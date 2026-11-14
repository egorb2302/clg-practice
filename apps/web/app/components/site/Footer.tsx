import { API_PREFIX } from "@armorix/contracts";
import { type FormEvent, useId, useRef, useState } from "react";
import { Link, NavLink } from "react-router";
import { telegramLink } from "../../lib/format";
import { telHref, useSite, vkLink } from "../../lib/site";
import { ui } from "../../lib/ui";
import { useNavLinks } from "./Header";
import { Icon, Logo, VkMark } from "./Icon";

export function Footer() {
  const { meta } = useSite();
  const links = useNavLinks();
  const c = meta.contacts;
  const tel = telHref(c.phone);
  const tg = c.telegram ? telegramLink(c.telegram) : null;
  const vk = vkLink(c.vk);
  const year = new Date().getFullYear();

  return (
    <footer className="ft dark2">
      <div className="wrap">
        <div className="ft__grid">
          <div className="ft__brand">
            <Link to="/" className="hd__logo" aria-label="ARMORIX, на главную"><Logo /></Link>
            <p className="ft__about">Стальная защита бампера для китайских внедорожников</p>
            {tg || vk ? (
              <div className="ft__soc">
                {vk ? <a href={vk.href} target="_blank" rel="noopener noreferrer"><span className="ar ol" aria-hidden="true"><VkMark /></span>ВКонтакте</a> : null}
                {tg ? <a href={tg.href} target="_blank" rel="noopener noreferrer"><span className="ar ol" aria-hidden="true"><Icon name="telegram" size={18} /></span>Telegram</a> : null}
              </div>
            ) : null}
          </div>
          <nav className="ft__col" aria-labelledby="ft-nav">
            <h2 className="ft__h" id="ft-nav">Навигация</h2>
            {links.map((l) => <NavLink key={l.to} to={l.to}>{l.label}</NavLink>)}
            <NavLink to="/faq">Вопросы и ответы</NavLink>
          </nav>
          {tel || c.email || c.address || c.hours ? (
            <div className="ft__col">
              <h2 className="ft__h">Контакты</h2>
              {tel && c.phone ? <a className="hd__ph" href={tel}>{c.phone}</a> : null}
              {c.email ? <a href={`mailto:${c.email}`}>{c.email}</a> : null}
              {c.address ? <span>{c.address}</span> : null}
              {c.hours ? <span>{c.hours}</span> : null}
            </div>
          ) : <div />}
          {meta.features.campaigns ? <Subscribe /> : null}
        </div>
        <div className="ft__bot">
          <span>© ARMORIX, {year}</span>
          <nav className="ft__legal" aria-label="Документы">
            <button type="button" onClick={() => ui.openLegal("policy")}>Политика конфиденциальности</button>
            <button type="button" onClick={() => ui.openLegal("pd")}>Согласие на обработку персональных данных</button>
            <button type="button" onClick={() => ui.openLegal("mail")}>Согласие на рассылку</button>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function Subscribe() {
  const id = useId().replace(/:/g, "");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const input = useRef<HTMLInputElement>(null);
  const again = useRef<HTMLButtonElement>(null);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      setErr(v ? "Проверьте адрес, нужен вид name@mail.ru" : "Укажите email");
      input.current?.focus();
      return;
    }
    setState("sending");
    setErr("");
    try {
      const r = await fetch(`${API_PREFIX}/subscriptions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: v, consent: true, source: "footer" }) });
      if (r.ok) { setState("done"); setTimeout(() => again.current?.focus(), 30); return; }
      setState("idle");
      setErr(r.status === 422 ? "Проверьте адрес, нужен вид name@mail.ru" : r.status === 429 ? "Слишком много попыток, попробуйте через час" : "Не удалось подписаться, попробуйте еще раз");
    } catch {
      setState("idle");
      setErr("Не удалось подписаться, проверьте связь и попробуйте еще раз");
    }
  }

  return (
    <div className="ft__sub">
      <h2 className="ft__h" id={`${id}-h`}>Акции и новости на почту</h2>
      <span>Новые комплекты и акции, отписка в один клик из любого письма</span>
      <div aria-live="polite">
        {state === "done" ? (
          <div className="ft__ok" role="status">
            <b>Осталось подтвердить</b>
            <span>Отправили письмо на {email.trim()}. Нажмите ссылку в нем, без этого рассылка не начнется</span>
            <button ref={again} type="button" className="flink" onClick={() => { setState("idle"); setEmail(""); setTimeout(() => input.current?.focus(), 30); }}>Другой адрес</button>
          </div>
        ) : null}
      </div>
      {state !== "done" ? (
        <form className="ft__sub" noValidate onSubmit={send} aria-labelledby={`${id}-h`}>
          <div className="ft__subrow">
            <input
              ref={input}
              className="in"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@mail.ru"
              aria-label="Email для рассылки"
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? `${id}-e` : undefined}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(""); }}
            />
            <button type="submit" className="btn btn--light btn--sm" aria-busy={state === "sending"}>
              {state === "sending" ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}Подписаться
            </button>
          </div>
          {err ? <small className="ferr" id={`${id}-e`} role="alert">{err}</small> : null}
          <span className="ft__pd">Подписываясь, вы соглашаетесь с <button type="button" className="flink" onClick={() => ui.openLegal("mail")}>рассылкой</button> и <button type="button" className="flink" onClick={() => ui.openLegal("pd")}>обработкой данных</button></span>
        </form>
      ) : null}
    </div>
  );
}
