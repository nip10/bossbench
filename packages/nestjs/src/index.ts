import type { BossbenchOptions } from "@bossbench/core";
import type { INestApplication } from "@nestjs/common";

export async function bossbench(
  app: INestApplication,
  path: string,
  options: BossbenchOptions,
): Promise<void> {
  const adapter = app.getHttpAdapter();
  if (adapter.getType() === "fastify") {
    const { bossbench: fastifyBossbench } = await import("@bossbench/fastify");
    await (
      adapter.getInstance() as {
        register: (
          plugin: unknown,
          opts?: { prefix?: string },
        ) => Promise<void>;
      }
    ).register(fastifyBossbench(options), { prefix: path });
    return;
  }
  const { bossbench: expressBossbench } = await import("@bossbench/express");
  app.use(path, expressBossbench(options));
}
