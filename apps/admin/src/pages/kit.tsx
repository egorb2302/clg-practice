import type { ApiFailure } from "../api";

export const fieldsOf = (e: ApiFailure | null | undefined): Record<string, string> => e?.fieldErrors ?? {};

export function useConflictReload(_error: ApiFailure | null | undefined, _reload: () => void) {}

export function Problems({ error }: { error: ApiFailure | null | undefined }) {
  const items = Object.values(fieldsOf(error));
  if (!items.length) return null;
  return (
    <ul className="problems">
      {items.map((m) => (
        <li key={m}>{m}</li>
      ))}
    </ul>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

export function isoFromLocal(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  return `${local.length === 16 ? `${local}:00` : local}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

export function localFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const errorMessage = (message: string, field: string) => ({
  code: "VALIDATION" as const,
  message,
  fieldErrors: { [field]: message },
  requestId: "",
});
