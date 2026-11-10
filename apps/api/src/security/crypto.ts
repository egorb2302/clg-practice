import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export const sha256 = (data: string | Buffer) => createHash("sha256").update(data).digest();

export const hmac = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest();

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export const randomDigits = (n: number) => Array.from({ length: n }, () => randomInt(10)).join("");

export function safeEqual(a: Buffer | string, b: Buffer | string) {
  const x = Buffer.isBuffer(a) ? a : Buffer.from(a);
  const y = Buffer.isBuffer(b) ? b : Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function encrypt(keyB64: string, plain: string) {
  const key = Buffer.from(keyB64, "base64");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(keyB64: string, packed: string) {
  const [iv, tag, body] = packed.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !body) throw new Error("bad ciphertext");
  const d = createDecipheriv("aes-256-gcm", Buffer.from(keyB64, "base64"), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

export function fingerprint(value: unknown) {
  return sha256(stableStringify(value)).toString("hex");
}

function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`)
    .join(",")}}`;
}
