import { memo, useState } from "react";
import { BaseEdge, EdgeLabelRenderer, useInternalNode, type EdgeProps, type InternalNode } from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { hashUnit } from "@/lib/board";
import { useBoard } from "@/stores/board";
import { removeEdge } from "@/lib/actions";

export const PRESET_LABELS = ["Related", "Depends on", "Inspires", "Reference", "Blocks"];

function rectOf(n: InternalNode) {
  const { x, y } = n.internals.positionAbsolute;
  const w = n.measured.width ?? n.width ?? 280;
  const h = n.measured.height ?? n.height ?? 200;
  return { x, y, w, h, c: { x: x + w / 2, y: y + h / 2 } };
}

/** Leaves from the side dot facing the other card and lands on the opposite side dot. */
function anchors(sr: ReturnType<typeof rectOf>, tr: ReturnType<typeof rectOf>) {
  const dir = tr.c.x >= sr.c.x ? 1 : -1;
  const s = { x: dir > 0 ? sr.x + sr.w + 9 : sr.x - 9, y: sr.c.y };
  const t = { x: dir > 0 ? tr.x - 11 : tr.x + tr.w + 11, y: tr.c.y };
  return { s, t, dir };
}

export const SketchEdge = memo(function SketchEdge({ id, source, target, selected, data }: EdgeProps) {
  const sn = useInternalNode(source);
  const tn = useInternalNode(target);
  const [draft, setDraft] = useState("");
  const setLabel = useBoard((s) => s.setLabel);
  if (!sn || !tn) return null;

  const manual = Boolean((data as { manual?: boolean } | undefined)?.manual);
  const label = (data as { label?: string } | undefined)?.label ?? "";
  const sr = rectOf(sn);
  const tr = rectOf(tn);
  const { s, t, dir } = anchors(sr, tr);
  const len = Math.hypot(t.x - s.x, t.y - s.y);
  const reach = Math.max(40, Math.abs(t.x - s.x) * 0.45);
  const sag = hashUnit(id) * 10;
  const c1 = { x: s.x + dir * reach, y: s.y + sag };
  const c2 = { x: t.x - dir * reach, y: t.y - sag };
  const d = `M ${s.x} ${s.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${t.x} ${t.y}`;
  // Hand-drawn arrow head: two short strokes angled off the tangent at the target.
  const ang = Math.atan2(t.y - c2.y, t.x - c2.x);
  const head = (a: number, l: number) => `${t.x - Math.cos(ang + a) * l} ${t.y - Math.sin(ang + a) * l}`;
  const headD = `M ${head(0.5, 13)} L ${t.x} ${t.y} L ${head(-0.45, 15)}`;
  const mid = { x: 0.125 * s.x + 0.375 * c1.x + 0.375 * c2.x + 0.125 * t.x, y: 0.125 * s.y + 0.375 * c1.y + 0.375 * c2.y + 0.125 * t.y };
  const cls = `${manual ? "manual" : ""} ${selected ? "selected" : ""}`;
  const dash = { ["--len" as string]: Math.round(len * 1.6 + 40) };

  return (
    <>
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
            <button className="btn btn-danger btn-icon w-full justify-center" onClick={() => removeEdge(id, source, target)}><Trash2 size={14} /> Remove link</button>
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  );
});
