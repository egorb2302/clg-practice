import { useSyncExternalStore } from "react";
import { maskPhone } from "./format";

export type ContactFields = { name: string; pref: "phone" | "email"; phone: string; email: string };
export type Contact = ContactFields & { owner: string | null };
export const CONTACT_FIELDS = ["name", "pref", "phone", "email"] as const;

const KEY = "armorix.contact.v1";
const EMPTY: Contact = { name: "", pref: "phone", phone: "", email: "", owner: null };
let cache: Contact | null = null;
const subs = new Set<() => void>();

function read(): Contact {
  if (cache) return cache;
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<Contact> | null;
    cache = v && typeof v === "object"
      ? {
          name: String(v.name ?? ""),
          pref: v.pref === "email" ? "email" : "phone",
          phone: String(v.phone ?? ""),
          email: String(v.email ?? ""),
          owner: typeof v.owner === "string" ? v.owner : null,
        }
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Contact) {
  cache = next;
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { return notify(); }
  notify();
}

function notify() {
  subs.forEach((f) => f());
}

export const contact = {
  get: read,
  set(patch: Partial<ContactFields>) {
    const cur = read();
    const next = { ...cur, ...patch };
    if (CONTACT_FIELDS.every((k) => next[k] === cur[k])) return;
    write(next);
  },
  fromProfile(p: { id: string; name: string | null; phone: string | null; email: string | null }) {
    const cur = read();
    if (cur.owner === p.id) {
      contact.set({
        name: cur.name || p.name?.trim() || "",
        phone: cur.phone || (p.phone ? maskPhone(p.phone) : ""),
        email: cur.email || p.email || "",
      });
      return;
    }
    const base = cur.owner ? EMPTY : cur;
    write({
      name: p.name?.trim() || base.name,
      phone: p.phone ? maskPhone(p.phone) : base.phone,
      email: p.email || base.email,
      pref: p.phone ? "phone" : p.email && !base.phone ? "email" : base.pref,
      owner: p.id,
    });
  },
  signedIn(id: string) {
    const cur = read();
    if (cur.owner && cur.owner !== id) write(EMPTY);
  },
  clear() {
    write(EMPTY);
  },
};

export function useContact(): Contact {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    read,
    () => EMPTY,
  );
}
