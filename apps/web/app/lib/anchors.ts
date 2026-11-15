import { useEffect } from "react";

function target(a: HTMLAnchorElement): HTMLElement | null {
  try {
    const id = decodeURIComponent(a.getAttribute("href")!.slice(1));
    return id ? document.getElementById(id) : null;
  } catch {
    return null;
  }
}

export function useSmoothAnchors() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href^="#"]');
      const el = a ? target(a) : null;
      if (!a || !el) return;
      e.preventDefault();
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
      if (!el.hasAttribute("tabindex") && !el.matches("a[href],button,input,select,textarea")) el.setAttribute("tabindex", "-1");
      el.focus({ preventScroll: true });
      history.pushState(history.state, "", a.getAttribute("href")!);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
}
