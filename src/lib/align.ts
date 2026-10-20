export interface Rect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type AlignMode = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";

/** New x/y for each rect so they line up on the chosen edge or centre of the whole selection. */
export function alignRects(rects: Rect[], mode: AlignMode): Record<string, { x: number; y: number }> {
  if (rects.length < 2) return {};
  const minX = Math.min(...rects.map((r) => r.x));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  const out: Record<string, { x: number; y: number }> = {};
  for (const r of rects) {
    let { x, y } = r;
    if (mode === "left") x = minX;
    else if (mode === "right") x = maxX - r.w;
    else if (mode === "hcenter") x = (minX + maxX) / 2 - r.w / 2;
    else if (mode === "top") y = minY;
    else if (mode === "bottom") y = maxY - r.h;
    else y = (minY + maxY) / 2 - r.h / 2;
    out[r.id] = { x: Math.round(x), y: Math.round(y) };
  }
  return out;
}

/** Spreads rects so the gaps between them are equal along the axis; the outermost two stay in place. */
export function distributeRects(rects: Rect[], axis: "x" | "y"): Record<string, { x: number; y: number }> {
  if (rects.length < 3) return {};
  const size = axis === "x" ? "w" : "h";
  const sorted = [...rects].sort((a, b) => a[axis] - b[axis]);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const total = last[axis] + last[size] - first[axis];
  const gap = (total - sorted.reduce((s, r) => s + r[size], 0)) / (sorted.length - 1);
  const out: Record<string, { x: number; y: number }> = {};
  let cursor = first[axis];
  for (const r of sorted) {
    out[r.id] = axis === "x" ? { x: Math.round(cursor), y: r.y } : { x: r.x, y: Math.round(cursor) };
    cursor += r[size] + gap;
  }
  return out;
}

export interface SnapResult {
  /** Offset to add to the dragged rect so it lines up. */
  dx: number;
  dy: number;
  /** Flow-space coordinates of the guide lines to draw. */
  guideX: number | null;
  guideY: number | null;
}

/** Magnetic snapping of `moving` to the edges and centres of `others` within `threshold` (flow units). */
export function snapRect(moving: Rect, others: Rect[], threshold: number): SnapResult {
  const xs = [moving.x, moving.x + moving.w / 2, moving.x + moving.w];
  const ys = [moving.y, moving.y + moving.h / 2, moving.y + moving.h];
  let best: { d: number; at: number } | null = null;
  let bestY: { d: number; at: number } | null = null;
  for (const o of others) {
    const ox = [o.x, o.x + o.w / 2, o.x + o.w];
    const oy = [o.y, o.y + o.h / 2, o.y + o.h];
    for (const a of xs) for (const b of ox) {
      const d = b - a;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, at: b };
    }
    for (const a of ys) for (const b of oy) {
      const d = b - a;
      if (Math.abs(d) <= threshold && (!bestY || Math.abs(d) < Math.abs(bestY.d))) bestY = { d, at: b };
    }
  }
  return { dx: best?.d ?? 0, dy: bestY?.d ?? 0, guideX: best?.at ?? null, guideY: bestY?.at ?? null };
}
