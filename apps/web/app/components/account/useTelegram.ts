import type { SessionResponse } from "@armorix/contracts";
import { useEffect, useRef, useState } from "react";
import { loadTelegram, send, setCsrf } from "../../lib/account";

type Phase = "idle" | "loading" | "ready" | "waiting" | "sending" | "off";
type Prep = { lib: Awaited<ReturnType<typeof loadTelegram>>; nonce: string; clientId: number; at: number };
type Opts = {
  purpose: "login" | "link";
  onLogin?: (s: SessionResponse) => void;
  onLinked?: () => void;
  onReauth?: () => void;
};

const OFF_KEY = "armorix-tg-off";

export function useTelegram({ purpose, onLogin, onLinked, onReauth }: Opts) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const prep = useRef<Prep | null>(null);
  const cbs = useRef({ onLogin, onLinked, onReauth });
  cbs.current = { onLogin, onLinked, onReauth };

  useEffect(() => {
    try { if (sessionStorage.getItem(OFF_KEY)) setPhase("off"); } catch { /* storage blocked */ }
  }, []);

  async function prepare(): Promise<boolean> {
    setError("");
    setPhase("loading");
    const [lib, n] = await Promise.all([
      loadTelegram().catch(() => null),
      send<{ nonce: string; clientId: number; purpose: string }>("POST", "/auth/telegram/nonce"),
    ]);
    if (n.status === 404) {
      try { sessionStorage.setItem(OFF_KEY, "1"); } catch { /* storage blocked */ }
      setPhase("off");
      return false;
    }
    if (!lib || !n.body) {
      setError(n.status === 429 ? "Слишком много попыток, попробуйте через час" : "Не удалось открыть вход через Telegram, попробуйте еще раз");
      setPhase("idle");
      return false;
    }
    prep.current = { lib, nonce: n.body.nonce, clientId: n.body.clientId, at: Date.now() };
    setPhase("ready");
    return true;
  }

  async function finish(idToken: string, nonce: string) {
    setPhase("sending");
    if (purpose === "login") {
      const r = await send<SessionResponse>("POST", "/auth/telegram", { idToken, nonce });
      if (r.body) {
        setCsrf(r.body.csrfToken);
        cbs.current.onLogin?.(r.body);
        return;
      }
      setError(r.status === 403 ? (r.error?.message ?? "Вход через Telegram недоступен") : r.status === 429 ? "Слишком много попыток, попробуйте через час" : "Не удалось подтвердить вход через Telegram, попробуйте еще раз");
    } else {
      const r = await send<{ linked: boolean }>("POST", "/me/identities/telegram", { idToken, nonce });
      if (r.body) {
        setPhase("idle");
        cbs.current.onLinked?.();
        return;
      }
      if (r.status === 401) {
        setPhase("idle");
        cbs.current.onReauth?.();
        return;
      }
      setError(r.status === 409 ? "Этот Telegram уже привязан к другому кабинету. Позвоните менеджеру, и разберемся" : "Не удалось привязать Telegram, попробуйте еще раз");
    }
    setPhase("idle");
  }

  function open() {
    const p = prep.current;
    if (!p) { void prepare(); return; }
    if (Date.now() - p.at > 9 * 60_000) { prep.current = null; void prepare(); return; }
    setError("");
    setPhase("waiting");
    try {
      p.lib.auth({ client_id: p.clientId, nonce: p.nonce, scope: ["profile", "phone"], lang: "ru" }, (res) => {
        prep.current = null;
        if (res.id_token) { void finish(res.id_token, p.nonce); return; }
        setError(res.error === "popup_closed" ? "Окно Telegram закрыли, вход не выполнен" : "Telegram не подтвердил вход, попробуйте еще раз");
        setPhase("idle");
      });
    } catch {
      prep.current = null;
      setError("Не удалось открыть окно Telegram, попробуйте еще раз");
      setPhase("idle");
    }
  }

  function reset() {
    prep.current = null;
    setError("");
    setPhase((p) => (p === "off" ? p : "idle"));
  }

  return { phase, error, prepare, open, reset };
}
