import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useUi } from "@/stores/ui";

export function Dialog({ title, onClose, children, width, center = false }: { title?: string; onClose: () => void; children: ReactNode; width?: number; center?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (f.length === 0) return;
        const first = f[0]!;
        const last = f[f.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("keydown", key, true);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="dialog-backdrop" data-center={center ? "true" : undefined} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title} style={width ? { width } : undefined}>
        {title && (
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="dialog-title">{title}</div>
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X size={16} /></button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const req = useUi((s) => s.confirmReq);
  const resolve = useUi((s) => s.resolveConfirm);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (req) okRef.current?.focus();
  }, [req]);
  if (!req) return null;
  return (
    <Dialog title={req.title} onClose={() => resolve(false)} width={440} center>
      <div className="px-5 pb-2 selectable" style={{ color: "var(--ink-dim)" }}>{req.message}</div>
      <div className="flex justify-end gap-2 px-5 py-4">
        <button className="btn" onClick={() => resolve(false)}>Cancel</button>
        <button ref={okRef} className={`btn ${req.danger ? "btn-danger" : "btn-primary"}`} onClick={() => resolve(true)}>
          {req.confirmLabel ?? "OK"}
        </button>
      </div>
    </Dialog>
  );
}

export function ChoiceDialog() {
  const req = useUi((s) => s.choiceReq);
  const resolve = useUi((s) => s.resolveChoice);
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (req) firstRef.current?.focus();
  }, [req]);
  if (!req) return null;
  return (
    <Dialog title={req.title} onClose={() => resolve(null)} width={480} center>
      <div className="px-5 pb-2 selectable" style={{ color: "var(--ink-dim)", whiteSpace: "pre-line" }}>{req.message}</div>
      {req.details && (
        <ul className="px-5 pb-2 overflow-auto selectable" style={{ maxHeight: 180, listStyle: "none", margin: 0 }}>
          {req.details.map((d) => <li key={d} style={{ padding: "1px 0" }}>{d}</li>)}
        </ul>
      )}
      <div className="flex justify-end gap-2 px-5 py-4 flex-wrap">
        <button className="btn" onClick={() => resolve(null)}>Cancel</button>
        {req.options.map((o, i) => (
          <button key={o.value} ref={i === 0 ? firstRef : undefined} className={`btn ${o.kind === "primary" ? "btn-primary" : o.kind === "danger" ? "btn-danger" : ""}`} onClick={() => resolve(o.value)}>{o.label}</button>
        ))}
      </div>
    </Dialog>
  );
}

export function PromptDialog() {
  const req = useUi((s) => s.promptReq);
  const resolve = useUi((s) => s.resolvePrompt);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (req) {
      setValue(req.initial ?? "");
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [req]);
  if (!req) return null;
  return (
    <Dialog title={req.title} onClose={() => resolve(null)} width={440} center>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) resolve(req.secret ? value : value.trim());
        }}
      >
        <div className="px-5 pb-2">
          {req.label && <label className="block mb-1" style={{ color: "var(--ink-dim)" }}>{req.label}</label>}
          <input ref={inputRef} className="field" type={req.secret ? "password" : "text"} autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} autoFocus spellCheck={false} />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <button type="button" className="btn" onClick={() => resolve(null)}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>{req.confirmLabel ?? "OK"}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind} onClick={() => dismiss(t.id)}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
