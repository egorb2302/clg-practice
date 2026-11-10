import { z } from "zod";

const bool = (def: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .optional()
    .transform((v) => (v === undefined ? def : v === "true" || v === "1"));

const list = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []));

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().int().default(3350),
  DATABASE_URL: z.string().min(1),
  SITE_URL: z.url(),
  ALLOWED_ORIGINS: list,
  APP_SECRET: z.string().min(32),
  TOTP_ENC_KEY: z.string().min(40),
  JOBS_SECRET: z.string().min(24),
  COOKIE_SECURE: bool(true),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),

  EMAIL_TRANSPORT: z.enum(["log", "smtp"]).default("log"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().default("ARMORIX <no-reply@armorix.local>"),
  EMAIL_DAILY_LIMIT: z.coerce.number().int().positive().default(400),
  STAFF_NOTIFY_EMAILS: list,

  TELEGRAM_TRANSPORT: z.enum(["log", "http"]).default("log"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(16).optional(),
  TELEGRAM_STAFF_CHAT_IDS: list,

  STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
  LOCAL_MEDIA_DIR: z.string().default(".local/media"),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  STORAGE_UPLOAD_BUCKET: z.string().default("uploads"),
  STORAGE_PUBLIC_BUCKET: z.string().default("catalog"),

  FEATURE_ACCOUNT: bool(false),
  FEATURE_LOYALTY: bool(false),
  FEATURE_OFFERS: bool(false),
  FEATURE_NEWS: bool(false),
  FEATURE_CAMPAIGNS: bool(false),

  LEAD_LIMIT_IP_PER_HOUR: z.coerce.number().int().positive().default(10),
  LEAD_LIMIT_CONTACT_PER_HOUR: z.coerce.number().int().positive().default(5),
  LEAD_MIN_FILL_MS: z.coerce.number().int().nonnegative().default(3000),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid configuration: ${keys}`);
  }
  const c = parsed.data;
  if (c.EMAIL_TRANSPORT === "smtp" && (!c.SMTP_HOST || !c.SMTP_USER || !c.SMTP_PASS)) {
    throw new Error("Invalid configuration: SMTP_HOST, SMTP_USER, SMTP_PASS required for smtp transport");
  }
  if (c.TELEGRAM_TRANSPORT === "http" && !c.TELEGRAM_BOT_TOKEN) {
    throw new Error("Invalid configuration: TELEGRAM_BOT_TOKEN required for http transport");
  }
  if (c.STORAGE_DRIVER === "supabase" && (!c.SUPABASE_URL || !c.SUPABASE_SERVICE_KEY)) {
    throw new Error("Invalid configuration: SUPABASE_URL, SUPABASE_SERVICE_KEY required for supabase storage");
  }
  return c;
}
