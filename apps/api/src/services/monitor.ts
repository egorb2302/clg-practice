import type { Deps } from "../deps";
import { enqueue, kick } from "./outbox";

const DB_LIMIT_BYTES = 500 * 1024 * 1024;

export async function runDailyMonitor(deps: Deps) {
  const fresh = await deps.sql`insert into monitor_runs (day) values (current_date) on conflict (day) do nothing returning day`;
  if (fresh.length === 0) return null;

  const [s] = await deps.sql<{ failed: number; review: number; overdue: number; db_bytes: number; emails: number }[]>`
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
  if (s!.emails > deps.cfg.EMAIL_DAILY_LIMIT * 0.8) issues.push(`вчера отправлено писем: ${s!.emails} из ${deps.cfg.EMAIL_DAILY_LIMIT}`);
  if (issues.length === 0) return { issues };

  const text = [`ARMORIX: ежедневная проверка`, ...issues.map((i) => `• ${i}`), `${deps.cfg.SITE_URL}/admin/jobs`].join("\n");
  const ids = await enqueue(
    deps.sql,
    deps.cfg.TELEGRAM_STAFF_CHAT_IDS.map((chat) => ({
      channel: "telegram" as const,
      topic: "monitor.daily",
      dedupeKey: `monitor:${new Date().toISOString().slice(0, 10)}:${chat}`,
      payload: { method: "sendMessage", params: { chat_id: chat, text, disable_web_page_preview: true } },
    })),
  );
  kick(deps, ids);
  return { issues };
}
