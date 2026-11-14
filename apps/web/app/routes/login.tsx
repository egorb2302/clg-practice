import type { SessionResponse } from "@armorix/contracts";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { data, redirect, useNavigate } from "react-router";
import type { Route } from "./+types/login";
import { CodeInput } from "../components/account/CodeInput";
import { useTelegram } from "../components/account/useTelegram";
import { Crumbs, Icon } from "../components/site";
import { emailOk, safeNext, send, setCsrf } from "../lib/account";
import { contact } from "../lib/contact";
import { PRIVATE_CACHE, privateHeaders, sessionOf } from "../lib/account.server";
import { rootOrigin, seo } from "../lib/seo";
import { useSite } from "../lib/site";
import { requireFeature } from "../lib/stub.server";
import { ui } from "../lib/ui";
import css from "../styles/pages/login.css?url";

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: css }];

export async function loader({ request }: Route.LoaderArgs) {
  await requireFeature("account", PRIVATE_CACHE);
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const reauth = url.searchParams.get("reauth") === "1";
  const s = await sessionOf(request);
  if (s && !reauth) throw redirect(next, { headers: privateHeaders() });
  return data({ next, reauth: reauth && !!s, email: reauth ? (s?.user.email ?? "") : "" }, { headers: privateHeaders() });
}
export { pageHeaders as headers } from "../lib/headers";
export const meta: Route.MetaFunction = ({ matches }) =>
  seo({ title: "Вход в кабинет", description: "Вход в личный кабинет ARMORIX по коду на почту или через Telegram: заявки, покупки и баллы", path: "/login", origin: rootOrigin(matches), noindex: true });

type Step = "email" | "code" | "tg";
const RESEND_SEC = 60;
const ATTEMPTS = 5;
const STAFF = new Set(["manager", "editor", "admin"]);

function useTick(on: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [on]);
  return now;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function Login({ loaderData }: Route.ComponentProps) {
  const { next, reauth } = loaderData;
  const { meta } = useSite();
  const navigate = useNavigate();
  const uid = useId().replace(/:/g, "");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(loaderData.email);
  const [mail, setMail] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<{ id: string; email: string; ttl: number } | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [left, setLeft] = useState(ATTEMPTS);
  const head = useRef<HTMLHeadingElement>(null);
  const emailIn = useRef<HTMLInputElement>(null);
  const first = useRef(true);
  const now = useTick(step === "code");
  const wait = Math.max(0, RESEND_SEC - Math.floor((now - sentAt) / 1000));
  const locked = left <= 0;

  async function done(s: SessionResponse, viaEmail: string | null) {
    setCsrf(s.csrfToken);
    contact.signedIn(s.user.id);
    if (viaEmail && mail && meta.features.campaigns) {
      await send("POST", "/subscriptions", { email: viaEmail, consent: true, source: "login" }).catch(() => null);
    }
    if (s.user.roles.some((r) => STAFF.has(r))) { window.location.assign("/admin/"); return; }
    navigate(next, { replace: true });
  }

  const tg = useTelegram({ purpose: "login", onLogin: (s) => void done(s, null) });

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = window.setTimeout(() => {
      if (step === "code") document.getElementById(`${uid}-c`)?.focus();
      else if (step === "email") emailIn.current?.focus();
      else head.current?.focus();
    }, 60);
    return () => window.clearTimeout(t);
  }, [step, uid]);

  useEffect(() => {
    if (tg.phase === "off" && step === "tg") {
      setStep("email");
      setNote("Вход через Telegram сейчас недоступен, войдите по почте");
    }
  }, [tg.phase, step]);

  async function requestCode(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    const v = email.trim();
    if (!emailOk(v)) {
      setErr(v ? "Проверьте адрес: должно быть имя@почта.ru" : "Укажите email, пришлем на него код");
      emailIn.current?.focus();
      return;
    }
    setBusy(true);
    setErr("");
    setNote("");
    const r = await send<{ challengeId: string; expiresInSec: number }>("POST", "/auth/email/request", { email: v });
    setBusy(false);
    if (r.status === 202 && r.body) {
      setChallenge({ id: r.body.challengeId, email: v, ttl: r.body.expiresInSec });
      setSentAt(Date.now());
      setLeft(ATTEMPTS);
      setCode("");
      setStep("code");
      return;
    }
    if (r.status === 429) {
      const sec = Number(r.error?.retryAfterSec ?? RESEND_SEC);
      if (sec <= RESEND_SEC && challenge?.email === v) {
        setSentAt(Date.now() - (RESEND_SEC - sec) * 1000);
        setStep("code");
        setErr(`Код уже отправлен, новый можно запросить через ${mmss(sec)}`);
        return;
      }
      setErr(sec > RESEND_SEC ? `Слишком много запросов кода. Попробуйте через ${Math.ceil(sec / 60)} мин${tg.phase !== "off" ? " или войдите через Telegram" : ""}` : `Код уже отправлен на этот адрес. Новый можно запросить через ${mmss(sec)}`);
      return;
    }
    if (r.status === 400 || r.status === 422) { setErr("Проверьте адрес: должно быть имя@почта.ru"); return; }
    setErr(r.status === 0 ? "Нет связи, проверьте интернет и попробуйте еще раз" : "Не удалось отправить код, попробуйте еще раз");
  }

  async function verify(value = code) {
    if (busy || !challenge) return;
    if (locked) { void requestCode(); return; }
    if (value.length < 6) { setErr("Введите все 6 цифр из письма"); return; }
    setBusy(true);
    setErr("");
    const r = await send<SessionResponse>("POST", "/auth/email/verify", { challengeId: challenge.id, code: value });
    if (r.status === 200 && r.body) { await done(r.body, challenge.email); return; }
    setBusy(false);
    if (r.status === 400 || r.status === 422) {
      const n = left - 1;
      setLeft(n);
      setErr(n > 0 ? `Код неверный или истек. ${n === 1 ? "Осталась 1 попытка" : `Осталось ${n} попытки`}` : "Попытки закончились. Запросите новый код");
      return;
    }
    if (r.status === 429) { setErr(`Слишком много попыток. Попробуйте через час${tg.phase !== "off" ? " или войдите через Telegram" : ""}`); return; }
    setErr(r.status === 0 ? "Нет связи, проверьте интернет и попробуйте еще раз" : "Не удалось проверить код, попробуйте еще раз");
  }

  async function toTelegram() {
    setErr("");
    setNote("");
    if (reauth) {
      await send("POST", "/auth/logout");
      setCsrf(null);
      contact.clear();
    }
    setStep("tg");
    await tg.prepare();
  }

  const back = () => { setStep("email"); setErr(""); setCode(""); tg.reset(); };
  const tgBusy = tg.phase === "loading" || tg.phase === "waiting" || tg.phase === "sending";
  const tgLabel = tg.phase === "loading" ? "Готовим вход" : tg.phase === "waiting" ? "Ждем подтверждения" : tg.phase === "sending" ? "Входим" : "Продолжить в Telegram";
  const errId = `${uid}-err`;

  return (
    <section className="lg-sec dark2">
      <div className="wrap lg-grid">
        <div className="lg-intro">
          <Crumbs items={[{ label: "Главная", to: "/" }, { label: reauth ? "Повторный вход" : "Вход" }]} />
          <h1 className="lg-t" data-in="">Личный<br />кабинет</h1>
          <p className="lg-lead" data-in="">Заявки, покупки и баллы в одном месте. Отдельно регистрироваться не нужно: войдите по почте{tg.phase !== "off" ? " или через Telegram" : ""}, и кабинет появится сам</p>
          <ul className="lg-why" data-stagger="">
            <li data-in=""><span className="lg-why__i cut" aria-hidden="true"><Icon name="clock" /></span><span><strong>Статус заявок</strong><small>Видно, когда менеджер взял заявку и чем она закончилась</small></span></li>
            <li data-in=""><span className="lg-why__i cut" aria-hidden="true"><Icon name="box" /></span><span><strong>Покупки</strong><small>Состав, сумма и дата каждой подтвержденной покупки</small></span></li>
            <li data-in=""><span className="lg-why__i cut" aria-hidden="true"><Icon name="shield" /></span><span><strong>Баллы и акции</strong><small>Баланс, срок действия и предложения для ваших машин</small></span></li>
          </ul>
          {meta.features.loyalty ? (
            <div className="lg-bonus ol" data-in="">
              <b className="D" data-count="1000">1 000</b>
              <span>приветственных баллов за первую заявку из каталога или на изготовление. 1 балл = 1 ₽, действуют 180 дней, оплачивают до 20% покупки</span>
            </div>
          ) : null}
        </div>

        <div className="lg-card ol" role="region" aria-labelledby={`${uid}-h`} data-in="">
          {step === "email" ? (
            <form key="email" className="lg-step" noValidate onSubmit={requestCode}>
              <h2 className="lg-h" id={`${uid}-h`} ref={head} tabIndex={-1}>{reauth ? "Войдите еще раз" : "Вход"}</h2>
              <p className="lg-sub">{reauth ? "Для смены почты или привязки Telegram нужен свежий вход, это займет минуту" : "Если входите впервые, кабинет создастся автоматически"}</p>
              {tg.phase !== "off" ? (
                <>
                  <span className="lift lift--block"><button type="button" className="btn btn--light btn--lg btn--block" onClick={() => void toTelegram()}><Icon name="telegram" size={20} />Войти через Telegram</button></span>
                  <span className="lg-or">или по почте</span>
                </>
              ) : null}
              {note ? <p className="lg-note" role="status">{note}</p> : null}
              <div className="fld">
                <label className="fld__l" htmlFor={`${uid}-e`}>Email</label>
                <input
                  ref={emailIn}
                  id={`${uid}-e`}
                  className="in"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="имя@почта.ru"
                  value={email}
                  aria-invalid={err ? true : undefined}
                  aria-describedby={err ? errId : undefined}
                  onChange={(e) => { setEmail(e.target.value); setErr(""); }}
                />
                {err ? <small className="ferr" id={errId} role="alert">{err}</small> : null}
              </div>
              {meta.features.campaigns && !reauth ? (
                <div className="lg-mail">
                  <label className="chk"><input className="vh" type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} /><i aria-hidden="true" /><span>Присылать акции и новости на этот email</span></label>
                  <button type="button" className="flink" onClick={() => ui.openLegal("mail")}>Условия рассылки</button>
                </div>
              ) : null}
              <span className="lift lift--block">
                <button type="submit" className="btn btn--white btn--lg btn--block" aria-busy={busy}>
                  {busy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}{busy ? "Отправляем" : "Получить код"}
                </button>
              </span>
              <span className="lg-pd">Продолжая, вы соглашаетесь с <button type="button" className="flink" onClick={() => ui.openLegal("pd")}>обработкой данных</button> и <button type="button" className="flink" onClick={() => ui.openLegal("policy")}>политикой конфиденциальности</button></span>
            </form>
          ) : null}

          {step === "code" && challenge ? (
            <form key="code" className="lg-step" noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }}>
              <h2 className="lg-h" id={`${uid}-h`} ref={head} tabIndex={-1}>Код из письма</h2>
              <p className="lg-sub">Отправили 6 цифр на <b className="lg-addr">{challenge.email}</b>. Код действует {Math.round(challenge.ttl / 60)} минут</p>
              <div className="fld">
                <label className="fld__l" htmlFor={`${uid}-c`}>Код</label>
                <CodeInput id={`${uid}-c`} value={code} onChange={(v) => { setCode(v); if (!locked) setErr(""); }} invalid={!!err} describedBy={err ? errId : undefined} disabled={busy || locked} onComplete={(v) => void verify(v)} />
                {err ? <small className="ferr" id={errId} role="alert">{err}</small> : null}
              </div>
              <div className="lg-meta">
                {wait > 0 ? <span aria-live="off">Отправить еще раз через {mmss(wait)}</span> : <button type="button" className="flink" onClick={() => void requestCode()} disabled={busy}>Отправить код еще раз</button>}
                <button type="button" className="flink" onClick={back}>Другой адрес</button>
              </div>
              <span className="lift lift--block">
                <button type="submit" className="btn btn--white btn--lg btn--block" aria-busy={busy} disabled={locked && wait > 0}>
                  {busy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}{busy ? "Проверяем" : locked ? (wait > 0 ? `Новый код через ${mmss(wait)}` : "Запросить новый код") : "Войти"}
                </button>
              </span>
              <span className="lg-pd">Письма нет? Проверьте папку «Спам», код приходит в течение минуты</span>
            </form>
          ) : null}

          {step === "tg" ? (
            <div key="tg" className="lg-step">
              <h2 className="lg-h" id={`${uid}-h`} ref={head} tabIndex={-1}>Вход через Telegram</h2>
              <p className="lg-sub">Откроется окно Telegram. Подтвердите вход и разрешите передать номер телефона: он станет подтвержденным контактом кабинета</p>
              <div className="lg-tg ol">
                <span className="lg-tg__i cut" aria-hidden="true"><Icon name="telegram" size={22} /></span>
                <span><strong>ARMORIX попросит</strong><small>имя, фото профиля и номер телефона из Telegram</small></span>
              </div>
              {tg.error ? <small className="ferr" role="alert">{tg.error}</small> : null}
              <span className="lift lift--block">
                <button type="button" className="btn btn--white btn--lg btn--block" aria-busy={tgBusy} disabled={tg.phase === "loading"} onClick={() => (tg.phase === "ready" || tg.phase === "idle" ? tg.open() : undefined)}>
                  {tgBusy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}{tgLabel}
                </button>
              </span>
              <div className="lg-meta">
                <button type="button" className="flink" onClick={back}>Войти по почте</button>
                {tg.phase === "waiting" ? <button type="button" className="flink" onClick={() => tg.reset()}>Окно не открылось</button> : null}
              </div>
              <span className="lg-pd">Если этот номер уже подтвержден в другом кабинете, войти по нему нельзя: позвоните менеджеру, и разберемся</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
