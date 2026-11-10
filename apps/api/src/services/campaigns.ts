import type { Deps } from "../deps.js";
import { hmac } from "../security/crypto.js";
import { enqueue, queueEmailLimit } from "./outbox.js";

const BATCH = 500;

export const subscriptionToken = (deps: Deps, id: string, purpose: "confirm" | "unsubscribe") =>
  hmac(deps.cfg.APP_SECRET, `sub:${purpose}:${id}`).toString("base64url");

export function unsubscribeLinks(deps: Deps, id: string) {
  const token = subscriptionToken(deps, id, "unsubscribe");
  const q = `id=${id}&token=${token}`;
  return {
    page: `${deps.cfg.SITE_URL}/unsubscribe?${q}`,
    oneClick: `${deps.cfg.SITE_URL}/api/v1/subscriptions/one-click?${q}`,
  };
}

export function campaignMessage(deps: Deps, c: { subject: string; body_text: string }, sub: { id: string; email: string }) {
  const links = unsubscribeLinks(deps, sub.id);
  return {
    to: sub.email,
    subject: c.subject,
    text: `${c.body_text}\n\nОтписаться от рассылки: ${links.page}`,
    headers: {
      "List-Unsubscribe": `<${links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

export function sendingDays(deps: Deps, recipients: number) {
  const perDay = Math.max(1, queueEmailLimit(deps.cfg.EMAIL_DAILY_LIMIT));
  return Math.max(1, Math.ceil(recipients / perDay));
}

export async function dispatchCampaigns(deps: Deps) {
  const due = await deps.sql<{ id: string }[]>`
    select id from campaigns where status in ('scheduled', 'sending') and scheduled_at <= now() order by scheduled_at`;
  let created = 0;
  for (const { id } of due) {
    created += await deps.sql.begin(async (tx) => {
      const [c] = await tx<{ id: string; status: string; subject: string; body_text: string }[]>`
        select id, status, subject, body_text from campaigns
        where id = ${id} and status in ('scheduled', 'sending') for update skip locked`;
      if (!c) return 0;
      if (c.status === "scheduled") {
        await tx`
          insert into campaign_deliveries (campaign_id, subscription_id)
          select ${c.id}, s.id from subscriptions s where s.status = 'active'
          on conflict do nothing`;
        await tx`update campaigns set status = 'sending', updated_at = now() where id = ${c.id}`;
      }
      const batch = await tx<{ subscription_id: string; email: string }[]>`
        select d.subscription_id, s.email from campaign_deliveries d join subscriptions s on s.id = d.subscription_id
        where d.campaign_id = ${c.id} and d.outbox_id is null and d.status = 'queued'
        limit ${BATCH}`;
      let n = 0;
      for (const d of batch) {
        const [jobId] = await enqueue(tx, [
          {
            channel: "email",
            topic: "campaign",
            dedupeKey: `campaign:${c.id}:${d.subscription_id}`,
            payload: { ...campaignMessage(deps, c, { id: d.subscription_id, email: d.email }), subscriptionId: d.subscription_id } as never,
          },
        ]);
        await tx`update campaign_deliveries set outbox_id = ${jobId ?? null}, status = ${jobId ? "queued" : "skipped"}, updated_at = now()
          where campaign_id = ${c.id} and subscription_id = ${d.subscription_id}`;
        if (jobId) n++;
      }
      const [left] = await tx<{ n: number }[]>`
        select count(*)::int as n from campaign_deliveries where campaign_id = ${c.id} and status = 'queued'`;
      if (left!.n === 0) await tx`update campaigns set status = 'done', updated_at = now() where id = ${c.id}`;
      return n;
    });
  }
  return created;
}
