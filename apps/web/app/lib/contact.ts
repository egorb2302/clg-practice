import { useSyncExternalStore } from "react";
import { maskPhone } from "./format";

export type Contact = { name: string; pref: "phone" | "email"; phone: string; email: string };

const KEY = "armorix.contact.v1";
const EMPTY: Contact = { name: "", pref: "phone", phone: "", email: "" };
let cache: Contact | null = null;
const subs = new Set<() => void>();

function read(): Contact {
  if (cache) return cache;
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<Contact> | null;
    cache = v && typeof v === "object"
      ? { name: String(v.name ?? ""), pref: v.pref === "email" ? "email" : "phone", phone: String(v.phone ?? ""), email: String(v.email ?? "") }
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(next: Contact) {
  cache = next;
  try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { cache = next; }
  subs.forEach((f) => f());
}

export const contact = {
  get: read,
  set(patch: Partial<Contact>) {
    const cur = read();
    const next = { ...cur, ...patch };
    if (next.name === cur.name && next.pref === cur.pref && next.phone === cur.phone && next.email === cur.email) return;
    write(next);
  },
  fromProfile(p: { name: string | null; phone: string | null; email: string | null }) {
    const cur = read();
    contact.set({
      name: cur.name || p.name?.trim() || "",
      phone: cur.phone || (p.phone ? maskPhone(p.phone) : ""),
      email: cur.email || p.email || "",
      pref: cur.phone || cur.email ? cur.pref : p.phone || !p.email ? "phone" : "email",
    });
  },
};

export function useContact(): Contact {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    read,
    () => EMPTY,
  );
}
