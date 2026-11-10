import { Router } from "express";
import type { Deps } from "../deps";
import { notFound } from "../http/errors";
import { safeEqual } from "../security/crypto";
import { enqueue, kick } from "../services/outbox";

type Update = {
  update_id?: number;
  message?: { text?: string; chat?: { id?: number; type?: string } };
};

export function startPayloadPath(payload: string | undefined) {
  const m = payload?.match(/^p_([a-z0-9-]{1,60})$/);
  return m ? `/catalog/${m[1]}` : "/catalog";
}

export function telegramRoutes(deps: Deps) {
  const r = Router();

  r.post("/webhooks/telegram", async (req, res) => {
    const secret = deps.cfg.TELEGRAM_WEBHOOK_SECRET;
    const sent = req.header("x-telegram-bot-api-secret-token");
    if (!secret || !sent || !safeEqual(sent, secret)) throw notFound();

    const update = req.body as Update;
    if (typeof update?.update_id !== "number") {
      res.status(200).json({ ok: true });
      return;
    }
    const chatId = update.message?.chat?.id;
    const isPrivate = update.message?.chat?.type === "private";
    const text = update.message?.text?.trim() ?? "";

    const jobIds = await deps.sql.begin(async (tx) => {
      const fresh = await tx`
        insert into telegram_updates (update_id) values (${update.update_id!})
        on conflict (update_id) do nothing returning update_id`;
      if (fresh.length === 0 || !chatId || !isPrivate || !text) return [];
      const [contacts] = await tx<{ value: { telegram?: string } }[]>`select value from site_settings where key = 'contacts'`;
      const site = deps.cfg.SITE_URL;
      const payload = text.startsWith("/start") ? text.split(/\s+/)[1] : undefined;
      const contactUrl = contacts?.value.telegram?.startsWith("https://") ? contacts.value.telegram : `${site}/contacts`;
      return enqueue(tx, [
        {
          channel: "telegram",
          topic: "bot.reply",
          dedupeKey: `tg-update:${update.update_id}`,
          payload: {
            method: "sendMessage",
            params: {
              chat_id: chatId,
              text: "ARMORIX — защита бамперов для внедорожников. Подберите комплект в каталоге, оставьте заявку или свяжитесь с нами.",
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Каталог", url: `${site}${startPayloadPath(payload)}` }],
                  [{ text: "Оставить заявку", url: `${site}/contacts#form` }],
                  [{ text: "Связаться", url: contactUrl }],
                ],
              },
            },
          },
        },
      ]);
    });
    kick(deps, jobIds);
    res.status(200).json({ ok: true });
  });

  return r;
}
