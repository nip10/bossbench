import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { confirm, intro, isCancel, note, outro, text } from "@clack/prompts";
import pc from "picocolors";
import { detectFramework } from "../lib/framework-detect.js";
import { INJECTORS } from "../lib/inject/index.js";
import { detectPackageManager } from "../lib/package-manager.js";
import { generatePassword } from "../lib/password.js";

export interface InitOptions {
  cwd: string;
  mount: string;
  auth: boolean;
  docker: boolean;
  yes: boolean;
  dryRun: boolean;
}

export interface InitResult {
  framework: string;
  entry: string | null;
  injection: InjectionResult;
  install: string;
  envPath: string;
}

export async function initCommand(
  cwd = ".",
  options: Partial<InitOptions> = {},
) {
  return init({
    cwd,
    mount: options.mount ?? "/jobs",
    auth: options.auth ?? true,
    docker: options.docker ?? true,
    yes: options.yes ?? true,
    dryRun: options.dryRun ?? false,
  });
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface InjectionResult {
  ok: boolean;
  path: string | null;
  source: string;
  reason?: string;
}

export async function init(opts: InitOptions): Promise<InitResult | undefined> {
  const cwd = resolve(opts.cwd);
  console.log();
  intro(pc.bgCyan(pc.black(" Bossbench ")));

  const pkgPath = join(cwd, "package.json");
  if (!existsSync(pkgPath)) throw new Error(`No package.json found in ${cwd}`);

  const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PackageJson;
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const detected = await detectFramework(cwd, deps);
  if (!detected) throw new Error("no supported framework detected");

  const pm = detectPackageManager(cwd);
  let mountPath = opts.mount;
  let enableAuth = opts.auth;
  let writeDocker = opts.docker;

  if (!opts.yes) {
    const mountAnswer = await text({
      message: "Mount path",
      initialValue: mountPath,
    });
    if (isCancel(mountAnswer)) return;
    mountPath = String(mountAnswer);
    const authAnswer = await confirm({
      message: "Protect with basic auth?",
      initialValue: enableAuth,
    });
    if (isCancel(authAnswer)) return;
    enableAuth = Boolean(authAnswer);
    const dockerAnswer = await confirm({
      message: "Write docker-compose.yml for Postgres?",
      initialValue: writeDocker,
    });
    if (isCancel(dockerAnswer)) return;
    writeDocker = Boolean(dockerAnswer);
  }

  const envPath = join(cwd, ".env.example");
  const env = buildEnvExample(readText(envPath), enableAuth);
  const injector = INJECTORS[detected.framework] as (input: {
    cwd: string;
    entry: string | null;
    mountPath: string;
    withAuth: boolean;
  }) => Promise<InjectionResult>;
  const injection = await injector({
    cwd,
    entry: detected.entry,
    mountPath,
    withAuth: enableAuth,
  });

  if (!opts.dryRun) {
    writeFileSync(envPath, env);
    if (injection.ok && injection.path) {
      mkdirSync(dirname(injection.path), { recursive: true });
      writeFileSync(injection.path, injection.source);
    }
    if (writeDocker && !existsSync(join(cwd, "docker-compose.yml"))) {
      writeFileSync(join(cwd, "docker-compose.yml"), dockerCompose());
    }
  }

  const install = installCommand(
    pm,
    detected.framework,
    detected.adapterPackage,
  );
  note(
    [
      `Framework: ${detected.framework}`,
      `Entry: ${detected.entry ? relative(cwd, detected.entry) : "n/a"}`,
      `Install: ${install}`,
      injection.ok
        ? `Updated: ${injection.path ? relative(cwd, injection.path) : "n/a"}`
        : `Manual step: ${injection.reason}`,
      `Auth env: ${enableAuth ? "BOSSBENCH_USER/BOSSBENCH_PASS" : "disabled"}`,
    ].join("\n"),
    "Next steps",
  );
  outro(pc.green("Bossbench is ready."));

  return {
    framework: detected.framework,
    entry: detected.entry,
    injection,
    install,
    envPath,
  };
}

function buildEnvExample(existing: string | undefined, withAuth: boolean) {
  const rawLines = (existing ?? "").split(/\r?\n/);
  const lines = rawLines.filter(
    (line, index) => line || index < rawLines.length - 1,
  );
  const keys = new Set<string>();

  for (const line of lines) {
    const match = /^([A-Z0-9_]+)=/.exec(line);
    if (match?.[1]) keys.add(match[1]);
  }

  if (!keys.has("DATABASE_URL"))
    lines.push("DATABASE_URL=postgres://localhost:5432/postgres");
  if (withAuth) {
    if (!keys.has("BOSSBENCH_USER")) lines.push("BOSSBENCH_USER=admin");
    if (!keys.has("BOSSBENCH_PASS"))
      lines.push(`BOSSBENCH_PASS=${generatePassword()}`);
  }
  return `${lines.join("\n")}\n`;
}

function adapterPackageIsAvailable(framework: string) {
  return ["hono", "express", "fastify", "elysia", "nestjs", "next"].includes(
    framework,
  );
}

function installCommand(pm: string, framework: string, adapterPackage: string) {
  const packages =
    framework === "nestjs"
      ? `${adapterPackage} @bossbench/express @bossbench/fastify pg pg-boss`
      : `${adapterPackage} pg pg-boss`;
  return adapterPackageIsAvailable(framework)
    ? `${pm} add ${packages}`
    : `${adapterPackage} is pending in issue #4; install pg pg-boss now and add the adapter after it lands`;
}
function dockerCompose() {
  return `services:\n  postgres:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: postgres\n      POSTGRES_DB: postgres\n    ports:\n      - "5432:5432"\n`;
}
function readText(path: string) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}
