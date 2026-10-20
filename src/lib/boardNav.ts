import type { Rect } from "./align";

export type Dir = "left" | "right" | "up" | "down";

/**
 * The card to move to when pressing an arrow key: the nearest one in that direction, preferring cards
 * that are roughly in line with the current one. Returns null when nothing lies that way.
 */
export function nearestInDirection(from: Rect, others: Rect[], dir: Dir): string | null {
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  let best: { id: string; score: number } | null = null;
  for (const o of others) {
    if (o.id === from.id) continue;
    const dx = o.x + o.w / 2 - cx;
    const dy = o.y + o.h / 2 - cy;
    const primary = dir === "right" ? dx : dir === "left" ? -dx : dir === "down" ? dy : -dy;
    const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (primary <= 1 || cross > primary * 2.5 + from.h) continue;
    const score = primary + cross * 2;
    if (!best || score < best.score) best = { id: o.id, score };
  }
  return best?.id ?? null;
}

/** First card in reading order (top-left), used when nothing is selected yet. */
export function firstCard(rects: Rect[]): string | null {
  const sorted = [...rects].sort((a, b) => a.y - b.y || a.x - b.x);
  return sorted[0]?.id ?? null;
}
