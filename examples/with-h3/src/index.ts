import { bossbench } from "@bossbench/h3";
import { createApp, toWebHandler } from "h3";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("Set DATABASE_URL before mounting Bossbench");

const handler = bossbench({
  db: databaseUrl,
  basePath: "/jobs",
  auth: {
    username: process.env.BOSSBENCH_USER ?? "admin",
    password: process.env.BOSSBENCH_PASS ?? "change-me",
  },
});

const app = createApp().use("/jobs", handler).use("/jobs/**", handler);

export default {
  fetch: toWebHandler(app),
};
