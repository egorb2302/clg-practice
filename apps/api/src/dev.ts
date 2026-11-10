import { createEmail } from "./adapters/email.js";
import { createStorage } from "./adapters/storage.js";
import { createTelegram } from "./adapters/telegram.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db.js";
import { runJobs } from "./services/outbox.js";

const cfg = loadConfig();
const sql = createDb(cfg.DATABASE_URL, { max: 4 });
const pending = new Set<Promise<unknown>>();
const deps = {
  cfg,
  sql,
  email: createEmail(cfg),
  telegram: createTelegram(cfg),
  storage: createStorage(cfg, ""),
  waitUntil: (p: Promise<unknown>) => {
    pending.add(p);
    p.finally(() => pending.delete(p));
  },
};

createApp(deps).listen(cfg.PORT, "127.0.0.1", () => {
  console.log(`api on http://localhost:${cfg.PORT}`);
});

setInterval(() => {
  runJobs(deps, { budgetMs: 10_000 }).catch((e) => console.error("jobs", e));
}, 60_000);
