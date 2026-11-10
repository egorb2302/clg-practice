import type { ApiError, MetaResponse, SessionResponse } from "@armorix/contracts";

export class ApiFailure extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.message);
  }
  get fieldErrors() {
    return this.body.fieldErrors ?? {};
  }
}

let csrf = "";
export const setCsrf = (t: string) => {
  csrf = t;
};
export const getCsrf = () => csrf;

export async function uploadFile(url: string, file: File) {
  const sameOrigin = url.startsWith("/");
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream", ...(sameOrigin && csrf ? { "X-CSRF-Token": csrf } : {}) },
    credentials: sameOrigin ? "same-origin" : "omit",
    body: file,
  }).catch(() => null);
  if (!res || !res.ok) {
    throw new ApiFailure(res?.status ?? 0, { code: "INTERNAL", message: "Не удалось загрузить файл", requestId: "" });
  }
}

type Options = { method?: string; body?: unknown; idempotencyKey?: string; signal?: AbortSignal };

export async function api<T>(path: string, opts: Options = {}): Promise<T> {
  const method = opts.method ?? (opts.body === undefined ? "GET" : "POST");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrf) headers["X-CSRF-Token"] = csrf;
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      headers,
      credentials: "same-origin",
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
    });
  } catch {
    throw new ApiFailure(0, { code: "INTERNAL", message: "Нет связи с сервером, проверьте интернет", requestId: "" });
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const body = data as ApiError;
    if (res.status === 401 && body.code !== "VALIDATION") window.dispatchEvent(new CustomEvent("armorix:unauthorized", { detail: body.code }));
    throw new ApiFailure(res.status, { ...body, message: body.message ?? "Ошибка запроса" });
  }
  return data as T;
}

export const getSession = () => api<SessionResponse>("/auth/session");
export const getMeta = () => api<MetaResponse>("/meta");

export const rub = (kopecks: number | null | undefined) =>
  kopecks === null || kopecks === undefined ? "Уточнить цену" : `${new Intl.NumberFormat("ru-RU").format(Math.round(kopecks / 100))} ₽`;

export const toKopecks = (rubles: string) => {
  const n = Number(rubles.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Moscow" }).format(new Date(iso)) : "";

export const newKey = () => crypto.randomUUID();

export const leadStatusLabels: Record<string, string> = {
  new: "Новая",
  in_progress: "В работе",
  offer_agreed: "Предложение согласовано",
  sale_confirmed: "Продажа подтверждена",
  closed: "Закрыта",
};

export const leadTypeLabels: Record<string, string> = {
  catalog: "По каталогу",
  custom: "Индивидуальное изготовление",
  general: "Общий вопрос",
};

export const closeReasonLabels: Record<string, string> = {
  no_contact: "Не удалось связаться",
  price: "Не подошла цена",
  no_solution: "Нет совместимого решения",
  spam: "Дубль или спам",
  other: "Другое",
};

export const saleStatusLabels: Record<string, string> = {
  draft: "Черновик",
  confirmed: "Подтверждена",
  partially_refunded: "Частичный возврат",
  refunded: "Возврат",
};
