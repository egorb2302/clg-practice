import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ApiFailure } from "./api";

export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data?: T; error?: ApiFailure; loading: boolean }>({ loading: true });
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const ctl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: undefined }));
    loadRef
      .current(ctl.signal)
      .then((data) => !ctl.signal.aborted && setState({ data, loading: false }))
      .catch((error) => !ctl.signal.aborted && setState({ error: asFailure(error), loading: false }));
    return () => ctl.abort();
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export const asFailure = (e: unknown) =>
  e instanceof ApiFailure ? e : new ApiFailure(0, { code: "INTERNAL", message: "Что-то пошло не так", requestId: "" });

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiFailure | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>, okMessage?: string) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await fn();
      if (okMessage) setDone(okMessage);
      return r;
    } catch (e) {
      setError(asFailure(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, done, run, setError };
}

export function Loading({ label = "Загружаем" }: { label?: string }) {
  return (
    <p className="muted" role="status">
      {label}…
    </p>
  );
}

export function ErrorBox({ error, onRetry }: { error?: ApiFailure | null; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      {error.message}
      {error.body.requestId ? <span className="muted mono"> · {error.body.requestId}</span> : null}
      {onRetry ? (
        <>
          {" "}
          <button className="btn small" type="button" onClick={onRetry}>
            Повторить
          </button>
        </>
      ) : null}
    </div>
  );
}

export function Done({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div className="notice ok" role="status">
      {message}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
};

export function Field({ label, error, hint, children }: FieldProps) {
  const id = useId();
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-err` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, ...(error ? { "aria-invalid": true } : {}), ...(describedBy ? { "aria-describedby": describedBy } : {}) })}
      {hint ? (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="err" id={`${id}-err`}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

export function Badge({ kind, children }: { kind?: "new" | "ok" | "bad" | "work"; children: ReactNode }) {
  return <span className={`badge ${kind ?? ""}`}>{children}</span>;
}

export function PageHead({ title, children }: { title: string; children?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · ARMORIX`;
  }, [title]);
  return (
    <div className="page-head">
      <h1>{title}</h1>
      {children ? <div className="row">{children}</div> : null}
    </div>
  );
}
