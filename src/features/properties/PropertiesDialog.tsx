import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Dialog } from "@/components/Dialogs";
import { propText } from "@/lib/frontmatter";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

const MAX_COLS = 8;
const MAX_ROWS = 500;

/** Notes × frontmatter properties as a sortable, filterable table. */
export function PropertiesDialog() {
  const setDialog = useUi((s) => s.setDialog);
  const meta = useWorkspace((s) => s.index.meta);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: "title", dir: 1 });
  const [all, setAll] = useState(false);

  const { cols, rows, total } = useMemo(() => {
    const use = new Map<string, number>();
    for (const m of meta.values()) for (const k of Object.keys(m.props)) use.set(k, (use.get(k) ?? 0) + 1);
    const cols = [...use.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MAX_COLS).map(([k]) => k);
    const needle = q.trim().toLowerCase();
    let list = [...meta.values()].filter((m) => all || Object.keys(m.props).length > 0);
    const total = list.length;
    if (needle) list = list.filter((m) => m.title.toLowerCase().includes(needle) || cols.some((c) => propText(m.props[c]).toLowerCase().includes(needle)));
    const val = (m: (typeof list)[number]) => (sort.key === "title" ? m.title : propText(m.props[sort.key]));
    list.sort((a, b) => val(a).localeCompare(val(b), undefined, { numeric: true, sensitivity: "base" }) * sort.dir);
    return { cols, rows: list.slice(0, MAX_ROWS), total };
  }, [meta, q, sort, all]);

  const head = (key: string, label: string) => (
    <th key={key}>
      <button className="flex items-center gap-1" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))} style={{ font: "inherit" }}>
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <Dialog title="Properties" onClose={() => setDialog(null)} width={860}>
      <div className="flex items-center gap-2 px-5 pb-2">
        <input className="field" autoFocus placeholder="Filter by title or value…" aria-label="Filter properties" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2" style={{ whiteSpace: "nowrap" }}>
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Include notes without properties
        </label>
      </div>
      <div className="overflow-auto px-5" style={{ maxHeight: "60vh" }}>
        {cols.length === 0 ? (
          <p style={{ color: "var(--ink-dim)", padding: "12px 0" }}>
            No properties yet. Add a block at the top of a note:<br />
            <code>{"---\nstatus: draft\ntags: [a, b]\n---"}</code>
          </p>
        ) : (
          <table className="props-table">
            <thead><tr>{head("title", "Note")}{cols.map((c) => head(c, c))}</tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.path}>
                  <td><button className="chip" onClick={() => useUi.getState().openNote(m.path)} data-tip={m.path}>{m.title}</button></td>
                  {cols.map((c) => <td key={c}>{propText(m.props[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="px-5 py-3 m-0" style={{ color: "var(--ink-faint)", fontSize: "0.85rem" }}>{rows.length} of {total} notes. Search them with <span className="kbd">status:draft</span> in Ctrl+P.</p>
    </Dialog>
  );
}
