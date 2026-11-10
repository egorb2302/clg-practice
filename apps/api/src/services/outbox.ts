import type { EmailMessage } from "../adapters/email";
import { PermanentError, RetryLaterError } from "../adapters/errors";
import type { Db, Sql } from "../db";
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

export async function reserveEmail(sql: Sql, limit: number) {
  const rows = await sql`
    insert into email_budget (day, used) values (current_date, 1)
    on conflict (day) do update set used = email_budget.used + 1
    where email_budget.used < ${limit}
    returning used`;
  return rows.length > 0 && Number(rows[0]!.used) <= limit;
}

export async function releaseEmail(sql: Sql) {
  await sql`update email_budget set used = greatest(used - 1, 0) where day = current_date`;
}

export const authEmailReserve = (limit: number) => Math.min(50, Math.floor(limit / 5));
export const queueEmailLimit = (limit: number) => limit - authEmailReserve(limit);

const SEND_DEADLINE_MS = 60_000;

function withDeadline<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("send deadline exceeded")), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

type Row = {
  id: string;
  channel: "email" | "telegram";
  topic: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
  lease_token: string;
};

const LEASE_SEC = 120;
const PER_JOB_MS = 15_000;
const backoffSec = (attempt: number) => Math.min(3600, 30 * 2 ** Math.max(0, attempt - 1));

async function claimOne(db: Db, ids?: string[]) {
  const onlyIds = ids && ids.length > 0;
  await db`
    update outbox set status = 'failed', lease_until = null, lease_token = null,
      last_error = coalesce(last_error, 'lease expired too many times')
    where status = 'processing' and lease_until < now() and attempts >= max_attempts`;
  const [row] = await db<Row[]>`
    update outbox set status = 'processing', attempts = attempts + 1,
      lease_until = now() + make_interval(secs => ${LEASE_SEC}), lease_token = gen_random_uuid()
    where id = (
      select id from outbox
      where ((status = 'pending' and run_after <= now()) or (status = 'processing' and lease_until < now()))
        and attempts < max_attempts
      ${onlyIds ? db`and id in ${db(ids)}` : db``}
      order by run_after
      limit 1
      for update skip locked
    )
    returning id, channel, topic, payload, attempts, max_attempts, lease_token`;
  return row ?? null;
}

type Outcome =
  | { status: "sent" }
  | { status: "failed"; error: string }
  | { status: "pending"; error: string; delaySec: number; refundAttempt?: boolean };

async function finish(db: Db, job: Row, o: Outcome) {
  const error = o.status === "sent" ? null : o.error;
  const delay = o.status === "pending" ? o.delaySec : 0;
  const refund = o.status === "pending" && o.refundAttempt ? 1 : 0;
  await db`
    update outbox set status = ${o.status}, last_error = ${error},
      sent_at = case when ${o.status} = 'sent' then now() else sent_at end,
      run_after = case when ${o.status} = 'pending' then now() + make_interval(secs => ${delay}) else run_after end,
      attempts = attempts - ${refund},
      lease_until = null, lease_token = null
    where id = ${job.id} and status = 'processing' and lease_token = ${job.lease_token}`;
}

export async function runJobs(deps: Deps, opts: { ids?: string[]; budgetMs?: number } = {}) {
  const started = Date.now();
  const budgetMs = opts.budgetMs ?? 50_000;
  const result = { sent: 0, retried: 0, failed: 0, deferred: 0 };
  const sql = deps.sql;
  let processed = 0;

  while (processed === 0 || Date.now() - started + PER_JOB_MS <= budgetMs) {
    const job = await claimOne(sql, opts.ids);
    if (!job) break;
    processed++;
    if (job.channel === "email" && !(await reserveEmail(sql, queueEmailLimit(deps.cfg.EMAIL_DAILY_LIMIT)))) {
      await finish(sql, job, { status: "pending", error: "daily email limit", delaySec: 3600, refundAttempt: true });
      result.deferred++;
      continue;
    }
    try {
      if (job.channel === "email") {
        await withDeadline(deps.email.send(job.payload as EmailMessage), SEND_DEADLINE_MS);
      } else {
        const p = job.payload as { method: string; params: Record<string, unknown> };
        await withDeadline(deps.telegram.call(p.method, p.params), SEND_DEADLINE_MS);
      }
      await finish(sql, job, { status: "sent" });
      result.sent++;
    } catch (e) {
      const error = (e as Error).message.slice(0, 300);
      if (job.channel === "email" && !(e instanceof PermanentError)) await releaseEmail(sql);
      if (e instanceof PermanentError || job.attempts >= job.max_attempts) {
        await finish(sql, job, { status: "failed", error });
        result.failed++;
      } else {
        const delaySec = e instanceof RetryLaterError ? e.retryAfterSec : backoffSec(job.attempts);
        await finish(sql, job, { status: "pending", error, delaySec });
        result.retried++;
      }
    }
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
