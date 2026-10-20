import type { NoteIndex, NoteMeta } from "./noteIndex";
import { propText } from "./frontmatter";

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  snippet: string;
  /** [start, end) ranges inside `snippet` to highlight. */
  marks: [number, number][];
}

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

export interface QueryFilter {
  key: string;
  value: string;
}

/** `key:value` words become filters (tag:, path:, title:, or any frontmatter property); the rest is free text. */
export function parseQuery(q: string): { text: string; filters: QueryFilter[] } {
  const filters: QueryFilter[] = [];
  const rest: string[] = [];
  for (const w of q.trim().split(/\s+/).filter(Boolean)) {
    const m = /^([A-Za-z][\w-]*):(.+)$/.exec(w);
    if (m && !/^https?$/i.test(m[1]!)) filters.push({ key: m[1]!.toLowerCase(), value: m[2]!.toLowerCase().replace(/^["']|["']$/g, "") });
    else rest.push(w);
  }
  return { text: rest.join(" "), filters };
}

function matchesFilter(m: NoteMeta, f: QueryFilter): boolean {
  if (f.key === "tag") return m.tags.some((t) => t === f.value.replace(/^#/, "") || t.startsWith(f.value.replace(/^#/, "") + "/"));
  if (f.key === "path" || f.key === "in") return m.path.toLowerCase().includes(f.value);
  if (f.key === "title") return m.title.toLowerCase().includes(f.value);
  const v = m.props[f.key];
  return v !== undefined && propText(v).toLowerCase().includes(f.value);
}

function makeSnippet(content: string, lower: string, tokens: string[]): { snippet: string; marks: [number, number][] } {
  let at = -1;
  for (const t of tokens) {
    at = lower.indexOf(t);
    if (at !== -1) break;
  }
  if (at === -1) return { snippet: content.slice(0, 120).replace(/\s+/g, " "), marks: [] };
  const start = Math.max(0, at - 40);
  const raw = content.slice(start, start + 140);
  const snippet = raw.replace(/\s+/g, " ");
  const low = snippet.toLowerCase();
  const marks: [number, number][] = [];
  for (const t of tokens) {
    let i = low.indexOf(t);
    while (i !== -1) {
      marks.push([i, i + t.length]);
      i = low.indexOf(t, i + t.length);
    }
  }
  marks.sort((a, b) => a[0] - b[0]);
  return { snippet: (start > 0 ? "…" : "") + snippet, marks: marks.map(([a, b]) => [a + (start > 0 ? 1 : 0), b + (start > 0 ? 1 : 0)]) };
}

/** Searches filename, title, tags and content. All tokens must match somewhere. */
export function searchNotes(
  index: NoteIndex,
  contents: (path: string) => string,
  query: string,
  limit = 50,
): SearchResult[] {
  const parsed = parseQuery(query);
  const tokens = tokenize(parsed.text.replace(/^#/, ""));
  if (tokens.length === 0 && parsed.filters.length === 0) return [];
  const tagQuery = parsed.text.trim().startsWith("#");
  const results: SearchResult[] = [];
  for (const m of index.meta.values()) {
    if (!parsed.filters.every((f) => matchesFilter(m, f))) continue;
    const name = m.name.toLowerCase();
    const title = m.title.toLowerCase();
    let score = 0;
    let ok = true;
    for (const t of tokens) {
      let s = 0;
      if (name === t) s += 100;
      else if (name.startsWith(t)) s += 60;
      else if (name.includes(t)) s += 40;
      if (title.includes(t)) s += 30;
      if (m.tags.some((tag) => tag === t || (tagQuery && tag.startsWith(t)))) s += 35;
      else if (m.tags.some((tag) => tag.includes(t))) s += 10;
      if (s === 0 && m.lower.includes(t)) s += 5;
      if (s === 0) {
        ok = false;
        break;
      }
      score += s;
    }
    if (!ok) continue;
    results.push({ path: m.path, title: m.title, score: score + parsed.filters.length, snippet: "", marks: [] });
  }
  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const top = results.slice(0, limit);
  for (const r of top) {
    const meta = index.meta.get(r.path);
    if (!meta) continue;
    const s = makeSnippet(contents(r.path), meta.lower, tokens);
    r.snippet = s.snippet;
    r.marks = s.marks;
  }
  return top;
}

/** Subsequence fuzzy score (higher is better); null when no match. */
export function fuzzyScore(text: string, query: string): number | null {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  let score = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    streak = found === ti ? streak + 1 : 0;
    score += 1 + streak * 2 - Math.min(found - ti, 5) * 0.2 + (found === 0 || " -/_".includes(t[found - 1] ?? "") ? 3 : 0);
    ti = found + 1;
  }
  return score - t.length * 0.01;
}
