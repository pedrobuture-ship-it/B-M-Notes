import { extractWikiLinks } from "./markdownText";
import { basename, stripExt } from "./paths";
import type { NoteIndex } from "./noteIndex";
import { TEMPLATE_DIR } from "./templates";

export interface BrokenLink {
  /** Note containing the link. */
  from: string;
  /** Target exactly as written. */
  target: string;
  /** Closest existing note name, when one is similar enough. */
  suggestion: string | null;
}

export interface VaultHealth {
  broken: BrokenLink[];
  /** Notes with no links in or out. */
  orphans: string[];
  /** Notes without a `# Title` heading. */
  untitled: string[];
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** The existing note name closest to `target` (similarity >= 0.6), or null. */
export function suggestName(target: string, names: string[]): string | null {
  const t = stripExt(basename(target)).toLowerCase();
  if (!t) return null;
  let best: { name: string; sim: number } | null = null;
  for (const n of names) {
    const low = n.toLowerCase();
    const sim = low.includes(t) || t.includes(low) ? Math.max(0.75, 1 - Math.abs(low.length - t.length) / Math.max(low.length, t.length)) : 1 - levenshtein(low, t) / Math.max(low.length, t.length);
    if (sim >= 0.6 && (!best || sim > best.sim)) best = { name: n, sim };
  }
  return best?.name ?? null;
}

/** Broken [[links]], orphan notes and untitled notes. Notes in templates/ are ignored. */
export function analyzeVault(notes: Record<string, string>, index: NoteIndex): VaultHealth {
  const paths = Object.keys(notes).filter((p) => !p.startsWith(TEMPLATE_DIR + "/"));
  const names = [...new Set(paths.map((p) => stripExt(basename(p))))];
  const broken: BrokenLink[] = [];
  const orphans: string[] = [];
  const untitled: string[] = [];
  for (const p of paths) {
    const seen = new Set<string>();
    for (const l of extractWikiLinks(notes[p] ?? "")) {
      if (seen.has(l.target) || index.resolver.resolve(l.target)) continue;
      seen.add(l.target);
      broken.push({ from: p, target: l.target, suggestion: suggestName(l.target, names) });
    }
    const m = index.meta.get(p);
    if (m && m.links.length === 0 && !(index.backlinks.get(p)?.length)) orphans.push(p);
    if (m && m.title === m.name) untitled.push(p);
  }
  return { broken, orphans: orphans.sort(), untitled: untitled.sort() };
}
