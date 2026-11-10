import type { Config } from "../config.js";
import { PermanentError, RetryLaterError } from "./errors.js";

export interface TelegramAdapter {
  call(method: string, params: Record<string, unknown>): Promise<unknown>;
}

export class MemoryTelegram implements TelegramAdapter {
  calls: { method: string; params: Record<string, unknown> }[] = [];
  failWith: Error | null = null;
  constructor(private echo = false) {}
  async call(method: string, params: Record<string, unknown>) {
    if (this.failWith) throw this.failWith;
    this.calls.push({ method, params });
    if (this.echo) console.log(JSON.stringify({ level: "info", event: "telegram.log", method, chat: params.chat_id, text: params.text }));
    return { ok: true };
  }
}

export class HttpTelegram implements TelegramAdapter {
  constructor(private token: string) {}
  async call(method: string, params: Record<string, unknown>) {
    let res: Response;
    try {
      res = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new Error("telegram network error");
    }
    const body = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      parameters?: { retry_after?: number };
    };
    if (res.ok && body.ok) return body;
    if (res.status === 429) throw new RetryLaterError("telegram 429", body.parameters?.retry_after ?? 30);
    if (res.status >= 400 && res.status < 500) throw new PermanentError(`telegram ${res.status}`);
    throw new Error(`telegram ${res.status}`);
  }
}

export function createTelegram(cfg: Config): TelegramAdapter {
  return cfg.TELEGRAM_TRANSPORT === "http" && cfg.TELEGRAM_BOT_TOKEN
    ? new HttpTelegram(cfg.TELEGRAM_BOT_TOKEN)
    : new MemoryTelegram(true);
}
