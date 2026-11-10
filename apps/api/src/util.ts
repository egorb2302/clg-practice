export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (digits.startsWith("7") && digits.length !== 11) return null;
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) return `+7${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("9")) return `+7${digits}`;
  return null;
}

export const normalizeEmail = (raw: string) => raw.trim().toLowerCase();

export function maskPhone(p: string | null) {
  if (!p) return null;
  return p.length > 6 ? `${p.slice(0, 2)}***${p.slice(-4)}` : "***";
}

export function maskEmail(e: string | null) {
  if (!e) return null;
  const [user = "", domain = ""] = e.split("@");
  return `${user.slice(0, 1)}***@${domain}`;
}

export const formatRub = (kopecks: number) =>
  `${new Intl.NumberFormat("ru-RU").format(Math.round(kopecks / 100)).replace(/ /g, " ")} ₽`;
