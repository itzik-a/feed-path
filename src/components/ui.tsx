/* Small shared UI pieces. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconMinus, IconPlus } from "./Icons";

/** State kept in sessionStorage, so a filter survives switching tabs but not closing the app. */
export function useSessionState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className="switch" onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

export function Stepper({ value, onChange, min, max, step, label, unit }: { value: number; onChange: (v: number) => void; min: number; max: number; step: number; label: string; unit?: string }) {
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-ctl">
        <button type="button" aria-label={`Lower ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - step))}><IconMinus /></button>
        <span className="stepper-value" aria-live="polite"><b className="num-static">{value}</b>{unit && <span className="unit">{unit}</span>}</span>
        <button type="button" aria-label={`Raise ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + step))}><IconPlus /></button>
      </div>
    </div>
  );
}

/** A modal sheet (bottom sheet on phones, centred dialog on wider screens). */
export function Sheet({ title, onClose, children, actions }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return (
    <dialog ref={ref} className="dlg" aria-labelledby="sheet-title" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}>
      <div className="dlg-body">
        <div className="dlg-grip" aria-hidden="true" />
        <div className="card-head">
          <h2 id="sheet-title">{title}</h2>
          {actions ?? <button type="button" className="btn ghost sm" onClick={() => ref.current?.close()}>Done</button>}
        </div>
        {children}
      </div>
    </dialog>
  );
}
