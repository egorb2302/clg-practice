import type { EmailMessage } from "../adapters/email";
import { PermanentError, RetryLaterError } from "../adapters/errors";
import type { Db } from "../db";
import type { Deps } from "../deps";

export type OutboxJob =
  | { channel: "email"; topic: string; dedupeKey: string; payload: EmailMessage }
  | { channel: "telegram"; topic: string; dedupeKey: string; payload: { method: string; params: Record<string, unknown> } };

export async function enqueue(db: Db, jobs: OutboxJob[]): Promise<string[]> {
  const ids: string[] = [];
  for (const j of jobs) {
    const rows = await db<{ id: string }[]>`
      insert into outbox (channel, topic, dedupe_key, payload)
      values (${j.channel}, ${j.topic}, ${j.dedupeKey}, ${db.json(j.payload as never)})
      on conflict (dedupe_key) do nothing
      returning id`;
    if (rows[0]) ids.push(rows[0].id);
  }
  return ids;
}

type Row = {
  id: string;
  channel: "email" | "telegram";
  topic: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
};

const backoffSec = (attempt: number) => Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));

async function claim(db: Db, limit: number, ids?: string[]) {
  const onlyIds = ids && ids.length > 0;
  return db<Row[]>`
    update outbox set status = 'processing', attempts = attempts + 1, lease_until = now() + interval '2 minutes'
    where id in (
      select id from outbox
      where ((status = 'pending' and run_after <= now()) or (status = 'processing' and lease_until < now()))
      ${onlyIds ? db`and id in ${db(ids)}` : db``}
      order by run_after
      limit ${limit}
      for update skip locked
    )
    returning id, channel, topic, payload, attempts, max_attempts`;
}

async function emailBudgetLeft(deps: Deps) {
  const [r] = await deps.sql<{ n: number }[]>`
    select count(*)::int as n from outbox
    where channel = 'email' and status = 'sent' and sent_at > now() - interval '24 hours'`;
  return deps.cfg.EMAIL_DAILY_LIMIT - (r?.n ?? 0);
}

export async function runJobs(deps: Deps, opts: { ids?: string[]; limit?: number; budgetMs?: number } = {}) {
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 50_000;
  const result = { sent: 0, retried: 0, failed: 0, deferred: 0 };
  let emailLeft = await emailBudgetLeft(deps);

  while (Date.now() - started < budgetMs) {
    const batch = await claim(deps.sql, opts.limit ?? 10, opts.ids);
    if (batch.length === 0) break;
    for (const job of batch) {
      if (job.channel === "email" && emailLeft <= 0) {
        await deps.sql`
          update outbox set status = 'pending', attempts = attempts - 1, lease_until = null,
            run_after = now() + interval '1 hour', last_error = 'daily email limit'
          where id = ${job.id}`;
        result.deferred++;
        continue;
      }
      try {
        if (job.channel === "email") {
          await deps.email.send(job.payload as EmailMessage);
          emailLeft--;
        } else {
          const p = job.payload as { method: string; params: Record<string, unknown> };
          await deps.telegram.call(p.method, p.params);
        }
        await deps.sql`
          update outbox set status = 'sent', sent_at = now(), lease_until = null, last_error = null
          where id = ${job.id}`;
        result.sent++;
      } catch (e) {
        const msg = (e as Error).message.slice(0, 300);
        const permanent = e instanceof PermanentError;
        const exhausted = job.attempts >= job.max_attempts;
        if (permanent || exhausted) {
          await deps.sql`
            update outbox set status = 'failed', lease_until = null, last_error = ${msg} where id = ${job.id}`;
          result.failed++;
        } else {
          const delay = e instanceof RetryLaterError ? e.retryAfterSec : backoffSec(job.attempts);
          await deps.sql`
            update outbox set status = 'pending', lease_until = null, last_error = ${msg},
              run_after = now() + make_interval(secs => ${delay})
            where id = ${job.id}`;
          result.retried++;
        }
      }
    }
    if (opts.ids) break;
  }
  return result;
}

export function kick(deps: Deps, ids: string[]) {
  if (ids.length === 0) return;
  deps.waitUntil(
    runJobs(deps, { ids, budgetMs: 20_000 }).catch((e) =>
      console.error(JSON.stringify({ level: "error", event: "outbox.kick", error: String(e) })),
    ),
  );
}
