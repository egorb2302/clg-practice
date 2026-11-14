import { type FormEvent, useId, useRef, useState } from "react";
import { emailOk, send } from "../../lib/account";
import { ui } from "../../lib/ui";

type Props = { source: string; light?: boolean; submitLabel?: string; label?: string; doneTitle?: string };

export function SubscribeForm({ source, light, submitLabel = "Подписаться", label = "Email для рассылки", doneTitle = "Осталось подтвердить" }: Props) {
  const id = useId().replace(/:/g, "");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const input = useRef<HTMLInputElement>(null);
  const again = useRef<HTMLButtonElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (state === "sending") return;
    const v = email.trim();
    if (!emailOk(v)) {
      setErr(v ? "Проверьте адрес, нужен вид name@mail.ru" : "Укажите email");
      input.current?.focus();
      return;
    }
    setState("sending");
    setErr("");
    const r = await send("POST", "/subscriptions", { email: v, consent: true, source });
    if (r.status === 202 || r.status === 200) {
      setState("done");
      setTimeout(() => again.current?.focus(), 30);
      return;
    }
    setState("idle");
    setErr(r.status === 422 || r.status === 400 ? "Проверьте адрес, нужен вид name@mail.ru" : r.status === 429 ? "Слишком много попыток, попробуйте через час" : r.status === 0 ? "Нет связи, проверьте интернет и попробуйте еще раз" : "Не удалось подписаться, попробуйте еще раз");
  }

  return (
    <div className={`sb-form${light ? " on-light" : ""}`}>
      <div aria-live="polite">
        {state === "done" ? (
          <div className="sb-form__ok" role="status">
            <b>{doneTitle}</b>
            <span>Отправили письмо на {email.trim()}. Нажмите ссылку в нем, без этого рассылка не начнется</span>
            <button ref={again} type="button" className="flink" onClick={() => { setState("idle"); setEmail(""); setTimeout(() => input.current?.focus(), 30); }}>Другой адрес</button>
          </div>
        ) : null}
      </div>
      {state !== "done" ? (
        <form noValidate onSubmit={submit} className="sb-form__f">
          <div className="sb-form__row">
            <input
              ref={input}
              className={`in${light ? " in--light" : ""}`}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@mail.ru"
              aria-label={label}
              aria-invalid={err ? true : undefined}
              aria-describedby={err ? `${id}-e` : undefined}
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErr(""); }}
            />
            <span className={`lift${light ? " lift--ink" : ""}`}>
              <button type="submit" className={`btn ${light ? "btn--dark" : "btn--light"}`} aria-busy={state === "sending"}>
                {state === "sending" ? <span className="busy" aria-hidden="true"><i /><i /><i /></span> : null}{submitLabel}
              </button>
            </span>
          </div>
          {err ? <small className="ferr" id={`${id}-e`} role="alert">{err}</small> : null}
          <span className="sb-form__pd">Подписываясь, вы соглашаетесь с <button type="button" className="flink" onClick={() => ui.openLegal("mail")}>рассылкой</button> и <button type="button" className="flink" onClick={() => ui.openLegal("pd")}>обработкой данных</button></span>
        </form>
      ) : null}
    </div>
  );
}
