import { type RefObject, useEffect, useRef } from "react";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]):not(.hp), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const stack: { el: HTMLElement; close: () => void }[] = [];
function onDocKey(e: KeyboardEvent) {
  if (e.key !== "Escape" || !stack.length) return;
  if (stack.some((s) => s.el.contains(document.activeElement))) return;
  stack[stack.length - 1]!.close();
}

let locks = 0;
function lock() {
  locks += 1;
  if (locks === 1) document.documentElement.classList.add("is-locked");
}
function unlock() {
  locks = Math.max(0, locks - 1);
  if (locks === 0) document.documentElement.classList.remove("is-locked");
}

function visible(el: HTMLElement) {
  const cs = getComputedStyle(el);
  return cs.visibility !== "hidden" && (el.offsetParent !== null || cs.position === "fixed");
}

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.closest("[inert]") && visible(el));
}

type Opts = { fallback?: string; lockScroll?: boolean };

export function useModal(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, opts: Opts = {}) {
  const close = useRef(onClose);
  close.current = onClose;
  const { fallback, lockScroll = true } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (lockScroll) lock();

    const first = el.querySelector<HTMLElement>("[data-autofocus]") ?? el.querySelector<HTMLElement>("h1[tabindex='-1'], h2[tabindex='-1']") ?? focusables(el)[0] ?? el;
    const t = window.setTimeout(() => first.focus({ preventScroll: true }), 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables(el);
      if (!list.length) { e.preventDefault(); return; }
      const a = list[0]!, z = list[list.length - 1]!;
      const cur = document.activeElement;
      if (e.shiftKey && (cur === a || !el.contains(cur))) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && (cur === z || !el.contains(cur))) { e.preventDefault(); a.focus(); }
    };
    el.addEventListener("keydown", onKey);
    const entry = { el, close: () => close.current() };
    stack.push(entry);
    if (stack.length === 1) document.addEventListener("keydown", onDocKey);

    return () => {
      window.clearTimeout(t);
      el.removeEventListener("keydown", onKey);
      stack.splice(stack.indexOf(entry), 1);
      if (!stack.length) document.removeEventListener("keydown", onDocKey);
      if (lockScroll) unlock();
      const back = opener && opener.isConnected && !opener.closest("[inert]") && visible(opener)
        ? opener
        : fallback ? document.querySelector<HTMLElement>(fallback) : null;
      if (back && (el.contains(document.activeElement) || document.activeElement === document.body)) back.focus({ preventScroll: true });
    };
  }, [open, ref, fallback, lockScroll]);
}
