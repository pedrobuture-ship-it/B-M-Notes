import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useUi, type PickItem } from "@/stores/ui";
import { fuzzyScore } from "@/lib/search";
import { useTr } from "@/lib/i18n";

export function Dialog({ title, onClose, children, width, center = false }: { title?: string; onClose: () => void; children: ReactNode; width?: number; center?: boolean }) {
  const tr = useTr();
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
      <div ref={ref} className="dialog" role="dialog" aria-modal="true" aria-label={title ? tr(title) : undefined} style={width ? { width } : undefined}>
        {title && (
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="dialog-title">{tr(title)}</div>
            <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label={tr("Close")}><X size={16} /></button>
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
  const tr = useTr();
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (req) okRef.current?.focus();
  }, [req]);
  if (!req) return null;
  return (
    <Dialog title={req.title} onClose={() => resolve(false)} width={440} center>
      <div className="px-5 pb-2 selectable" style={{ color: "var(--ink-dim)" }}>{tr(req.message)}</div>
      <div className="flex justify-end gap-2 px-5 py-4">
        <button className="btn" onClick={() => resolve(false)}>{tr("Cancel")}</button>
        <button ref={okRef} className={`btn ${req.danger ? "btn-danger" : "btn-primary"}`} onClick={() => resolve(true)}>
          {tr(req.confirmLabel ?? "OK")}
        </button>
      </div>
    </Dialog>
  );
}

export function ChoiceDialog() {
  const req = useUi((s) => s.choiceReq);
  const resolve = useUi((s) => s.resolveChoice);
  const tr = useTr();
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (req) firstRef.current?.focus();
  }, [req]);
  if (!req) return null;
  return (
    <Dialog title={req.title} onClose={() => resolve(null)} width={480} center>
      <div className="px-5 pb-2 selectable" style={{ color: "var(--ink-dim)", whiteSpace: "pre-line" }}>{tr(req.message)}</div>
      {req.details && (
        <ul className="px-5 pb-2 overflow-auto selectable" style={{ maxHeight: 180, listStyle: "none", margin: 0 }}>
          {req.details.map((d) => <li key={d} style={{ padding: "1px 0" }}>{d}</li>)}
        </ul>
      )}
      <div className="flex justify-end gap-2 px-5 py-4 flex-wrap">
        <button className="btn" onClick={() => resolve(null)}>{tr("Cancel")}</button>
        {req.options.map((o, i) => (
          <button key={o.value} ref={i === 0 ? firstRef : undefined} className={`btn ${o.kind === "primary" ? "btn-primary" : o.kind === "danger" ? "btn-danger" : ""}`} onClick={() => resolve(o.value)}>{tr(o.label)}</button>
        ))}
      </div>
    </Dialog>
  );
}

export function PromptDialog() {
  const req = useUi((s) => s.promptReq);
  const resolve = useUi((s) => s.resolvePrompt);
  const tr = useTr();
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
          {req.label && <label className="block mb-1" style={{ color: "var(--ink-dim)" }}>{tr(req.label)}</label>}
          <input ref={inputRef} className="field" type={req.secret ? "password" : "text"} autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} autoFocus spellCheck={false} />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4">
          <button type="button" className="btn" onClick={() => resolve(null)}>{tr("Cancel")}</button>
          <button type="submit" className="btn btn-primary" disabled={!value.trim()}>{tr(req.confirmLabel ?? "OK")}</button>
        </div>
      </form>
    </Dialog>
  );
}

export function PickDialog() {
  const req = useUi((s) => s.pickReq);
  const resolve = useUi((s) => s.resolvePick);
  const tr = useTr();
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => resolve(null), [resolve]);
  useEffect(() => {
    setQuery("");
    setSel(0);
  }, [req]);
  const items = useMemo(() => {
    if (!req) return [];
    const q = query.trim();
    if (!q) return req.items;
    return req.items
      .map((it) => ({ it, s: fuzzyScore(it.label, q) }))
      .filter((x): x is { it: PickItem; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.it);
  }, [req, query]);
  useEffect(() => setSel(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sel]);
  if (!req) return null;
  return (
    <Dialog title={req.title} onClose={close} width={460} center>
      <div className="px-5 pb-2">
        <input
          className="field"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={tr(req.placeholder ?? "Type to filter…")}
          aria-label={tr(req.placeholder ?? "Type to filter…")}
          role="combobox"
          aria-expanded="true"
          aria-controls="pick-list"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter" && items[sel]) { e.preventDefault(); resolve(items[sel].value); }
          }}
        />
      </div>
      <div className="palette-list" id="pick-list" role="listbox" ref={listRef} style={{ maxHeight: 320, padding: "0 12px 12px" }}>
        {items.length === 0 ? (
          <p className="m-0 py-3 text-center" style={{ color: "var(--ink-faint)" }}>{tr("Nothing matches.")}</p>
        ) : (
          items.map((it, i) => (
            <button key={it.value} role="option" aria-selected={i === sel} className="palette-item" onMouseMove={() => setSel(i)} onClick={() => resolve(it.value)}>
              <span className="flex-1 truncate">{it.label}</span>
              {it.hint && <span className="text-xs shrink-0" style={{ color: "var(--ink-faint)" }}>{it.hint}</span>}
            </button>
          ))
        )}
      </div>
    </Dialog>
  );
}

export function Toasts() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismissToast);
  const tr = useTr();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast" data-kind={t.kind} onClick={() => dismiss(t.id)}>
          {tr(t.message)}
        </div>
      ))}
    </div>
  );
}
