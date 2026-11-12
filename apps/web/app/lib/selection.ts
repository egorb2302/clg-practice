/* The selection («подборка»): localStorage key armorix.selection.v1. Snapshot is for
   display only; the server re-validates on submit. Works without storage (memory). */
import { useSyncExternalStore } from "react";

export type SelectionItem = {
  variantId: string;
  productSlug: string;
  vehicleSlug: string;
  quantity: number;
  snapshot: { title: string; priceFrom: number | null; imageUrl: string | null; variantTitle?: string; vehicleLabel?: string };
};

const KEY = "armorix.selection.v1";
const EMPTY: SelectionItem[] = [];
let memory: SelectionItem[] = EMPTY;
let cache: SelectionItem[] | null = null;
const subs = new Set<() => void>();

function read(): SelectionItem[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed) ? (parsed as SelectionItem[]).filter((i) => i && typeof i.variantId === "string") : [];
  } catch {
    cache = memory;
  }
  return cache;
}
function write(next: SelectionItem[]) {
  cache = next;
  memory = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage off: memory only */ }
  subs.forEach((f) => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { cache = null; f(); } };
  window.addEventListener("storage", onStorage);
  return () => { subs.delete(f); window.removeEventListener("storage", onStorage); };
}

export function useSelection() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export const selection = {
  add(item: Omit<SelectionItem, "quantity">, quantity = 1) {
    const cur = read();
    const found = cur.find((i) => i.variantId === item.variantId);
    write(found
      ? cur.map((i) => (i.variantId === item.variantId ? { ...i, quantity: Math.min(20, i.quantity + quantity), snapshot: item.snapshot } : i))
      : [...cur, { ...item, quantity }]);
  },
  setQuantity(variantId: string, q: number) {
    write(read().map((i) => (i.variantId === variantId ? { ...i, quantity: Math.max(1, Math.min(20, q)) } : i)));
  },
  setPrice(variantId: string, priceFrom: number | null) {
    write(read().map((i) => (i.variantId === variantId ? { ...i, snapshot: { ...i.snapshot, priceFrom } } : i)));
  },
  remove(variantId: string) {
    write(read().filter((i) => i.variantId !== variantId));
  },
  /** after success: take away only the submitted quantities */
  removeSubmitted(sent: { variantId: string; quantity: number }[]) {
    const q = new Map(sent.map((s) => [s.variantId, s.quantity]));
    write(read().map((i) => ({ ...i, quantity: i.quantity - (q.get(i.variantId) ?? 0) })).filter((i) => i.quantity > 0));
  },
  has(variantId: string) {
    return read().some((i) => i.variantId === variantId);
  },
};
