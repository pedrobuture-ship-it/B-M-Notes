import { useMemo } from "react";
import { Dialog } from "@/components/Dialogs";
import { buildMindMap } from "@/lib/mindmap";
import { basename, stripExt } from "@/lib/paths";
import { useTr } from "@/lib/i18n";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

const NODE_H = 30;
const MAX_CHARS = 26;

/** The headings of the open note drawn as a mind map. Click a node to jump to that section. */
export function MindMapDialog() {
  const tr = useTr();
  const setDialog = useUi((s) => s.setDialog);
  const path = useUi((s) => s.activeNote);
  const note = useWorkspace((s) => (path ? s.notes[path] : undefined));
  const map = useMemo(() => (note && path ? buildMindMap(note.content, stripExt(basename(path))) : null), [note, path]);

  if (!map || !path) {
    return <Dialog title={tr("Mind map")} onClose={() => setDialog(null)} width={520}><p className="px-5 pb-5">{tr("Open a note first.")}</p></Dialog>;
  }
  const go = (slug: string) => {
    setDialog(null);
    useUi.getState().openNote(path);
    if (slug) useUi.getState().setPendingHeading(slug);
  };
  const pad = 16;
  const label = (t: string) => (t.length > MAX_CHARS ? t.slice(0, MAX_CHARS - 1) + "…" : t);
  const width = (t: string) => Math.max(60, label(t).length * 8.2 + 22);

  return (
    <Dialog title={tr("Mind map")} onClose={() => setDialog(null)} width={900}>
      <div className="overflow-auto px-5 pb-5" style={{ maxHeight: "70vh" }}>
        {map.nodes.length === 1 && <p style={{ color: "var(--ink-dim)" }}>{tr("This note has no headings yet. Add lines starting with # or ##.")}</p>}
        <svg role="img" aria-label={tr("Mind map")} width={map.width + 260 + pad * 2} height={map.height + pad * 2} style={{ display: "block" }}>
          <g transform={`translate(${pad} ${pad + NODE_H / 2})`}>
            {map.links.map((l) => {
              const x1 = l.from.x + width(l.from.text);
              const x2 = l.to.x;
              const mid = (x1 + x2) / 2;
              return <path key={l.to.id} d={`M ${x1} ${l.from.y} C ${mid} ${l.from.y}, ${mid} ${l.to.y}, ${x2} ${l.to.y}`} fill="none" stroke="var(--ink-faint)" strokeWidth={2} strokeLinecap="round" />;
            })}
            {map.nodes.map((n) => (
              <g key={n.id} transform={`translate(${n.x} ${n.y - NODE_H / 2})`} style={{ cursor: "pointer" }} onClick={() => go(n.slug)} role="button" tabIndex={0} aria-label={n.text} onKeyDown={(e) => e.key === "Enter" && go(n.slug)}>
                <rect width={width(n.text)} height={NODE_H} rx={9} ry={12} fill={n.depth === 0 ? "var(--amber)" : "var(--card-yellow)"} stroke="var(--line)" strokeWidth={2} />
                <text x={11} y={20} fontSize={n.depth === 0 ? 17 : 15} fontWeight={700} fill="#2a241c" style={{ fontFamily: "var(--font-hand)" }}>{label(n.text)}</text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </Dialog>
  );
}
