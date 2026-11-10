import { waitUntil } from "@vercel/functions";
import { createEmail } from "./adapters/email";
import { createStorage } from "./adapters/storage";
import { createTelegram } from "./adapters/telegram";
import { createApp } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db";

const cfg = loadConfig();
const sql = createDb(cfg.DATABASE_URL);
const apiBase = process.env.API_PUBLIC_URL ?? cfg.SITE_URL;

const app = createApp({
  cfg,
  sql,
  email: createEmail(cfg),
  telegram: createTelegram(cfg),
  storage: createStorage(cfg, apiBase),
  waitUntil,
});

export default app;
