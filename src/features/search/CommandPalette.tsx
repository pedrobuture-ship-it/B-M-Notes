import { useMemo, useRef, useState, useEffect } from "react";
import { Command as CmdIcon } from "lucide-react";
import { Dialog } from "@/components/Dialogs";
import { fuzzyScore } from "@/lib/search";
import { useUi } from "@/stores/ui";
import { getCommands } from "./commands";
import { useTr } from "@/lib/i18n";

export function CommandPalette() {
  const tr = useTr();
  const setDialog = useUi((s) => s.setDialog);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const items = useMemo(() => {
    const all = getCommands().map((c) => ({ ...c, label: tr(c.label) }));
    if (!q.trim()) return all;
    return all
      .map((c) => ({ c, s: fuzzyScore(c.label, q.trim()) }))
      .filter((x): x is { c: (typeof all)[number]; s: number } => x.s !== null)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [q, tr]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (i: number) => {
    const c = items[i];
    if (!c) return;
    setDialog(null);
    // let the dialog unmount (and restore focus) before the command runs
    setTimeout(() => void c.run(), 0);
  };

  return (
    <Dialog onClose={() => setDialog(null)} width={560}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <CmdIcon size={18} style={{ color: "var(--amber)" }} />
        <input
          className="field"
          autoFocus
          placeholder={tr("Type a command…")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={tr("Command")}
          role="combobox"
          aria-expanded="true"
          aria-controls="cmd-list"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter") run(sel);
          }}
        />
      </div>
      <div className="palette-list" id="cmd-list" role="listbox" ref={listRef}>
        {items.length === 0 ? (
          <p className="px-3 py-6 m-0 text-center" style={{ color: "var(--ink-faint)" }}>{tr("No matching command.")}</p>
        ) : (
          items.map((c, i) => (
            <button key={c.id} role="option" aria-selected={i === sel} className="palette-item" onMouseMove={() => setSel(i)} onClick={() => run(i)}>
              <span className="flex-1">{c.label}</span>
              {c.hint && <span className="kbd">{c.hint}</span>}
            </button>
          ))
        )}
      </div>
    </Dialog>
  );
}
