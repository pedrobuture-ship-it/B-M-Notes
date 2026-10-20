import { useMemo, useState } from "react";
import { Dialog } from "@/components/Dialogs";
import { toggleCheckbox } from "@/lib/markdownText";
import { extractTasks } from "@/lib/tasks";
import { TEMPLATE_DIR } from "@/lib/templates";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

type Filter = "open" | "done" | "all";
const LIMIT = 300;

/** Every checkbox of every note in one place. Ticking one edits the real note. */
export function TasksDialog() {
  const setDialog = useUi((s) => s.setDialog);
  const notes = useWorkspace((s) => s.notes);
  const meta = useWorkspace((s) => s.index.meta);
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");

  const { groups, total, shown } = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const groups: { path: string; title: string; tasks: ReturnType<typeof extractTasks> }[] = [];
    let total = 0;
    let shown = 0;
    for (const p of Object.keys(notes).sort()) {
      if (p.startsWith(TEMPLATE_DIR + "/")) continue;
      const all = extractTasks(notes[p]!.content);
      total += all.length;
      const tasks = all.filter((t) => (filter === "all" || (filter === "done") === t.done) && (!needle || t.text.toLowerCase().includes(needle)));
      if (!tasks.length || shown >= LIMIT) continue;
      shown += tasks.length;
      groups.push({ path: p, title: meta.get(p)?.title ?? p, tasks });
    }
    return { groups, total, shown };
  }, [notes, meta, filter, q]);

  const toggle = (path: string, index: number) => {
    const ws = useWorkspace.getState();
    const cur = ws.notes[path]?.content;
    const next = cur === undefined ? null : toggleCheckbox(cur, index);
    if (next !== null) ws.setContent(path, next);
  };

  return (
    <Dialog title="Tasks" onClose={() => setDialog(null)} width={640}>
      <div className="flex items-center gap-2 px-5 pb-2">
        <input className="field" autoFocus placeholder="Filter tasks…" aria-label="Filter tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="segmented" role="group" aria-label="Status">
          {(["open", "done", "all"] as const).map((f) => (
            <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>
      <div className="overflow-auto px-5" style={{ maxHeight: "55vh" }}>
        {groups.length === 0 && <p style={{ color: "var(--ink-dim)", padding: "12px 0" }}>{total === 0 ? "No tasks yet. Write “- [ ] something” in any note." : "Nothing matches."}</p>}
        {groups.map((g) => (
          <div key={g.path} style={{ marginBottom: 10 }}>
            <button className="handwritten-label" style={{ fontSize: "1.3rem" }} onClick={() => { useUi.getState().openNote(g.path); }}>{g.title}</button>
            {g.tasks.map((t) => (
              <label key={t.index} className="flex items-start gap-2" style={{ padding: "2px 0", cursor: "pointer", opacity: t.done ? 0.6 : 1 }}>
                <input type="checkbox" checked={t.done} onChange={() => toggle(g.path, t.index)} style={{ marginTop: 5 }} />
                <span style={{ textDecoration: t.done ? "line-through" : "none" }}>{t.text}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <p className="px-5 py-3 m-0" style={{ color: "var(--ink-faint)", fontSize: "0.85rem" }}>{shown} shown of {total} tasks{shown >= LIMIT ? " (first 300)" : ""}.</p>
    </Dialog>
  );
}
