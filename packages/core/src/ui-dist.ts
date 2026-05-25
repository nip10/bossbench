import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const UI_DIST_PATH = join(dirname(fileURLToPath(import.meta.url)), "ui");
