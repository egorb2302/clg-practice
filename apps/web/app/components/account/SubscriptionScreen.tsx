import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { fmtDate, fmtTime, send } from "../../lib/account";
import { useSite } from "../../lib/site";
import { Icon, type IconName } from "../site";
import { SubscribeForm } from "./SubscribeForm";

type Mode = "confirm" | "unsubscribe";
type State = "ask" | "ok" | "off" | "old" | "back";

const COPY: Record<State, (m: Mode) => { icon: IconName; h: string; t: string }> = {
  ask: (m) => m === "confirm"
    ? { icon: "mail", h: "Подтвердите подписку", t: "Нажмите кнопку, и будем присылать акции и новости мастерской на этот адрес. Без подтверждения письма не приходят" }
    : { icon: "mail", h: "Отписаться от рассылки", t: "Перестанем присылать акции и новости на этот адрес. Письма о ваших заявках и коды входа продолжат приходить" },
  ok: () => ({ icon: "check", h: "Адрес подтвержден", t: "Будем присылать акции и новости мастерской. Отписаться можно по ссылке в любом письме или в кабинете" }),
  off: () => ({ icon: "close", h: "Вы отписались", t: "Больше не будем присылать акции и новости на этот адрес. Письма о ваших заявках и коды входа продолжат приходить" }),
  old: (m) => m === "confirm"
    ? { icon: "clock", h: "Ссылка устарела", t: "Ссылка не сработала: возможно, она устарела или скопирована не целиком. Укажите адрес, и пришлем новое письмо" }
    : { icon: "clock", h: "Ссылка не сработала", t: "Возможно, ее скопировали не целиком. Отпишитесь по ссылке из последнего письма или в кабинете, в разделе «Профиль»" },
  back: () => ({ icon: "mail", h: "Вернуть подписку", t: "Укажите адрес, и пришлем письмо для подтверждения. Подписка заработает после нажатия ссылки в нем" }),
};

export function SubscriptionScreen({ mode, id, token }: { mode: Mode; id: string; token: string }) {
  const { meta } = useSite();
  const valid = /^[0-9a-f-]{36}$/i.test(id) && token.length >= 20;
  const [state, setState] = useState<State>(valid ? "ask" : "old");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [at, setAt] = useState<Date | null>(null);
  const head = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    head.current?.focus();
  }, [state]);

  async function go() {
    if (busy) return;
    setBusy(true);
    setErr("");
    const r = await send("POST", mode === "confirm" ? "/subscriptions/confirm" : "/subscriptions/unsubscribe", { id, token });
    setBusy(false);
    if (r.status === 200) { setAt(new Date()); setState(mode === "confirm" ? "ok" : "off"); return; }
    if (r.status === 404 || r.status === 400 || r.status === 422) { setState("old"); return; }
    setErr(r.status === 0 ? "Нет связи, проверьте интернет и попробуйте еще раз" : "Не получилось, попробуйте еще раз через минуту");
  }

  const c = COPY[state](mode);
  return (
    <section className="sb-sec dark2">
      <div className="wrap sb-wrap">
        <div className="sb-card ol" data-in="">
          <div className="sb-step" key={state}>
            <span className={`sb-ico cut${state === "ok" ? " is-ok" : ""}`} aria-hidden="true"><Icon name={c.icon} size={28} /></span>
            <h1 className="sb-t" ref={head} tabIndex={-1}>{c.h}</h1>
            <p className="sb-p">{c.t}</p>

            {state === "ask" ? (
              <div className="sb-acts">
                <span className="lift"><button type="button" className="btn btn--white btn--lg" aria-busy={busy} onClick={() => void go()}>
                  {busy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}{mode === "confirm" ? "Подтвердить подписку" : "Отписаться"}
                </button></span>
                {err ? <small className="ferr" role="alert">{err}</small> : null}
              </div>
            ) : null}

            {(state === "old" && mode === "confirm") || state === "back" ? <SubscribeForm source={state === "back" ? "return" : "resend"} submitLabel={state === "back" ? "Вернуть подписку" : "Отправить письмо"} /> : null}

            {state === "off" ? (
              <div className="sb-acts">
                <span className="lift"><button type="button" className="btn btn--light btn--lg" onClick={() => setState("back")}>Вернуть подписку</button></span>
              </div>
            ) : null}

            {state === "old" && mode === "unsubscribe" && meta.features.account ? (
              <div className="sb-acts">
                <Link className="lnk" to="/account?tab=profile"><span className="lnk__t">Рассылка в кабинете</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
              </div>
            ) : null}

            <div className="sb-links">
              <Link className="lnk" to="/catalog"><span className="lnk__t">Смотреть каталог</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
              {meta.features.offers ? <Link className="lnk" to="/offers"><span className="lnk__t">Акции</span></Link> : null}
            </div>

            <span className="sb-small">
              {state === "ok" && at ? `Согласие на рассылку записано ${fmtDate(at)} в ${fmtTime(at)} по Москве` : state === "off" ? "Если отписались случайно, верните подписку: пришлем письмо для подтверждения адреса" : "Отписаться можно по ссылке в любом письме или в кабинете"}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
