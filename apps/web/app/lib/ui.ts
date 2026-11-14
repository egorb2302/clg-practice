import { useSyncExternalStore } from "react";

export type LegalDoc = "policy" | "pd" | "mail";

export type UiState = {
  drawer: boolean;
  toast: { title: string; id: number } | null;
  legal: LegalDoc | null;
  contact: boolean;
  menu: boolean;
};

const INITIAL: UiState = { drawer: false, toast: null, legal: null, contact: false, menu: false };
let state: UiState = INITIAL;
const subs = new Set<() => void>();

function set(patch: Partial<UiState>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}
function subscribe(f: () => void) {
  subs.add(f);
  return () => { subs.delete(f); };
}

export function useUi<T>(pick: (s: UiState) => T): T {
  return useSyncExternalStore(subscribe, () => pick(state), () => pick(INITIAL));
}

let toastId = 0;

export const ui = {
  get: () => state,
  openDrawer: () => set({ drawer: true, toast: null, menu: false }),
  closeDrawer: () => set({ drawer: false }),
  toggleDrawer: () => (state.drawer ? set({ drawer: false }) : set({ drawer: true, toast: null, menu: false })),
  toast: (title: string) => set({ toast: { title, id: ++toastId } }),
  closeToast: () => set({ toast: null }),
  openLegal: (doc: LegalDoc) => set({ legal: doc }),
  closeLegal: () => set({ legal: null }),
  setContact: (contact: boolean) => set({ contact, ...(contact ? { menu: false } : {}) }),
  setMenu: (menu: boolean) => set({ menu, ...(menu ? { contact: false } : {}) }),
};
