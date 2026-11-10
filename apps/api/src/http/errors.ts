import type { ErrorCode } from "@armorix/contracts";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound = (message = "Не найдено") => new HttpError(404, "NOT_FOUND", message);
export const forbidden = (message = "Недостаточно прав") => new HttpError(403, "FORBIDDEN", message);
export const versionConflict = () =>
  new HttpError(409, "VERSION_CONFLICT", "Запись изменилась, обновите страницу и повторите");

export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(422, "VALIDATION", "Проверьте поля формы", { fieldErrors: fieldErrorsOf(r.error) });
  }
  return r.data;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const requestId = res.locals.requestId as string;
  if (err instanceof HttpError) {
    res.status(err.status).json({ code: err.code, message: err.message, ...err.extra, requestId });
    return;
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === "entity.too.large") {
    res.status(413).json({ code: "PAYLOAD_TOO_LARGE", message: "Слишком большой запрос", requestId });
    return;
  }
  if (e?.type === "entity.parse.failed") {
    res.status(400).json({ code: "VALIDATION", message: "Некорректный JSON", requestId });
    return;
  }
  console.error(JSON.stringify({ level: "error", requestId, path: req.path, error: String((err as Error)?.stack ?? err) }));
  res.status(500).json({ code: "INTERNAL", message: "Внутренняя ошибка, попробуйте позже", requestId });
}
