import type { EmailAdapter } from "./adapters/email.js";
import type { StorageAdapter } from "./adapters/storage.js";
import type { TelegramAdapter } from "./adapters/telegram.js";
import type { Config } from "./config.js";
import type { Sql } from "./db.js";
import type { JwksSource } from "./security/oidc.js";

export type Deps = {
  cfg: Config;
  sql: Sql;
  email: EmailAdapter;
  telegram: TelegramAdapter;
  storage: StorageAdapter;
  waitUntil: (p: Promise<unknown>) => void;
  telegramJwks?: JwksSource;
};
