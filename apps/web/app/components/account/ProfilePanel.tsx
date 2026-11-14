import { type FormEvent, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { emailOk, loginHref, maskedPhone, send } from "../../lib/account";
import { ui } from "../../lib/ui";
import { Collapse, Icon } from "../site";
import { CodeInput } from "./CodeInput";
import type { Profile, Subscription } from "./types";
import { useTelegram } from "./useTelegram";

const BACK = "/account?tab=profile";

function Reauth({ text }: { text: string }) {
  return (
    <div className="ac-reauth" role="alert">
      <span>{text}</span>
      <Link className="lnk lnk--sm" to={loginHref(BACK, true)}><span className="lnk__t">Войти заново</span><span className="ar ol" aria-hidden="true"><Icon name="arrow" /></span></Link>
    </div>
  );
}

function NameRow({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const id = useId().replace(/:/g, "");
  const [name, setName] = useState(profile.name ?? "");
  const [state, setState] = useState<"idle" | "busy" | "saved">("idle");
  const [err, setErr] = useState("");
  const dirty = name.trim() !== (profile.name ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) { setErr("Укажите имя"); return; }
    if (v.length > 80) { setErr("Не длиннее 80 символов"); return; }
    setState("busy");
    setErr("");
    const r = await send("PATCH", "/me", { name: v });
    if (r.status === 200) { setState("saved"); onChanged(); return; }
    setState("idle");
    setErr(r.status === 422 || r.status === 400 ? "Имя от 1 до 80 символов" : "Не удалось сохранить, попробуйте еще раз");
  }

  return (
    <form className="ac-f" noValidate onSubmit={save}>
      <label className="ac-f__k" htmlFor={`${id}-n`}>Имя</label>
      <div className="ac-f__v">
        <input id={`${id}-n`} className="in in--light ac-f__in" value={name} maxLength={80} autoComplete="name" placeholder="Как к вам обращаться" aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-e` : undefined} onChange={(e) => { setName(e.target.value); setErr(""); setState("idle"); }} />
        {err ? <small className="ferr" id={`${id}-e`} role="alert">{err}</small> : null}
        {state === "saved" && !dirty ? <small className="ac-ok" role="status">Сохранили</small> : null}
      </div>
      <div className="ac-f__a">
        {dirty ? <button type="submit" className="btn btn--dark btn--sm" aria-busy={state === "busy"}>{state === "busy" ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}Сохранить</button> : null}
      </div>
    </form>
  );
}

function EmailRow({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const id = useId().replace(/:/g, "");
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [ch, setCh] = useState<{ id: string; email: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [reauth, setReauth] = useState(false);
  const [done, setDone] = useState("");
  const input = useRef<HTMLInputElement>(null);

  function close() { setOpen(false); setCh(null); setCode(""); setEmail(""); setErr(""); }

  async function request(e?: FormEvent) {
    e?.preventDefault();
    const v = email.trim();
    if (!emailOk(v)) { setErr(v ? "Проверьте адрес: должно быть имя@почта.ru" : "Укажите новый email"); input.current?.focus(); return; }
    if (v.toLowerCase() === (profile.email ?? "").toLowerCase()) { setErr("Это текущий адрес кабинета"); return; }
    setBusy(true);
    setErr("");
    const r = await send<{ challengeId: string }>("POST", "/me/email/request", { email: v });
    setBusy(false);
    if (r.status === 202 && r.body) { setCh({ id: r.body.challengeId, email: v }); setCode(""); setTimeout(() => document.getElementById(`${id}-c`)?.focus(), 60); return; }
    if (r.status === 401) { setReauth(true); return; }
    setErr(r.status === 429 ? "Слишком много попыток, попробуйте через час" : r.status === 422 || r.status === 400 ? "Проверьте адрес: должно быть имя@почта.ru" : "Не удалось отправить код, попробуйте еще раз");
  }

  async function verify(value = code) {
    if (!ch || busy) return;
    if (value.length < 6) { setErr("Введите все 6 цифр из письма"); return; }
    setBusy(true);
    setErr("");
    const r = await send<{ email: string }>("POST", "/me/email/verify", { challengeId: ch.id, code: value });
    setBusy(false);
    if (r.status === 200 && r.body) { setDone(`Почта изменена на ${r.body.email}`); close(); onChanged(); return; }
    if (r.status === 401) { setReauth(true); return; }
    setErr(r.status === 409 ? "Этот email уже используется в другом кабинете" : r.status === 400 || r.status === 422 ? "Код неверный или истек" : "Не удалось проверить код, попробуйте еще раз");
  }

  return (
    <div className="ac-f ac-f--wrap">
      <span className="ac-f__k">Почта</span>
      <span className="ac-f__v">
        {profile.email ? <>{profile.email}<span className="ac-mark">{profile.emailVerified ? "подтверждена" : "не подтверждена"}</span></> : <span className="ac-dim">не указана</span>}
        {done ? <small className="ac-ok" role="status">{done}</small> : null}
      </span>
      <span className="ac-f__a">
        <button type="button" className="flink" aria-expanded={open} aria-controls={`${id}-p`} onClick={() => (open ? close() : (setOpen(true), setDone(""), setTimeout(() => input.current?.focus(), 60)))}>{open ? "Отмена" : profile.email ? "Сменить" : "Добавить"}</button>
      </span>
      <Collapse open={open} id={`${id}-p`} className="ac-f__more">
          <div className="ac-chg">
            {reauth ? <Reauth text="Для смены почты нужен свежий вход: так мы проверяем, что это вы" /> : null}
            {!ch ? (
              <form noValidate onSubmit={request} className="ac-chg__row">
                <div className="fld">
                  <label className="fld__l" htmlFor={`${id}-e`}>Новый email</label>
                  <input ref={input} id={`${id}-e`} className="in in--light" type="email" inputMode="email" autoComplete="email" placeholder="имя@почта.ru" value={email} aria-invalid={err ? true : undefined} aria-describedby={err ? `${id}-er` : undefined} onChange={(e) => { setEmail(e.target.value); setErr(""); }} />
                </div>
                <button type="submit" className="btn btn--dark" aria-busy={busy}>{busy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}Получить код</button>
              </form>
            ) : (
              <form noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }} className="ac-chg__row">
                <div className="fld">
                  <label className="fld__l" htmlFor={`${id}-c`}>Код из письма на {ch.email}</label>
                  <CodeInput id={`${id}-c`} light value={code} onChange={(v) => { setCode(v); setErr(""); }} invalid={!!err} describedBy={err ? `${id}-er` : undefined} disabled={busy} onComplete={(v) => void verify(v)} />
                </div>
                <button type="submit" className="btn btn--dark" aria-busy={busy}>{busy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}Подтвердить</button>
              </form>
            )}
            {err ? <small className="ferr" id={`${id}-er`} role="alert">{err}</small> : null}
            <span className="ac-dim">Новый адрес подтверждаем кодом, вход по коду будет приходить на него</span>
          </div>
      </Collapse>
    </div>
  );
}

export function TelegramLink({ label = "Подключить Telegram", onLinked }: { label?: string; onLinked: () => void }) {
  const [reauth, setReauth] = useState(false);
  const [ok, setOk] = useState(false);
  const tg = useTelegram({ purpose: "link", onLinked: () => { setOk(true); onLinked(); }, onReauth: () => setReauth(true) });
  if (tg.phase === "off") return <span className="ac-dim">Привязка Telegram сейчас недоступна</span>;
  if (ok) return <small className="ac-ok" role="status">Telegram подключен</small>;
  const busy = tg.phase === "loading" || tg.phase === "waiting" || tg.phase === "sending";
  return (
    <span className="ac-tgl">
      {tg.phase === "ready" || tg.phase === "waiting" || tg.phase === "sending" ? (
        <>
          <button type="button" className="btn btn--dark btn--sm" aria-busy={busy} onClick={() => (tg.phase === "ready" ? tg.open() : undefined)}>
            {busy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}{tg.phase === "ready" ? "Открыть Telegram" : tg.phase === "waiting" ? "Ждем подтверждения" : "Привязываем"}
          </button>
          <small className="ac-dim">Подтвердите вход в окне Telegram и разрешите передать номер</small>
          {tg.phase === "waiting" ? <button type="button" className="flink" onClick={() => tg.reset()}>Окно не открылось</button> : null}
        </>
      ) : (
        <button type="button" className="btn btn--dark btn--sm" aria-busy={busy} onClick={() => void tg.prepare()}>
          {busy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}{label}
        </button>
      )}
      {tg.error ? <small className="ferr" role="alert">{tg.error}</small> : null}
      {reauth ? <Reauth text="Для привязки Telegram нужен свежий вход" /> : null}
    </span>
  );
}

function SubscriptionRow({ profile, subscription, onChanged }: { profile: Profile; subscription: Subscription; onChanged: () => void }) {
  const [sub, setSub] = useState(subscription);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const on = sub?.status === "active" || sub?.status === "pending";
  const email = sub?.email ?? profile.email;

  async function toggle() {
    if (busy) return;
    setErr("");
    setMsg("");
    if (on && sub) {
      const u = (() => { try { return new URL(sub.unsubscribe); } catch { return null; } })();
      const id = u?.searchParams.get("id"), token = u?.searchParams.get("token");
      if (!id || !token) { setErr("Не удалось отписаться, попробуйте по ссылке из любого письма"); return; }
      setBusy(true);
      const r = await send("POST", "/subscriptions/unsubscribe", { id, token });
      setBusy(false);
      if (r.status === 200) { setSub({ ...sub, status: "unsubscribed" }); setMsg("Вы отписаны, письма с акциями больше не придут"); onChanged(); return; }
      setErr("Не удалось отписаться, попробуйте еще раз");
      return;
    }
    if (!email) { setErr("Сначала добавьте почту выше"); return; }
    setBusy(true);
    const r = await send("POST", "/subscriptions", { email, consent: true, source: "account" });
    setBusy(false);
    if (r.status === 202) {
      setSub({ status: "pending", email, unsubscribe: sub?.unsubscribe ?? "" });
      setMsg(`Отправили письмо на ${email}. Нажмите ссылку в нем, без этого рассылка не начнется`);
      onChanged();
      return;
    }
    setErr(r.status === 429 ? "Слишком много попыток, попробуйте завтра" : "Не удалось подписаться, попробуйте еще раз");
  }

  const text = !sub || sub.status === "unsubscribed" ? "выключена, письма с акциями не приходят" : sub.status === "pending" ? `ждет подтверждения по ссылке из письма на ${sub.email}` : `включена, письма приходят на ${sub.email}`;
  return (
    <>
      <div className="ac-f">
        <span className="ac-f__k">Акции и новости</span>
        <span className="ac-f__v">{text}</span>
        <span className="ac-f__a">
          <button type="button" className={`ac-tog cut${on ? " is-on" : ""}`} role="switch" aria-checked={on} aria-busy={busy} aria-label="Рассылка акций и новостей на почту" onClick={() => void toggle()} />
        </span>
      </div>
      {msg ? <small className="ac-ok" role="status">{msg}</small> : null}
      {err ? <small className="ferr" role="alert">{err}</small> : null}
      <span className="ac-foot">Включая рассылку, вы соглашаетесь с <button type="button" className="flink" onClick={() => ui.openLegal("mail")}>условиями рассылки</button>. Отписаться можно здесь или по ссылке в любом письме</span>
    </>
  );
}

type Props = { profile: Profile; subscription: Subscription | undefined; onChanged: () => void; onLogout: () => void };

export function ProfilePanel({ profile, subscription, onChanged, onLogout }: Props) {
  const tgLinked = profile.identities.includes("telegram");
  return (
    <div className="ac-prof" data-stagger="">
      <div className="ac-box ol" data-in="">
        <h3 className="ac-box__t">Контакты</h3>
        <NameRow profile={profile} onChanged={onChanged} />
        <EmailRow profile={profile} onChanged={onChanged} />
        <div className="ac-f">
          <span className="ac-f__k">Телефон</span>
          <span className="ac-f__v">{profile.phone && profile.phoneVerified ? <>{maskedPhone(profile.phone)}<span className="ac-mark">подтвержден через Telegram</span></> : <span className="ac-dim">не подтвержден</span>}</span>
          <span className="ac-f__a">{!profile.phoneVerified ? <TelegramLink label="Подтвердить через Telegram" onLinked={onChanged} /> : null}</span>
        </div>
        <span className="ac-foot">Телефон подтверждается только через Telegram: номер приходит из вашего аккаунта и сразу считается проверенным</span>
      </div>

      <div className="ac-box ol" data-in="">
        <h3 className="ac-box__t">Способы входа</h3>
        <div className="ac-f">
          <span className="ac-f__k">Код на почту</span>
          <span className="ac-f__v">{profile.email ?? <span className="ac-dim">добавьте почту в контактах</span>}</span>
          <span className="ac-f__a">{profile.email ? <span className="ac-mark">подключен</span> : null}</span>
        </div>
        <div className="ac-f">
          <span className="ac-f__k">Telegram</span>
          <span className="ac-f__v">{tgLinked ? "подключен" : <span className="ac-dim">не подключен</span>}</span>
          <span className="ac-f__a">{!tgLinked ? <TelegramLink onLinked={onChanged} /> : null}</span>
        </div>
      </div>

      {subscription !== undefined ? (
        <div className="ac-box ol" data-in="">
          <h3 className="ac-box__t">Рассылка</h3>
          <SubscriptionRow profile={profile} subscription={subscription} onChanged={onChanged} />
        </div>
      ) : null}

      <div className="ac-out" data-in="">
        <button type="button" className="btn btn--line ol" onClick={onLogout}>Выйти из кабинета</button>
        <span className="ac-dim">Сессия на этом устройстве закончится, войти снова можно по коду или через Telegram</span>
      </div>
    </div>
  );
}
