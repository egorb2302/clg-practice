import { leadRequestSchema, type CatalogChange, type DeliveryMethodCode, type LeadRequest, type MetaResponse } from "@armorix/contracts";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { maskPhone, phoneE164 } from "../lib/format";
import { postLead, uuid } from "../lib/leads";
import type { SelectionItem } from "../lib/selection";
import { Icon, Sbtn } from "./ui";

export type LeadType = "catalog" | "custom" | "general";
type Props = {
  type: LeadType;
  /** one form for a question and a custom order (round 11): the car is optional, the text is
      required; with make and model filled it goes out as `custom`, otherwise as `general` */
  switchable?: boolean;
  items?: SelectionItem[];
  deliveryMethods?: MetaResponse["deliveryMethods"];
  prefill?: { make?: string; model?: string; request?: string; comment?: string };
  onSuccess?: (reference: string, submittedIds: string[]) => void;
  onCatalogChanged?: (changes: CatalogChange[]) => void;
  submitLabel?: string;
  changedMessage?: string;
  className?: string;
};
type Status =
  | { s: "idle" }
  | { s: "sending" }
  | { s: "ok"; ref: string }
  | { s: "invalid" }
  | { s: "changed" }
  | { s: "limited"; min: number }
  | { s: "busy" }
  | { s: "failed" };

export function LeadForm({ type: initialType, switchable, items = [], deliveryMethods = [], prefill = {}, onSuccess, onCatalogChanged, submitLabel = "Отправить заявку", changedMessage, className = "" }: Props) {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<LeadType>(initialType);
  const [preferred, setPreferred] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [delivery, setDelivery] = useState<DeliveryMethodCode | "">(deliveryMethods.length === 1 ? deliveryMethods[0]!.code : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>({ s: "idle" });
  const key = useRef<string | null>(null);
  const shownAt = useRef(0);

  useEffect(() => { shownAt.current = performance.now(); }, []);
  useEffect(() => setType(initialType), [initialType]);
  // a new idempotency key only after the user changes the selection or the form
  const itemsSig = items.map((i) => `${i.variantId}:${i.quantity}:${i.snapshot.priceFrom}`).join("|");
  useEffect(() => { key.current = null; }, [itemsSig, type]);
  const touched = () => { key.current = null; if (status.s !== "sending" && status.s !== "idle" && status.s !== "ok") setStatus({ s: "idle" }); };

  function body(): LeadRequest {
    const f = new FormData(form.current!);
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const contact = { preferred, ...(preferred === "phone" ? { phone: phone ? phoneE164(phone) : undefined } : { email: s("email") || undefined }) };
    const base = { name: s("name"), contact, website: s("website"), fillMs: Math.round(performance.now() - shownAt.current) };
    if (type === "catalog") {
      return { type, ...base, items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, seenPriceFrom: i.snapshot.priceFrom })), deliveryMethod: delivery || undefined, comment: s("comment") || undefined } as LeadRequest;
    }
    if (switchable) {
      const make = s("make"), model = s("model"), text = s("text"), year = Number(s("year"));
      if (make && model) return { type: "custom", ...base, vehicle: { make, model, ...(year ? { year } : {}) }, request: text } as LeadRequest;
      const car = [make, model, year ? String(year) : ""].filter(Boolean).join(" ");
      return { type: "general", ...base, message: car && text ? `${car}: ${text}` : text } as LeadRequest;
    }
    if (type === "custom") {
      const year = Number(s("year"));
      return { type, ...base, vehicle: { make: s("make"), model: s("model"), ...(year ? { year } : {}) }, request: s("request"), comment: s("comment") || undefined } as LeadRequest;
    }
    return { type, ...base, message: s("message") } as LeadRequest;
  }

  function showErrors(fe: Record<string, string>) {
    if (switchable) {
      const t = fe.message ?? fe.request;
      if (t) fe = { ...fe, text: "Напишите вопрос или что нужно изготовить" };
    }
    setErrors(fe);
    setStatus({ s: "invalid" });
    requestAnimationFrame(() => {
      const first = Object.keys(fe).map((k) => form.current?.querySelector<HTMLElement>(`[data-field="${k}"]`)).find(Boolean);
      first?.focus();
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (status.s === "sending") return; // double submit blocked
    const b = body();
    const check = leadRequestSchema.safeParse(b);
    if (!check.success) {
      const fe: Record<string, string> = {};
      for (const i of check.error.issues) fe[i.path.join(".")] ??= i.message;
      return showErrors(fe);
    }
    setErrors({});
    key.current ??= uuid(); // same key on retry after a timeout or a network error
    setStatus({ s: "sending" });
    const r = await postLead(b, key.current);
    if (r.kind === "ok") {
      setStatus({ s: "ok", ref: r.data.reference });
      onSuccess?.(r.data.reference, items.map((i) => i.variantId));
    } else if (r.kind === "invalid") showErrors(r.fieldErrors);
    else if (r.kind === "changed") { key.current = null; setStatus({ s: "changed" }); onCatalogChanged?.(r.changes); }
    else if (r.kind === "mismatch") { key.current = null; setStatus({ s: "failed" }); }
    else if (r.kind === "busy") setStatus({ s: "busy" });
    else if (r.kind === "limited") setStatus({ s: "limited", min: Math.max(1, Math.ceil(r.retryAfterSec / 60)) });
    else setStatus({ s: "failed" });
  }

  const err = (k: string) => errors[k] ? <span className="field__err" id={`${id}-${k}-e`}>{errors[k]}</span> : null;
  const aria = (k: string) => ({ "data-field": k, "aria-invalid": errors[k] ? true : undefined, "aria-describedby": errors[k] ? `${id}-${k}-e` : undefined });
  const busy = status.s === "sending";

  if (status.s === "ok") {
    return (
      <div className={`lead lead--ok ${className}`} role="status" aria-live="polite" tabIndex={-1}>
        <span className="lead__okmark"><Icon name="check" /></span>
        <h3 className="lead__okt">Заявка <span className="nw">{status.ref}</span> принята</h3>
        <ol className="lead__next">
          <li><b>Сегодня</b><span>Менеджер проверит совместимость с вашей машиной и цену комплектации</span></li>
          <li><b>В течение рабочего дня</b><span>Свяжемся {preferred === "phone" ? "по телефону" : "по email"}, который вы указали, и назовем точную стоимость</span></li>
          <li><b>После согласования</b><span>Договоримся о получении: самовывоз, транспортная компания или установка у нас</span></li>
        </ol>
        <p className="lead__ref">Номер заявки пригодится, если захотите уточнить детали: <b className="num">{status.ref}</b></p>
      </div>
    );
  }

  return (
    <form ref={form} className={`lead ${className}`} onSubmit={submit} onChange={touched} noValidate>

      <div className="lead__grid">
        <div className="field field--full">
          <label htmlFor={`${id}-name`}>Как к вам обращаться</label>
          <input id={`${id}-name`} name="name" autoComplete="name" maxLength={80} defaultValue="" {...aria("name")} />
          {err("name")}
        </div>

        <fieldset className="field field--full radios">
          <legend>Как удобнее связаться</legend>
          <label><input type="radio" name="preferred" value="phone" checked={preferred === "phone"} onChange={() => setPreferred("phone")} /><span>Позвонить</span></label>
          <label><input type="radio" name="preferred" value="email" checked={preferred === "email"} onChange={() => setPreferred("email")} /><span>Написать на email</span></label>
        </fieldset>

        {preferred === "phone" ? (
          <div className="field field--full">
            <label htmlFor={`${id}-phone`}>Телефон</label>
            <input id={`${id}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+7 (900) 000-00-00" value={phone} onChange={(e) => setPhone(e.target.value ? maskPhone(e.target.value) : "")} {...aria("contact.phone")} />
            {err("contact.phone")}
          </div>
        ) : (
          <div className="field field--full">
            <label htmlFor={`${id}-email`}>Email</label>
            <input id={`${id}-email`} name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="name@mail.ru" {...aria("contact.email")} />
            {err("contact.email")}
          </div>
        )}

        {switchable ? (
          <>
            <p className="lead__hint field--full">Машина <em>необязательно</em><span>{"Укажите марку и модель, если нужна защита под заказ"}</span></p>
            <div className="field">
              <label htmlFor={`${id}-make`}>Марка</label>
              <input id={`${id}-make`} name="make" maxLength={60} defaultValue={prefill.make} placeholder="Tank" {...aria("vehicle.make")} />
              {err("vehicle.make")}
            </div>
            <div className="field">
              <label htmlFor={`${id}-model`}>Модель</label>
              <input id={`${id}-model`} name="model" maxLength={60} defaultValue={prefill.model} placeholder="300" {...aria("vehicle.model")} />
              {err("vehicle.model")}
            </div>
            <div className="field">
              <label htmlFor={`${id}-year`}>Год</label>
              <input id={`${id}-year`} name="year" inputMode="numeric" maxLength={4} placeholder="2024" {...aria("vehicle.year")} />
              {err("vehicle.year")}
            </div>
            <div className="field field--full">
              <label htmlFor={`${id}-text`}>Ваш вопрос или что нужно изготовить <em className="req">обязательно</em></label>
              <textarea id={`${id}-text`} name="text" maxLength={2000} rows={4} required defaultValue={prefill.request} placeholder="Например, подойдет ли защита к машине с фаркопом, или передняя дуга с площадкой под лебедку" {...aria("text")} />
              {err("text")}
            </div>
          </>
        ) : type === "custom" ? (
          <>
            <div className="field">
              <label htmlFor={`${id}-make`}>Марка</label>
              <input id={`${id}-make`} name="make" maxLength={60} defaultValue={prefill.make} placeholder="Например, Tank" {...aria("vehicle.make")} />
              {err("vehicle.make")}
            </div>
            <div className="field">
              <label htmlFor={`${id}-model`}>Модель</label>
              <input id={`${id}-model`} name="model" maxLength={60} defaultValue={prefill.model} placeholder="300" {...aria("vehicle.model")} />
              {err("vehicle.model")}
            </div>
            <div className="field">
              <label htmlFor={`${id}-year`}>Год выпуска <em>необязательно</em></label>
              <input id={`${id}-year`} name="year" inputMode="numeric" maxLength={4} placeholder="2024" {...aria("vehicle.year")} />
              {err("vehicle.year")}
            </div>
            <div className="field field--full">
              <label htmlFor={`${id}-req`}>Что нужно изготовить</label>
              <textarea id={`${id}-req`} name="request" maxLength={2000} rows={3} defaultValue={prefill.request} placeholder="Передняя защита с площадкой под лебедку, сталь AISI 304" {...aria("request")} />
              {err("request")}
            </div>
          </>
        ) : null}

        {type === "general" && !switchable ? (
          <div className="field field--full">
            <label htmlFor={`${id}-msg`}>Ваш вопрос</label>
            <textarea id={`${id}-msg`} name="message" maxLength={2000} rows={4} placeholder="Например, подойдет ли защита к машине с фаркопом" {...aria("message")} />
            {err("message")}
          </div>
        ) : null}

        {type === "catalog" && deliveryMethods.length > 1 ? (
          <fieldset className="field field--full radios radios--col">
            <legend>Способ получения</legend>
            {deliveryMethods.map((m) => (
              <label key={m.code}><input type="radio" name="delivery" value={m.code} checked={delivery === m.code} onChange={() => setDelivery(m.code)} /><span>{m.label}</span></label>
            ))}
            {err("deliveryMethod")}
          </fieldset>
        ) : null}

        {type !== "general" && !switchable ? (
          <div className="field field--full">
            <label htmlFor={`${id}-comment`}>Комментарий <em>необязательно</em></label>
            <textarea id={`${id}-comment`} name="comment" maxLength={1000} rows={2} defaultValue={prefill.comment} {...aria("comment")} />
            {err("comment")}
          </div>
        ) : null}

        {/* honeypot: people never see or fill it */}
        <div className="hp" aria-hidden="true">
          <label htmlFor={`${id}-website`}>Сайт</label>
          <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
        </div>
        {errors.items ? <p className="field__err field--full">{errors.items}</p> : null}
      </div>

      <div className="lead__send">
        <Sbtn type="submit" className="sbtn--lg" busy={busy}>{busy ? "Отправляем…" : status.s === "failed" ? "Повторить" : submitLabel}</Sbtn>
        <p>Нажимая кнопку, вы соглашаетесь с <Link to="/privacy">обработкой данных</Link></p>
      </div>
      <p className={`lead__status${status.s === "idle" || status.s === "sending" ? "" : " is-shown"}`} role="status" aria-live="polite">
        {status.s === "sending" ? "Отправляем заявку…" : null}
        {status.s === "invalid" ? "Проверьте отмеченные поля" : null}
        {status.s === "changed" ? (changedMessage ?? "Пока вы выбирали, в каталоге изменились позиции: проверьте подборку выше и отправьте снова") : null}
        {status.s === "busy" ? "Заявка уже обрабатывается, нажмите «Повторить» через несколько секунд" : null}
        {status.s === "limited" ? `Слишком много попыток, попробуйте через ${status.min} мин` : null}
        {status.s === "failed" ? "Не удалось отправить, данные сохранены: нажмите «Повторить»" : null}
      </p>
    </form>
  );
}
