import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog } from "@/components/Dialogs";
import { extractDates, monthGrid, type DateMention } from "@/lib/dates";
import { toggleCheckbox } from "@/lib/markdownText";
import { basename, stripExt } from "@/lib/paths";
import { TEMPLATE_DIR } from "@/lib/templates";
import { dayKey } from "@/lib/timeline";
import { useTr } from "@/lib/i18n";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

interface Item extends DateMention {
  path: string;
  title: string;
}

const DAILY = /^\d{4}-\d{2}-\d{2}$/;

/** Month calendar of the `@2026-11-01` dates (and daily notes) found in your notes. */
export function CalendarDialog() {
  const tr = useTr();
  const setDialog = useUi((s) => s.setDialog);
  const notes = useWorkspace((s) => s.notes);
  const meta = useWorkspace((s) => s.index.meta);
  const today = dayKey(Date.now());
  const [ym, setYm] = useState(() => ({ y: new Date().getFullYear(), m: new Date().getMonth() }));
  const [sel, setSel] = useState(today);

  const byDate = useMemo(() => {
    const map = new Map<string, Item[]>();
    const add = (date: string, it: Item) => map.set(date, [...(map.get(date) ?? []), it]);
    for (const [path, n] of Object.entries(notes)) {
      if (path.startsWith(TEMPLATE_DIR + "/")) continue;
      const title = meta.get(path)?.title ?? stripExt(basename(path));
      const name = stripExt(basename(path));
      if (DAILY.test(name)) add(name, { path, title, date: name, time: null, line: 0, text: title, taskIndex: null, done: false });
      if (n.content.includes("@")) for (const d of extractDates(n.content)) add(d.date, { ...d, path, title });
    }
    return map;
  }, [notes, meta]);

  const overdue = useMemo(() => [...byDate.entries()].filter(([d]) => d < today).flatMap(([, v]) => v).filter((i) => i.taskIndex !== null && !i.done), [byDate, today]);
  const weeks = monthGrid(ym.y, ym.m, 0);
  const monthName = new Date(ym.y, ym.m, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const weekdays = Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }));
  const shift = (d: number) => setYm((c) => {
    const dt = new Date(c.y, c.m + d, 1);
    return { y: dt.getFullYear(), m: dt.getMonth() };
  });

  const toggle = (it: Item) => {
    const ws = useWorkspace.getState();
    const cur = ws.notes[it.path]?.content;
    const next = cur !== undefined && it.taskIndex !== null ? toggleCheckbox(cur, it.taskIndex) : null;
    if (next !== null) ws.setContent(it.path, next);
  };

  const row = (it: Item) => (
    <div key={`${it.path}:${it.line}`} className="flex items-start gap-2" style={{ padding: "2px 0" }}>
      {it.taskIndex !== null ? <input type="checkbox" checked={it.done} onChange={() => toggle(it)} style={{ marginTop: 5 }} aria-label={it.text} /> : <span aria-hidden="true">📝</span>}
      <button className="text-left" style={{ textDecoration: it.done ? "line-through" : "none", opacity: it.done ? 0.6 : 1 }} onClick={() => useUi.getState().openNote(it.path)}>
        {it.time && <b>{it.time} </b>}{it.taskIndex !== null ? it.text.replace(/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+/, "") : it.title}
        <small style={{ color: "var(--ink-faint)" }}> · {it.title}</small>
      </button>
    </div>
  );

  const items = (byDate.get(sel) ?? []).slice().sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  return (
    <Dialog title={tr("Calendar")} onClose={() => setDialog(null)} width={760}>
      <div className="px-5 pb-4" style={{ display: "grid", gridTemplateColumns: "minmax(300px, 1fr) 1fr", gap: 18 }}>
        <div>
          <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
            <button className="btn btn-ghost btn-icon" onClick={() => shift(-1)} aria-label={tr("Previous month")}><ChevronLeft size={16} /></button>
            <span className="handwritten-label flex-1 text-center" style={{ fontSize: "1.4rem", textTransform: "capitalize" }}>{monthName}</span>
            <button className="btn btn-ghost btn-icon" onClick={() => shift(1)} aria-label={tr("Next month")}><ChevronRight size={16} /></button>
            <button className="btn" onClick={() => { const d = new Date(); setYm({ y: d.getFullYear(), m: d.getMonth() }); setSel(today); }}>{tr("Today")}</button>
          </div>
          <div className="cal-grid" role="grid" aria-label={monthName}>
            {weekdays.map((w) => <div key={w} className="cal-head" role="columnheader">{w}</div>)}
            {weeks.flat().map((d, i) => {
              if (!d) return <div key={`p${i}`} />;
              const list = byDate.get(d) ?? [];
              const open = list.filter((x) => x.taskIndex !== null && !x.done).length;
              return (
                <button key={d} role="gridcell" className="cal-cell" data-today={d === today} data-selected={d === sel} data-late={open > 0 && d < today} onClick={() => setSel(d)} aria-label={`${d}: ${list.length}`}>
                  <span>{Number(d.slice(8))}</span>
                  {list.length > 0 && <small className="cal-count">{list.length}</small>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="overflow-auto" style={{ maxHeight: "55vh" }}>
          {overdue.length > 0 && (
            <section style={{ marginBottom: 12 }}>
              <div className="handwritten-label" style={{ fontSize: "1.3rem", color: "var(--red)" }}>{tr("Overdue")} ({overdue.length})</div>
              {overdue.slice(0, 20).map((it) => <div key={`${it.path}:${it.line}`}><small style={{ color: "var(--red)" }}>{it.date}</small>{row(it)}</div>)}
            </section>
          )}
          <div className="handwritten-label" style={{ fontSize: "1.3rem" }}>{new Date(Number(sel.slice(0, 4)), Number(sel.slice(5, 7)) - 1, Number(sel.slice(8))).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</div>
          {items.length === 0 ? <p style={{ color: "var(--ink-faint)" }}>{tr("Nothing scheduled. Write @{date} in a note.", { date: sel })}</p> : items.map(row)}
        </div>
      </div>
    </Dialog>
  );
}
