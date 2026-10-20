import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Dialog } from "@/components/Dialogs";
import { applyTemplate, collectTemplates, type Template } from "@/lib/templates";
import { dirname } from "@/lib/paths";
import { fuzzyScore } from "@/lib/search";
import { newNote } from "@/lib/actions";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { useTr } from "@/lib/i18n";

/** Picks a template (built-in or from the workspace's `templates/` folder) and creates a note from it. */
export function TemplateDialog() {
  const tr = useTr();
  const setDialog = useUi((s) => s.setDialog);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const items = useMemo(() => {
    const all = collectTemplates(useWorkspace.getState().notes);
    return q.trim()
      ? all.map((t) => ({ t, s: fuzzyScore(t.name, q) })).filter((x): x is { t: Template; s: number } => x.s !== null).sort((a, b) => b.s - a.s).map((x) => x.t)
      : all;
  }, [q]);

  const pick = async (t?: Template) => {
    if (!t) return;
    setDialog(null);
    const ui = useUi.getState();
    const title = await ui.prompt({ title: `New ${t.name.toLowerCase()} note`, label: "Title", initial: t.name, confirmLabel: "Create" });
    if (!title) return;
    const dir = ui.view === "note" && ui.activeNote ? dirname(ui.activeNote) : "";
    await newNote(dir, { name: title, content: applyTemplate(t.content, title) });
  };

  return (
    <Dialog title="New note from template" onClose={() => setDialog(null)} width={520}>
      <div className="px-5 pb-2">
        <input
          className="field"
          autoFocus
          placeholder={tr("Filter templates…")}
          aria-label={tr("Filter templates")}
          value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter") void pick(items[sel]);
          }}
        />
      </div>
      <div className="palette-list" role="listbox" style={{ minHeight: 120 }}>
        {items.map((t, i) => (
          <button key={t.id} role="option" aria-selected={i === sel} className="palette-item" onMouseMove={() => setSel(i)} onClick={() => void pick(t)}>
            <FileText size={16} className="shrink-0" />
            <span className="flex-1">{t.name}</span>
            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>{t.path ? t.path : "built-in"}</span>
          </button>
        ))}
        {items.length === 0 && <p className="px-3 py-6 m-0 text-center" style={{ color: "var(--ink-faint)" }}>{tr("No template matches.")}</p>}
      </div>
      <p className="px-5 py-3 m-0" style={{ color: "var(--ink-faint)", fontSize: "0.85rem" }}>
        Add your own by creating notes in a <b>templates/</b> folder. Variables: <code>{"{{title}}"}</code> <code>{"{{date}}"}</code> <code>{"{{time}}"}</code>.
      </p>
    </Dialog>
  );
}
