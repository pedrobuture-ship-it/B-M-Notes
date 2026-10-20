import { maskCode } from "./markdownText";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ranges (start, end) of [[wiki links]] and markdown links, which a mention must not sit inside. */
function linkRanges(masked: string): [number, number][] {
  const out: [number, number][] = [];
  for (const m of masked.matchAll(/\[\[[^\]\n]*\]\]|\[[^\]\n]*\]\([^)\n]*\)/g)) out.push([m.index, m.index + m[0].length]);
  return out;
}

/** First place `names` appears as plain text (whole word, outside code and links), or null. */
export function findMention(content: string, names: string[]): { start: number; end: number; text: string } | null {
  const masked = maskCode(content);
  const skip = linkRanges(masked);
  for (const name of names.filter((n) => n.trim().length >= 2)) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}_])${escape(name)}(?![\\p{L}\\p{N}_])`, "giu");
    for (const m of masked.matchAll(re)) {
      const s = m.index;
      if (skip.some(([a, b]) => s >= a && s < b)) continue;
      return { start: s, end: s + m[0].length, text: content.slice(s, s + m[0].length) };
    }
  }
  return null;
}

/** Wraps the first plain mention of `names` in a [[link]] to `linkName`; null when there is none. */
export function linkFirstMention(content: string, names: string[], linkName: string): string | null {
  const hit = findMention(content, names);
  if (!hit) return null;
  const link = hit.text === linkName ? `[[${linkName}]]` : `[[${linkName}|${hit.text}]]`;
  return content.slice(0, hit.start) + link + content.slice(hit.end);
}
