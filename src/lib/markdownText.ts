/** Helpers that work on raw Markdown text without building an AST. */

/** Replaces fenced and inline code with spaces so regexes don't match inside them. */
export function maskCode(content: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return content
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?(?:\n\1[^\n]*|$)/gm, blank)
    .replace(/`[^`\n]*`/g, blank);
}

export interface WikiLink {
  target: string;
  alias?: string;
}

const WIKI = /\[\[([^[\]\n|#]+)(?:#[^[\]\n|]*)?(?:\|([^[\]\n]*))?\]\]/g;

export function extractWikiLinks(content: string): WikiLink[] {
  const out: WikiLink[] = [];
  const masked = maskCode(content);
  for (const m of masked.matchAll(WIKI)) {
    const target = (m[1] ?? "").trim();
    if (target) out.push({ target, alias: m[2]?.trim() || undefined });
  }
  return out;
}

export function extractTags(content: string): string[] {
  const masked = maskCode(content).replace(/^---\n[\s\S]*?\n---\n/, (m) => m.replace(/[^\n]/g, " "));
  const tags = new Set<string>();
  // '#tag' preceded by start/whitespace; headings have a space after '#', so they don't match.
  for (const m of masked.matchAll(/(?:^|[\s(])#([\p{L}\p{N}_][\p{L}\p{N}_/-]*)/gu)) {
    const tag = m[1] ?? "";
    if (/^\d+$/.test(tag)) continue;
    tags.add(tag.replace(/[/-]+$/, "").toLowerCase());
  }
  return [...tags].filter(Boolean);
}

export function extractTitle(content: string, fallback: string): string {
  const masked = maskCode(content);
  const m = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/m.exec(masked);
  if (!m || m[1] === undefined) return fallback;
  const start = m.index + m[0].indexOf(m[1]);
  return content.slice(start, start + m[1].length).trim() || fallback;
}

const TASK = /^(\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\]\s)/;

/**
 * Toggles the nth task checkbox (document order, ignoring code blocks) and
 * returns the new content, leaving every other byte untouched.
 */
export function toggleCheckbox(content: string, index: number): string | null {
  const lines = content.split("\n");
  let inFence: string | null = null;
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const fence = line.match(/^\s*(```|~~~)/);
    if (fence) {
      if (!inFence) inFence = fence[1] ?? null;
      else if (fence[1] === inFence) inFence = null;
      continue;
    }
    if (inFence) continue;
    const m = line.match(TASK);
    if (!m) continue;
    if (n === index) {
      const next = m[2] === " " ? "x" : " ";
      lines[i] = line.replace(TASK, `$1${next}$3`);
      return lines.join("\n");
    }
    n++;
  }
  return null;
}
