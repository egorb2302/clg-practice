import type { Db } from "../db";
import { HttpError } from "../http/errors";

export async function hit(db: Db, key: string, limit: number, windowSec: number, now = new Date()) {
  const start = new Date(Math.floor(now.getTime() / 1000 / windowSec) * windowSec * 1000);
  const [row] = await db<{ count: number }[]>`
    insert into rate_limits (key, window_start, count) values (${key}, ${start}, 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  const count = row?.count ?? 1;
  const retryAfterSec = Math.max(1, Math.ceil((start.getTime() + windowSec * 1000 - now.getTime()) / 1000));
  return { allowed: count <= limit, retryAfterSec };
}

export async function enforce(db: Db, key: string, limit: number, windowSec: number) {
  const r = await hit(db, key, limit, windowSec);
  if (!r.allowed) {
    throw new HttpError(429, "RATE_LIMITED", "Слишком много попыток, попробуйте позже", {
      retryAfterSec: r.retryAfterSec,
    });
  }
}
