import nodemailer from "nodemailer";
import type { Config } from "../config";
import { PermanentError } from "./errors";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
};

export interface EmailAdapter {
  send(msg: EmailMessage): Promise<{ messageId: string }>;
}

export class MemoryEmail implements EmailAdapter {
  sent: EmailMessage[] = [];
  failWith: Error | null = null;
  constructor(private echo = false) {}
  async send(msg: EmailMessage) {
    if (this.failWith) throw this.failWith;
    this.sent.push(msg);
    if (this.echo) console.log(JSON.stringify({ level: "info", event: "email.log", to: msg.to, subject: msg.subject, text: msg.text }));
    return { messageId: `log-${this.sent.length}` };
  }
}

export class SmtpEmail implements EmailAdapter {
  private transport;
  constructor(private cfg: Config) {
    this.transport = nodemailer.createTransport({
      host: cfg.SMTP_HOST,
      port: cfg.SMTP_PORT,
      secure: cfg.SMTP_PORT === 465,
      auth: { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }
  async send(msg: EmailMessage) {
    try {
      const info = await this.transport.sendMail({ from: this.cfg.EMAIL_FROM, ...msg });
      return { messageId: String(info.messageId) };
    } catch (e) {
      const code = (e as { responseCode?: number }).responseCode;
      if (code && code >= 500 && code < 600 && code !== 530 && code !== 535) throw new PermanentError(`smtp ${code}`);
      throw new Error(`smtp ${code ?? (e as { code?: string }).code ?? "error"}`);
    }
  }
}

export function createEmail(cfg: Config): EmailAdapter {
  return cfg.EMAIL_TRANSPORT === "smtp" ? new SmtpEmail(cfg) : new MemoryEmail(cfg.NODE_ENV !== "production");
}
