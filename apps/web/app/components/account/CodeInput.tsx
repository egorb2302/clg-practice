import { useState } from "react";

type Props = {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  light?: boolean;
  onComplete?: (v: string) => void;
};

export function CodeInput({ id, value, onChange, invalid, describedBy, disabled, light, onComplete }: Props) {
  const [focus, setFocus] = useState(false);
  const digits = value.replace(/\D/g, "").slice(0, 6);
  return (
    <div className={`lg-code${light ? " lg-code--light" : ""}${invalid ? " is-bad" : ""}${focus ? " is-focus" : ""}`}>
      <input
        id={id}
        className="lg-code__in"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        value={digits}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(v);
          if (v.length === 6 && digits.length < 6) onComplete?.(v);
        }}
      />
      <div className="lg-code__cells" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} className={`lg-code__c${digits[i] ? " is-on" : ""}${focus && i === Math.min(digits.length, 5) ? " is-cur" : ""}`}>{digits[i] ?? ""}</span>
        ))}
      </div>
    </div>
  );
}
