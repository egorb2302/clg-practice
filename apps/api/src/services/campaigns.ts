import type { Deps } from "../deps";
import { hmac } from "../security/crypto";
import { enqueue } from "./outbox";

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

export async function dispatchCampaigns(deps: Deps) {
  const due = await deps.sql<{ id: string; subject: string; body_text: string; status: string }[]>`
    update campaigns set status = 'sending', updated_at = now()
    where status = 'scheduled' and scheduled_at <= now()
    returning id, subject, body_text, status`;
  const sending = await deps.sql<{ id: string; subject: string; body_text: string }[]>`
    select id, subject, body_text from campaigns where status = 'sending'`;
  const ids: string[] = [];
  for (const c of sending) {
    const jobIds = await deps.sql.begin(async (tx) => {
      const [locked] = await tx`select id from campaigns where id = ${c.id} and status = 'sending' for update skip locked`;
      if (!locked) return [];
      if (due.some((d) => d.id === c.id)) {
        await tx`
          insert into campaign_deliveries (campaign_id, subscription_id)
          select ${c.id}, s.id from subscriptions s where s.status = 'active'
          on conflict do nothing`;
      }
      const batch = await tx<{ subscription_id: string; email: string }[]>`
        select d.subscription_id, s.email from campaign_deliveries d join subscriptions s on s.id = d.subscription_id
        where d.campaign_id = ${c.id} and d.outbox_id is null and d.status = 'queued'
        limit ${BATCH}`;
      const created: string[] = [];
      for (const d of batch) {
        const [jobId] = await enqueue(tx, [
          {
            channel: "email",
            topic: "campaign",
            dedupeKey: `campaign:${c.id}:${d.subscription_id}`,
            payload: { ...campaignMessage(deps, c, { id: d.subscription_id, email: d.email }), subscriptionId: d.subscription_id } as never,
          },
        ]);
        if (jobId) {
          await tx`update campaign_deliveries set outbox_id = ${jobId}, updated_at = now()
            where campaign_id = ${c.id} and subscription_id = ${d.subscription_id}`;
          created.push(jobId);
        }
      }
      if (batch.length < BATCH) await tx`update campaigns set status = 'done', updated_at = now() where id = ${c.id}`;
      return created;
    });
    ids.push(...jobIds);
  }
  return ids.length;
}
