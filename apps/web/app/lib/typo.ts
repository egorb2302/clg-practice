import { useEffect } from "react";
import { nb } from "./format";

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION", "CODE", "PRE", "NOSCRIPT"]);
const CYR = /[А-Яа-яЁё]/;

function fixText(n: Node) {
  const p = n.parentElement;
  if (!p || SKIP.has(p.tagName) || p.closest("svg,[contenteditable],[data-count]")) return;
  const v = n.nodeValue;
  if (!v || !CYR.test(v)) return;
  const t = nb(v);
  if (t !== v) n.nodeValue = t;
}

function fixTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) return fixText(root);
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) fixText(n);
}

export function useTypography() {
  useEffect(() => {
    let mo: MutationObserver | null = null;
    const start = () => {
      fixTree(document.body);
      mo = new MutationObserver((list) => {
        for (const m of list) {
          if (m.type === "characterData") fixText(m.target);
          else m.addedNodes.forEach(fixTree);
        }
      });
      mo.observe(document.body, { subtree: true, childList: true, characterData: true });
    };
    const idle = window.requestIdleCallback ? window.requestIdleCallback(start, { timeout: 1200 }) : window.setTimeout(start, 300);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      mo?.disconnect();
    };
  }, []);
}
