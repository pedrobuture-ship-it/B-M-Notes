import { memo, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps, type InternalNode } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { hashUnit } from "@/lib/board";
import { useBoard } from "@/stores/board";
import { useUi } from "@/stores/ui";

export const PRESET_LABELS = ["Related", "Depends on", "Inspires", "Reference", "Blocks"];

interface Pt { x: number; y: number }

function rectOf(n: InternalNode) {
  const { x, y } = n.internals.positionAbsolute;
  const w = n.measured.width ?? n.width ?? 280;
  const h = n.measured.height ?? n.height ?? 200;
  return { x, y, w, h, c: { x: x + w / 2, y: y + h / 2 } };
}

/** Point where the line from the rect's centre toward `to` leaves the rect. */
function borderPoint(r: ReturnType<typeof rectOf>, to: Pt, gap = 6): Pt {
  const dx = to.x - r.c.x;
  const dy = to.y - r.c.y;
  if (dx === 0 && dy === 0) return r.c;
  const k = Math.min(r.w / 2 / Math.abs(dx || 1e-9), r.h / 2 / Math.abs(dy || 1e-9));
  const len = Math.hypot(dx, dy);
  return { x: r.c.x + dx * k + (dx / len) * gap, y: r.c.y + dy * k + (dy / len) * gap };
}

function wobble(s: Pt, t: Pt, seed: string, amount: number) {
  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / len;
  const ny = dx / len;
  const u = hashUnit(seed);
  const bend = (u * 0.5 + Math.sign(u || 1) * 0.28) * len * 0.22 * amount;
  const c1 = { x: s.x + dx * 0.3 + nx * bend, y: s.y + dy * 0.3 + ny * bend };
  const c2 = { x: s.x + dx * 0.7 + nx * bend * 0.55 + nx * hashUnit(seed + "b") * 10, y: s.y + dy * 0.7 + ny * bend * 0.55 };
  return { c1, c2, len };
}

export const SketchEdge = memo(function SketchEdge({ id, source, target, selected, data }: EdgeProps) {
  const sn = useInternalNode(source);
  const tn = useInternalNode(target);
  const [draft, setDraft] = useState("");
  const setLabel = useBoard((s) => s.setLabel);
  const removeConnection = useBoard((s) => s.removeConnection);
  if (!sn || !tn) return null;

  const manual = Boolean((data as { manual?: boolean } | undefined)?.manual);
  const label = (data as { label?: string } | undefined)?.label ?? "";
  const sr = rectOf(sn);
  const tr = rectOf(tn);
  const s = borderPoint(sr, tr.c);
  const t = borderPoint(tr, sr.c, 10);
  const { c1, c2, len } = wobble(s, t, id, 1);
  const d = `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${t.x} ${t.y}`;
  const p2 = wobble(s, t, id + "pencil", 1.35);
  const d2 = `M ${s.x + 1.5} ${s.y - 1} C ${p2.c1.x} ${p2.c1.y} ${p2.c2.x} ${p2.c2.y} ${t.x - 1} ${t.y + 1}`;
  // Hand-drawn arrow head: two short strokes angled off the tangent at the target.
  const ang = Math.atan2(t.y - c2.y, t.x - c2.x);
  const head = (a: number, l: number) => `${t.x - Math.cos(ang + a) * l} ${t.y - Math.sin(ang + a) * l}`;
  const headD = `M ${head(0.5, 13)} L ${t.x} ${t.y} L ${head(-0.45, 15)}`;
  const mid = { x: 0.125 * s.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * t.x, y: 0.125 * s.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * t.y };
  const cls = `${manual ? "manual" : ""} ${selected ? "selected" : ""}`;
  const dash = { ["--len" as string]: Math.round(len * 1.6 + 40) };

  return (
    <>
      <BaseEdge id={id} path={d2} className={`sketch-edge-path pencil ${cls}`} style={dash} interactionWidth={0} />
      <BaseEdge id={id} path={d} className={`sketch-edge-path ${cls}`} style={dash} interactionWidth={22} />
      <path d={headD} className={`sketch-edge-head ${cls}`} />
      <EdgeLabelRenderer>
        {label && !selected && (
          <div className="edge-label" style={{ left: mid.x, top: mid.y }}>{label}</div>
        )}
        {selected && (
          <div className="edge-toolbar nodrag nopan" style={{ left: mid.x, top: mid.y }} onMouseDown={(e) => e.stopPropagation()}>
            {PRESET_LABELS.map((l) => (
              <button key={l} className="chip" data-active={label === l} onClick={() => setLabel(id, label === l ? "" : l)}>{l}</button>
            ))}
            <form
              className="flex gap-1 w-full"
              onSubmit={(e) => {
                e.preventDefault();
                setLabel(id, draft);
                setDraft("");
              }}
            >
              <input className="field" style={{ padding: "2px 8px" }} placeholder={label ? `Label: ${label}` : "Custom label…"} value={draft} maxLength={40} onChange={(e) => setDraft(e.target.value)} />
              {label && <button type="button" className="btn btn-icon" onClick={() => setLabel(id, "")} aria-label="Clear label">✕</button>}
            </form>
            {manual ? (
              <button className="btn btn-danger btn-icon w-full justify-center" onClick={() => removeConnection(id)}><Trash2 size={14} /> Remove link</button>
            ) : (
              <button className="btn btn-ghost w-full justify-center" style={{ fontSize: "0.82rem", color: "var(--ink-faint)" }} onClick={() => useUi.getState().toast("This line comes from a [[wiki link]] in the note's text.")}>
                Auto link from [[wiki link]]
              </button>
            )}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
