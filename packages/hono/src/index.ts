import type { BossbenchOptions } from "@bossbench/core";
import { BossbenchCore, buildBossbenchApp } from "@bossbench/core";
import type { Hono } from "hono";

export function bossbench(options: BossbenchOptions): Hono {
  return buildBossbenchApp(BossbenchCore.create(options));
}
