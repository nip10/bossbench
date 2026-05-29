import { dirname, relative } from "node:path";

export function relativeImport(fromFile: string, toFile: string) {
  const path = relative(dirname(fromFile), toFile)
    .replace(/\\/g, "/")
    .replace(/\.ts$/, "");
  return path.startsWith(".") ? path : `./${path}`;
}
