import { waitUntil } from "@vercel/functions";
import { createEmail } from "./adapters/email.js";
import { createStorage } from "./adapters/storage.js";
import { createTelegram } from "./adapters/telegram.js";
import { createApp } from "./application.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";

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
