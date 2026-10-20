import { maskCode } from "./markdownText";

export interface Heading {
  level: number;
  text: string;
  slug: string;
  /** Zero-based line number in the note. */
  line: number;
}

/** GitHub-like slug: lowercase, punctuation dropped, spaces to dashes. Unicode letters are kept. */
export function slugHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_~[\]()]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function frontmatterLines(content: string): number {
  const m = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(content);
  return m ? m[0].split("\n").length - 1 : 0;
}

/** Headings outside code blocks and frontmatter, in document order. */
export function extractHeadings(content: string): Heading[] {
  const lines = maskCode(content).split("\n");
  const skip = frontmatterLines(content);
  const out: Heading[] = [];
  for (let i = skip; i < lines.length; i++) {
    const m = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/.exec(lines[i] ?? "");
    if (!m) continue;
    const original = (content.split("\n")[i] ?? "").replace(/^#{1,6}[ \t]+/, "").replace(/[ \t]*#*[ \t]*$/, "");
    out.push({ level: m[1]!.length, text: original.trim(), slug: slugHeading(original), line: i });
  }
  return out;
}

/** Text under the heading matching `heading` (by slug) up to the next heading of the same or higher level. */
export function sectionOf(content: string, heading: string): string | null {
  const want = slugHeading(heading);
  const heads = extractHeadings(content);
  const at = heads.findIndex((h) => h.slug === want);
  if (at === -1) return null;
  const start = heads[at]!;
  const end = heads.slice(at + 1).find((h) => h.level <= start.level);
  const lines = content.split("\n");
  return lines.slice(start.line + 1, end ? end.line : lines.length).join("\n").trim();
}
