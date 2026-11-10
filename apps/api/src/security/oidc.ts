import { createPublicKey, verify, type JsonWebKey } from "node:crypto";

export const TELEGRAM_ISSUER = "https://oauth.telegram.org";
export const TELEGRAM_JWKS_URL = "https://oauth.telegram.org/.well-known/jwks.json";

export type Jwk = JsonWebKey & { kid?: string; alg?: string; kty: string };
export type JwksSource = () => Promise<Jwk[]>;

export type TelegramClaims = {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nonce?: string;
  name?: string;
  preferred_username?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
};

let cache: { at: number; keys: Jwk[] } | null = null;

export const refetchTelegramJwks: JwksSource = async () => {
  if (cache && Date.now() - cache.at < 60_000) return cache.keys;
  cache = null;
  return fetchTelegramJwks();
};

export const fetchTelegramJwks: JwksSource = async () => {
  if (cache && Date.now() - cache.at < 3600_000) return cache.keys;
  const res = await fetch(TELEGRAM_JWKS_URL, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  cache = { at: Date.now(), keys: body.keys ?? [] };
  return cache.keys;
};

const b64 = (s: string) => Buffer.from(s, "base64url");

export class TokenError extends Error {}

export async function verifyTelegramIdToken(
  token: string,
  opts: { clientId: string; nonce: string; jwks: JwksSource; refetch?: JwksSource; nowSec?: number },
): Promise<TelegramClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new TokenError("malformed token");
  const [h, p, s] = parts as [string, string, string];
  let header: { alg?: string; kid?: string };
  let claims: TelegramClaims;
  try {
    header = JSON.parse(b64(h).toString("utf8"));
    claims = JSON.parse(b64(p).toString("utf8"));
  } catch {
    throw new TokenError("malformed token");
  }
  const algs: Record<string, { hash: string; dsa?: "ieee-p1363" }> = {
    RS256: { hash: "sha256" },
    ES256: { hash: "sha256", dsa: "ieee-p1363" },
  };
  const alg = header.alg ? algs[header.alg] : undefined;
  if (!alg) throw new TokenError("unsupported alg");
  const kty = header.alg === "RS256" ? "RSA" : "EC";
  const pick = (keys: Jwk[]) =>
    keys.find((k) => k.kty === kty && (header.kid ? k.kid === header.kid : true) && (!k.alg || k.alg === header.alg));
  let jwk = pick(await opts.jwks());
  if (!jwk && opts.refetch) jwk = pick(await opts.refetch());
  if (!jwk) throw new TokenError("unknown key");
  let ok = false;
  try {
    const key = createPublicKey({ key: jwk, format: "jwk" });
    ok = verify(alg.hash, Buffer.from(`${h}.${p}`), alg.dsa ? { key, dsaEncoding: alg.dsa } : key, b64(s));
  } catch {
    throw new TokenError("bad key");
  }
  if (!ok) throw new TokenError("bad signature");

  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  if (claims.iss !== TELEGRAM_ISSUER) throw new TokenError("bad issuer");
  const aud = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud)];
  if (!aud.includes(opts.clientId)) throw new TokenError("bad audience");
  if (typeof claims.exp !== "number" || claims.exp < now - 30) throw new TokenError("expired");
  if (!claims.nonce || claims.nonce !== opts.nonce) throw new TokenError("bad nonce");
  if (!claims.sub) throw new TokenError("no subject");
  return claims;
}
