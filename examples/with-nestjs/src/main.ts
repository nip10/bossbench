import "reflect-metadata";
import { bossbench } from "@bossbench/nestjs";
import { Controller, Get, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { Pool } from "pg";
import { PgBoss } from "pg-boss";

@Controller()
class AppController {
  @Get()
  health() {
    return { ok: true };
  }
}
@Module({ controllers: [AppController] })
class AppModule {}

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:54329/bossbench";
const schema = process.env.PGBOSS_SCHEMA ?? "pgboss";
const boss = new PgBoss({ connectionString, schema });
const db = new Pool({ connectionString });
await boss.start();
const app = await NestFactory.create(AppModule);
await bossbench(app, "/jobs", {
  boss,
  db,
  schema,
  basePath: "/jobs",
  tags: ["teamId"],
  auth: {
    username: process.env.BOSSBENCH_USER ?? "admin",
    password: process.env.BOSSBENCH_PASS ?? "change-me",
  },
});
await app.listen(Number(process.env.PORT ?? 3000));
