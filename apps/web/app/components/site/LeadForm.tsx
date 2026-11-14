import { API_PREFIX, type CatalogChange, type DeliveryMethodCode, type LeadCreatedResponse, type LeadRequest } from "@armorix/contracts";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { maskPhone, phoneE164, plural } from "../../lib/format";
import { postLead, uuid } from "../../lib/leads";
import { setDelivery, useDelivery } from "../../lib/selection";
import { useSite } from "../../lib/site";
import { ui } from "../../lib/ui";
import { useVehicle } from "../../lib/vehicle";

export type LeadItem = { variantId: string; quantity: number; seenPriceFrom: number | null };

type Props = {
  type: "catalog" | "custom" | "general";
  items?: LeadItem[];
  deliveryMethod?: DeliveryMethodCode;
  vehicle?: { make: string; model: string; year?: number };
  request?: string;
  message?: string;
  submitLabel?: string;
  successText?: string;
  onSuccess?: (r: LeadCreatedResponse, sent: LeadItem[]) => void;
  onCatalogChanged?: (changes: CatalogChange[]) => void;
  className?: string;
};

type Field = "name" | "phone" | "email" | "make" | "model" | "year" | "request" | "message" | "comment" | "delivery";
type Errors = Partial<Record<Field, string>>;
const SERVER_KEY: Record<string, Field> = {
  name: "name", "contact.phone": "phone", "contact.email": "email", "vehicle.make": "make", "vehicle.model": "model",
  "vehicle.year": "year", request: "request", message: "message", comment: "comment", deliveryMethod: "delivery",
};

const digits = (v: string) => v.replace(/\D/g, "");
const phoneOk = (v: string) => digits(v).length === 11;
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function LeadForm(props: Props) {
  const { type, items = [], deliveryMethod, submitLabel = "Отправить заявку", onSuccess, onCatalogChanged, className = "" } = props;
  const { meta } = useSite();
  const chosen = useVehicle();
  const stored = useDelivery();
  const methods = meta.deliveryMethods;
  const pickDelivery = type === "catalog" && !deliveryMethod && methods.length > 1;
  const dm: DeliveryMethodCode | undefined = deliveryMethod
    ?? methods.find((m) => m.code === stored)?.code
    ?? (methods.length === 1 ? methods[0]!.code : undefined);
  const id = useId().replace(/:/g, "");
  const form = useRef<HTMLFormElement>(null);
  const done = useRef<HTMLDivElement>(null);

  const [f, setF] = useState(() => ({
    name: "", pref: "phone" as "phone" | "email", phone: "", email: "", comment: "",
    make: props.vehicle?.make ?? "", model: props.vehicle?.model ?? "", year: props.vehicle?.year ? String(props.vehicle.year) : "",
    request: props.request ?? "", message: props.message ?? "", website: "", mail: false,
  }));
  const [err, setErr] = useState<Errors>({});
  const [msg, setMsg] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "limited" | "done">("idle");
  const [failed, setFailed] = useState(false);
  const [changed, setChanged] = useState(false);
  const [limitMin, setLimitMin] = useState(0);
  const [result, setResult] = useState<{ ref: string; mail: "sent" | "failed" | null; pending: boolean; authed: boolean } | null>(null);
  const key = useRef<string | null>(null);
  const started = useRef<number | null>(null);
  const mounted = useRef(Date.now());
  const focusBad = useRef(false);

  useEffect(() => {
    if (type !== "custom" || props.vehicle || chosen?.mode !== "custom") return;
    setF((o) => (o.make || o.model ? o : { ...o, make: chosen.brand, model: chosen.model }));
  }, [type, chosen, props.vehicle]);

  useEffect(() => {
    if (!focusBad.current) return;
    focusBad.current = false;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [err]);

  useEffect(() => {
    if (state === "done") done.current?.focus();
  }, [state]);

  useEffect(() => {
    if (state !== "limited") return;
    const t = window.setTimeout(() => { setState("idle"); setMsg(""); }, limitMin * 60_000);
    return () => window.clearTimeout(t);
  }, [state, limitMin]);

  const touch = () => { if (started.current == null) started.current = Date.now(); };
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => {
    touch();
    setF((o) => ({ ...o, [k]: v }));
    key.current = null;
    setFailed(false);
    if (k in err) setErr((e) => { const n = { ...e }; delete n[k as Field]; return n; });
    if (state !== "limited") setMsg("");
  };

  function validate(): Errors {
    const e: Errors = {};
    if (!f.name.trim()) e.name = "Как к вам обращаться?";
    if (f.pref === "phone" && !phoneOk(f.phone)) e.phone = digits(f.phone).length > 1 ? "Не хватает цифр: нужен номер из 10 цифр после +7" : "Укажите телефон, по нему перезвоним";
    if (f.pref === "email" && !emailOk(f.email)) e.email = f.email.trim() ? "Проверьте адрес: должно быть имя@почта.ru" : "Укажите email, ответим на него";
    if (type === "custom") {
      if (!f.make.trim()) e.make = "Укажите марку";
      if (!f.model.trim()) e.model = "Укажите модель";
      if (f.year.trim() && !(Number(f.year) >= 1950 && Number(f.year) <= 2100)) e.year = "Проверьте год: четыре цифры, например 2023";
      if (f.request.trim().length < 3) e.request = "Опишите, что нужно изготовить";
    }
    if (type === "general" && f.message.trim().length < 3) e.message = "Напишите, чем помочь";
    if (pickDelivery && !dm) e.delivery = "Выберите, как получить заказ";
    return e;
  }

  function body(): LeadRequest {
    const contact = f.pref === "phone"
      ? { preferred: "phone" as const, phone: phoneE164(f.phone) }
      : { preferred: "email" as const, email: f.email.trim() };
    const base = { name: f.name.trim(), contact, website: f.website, fillMs: Date.now() - (started.current ?? mounted.current) };
    const comment = f.comment.trim() || undefined;
    if (type === "catalog") return { type, ...base, items, deliveryMethod: dm, comment };
    if (type === "custom") {
      return { type, ...base, vehicle: { make: f.make.trim(), model: f.model.trim(), year: f.year.trim() ? Number(f.year) : undefined }, request: f.request.trim(), comment };
    }
    return { type, ...base, message: f.message.trim() };
  }

  async function subscribe(email: string): Promise<"sent" | "failed"> {
    try {
      const r = await fetch(`${API_PREFIX}/subscriptions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, consent: true, source: "lead" }) });
      return r.ok ? "sent" : "failed";
    } catch {
      return "failed";
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state === "sending" || state === "limited") return;
    const v = validate();
    if (type === "catalog" && !items.length) { setMsg("Подборка пуста: добавьте позиции из каталога"); return; }
    if (Object.keys(v).length) { focusBad.current = true; setErr(v); setMsg("Проверьте отмеченные поля"); return; }
    key.current ??= uuid();
    setState("sending");
    setMsg("");
    setChanged(false);
    const sent = items;
    const r = await postLead(body(), key.current);
    if (r.kind === "ok") {
      const mail = f.pref === "email" && f.mail && meta.features.campaigns ? await subscribe(f.email.trim()) : null;
      setResult({ ref: r.data.reference, mail, pending: meta.features.loyalty && r.data.loyaltyStatus === "pending", authed: r.authed });
      setState("done");
      setFailed(false);
      key.current = null;
      onSuccess?.(r.data, sent);
      return;
    }
    setState("idle");
    if (r.kind === "invalid") {
      const fe: Errors = {};
      let other = "";
      for (const [k, m] of Object.entries(r.fieldErrors)) {
        const field = SERVER_KEY[k];
        if (field === "delivery" && !pickDelivery) other ||= m;
        else if (field) fe[field] = field === "phone" ? "Сервер не принял этот номер, проверьте его" : m;
        else other ||= m;
      }
      focusBad.current = true;
      setErr(fe);
      setMsg(other || "Проверьте отмеченные поля");
    } else if (r.kind === "changed") {
      key.current = null;
      setChanged(true);
      onCatalogChanged?.(r.changes);
    } else if (r.kind === "limited") {
      const min = Math.max(1, Math.ceil(r.retryAfterSec / 60));
      setLimitMin(min);
      setState("limited");
      setMsg(`Слишком много попыток, попробуйте через ${min} ${plural(min, ["минуту", "минуты", "минут"])}`);
    } else if (r.kind === "busy") {
      setMsg("Заявка уже отправляется, подождите несколько секунд");
    } else {
      if (r.kind === "mismatch") key.current = null;
      setFailed(true);
      setMsg("Не удалось отправить. Все, что вы ввели, на месте: нажмите «Повторить»");
    }
  }

  function again() {
    setState("idle");
    setResult(null);
    setMsg("");
    setF((o) => ({ ...o, comment: "", request: "", message: "", mail: false }));
  }

  if (state === "done" && result) {
    const text = props.successText ?? (f.pref === "email"
      ? `Ответим на ${f.email.trim()} в рабочее время${meta.contacts.hours ? ` (${meta.contacts.hours})` : ""}`
      : `Менеджер перезвонит в рабочее время${meta.contacts.hours ? ` (${meta.contacts.hours})` : ""}, проверит совместимость и назовет точную цену`);
    return (
      <div ref={done} className={`lf__done ol ${className}`} role="status" tabIndex={-1}>
        <h3>Заявка {result.ref} принята</h3>
        <p>{text}</p>
        {result.mail === "sent" ? <p className="small">Про рассылку: отправили на {f.email.trim()} письмо со ссылкой. Нажмите ее, и начнем присылать акции</p> : null}
        {result.mail === "failed" ? <p className="small">Подписаться на рассылку сейчас не получилось, это можно сделать внизу страницы</p> : null}
        {result.pending && !result.authed ? <p className="small">Баллы станут доступны после <Link className="flink" to="/login?next=%2Faccount%3Ftab%3Dbonus">входа</Link> и подтверждения контакта</p> : null}
        {result.pending && result.authed ? <p className="small">Баллы начислим после подтверждения контакта в <Link className="flink" to="/account?tab=profile">кабинете</Link></p> : null}
        <button type="button" className="flink small" style={{ alignSelf: "flex-start" }} onClick={again}>Отправить еще одну заявку</button>
      </div>
    );
  }

  const busy = state === "sending";
  const fid = (k: string) => `${id}-${k}`;
  const field = (k: Field, label: ReactNode, input: ReactNode, wide = false) => (
    <div className={`fld${wide ? " is-wide" : ""}`}>
      <label className="fld__l" htmlFor={fid(k)}>{label}</label>
      {input}
      {err[k] ? <small className="ferr" id={fid(`${k}-e`)}>{err[k]}</small> : null}
    </div>
  );
  const inProps = (k: Field) => ({
    id: fid(k),
    "aria-invalid": err[k] ? (true as const) : undefined,
    "aria-describedby": err[k] ? fid(`${k}-e`) : undefined,
  });
  const btnLabel = busy ? "Отправляем" : state === "limited" ? `Подождите ${limitMin} ${plural(limitMin, ["минуту", "минуты", "минут"])}` : failed ? "Повторить" : submitLabel;

  return (
    <form ref={form} className={`lf ${className}`} noValidate onSubmit={submit} onFocus={touch} aria-busy={busy}>
      {field("name", "Имя", <input {...inProps("name")} className="in" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} />)}

      <div className="fld" role="radiogroup" aria-labelledby={fid("pref")}>
        <span className="fld__l" id={fid("pref")}>Как с вами связаться</span>
        <div className="rdos">
          {([["phone", "Позвонить"], ["email", "Написать на email"]] as const).map(([v, l]) => (
            <label key={v} className="rdo">
              <input className="vh" type="radio" name={fid("pref")} value={v} checked={f.pref === v} onChange={() => set("pref", v)} />
              <i aria-hidden="true" />{l}
            </label>
          ))}
        </div>
      </div>

      {f.pref === "phone"
        ? field("phone", "Телефон", <input {...inProps("phone")} className="in" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (___) ___-__-__" value={f.phone} onChange={(e) => set("phone", digits(e.target.value) ? maskPhone(e.target.value) : "")} />)
        : field("email", "Email", <input {...inProps("email")} className="in" type="email" inputMode="email" autoComplete="email" placeholder="имя@почта.ru" value={f.email} onChange={(e) => set("email", e.target.value)} />)}

      {type === "custom" ? (
        <div className="lf__grid">
          {field("make", "Марка", <input {...inProps("make")} className="in" autoComplete="off" value={f.make} onChange={(e) => set("make", e.target.value)} />)}
          {field("model", "Модель", <input {...inProps("model")} className="in" autoComplete="off" value={f.model} onChange={(e) => set("model", e.target.value)} />)}
          {field("year", <>Год выпуска <em>необязательно</em></>, <input {...inProps("year")} className="in" inputMode="numeric" maxLength={4} placeholder="2023" value={f.year} onChange={(e) => set("year", digits(e.target.value).slice(0, 4))} />)}
          {field("request", "Что изготовить", <textarea {...inProps("request")} className="in" placeholder="Например, передняя защита с площадкой под лебедку" value={f.request} onChange={(e) => set("request", e.target.value)} />, true)}
        </div>
      ) : null}

      {pickDelivery ? (
        <div className="fld" role="radiogroup" aria-labelledby={fid("dlv")} aria-describedby={err.delivery ? fid("delivery-e") : undefined}>
          <span className="fld__l" id={fid("dlv")}>Как получить</span>
          <div className="rdos">
            {methods.map((m, i) => (
              <label key={m.code} className="rdo">
                <input
                  className="vh"
                  type="radio"
                  name={fid("dlv")}
                  value={m.code}
                  checked={dm === m.code}
                  aria-invalid={err.delivery && i === 0 ? true : undefined}
                  onChange={() => {
                    touch();
                    setDelivery(m.code);
                    key.current = null;
                    setFailed(false);
                    setErr((e) => { const n = { ...e }; delete n.delivery; return n; });
                  }}
                />
                <i aria-hidden="true" />{m.label}
              </label>
            ))}
          </div>
          {err.delivery ? <small className="ferr" id={fid("delivery-e")}>{err.delivery}</small> : null}
        </div>
      ) : null}

      {type === "general"
        ? field("message", "Сообщение", <textarea {...inProps("message")} className="in" value={f.message} onChange={(e) => set("message", e.target.value)} />)
        : field("comment", <>Комментарий <em>необязательно</em></>, <textarea {...inProps("comment")} className="in" placeholder={type === "custom" ? "Удобное время для звонка, ссылка на фото машины" : "Год выпуска, комплектация, стоит ли лебедка или фаркоп"} value={f.comment} onChange={(e) => set("comment", e.target.value)} />)}

      {f.pref === "email" && meta.features.campaigns ? (
        <div className="lf__mail">
          <label className="chk">
            <input className="vh" type="checkbox" checked={f.mail} onChange={(e) => set("mail", e.target.checked)} />
            <i aria-hidden="true" /><span>Присылать акции на этот email</span>
          </label>
          <button type="button" className="flink" onClick={() => ui.openLegal("mail")}>Условия рассылки</button>
        </div>
      ) : null}

      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={(e) => setF((o) => ({ ...o, website: e.target.value }))} />

      {changed ? (
        <div className="lf__chg ol" role="alert">
          <b>Пока вы смотрели, каталог изменился</b>
          <span>Проверьте отмеченные позиции и отправьте заявку еще раз</span>
        </div>
      ) : null}

      <div className="lf__msg" aria-live="polite">{msg ? <span className="ferr">{msg}</span> : null}</div>

      <span className="lift lift--block">
        <button type="submit" className="btn btn--white btn--lg btn--block" aria-busy={busy} aria-disabled={busy || state === "limited" || undefined}>
          {busy ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}
          {btnLabel}
        </button>
      </span>
      <p className="lf__pd">
        Отправляя заявку, вы соглашаетесь с <button type="button" className="flink" onClick={() => ui.openLegal("pd")}>обработкой данных</button> и <button type="button" className="flink" onClick={() => ui.openLegal("policy")}>политикой конфиденциальности</button>
      </p>
    </form>
  );
}
