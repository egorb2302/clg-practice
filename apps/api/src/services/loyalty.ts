import type { Db, Sql, Tx } from "../db";
import { HttpError } from "../http/errors";

export type AwardStatus = "pending" | "credited" | "ineligible";

type Rule = {
  id: string;
  version: number;
  points: number;
  confirm_days: number;
  points_ttl_days: number | null;
  kopecks_per_point: number;
  redeem_limit_pct: number;
};

export async function activeRule(db: Db): Promise<Rule | null> {
  const [r] = await db<Rule[]>`
    select id, version, points, confirm_days, points_ttl_days, kopecks_per_point, redeem_limit_pct
    from loyalty_rules where program = 'welcome' and active`;
  return r ?? null;
}

export async function hasVerifiedContact(db: Db, userId: string) {
  const [u] = await db<{ ok: boolean }[]>`
    select (email_verified_at is not null or phone_verified_at is not null
      or exists (select 1 from identities i where i.user_id = users.id)) as ok
    from users where id = ${userId}`;
  return Boolean(u?.ok);
}

export async function lockUser(tx: Tx, userId: string) {
  await tx`select id from users where id = ${userId} for update`;
}

export async function creditAward(tx: Tx, awardId: string, userId: string): Promise<AwardStatus> {
  await lockUser(tx, userId);
  const [a] = await tx<{ id: string; status: AwardStatus; points: number; rule_id: string; program: string; confirm_deadline: Date }[]>`
    select id, status, points, rule_id, program, confirm_deadline from loyalty_awards where id = ${awardId} for update`;
  if (!a) return "ineligible";
  if (a.status !== "pending") return a.status;
  if (a.confirm_deadline < new Date()) {
    await tx`update loyalty_awards set status = 'ineligible', user_id = ${userId} where id = ${a.id}`;
    return "ineligible";
  }
  const claimed = await tx`
    insert into loyalty_program_claims (user_id, program, award_id) values (${userId}, ${a.program}, ${a.id})
    on conflict (user_id, program) do nothing returning award_id`;
  if (claimed.length === 0) {
    await tx`update loyalty_awards set status = 'ineligible', user_id = ${userId} where id = ${a.id}`;
    return "ineligible";
  }
  const [rule] = await tx<{ points_ttl_days: number | null }[]>`select points_ttl_days from loyalty_rules where id = ${a.rule_id}`;
  await tx`
    insert into loyalty_ledger (user_id, type, points, award_id, rule_id, op_key, reason, expires_at)
    values (${userId}, 'earn', ${a.points}, ${a.id}, ${a.rule_id}, ${`earn:${a.id}`}, 'Приветственный бонус за заявку',
      ${rule?.points_ttl_days ? tx`now() + make_interval(days => ${rule.points_ttl_days})` : null})`;
  await tx`update loyalty_awards set status = 'credited', user_id = ${userId}, credited_at = now() where id = ${a.id}`;
  return "credited";
}

export async function awardForLead(
  tx: Tx,
  lead: { id: string; type: string },
  ownerId: string | null,
): Promise<AwardStatus | undefined> {
  if (lead.type !== "catalog" && lead.type !== "custom") return undefined;
  const rule = await activeRule(tx);
  if (!rule) return undefined;
  const [award] = await tx<{ id: string }[]>`
    insert into loyalty_awards (lead_id, rule_id, program, user_id, points, status, confirm_deadline)
    values (${lead.id}, ${rule.id}, 'welcome', ${ownerId}, ${rule.points}, 'pending',
      now() + make_interval(days => ${rule.confirm_days}))
    returning id`;
  if (ownerId && (await hasVerifiedContact(tx, ownerId))) return creditAward(tx, award!.id, ownerId);
  return "pending";
}

export async function balance(db: Db, userId: string) {
  const [r] = await db<{ points: number }[]>`
    select coalesce(sum(points), 0)::int as points from loyalty_ledger where user_id = ${userId}`;
  return r?.points ?? 0;
}

export async function redeemForSale(
  tx: Tx,
  input: { userId: string; saleId: string; points: number; amountKopecks: number; actor: string },
) {
  if (input.points <= 0) return;
  await lockUser(tx, input.userId);
  const rule = await activeRule(tx);
  if (!rule) throw new HttpError(409, "CONFLICT", "Бонусная программа не активна");
  const available = await balance(tx, input.userId);
  if (available <= 0 || input.points > available) {
    throw new HttpError(422, "VALIDATION", "Недостаточно баллов", { fieldErrors: { redeemPoints: `Доступно ${Math.max(available, 0)}` } });
  }
  const maxPoints = Math.floor((input.amountKopecks * rule.redeem_limit_pct) / 100 / rule.kopecks_per_point);
  if (input.points > maxPoints) {
    throw new HttpError(422, "VALIDATION", "Превышен лимит списания", { fieldErrors: { redeemPoints: `Не больше ${maxPoints}` } });
  }
  await tx`
    insert into loyalty_ledger (user_id, type, points, sale_id, rule_id, op_key, reason, actor_user_id)
    values (${input.userId}, 'redeem', ${-input.points}, ${input.saleId}, ${rule.id}, ${`redeem:${input.saleId}`},
      'Списание при подтверждении покупки', ${input.actor})`;
}

export async function returnRedeemed(tx: Tx, sale: { id: string; client_user_id: string | null; redeemed_points: number }, actor: string) {
  if (!sale.client_user_id || sale.redeemed_points <= 0) return;
  await tx`
    insert into loyalty_ledger (user_id, type, points, sale_id, op_key, reason, actor_user_id)
    values (${sale.client_user_id}, 'reverse', ${sale.redeemed_points}, ${sale.id}, ${`refund-return:${sale.id}`},
      'Возврат списанных баллов после возврата покупки', ${actor})
    on conflict (op_key) do nothing`;
}

export async function reverseAward(tx: Tx, awardId: string, reason: string, actor: string | null) {
  const [a] = await tx<{ user_id: string | null; points: number; status: string }[]>`
    select user_id, points, status from loyalty_awards where id = ${awardId}`;
  if (!a || a.status !== "credited" || !a.user_id) return false;
  const rows = await tx`
    insert into loyalty_ledger (user_id, type, points, award_id, op_key, reason, actor_user_id)
    values (${a.user_id}, 'reverse', ${-a.points}, ${awardId}, ${`reverse:${awardId}`}, ${reason}, ${actor})
    on conflict (op_key) do nothing returning id`;
  return rows.length > 0;
}

export async function expirePoints(sql: Sql) {
  const due = await sql<{ id: string; user_id: string; points: number }[]>`
    select l.id, l.user_id, l.points from loyalty_ledger l
    where l.type = 'earn' and l.expires_at < now()
      and not exists (select 1 from loyalty_expiry_checks c where c.earn_id = l.id)
    order by l.expires_at
    limit 200`;
  let expired = 0;
  for (const e of due) {
    await sql.begin(async (tx) => {
      const fresh = await tx`insert into loyalty_expiry_checks (earn_id) values (${e.id}) on conflict do nothing returning earn_id`;
      if (fresh.length === 0) return;
      await lockUser(tx, e.user_id);
      const amount = Math.min(e.points, Math.max(await balance(tx, e.user_id), 0));
      if (amount <= 0) return;
      await tx`
        insert into loyalty_ledger (user_id, type, points, op_key, reason)
        values (${e.user_id}, 'expire', ${-amount}, ${`expire:${e.id}`}, 'Истёк срок действия баллов')`;
      expired++;
    });
  }
  return expired;
}
