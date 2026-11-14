import { useEffect, useId, useRef, useState } from "react";
import { contact as saved, useContact } from "../../lib/contact";
import { maskPhone, phoneE164, telegramLink } from "../../lib/format";
import { postLead, uuid, waitFill } from "../../lib/leads";
import { useModal } from "../../lib/modal";
import { useSelection } from "../../lib/selection";
import { telHref, useSite, vkLink } from "../../lib/site";
import { ui, useUi } from "../../lib/ui";
import { useVehicle } from "../../lib/vehicle";
import { Icon, VkMark } from "./Icon";

export function ContactFab() {
  const open = useUi((s) => s.contact);
  const { meta } = useSite();
  const c = meta.contacts;
  const items = useSelection();
  const car = useVehicle();
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState("");
  const [hp, setHp] = useState("");
  const [err, setErr] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "limited" | "done">("idle");
  const [ref_, setRef] = useState("");
  const key = useRef<string | null>(null);
  const started = useRef<number | null>(null);
  const known = useContact();
  useEffect(() => { setPhone(known.phone); }, [known.phone]);
  useEffect(() => { if (open) started.current ??= Date.now(); }, [open]);
  const close = () => ui.setContact(false);
  useModal(ref, open, close, { fallback: ".fab__btn, .bb [aria-controls='contact-p']" });

  const ok = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state === "done") ok.current?.focus(); }, [state]);

  useEffect(() => {
    if (state !== "limited") return;
    const t = window.setTimeout(() => { setState("idle"); setErr(""); }, 60_000);
    return () => window.clearTimeout(t);
  }, [state]);

  const tel = telHref(c.phone);
  const tg = c.telegram ? telegramLink(c.telegram) : null;
  const vk = vkLink(c.vk);
  const callAlt = c.phone ? ` или позвоните ${c.phone}` : "";

  async function send() {
    if (state === "sending" || state === "limited") return;
    const d = phone.replace(/\D/g, "");
    if (d.length !== 11) {
      setErr(d.length > 1 ? "Не хватает цифр: нужен номер из 10 цифр после +7" : "Укажите телефон, по нему перезвоним");
      input.current?.focus();
      return;
    }
    const lines = ["Перезвоните мне"];
    if (car) lines.push(`Машина: ${car.label}`);
    if (items.length) {
      lines.push("Подборка:");
      for (const i of items) lines.push(`${i.snapshot.title}${i.snapshot.variantTitle ? `, ${i.snapshot.variantTitle}` : ""}${i.snapshot.vehicleLabel ? `, ${i.snapshot.vehicleLabel}` : ""} × ${i.quantity}`);
    }
    key.current ??= uuid();
    setState("sending");
    setErr("");
    const k = key.current;
    await waitFill(started.current ?? Date.now());
    const r = await postLead({
      type: "general",
      name: "Обратный звонок",
      contact: { preferred: "phone", phone: phoneE164(phone) },
      message: lines.join("\n").slice(0, 2000),
      website: hp,
      fillMs: Date.now() - (started.current ?? Date.now()),
    }, k);
    if (r.kind === "ok") { setRef(r.data.reference); setState("done"); key.current = null; return; }
    if (r.kind === "limited") { setState("limited"); setErr(`Слишком много попыток. Подождите минуту${callAlt}`); return; }
    setState("idle");
    if (r.kind === "invalid") { setErr("Сервер не принял этот номер, проверьте его"); input.current?.focus(); return; }
    if (r.kind === "mismatch") key.current = null;
    if (r.kind === "busy") { setErr("Заявка уже отправляется, подождите несколько секунд"); return; }
    setErr(`Не отправилось. Попробуйте еще раз${callAlt}`);
  }

  const note = items.length
    ? `Подборка (${items.length}) уйдет вместе с заявкой`
    : car ? `Машина ${car.label} уйдет вместе с заявкой` : "Один звонок, на сайте ничего не оплачивается";

  return (
    <>
      <button type="button" className={`scrim scrim--clear${open ? " is-on" : ""}`} tabIndex={-1} aria-hidden="true" onClick={close} />
      <div className={`fab${open ? " is-open" : ""}`}>
        <div ref={ref} id="contact-p" className={`fab__p ol${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-labelledby={`${id}-h`} inert={!open}>
          <div className="fab__h"><h2 id={`${id}-h`} tabIndex={-1}>Связаться</h2>{c.hours ? <span>{c.hours}</span> : null}</div>
          {tel && c.phone ? (
            <a className="fab__i" href={tel}><span className="ar ol" aria-hidden="true"><Icon name="phone" size={18} /></span><span><b>Позвонить</b><small>{c.phone}</small></span></a>
          ) : null}
          {tg ? (
            <a className="fab__i" href={tg.href} target="_blank" rel="noopener noreferrer"><span className="ar ol" aria-hidden="true"><Icon name="telegram" size={18} /></span><span><b>Написать в Telegram</b><small>{tg.label}</small></span></a>
          ) : null}
          {vk ? (
            <a className="fab__i" href={vk.href} target="_blank" rel="noopener noreferrer"><span className="ar ol" aria-hidden="true"><VkMark /></span><span><b>Написать во ВКонтакте</b><small>{vk.label}</small></span></a>
          ) : null}
          {c.email ? (
            <a className="fab__i" href={`mailto:${c.email}`}><span className="ar ol" aria-hidden="true"><Icon name="mail" size={18} /></span><span><b>Написать на почту</b><small>{c.email}</small></span></a>
          ) : null}
          {state === "done" ? (
            <div ref={ok} className="fab__ok" role="status" tabIndex={-1}>
              <b>Заявка {ref_} принята</b>
              <span>Перезвоним в рабочее время{c.hours ? ` (${c.hours})` : ""}{items.length ? ", подборка у менеджера" : ""}</span>
            </div>
          ) : (
            <form className="fab__cb" noValidate onSubmit={(e) => { e.preventDefault(); void send(); }}>
              <label className="fld__l" htmlFor={`${id}-ph`}>Или оставьте телефон, перезвоним сами</label>
              <input
                ref={input}
                id={`${id}-ph`}
                className="in"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+7 (___) ___-__-__"
                value={phone}
                aria-invalid={err && state !== "limited" ? true : undefined}
                aria-describedby={err ? `${id}-e` : undefined}
                onFocus={() => { started.current ??= Date.now(); }}
                onChange={(e) => {
                  started.current ??= Date.now();
                  const v = e.target.value.replace(/\D/g, "") ? maskPhone(e.target.value) : "";
                  setPhone(v);
                  saved.set({ phone: v });
                  key.current = null;
                  if (state !== "limited") setErr("");
                }}
              />
              <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" value={hp} onChange={(e) => setHp(e.target.value)} />
              <div aria-live="polite">{err ? <small className="ferr" id={`${id}-e`}>{err}</small> : null}</div>
              <span className="lift lift--block">
                <button type="submit" className="btn btn--white btn--block" aria-busy={state === "sending"} aria-disabled={state === "sending" || state === "limited" || undefined}>
                  {state === "sending" ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}
                  {state === "sending" ? "Отправляем" : state === "limited" ? "Подождите минуту" : "Перезвоните мне"}
                </button>
              </span>
              <small className="fab__note">{note}</small>
              <span className="lf__pd">Отправляя, вы соглашаетесь с <button type="button" className="flink" onClick={() => ui.openLegal("pd")}>обработкой данных</button></span>
            </form>
          )}
        </div>
        <div className="fab__row">
          <span className="fab__lbl" aria-hidden="true">Связаться</span>
          <button type="button" className="fab__btn ol" aria-label="Связаться с нами" aria-expanded={open} aria-controls="contact-p" onClick={() => ui.setContact(!open)}>
            <Icon name={open ? "close" : "mail"} />
          </button>
        </div>
      </div>
    </>
  );
}
