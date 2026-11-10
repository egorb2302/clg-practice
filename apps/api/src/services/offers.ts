import type { Db, Tx } from "../db.js";
import { HttpError } from "../http/errors.js";

const bad = (msg: string) => new HttpError(422, "VALIDATION", msg, { fieldErrors: { offerId: msg } });

export async function priorPurchases(db: Db, userId: string, excludeSaleId: string | null) {
  const [r] = await db<{ n: number }[]>`
    select count(*)::int as n from sales
    where client_user_id = ${userId} and status in ('confirmed', 'partially_refunded')
      ${excludeSaleId ? db`and id <> ${excludeSaleId}` : db``}`;
  return r?.n ?? 0;
}

export async function checkOffer(tx: Tx, offerId: string, saleId: string, clientId: string | null) {
  const [o] = await tx<{ status: string; active: boolean; min_purchases: number | null; variant_ids: string[]; rule_version: number }[]>`
    select p.status, (coalesce(p.starts_at <= now(), true) and coalesce(p.ends_at > now(), true)) as active,
      r.min_purchases, r.variant_ids, r.rule_version
    from posts p join offer_rules r on r.post_id = p.id
    where p.id = ${offerId} and p.type = 'offer'`;
  if (!o || o.status !== "published") throw bad("Акция не найдена или не опубликована");
  if (!o.active) throw bad("Срок акции истёк или ещё не начался");
  if (o.min_purchases) {
    if (!clientId) throw bad("Акция требует кабинета клиента");
    const n = await priorPurchases(tx, clientId, saleId);
    if (n < o.min_purchases) throw bad(`Нужно подтверждённых покупок: ${o.min_purchases}, у клиента ${n}`);
  }
  if (o.variant_ids.length) {
    const [hit] = await tx`
      select 1 from sale_items i
      where i.sale_id = ${saleId} and i.variant_id in ${tx(o.variant_ids)} limit 1`;
    if (!hit) throw bad("В покупке нет товаров, на которые действует акция");
  }
  return o.rule_version;
}
