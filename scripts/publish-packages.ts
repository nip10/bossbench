// Replacement for `changeset publish`. changesets/cli always shells out to plain
// `npm publish`, which has no idea what the `workspace:` protocol is — so any internal
// dependency still declared as `workspace:*` (unbumped by that release) gets published
// to npm verbatim, producing an uninstallable package for every consumer outside this
// monorepo. `bun publish`/`bun pm pack` rewrite `workspace:*` to the real resolved
// version correctly, but `bun publish` has no `--provenance` support yet, so this script
// packs with bun (correct rewrite) and publishes the resulting tarball with `npm publish`
// (keeps npm provenance/OIDC attestation working, since that's still the real npm CLI).
//
// Invoked as the `publish:` script from changesets/action (see .github/workflows/release.yml).
// The action sets CHANGESETS_OUTPUT to a path where it expects one JSON line per published
// package — {"type":"git-tag","tag":"<name>@<version>","packageName":"<name>"} — and takes
// care of pushing that git tag and creating the GitHub release itself; this script's job
// stops at "publish the right bytes to npm" and reporting what it published.
import { spawnSync } from "node:child_process";
import { appendFileSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PACKAGES_DIR = join(ROOT, "packages");

type PackageJson = {
  name: string;
  private?: boolean;
  version: string;
};

function readPackageJson(dir: string): PackageJson | null {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

function isAlreadyPublished(name: string, version: string): boolean {
  const result = spawnSync("npm", ["view", `${name}@${version}`, "version"], {
    encoding: "utf8",
  });
  return result.status === 0 && result.stdout.trim() === version;
}

function publishPackage(dir: string, pkg: PackageJson) {
  console.log(`Publishing ${pkg.name}@${pkg.version}...`);

  // Diff the directory instead of parsing `bun pm pack`'s stdout for the tarball name —
  // its console output isn't a stable contract (confirmed: the filename isn't reliably
  // the last line, it varies between local runs and CI).
  const tgzBefore = new Set(readdirSync(dir).filter((f) => f.endsWith(".tgz")));
  const pack = spawnSync("bun", ["pm", "pack"], { cwd: dir, encoding: "utf8" });
  if (pack.status !== 0) {
    throw new Error(`bun pm pack failed for ${pkg.name}:\n${pack.stderr}`);
  }
  const tarballName = readdirSync(dir)
    .filter((f) => f.endsWith(".tgz"))
    .find((f) => !tgzBefore.has(f));
  if (!tarballName) {
    throw new Error(
      `bun pm pack for ${pkg.name} did not produce a new .tgz file. stdout:\n${pack.stdout}`,
    );
  }
  const tarballPath = join(dir, tarballName);

  try {
    const publish = spawnSync(
      "npm",
      ["publish", tarballPath, "--access", "public", "--provenance"],
      { cwd: dir, stdio: "inherit" },
    );
    if (publish.status !== 0) {
      throw new Error(`npm publish failed for ${pkg.name}@${pkg.version}`);
    }
  } finally {
    rmSync(tarballPath, { force: true });
  }
}

function recordPublishedTag(
  outputPath: string | undefined,
  tag: string,
  packageName: string,
) {
  if (!outputPath) return;
  appendFileSync(
    outputPath,
    `${JSON.stringify({ type: "git-tag", tag, packageName })}\n`,
  );
}

function main() {
  const outputPath = process.env.CHANGESETS_OUTPUT;
  if (!outputPath) {
    // changesets/action doesn't always set this — e.g. its "no pending changesets,
    // try publishing anything unpublished" fallback path invokes the publish script
    // without it. Warn and continue rather than failing the whole run: publishing still
    // needs to happen, it's only git-tag/GitHub-release creation for this run that's lost.
    console.warn(
      "CHANGESETS_OUTPUT is not set — publishing will proceed, but git tags and GitHub releases won't be created for this run.",
    );
  } else {
    // Ensure the file exists even if nothing needs publishing this run, so the action
    // doesn't warn about a missing output file for the (common, expected) no-op case.
    appendFileSync(outputPath, "");
  }

  const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PACKAGES_DIR, entry.name));

  let publishedCount = 0;
  for (const dir of packageDirs) {
    const pkg = readPackageJson(dir);
    if (!pkg || pkg.private) continue;

    if (isAlreadyPublished(pkg.name, pkg.version)) {
      console.log(`${pkg.name}@${pkg.version} is already published, skipping.`);
      continue;
    }

    publishPackage(dir, pkg);
    publishedCount += 1;

    recordPublishedTag(outputPath, `${pkg.name}@${pkg.version}`, pkg.name);
  }

  console.log(
    publishedCount > 0
      ? `Published ${publishedCount} package(s).`
      : "No packages needed publishing.",
  );
}

main();
