import type { EmailAdapter } from "./adapters/email";
import type { StorageAdapter } from "./adapters/storage";
import type { TelegramAdapter } from "./adapters/telegram";
import type { Config } from "./config";
import type { Sql } from "./db";

export type Deps = {
  cfg: Config;
  sql: Sql;
  email: EmailAdapter;
  telegram: TelegramAdapter;
  storage: StorageAdapter;
  waitUntil: (p: Promise<unknown>) => void;
};
