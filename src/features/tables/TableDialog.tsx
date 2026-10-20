import { useState } from "react";
import { Dialog } from "@/components/Dialogs";
import { editorBridge } from "@/features/editor/editorBridge";
import { emptyTable, findTableAt, parseTable, serializeTable, type Align, type Table } from "@/lib/mdTable";
import { useTr } from "@/lib/i18n";
import { useUi } from "@/stores/ui";

const NEXT: Record<string, Align> = { none: "left", left: "center", center: "right", right: null };
const GLYPH: Record<string, string> = { none: "≡", left: "⇤", center: "↔", right: "⇥" };

/** Edit the Markdown table under the cursor as a grid (or insert a new one). */
export function TableDialog() {
  const tr = useTr();
  const setDialog = useUi((s) => s.setDialog);
  const [snap] = useState(() => {
    const st = editorBridge.state();
    if (!st) return null;
    const found = findTableAt(st.doc, st.pos);
    const table = found ? parseTable(found.text) : null;
    return { st, found: table ? found : null, table: table ?? emptyTable() };
  });
  const [t, setT] = useState<Table>(snap?.table ?? emptyTable());

  if (!snap) {
    return <Dialog title={tr("Table")} onClose={() => setDialog(null)} width={460}><p className="px-5 pb-5">{tr("Click inside a note's editor first, then open the table editor.")}</p></Dialog>;
  }

  const apply = () => {
    const text = serializeTable(t);
    if (snap.found) editorBridge.replace(snap.found.from, snap.found.to, text);
    else editorBridge.replace(snap.st.pos, snap.st.pos, `\n${text}\n`);
    setDialog(null);
  };
  const setCell = (r: number, c: number, v: string) => setT((cur) => (r < 0 ? { ...cur, header: cur.header.map((h, i) => (i === c ? v : h)) } : { ...cur, rows: cur.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) }));
  const cols = t.header.length;

  return (
    <Dialog title={snap.found ? tr("Edit table") : tr("New table")} onClose={() => setDialog(null)} width={Math.min(980, 200 + cols * 170)}>
      <div className="overflow-auto px-5" style={{ maxHeight: "55vh" }}>
        <table className="props-table">
          <thead>
            <tr>
              <th />
              {t.header.map((h, c) => (
                <th key={c}>
                  <div className="flex gap-1 items-center">
                    <input className="field" value={h} aria-label={`${tr("Column")} ${c + 1}`} onChange={(e) => setCell(-1, c, e.target.value)} />
                    <button className="btn btn-ghost btn-icon" onClick={() => setT((x) => ({ ...x, align: x.align.map((a, i) => (i === c ? NEXT[a ?? "none"]! : a)) }))} aria-label={tr("Alignment")} data-tip={tr("Alignment")}>{GLYPH[t.align[c] ?? "none"]}</button>
                    <button className="btn btn-ghost btn-icon" disabled={cols <= 1} onClick={() => setT((x) => ({ header: x.header.filter((_, i) => i !== c), align: x.align.filter((_, i) => i !== c), rows: x.rows.map((r) => r.filter((_, i) => i !== c)) }))} aria-label={tr("Delete column")} data-tip={tr("Delete column")}>✕</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.rows.map((row, r) => (
              <tr key={r}>
                <td><button className="btn btn-ghost btn-icon" onClick={() => setT((x) => ({ ...x, rows: x.rows.filter((_, i) => i !== r) }))} aria-label={tr("Delete row")} data-tip={tr("Delete row")}>✕</button></td>
                {row.map((cell, c) => <td key={c}><input className="field" value={cell} aria-label={`${tr("Row")} ${r + 1}, ${tr("Column")} ${c + 1}`} onChange={(e) => setCell(r, c, e.target.value)} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 px-5 py-4 flex-wrap">
        <button className="btn" onClick={() => setT((x) => ({ ...x, rows: [...x.rows, Array(cols).fill("")] }))}>+ {tr("Row")}</button>
        <button className="btn" onClick={() => setT((x) => ({ header: [...x.header, `${tr("Column")} ${x.header.length + 1}`], align: [...x.align, null], rows: x.rows.map((r) => [...r, ""]) }))}>+ {tr("Column")}</button>
        <span className="flex-1" />
        <button className="btn" onClick={() => setDialog(null)}>{tr("Cancel")}</button>
        <button className="btn btn-primary" onClick={apply}>{tr("Apply")}</button>
      </div>
    </Dialog>
  );
}
