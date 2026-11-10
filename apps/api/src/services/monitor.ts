import type { Deps } from "../deps.js";
import { enqueue, kick } from "./outbox.js";

const DB_LIMIT_BYTES = 500 * 1024 * 1024;
const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;

async function storageBytes(deps: Deps) {
  try {
    const [r] = await deps.sql<{ bytes: number }[]>`
      select coalesce(sum((metadata->>'size')::bigint), 0)::bigint as bytes from storage.objects`;
    return r?.bytes ?? 0;
  } catch {
    return null;
  }
}

export async function runDailyMonitor(deps: Deps) {
  const storage = await storageBytes(deps);
  const result = await deps.sql.begin(async (tx) => {
    const fresh = await tx`insert into monitor_runs (day) values (current_date) on conflict (day) do nothing returning day`;
    if (fresh.length === 0) return null;
    const [s] = await tx<{ failed: number; review: number; overdue: number; db_bytes: number; emails: number }[]>`
      select
        (select count(*)::int from outbox where status = 'failed' and created_at > now() - interval '7 days') as failed,
        (select count(*)::int from outbox where status = 'needs_review') as review,
        (select count(*)::int from outbox where status in ('pending', 'processing') and run_after < now() - interval '15 minutes') as overdue,
        pg_database_size(current_database()) as db_bytes,
        coalesce((select used from email_budget where day = current_date - 1), 0) as emails`;
    const issues: string[] = [];
    if (s!.failed) issues.push(`неотправленных уведомлений за неделю: ${s!.failed}`);
    if (s!.review) issues.push(`задач на ручной проверке: ${s!.review}`);
    if (s!.overdue) issues.push(`просроченных задач в очереди: ${s!.overdue}`);
    if (s!.db_bytes > DB_LIMIT_BYTES * 0.8) issues.push(`база заполнена на ${Math.round((s!.db_bytes / DB_LIMIT_BYTES) * 100)}% лимита`);
    if (storage !== null && storage > STORAGE_LIMIT_BYTES * 0.8) {
      issues.push(`хранилище файлов заполнено на ${Math.round((storage / STORAGE_LIMIT_BYTES) * 100)}% лимита`);
    }
    if (s!.emails > deps.cfg.EMAIL_DAILY_LIMIT * 0.8) issues.push(`вчера отправлено писем: ${s!.emails} из ${deps.cfg.EMAIL_DAILY_LIMIT}`);
    if (issues.length === 0) return { issues, ids: [] as string[] };

    const text = ["ARMORIX: ежедневная проверка", ...issues.map((i) => `• ${i}`), `${deps.cfg.SITE_URL}/admin/jobs`].join("\n");
    const day = new Date().toISOString().slice(0, 10);
    const ids = await enqueue(
      tx,
      deps.cfg.TELEGRAM_STAFF_CHAT_IDS.map((chat) => ({
        channel: "telegram" as const,
        topic: "monitor.daily",
        dedupeKey: `monitor:${day}:${chat}`,
        payload: { method: "sendMessage", params: { chat_id: chat, text, disable_web_page_preview: true } },
      })),
    );
    return { issues, ids };
  });
  if (!result) return null;
  kick(deps, result.ids);
  return { issues: result.issues };
}
