import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from "react";

export type TabItem = { id: string; label: ReactNode; content?: ReactNode };

type ListProps = {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
  idBase: string;
  className?: string;
};

export function TabList({ tabs, value, onChange, label, idBase, className = "" }: ListProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.findIndex((t) => t.id === value);
    let n = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") n = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    onChange(tabs[n]!.id);
    refs.current[n]?.focus();
  };
  return (
    <div className={`tabs__list ${className}`} role="tablist" aria-label={label} onKeyDown={onKey}>
      {tabs.map((t, i) => {
        const on = t.id === value;
        return (
          <button
            key={t.id}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="tab"
            id={`${idBase}-t-${t.id}`}
            aria-selected={on}
            aria-controls={`${idBase}-p-${t.id}`}
            tabIndex={on ? 0 : -1}
            className="tab ol"
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

type Props = {
  tabs: TabItem[];
  label: string;
  value?: string;
  onChange?: (id: string) => void;
  mode?: "stack" | "swap";
  className?: string;
  listClassName?: string;
};

export function Tabs({ tabs, label, value, onChange, mode = "stack", className = "", listClassName }: Props) {
  const [own, setOwn] = useState(tabs[0]?.id ?? "");
  const cur = value ?? own;
  const set = (id: string) => { setOwn(id); onChange?.(id); };
  const base = useId().replace(/:/g, "");
  const active = tabs.find((t) => t.id === cur);
  return (
    <div className={`tabs ${className}`}>
      <TabList tabs={tabs} value={cur} onChange={set} label={label} idBase={base} className={listClassName} />
      <div className="tabs__panels">
        {mode === "swap" && active ? (
          <div key={active.id} className="tabs__panel is-swap" role="tabpanel" id={`${base}-p-${active.id}`} aria-labelledby={`${base}-t-${active.id}`} tabIndex={0}>
            {active.content}
          </div>
        ) : (
          tabs.map((t) => {
            const on = t.id === cur;
            return (
              <div
                key={t.id}
                className={`tabs__panel${on ? "" : " is-off"}`}
                role="tabpanel"
                id={`${base}-p-${t.id}`}
                aria-labelledby={`${base}-t-${t.id}`}
                tabIndex={on ? 0 : -1}
                inert={!on}
              >
                {t.content}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
