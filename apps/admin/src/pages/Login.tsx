import type { SessionResponse } from "@armorix/contracts";
import QRCode from "qrcode";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Done, ErrorBox, Field, useAction } from "../ui";

type Step = "email" | "code" | "enroll" | "totp" | "recovery-codes";

export function Login() {
  const { session, accept } = useAuth();
  const [step, setStep] = useState<Step>(() =>
    session && !session.mfa.passed ? (session.mfa.enrolled ? "totp" : "enroll") : "email",
  );
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [enroll, setEnroll] = useState<{ secret: string; otpauthUri: string; qr: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [pending, setPending] = useState<SessionResponse | null>(null);
  const act = useAction();

  useEffect(() => {
    document.title = "Вход · ARMORIX";
  }, []);

  const run = act.run;
  useEffect(() => {
    if (step !== "enroll" || enroll) return;
    void run(async () => {
      const r = await api<{ secret: string; otpauthUri: string }>("/auth/totp/enroll", { method: "POST" });
      setEnroll({ ...r, qr: await QRCode.toDataURL(r.otpauthUri, { margin: 0, width: 176 }) });
    });
  }, [step, enroll, run]);

  const fe = act.error?.fieldErrors ?? {};

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    const r = await act.run(() => api<{ challengeId: string }>("/auth/email/request", { body: { email } }));
    if (r) {
      setChallengeId(r.challengeId);
      setCode("");
      setStep("code");
    }
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    const s = await act.run(() => api<SessionResponse>("/auth/email/verify", { body: { challengeId, code: code.trim() } }));
    if (!s) return;
    accept(s);
    setCode("");
    setStep(s.mfa.enrolled ? "totp" : "enroll");
  }

  async function verifyTotp(e: FormEvent) {
    e.preventDefault();
    const path = useRecovery ? "/auth/recovery" : "/auth/totp/verify";
    const s = await act.run(() => api<SessionResponse & { recoveryCodes?: string[] }>(path, { body: { code: code.trim() } }));
    if (!s) return;
    if (s.recoveryCodes?.length) {
      setRecoveryCodes(s.recoveryCodes);
      setPending(s);
      setStep("recovery-codes");
      return;
    }
    accept(s);
  }

  return (
    <div className="login">
      <div className="panel">
        <img src="/admin/armorix-horizontal-light.svg" alt="ARMORIX" width="180" height="40" />
        {step === "email" && (
          <form onSubmit={sendCode} noValidate>
            <h1>Вход для сотрудников</h1>
            <Field label="Рабочий email" error={fe.email}>
              {(p) => (
                <input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
            </Field>
            <ErrorBox error={act.error?.fieldErrors.email ? null : act.error} />
            <button className="btn primary" disabled={act.busy || !email}>
              {act.busy ? "Отправляем…" : "Получить код"}
            </button>
          </form>
        )}
        {step === "code" && (
          <form onSubmit={verifyCode} noValidate>
            <h1>Код из письма</h1>
            <p className="muted">Если адрес зарегистрирован, код уже в почте {email}. Он действует 10 минут</p>
            <Field label="Код из 6 цифр" error={fe.code}>
              {(p) => (
                <input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
              )}
            </Field>
            <ErrorBox error={fe.code ? null : act.error} />
            <div className="row">
              <button className="btn primary" disabled={act.busy || code.trim().length !== 6}>
                {act.busy ? "Проверяем…" : "Войти"}
              </button>
              <button className="btn" type="button" onClick={() => setStep("email")}>
                Другой email
              </button>
            </div>
          </form>
        )}
        {step === "enroll" && (
          <div>
            <h1>Подключите приложение-аутентификатор</h1>
            <p className="muted">Отсканируйте код в Google Authenticator, Яндекс Ключе или похожем приложении, затем введите 6 цифр из него</p>
            {enroll ? (
              <>
                <img className="qr" src={enroll.qr} alt="QR-код для приложения-аутентификатора" width="200" height="200" />
                <p className="muted">
                  Ключ для ручного ввода: <span className="mono">{enroll.secret}</span>
                </p>
                <button className="btn primary" type="button" onClick={() => setStep("totp")}>
                  Приложение подключено
                </button>
              </>
            ) : (
              <ErrorBox error={act.error} />
            )}
          </div>
        )}
        {step === "totp" && (
          <form onSubmit={verifyTotp} noValidate>
            <h1>{useRecovery ? "Резервный код" : "Код из приложения"}</h1>
            <Field label={useRecovery ? "Резервный код" : "Код из 6 цифр"} error={fe.code}>
              {(p) => (
                <input
                  {...p}
                  inputMode={useRecovery ? "text" : "numeric"}
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              )}
            </Field>
            <ErrorBox error={fe.code ? null : act.error} />
            <div className="row">
              <button className="btn primary" disabled={act.busy || !code.trim()}>
                {act.busy ? "Проверяем…" : "Подтвердить"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setUseRecovery((v) => !v);
                  setCode("");
                }}
              >
                {useRecovery ? "Код из приложения" : "Нет доступа к приложению"}
              </button>
            </div>
          </form>
        )}
        {step === "recovery-codes" && (
          <div>
            <h1>Сохраните резервные коды</h1>
            <Done message="Приложение подключено" />
            <p className="muted">Каждый код работает один раз, если телефон с приложением недоступен. Больше мы их не покажем</p>
            <ul className="mono">
              {recoveryCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <button className="btn primary" type="button" onClick={() => pending && accept(pending)}>
              Коды сохранены
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
