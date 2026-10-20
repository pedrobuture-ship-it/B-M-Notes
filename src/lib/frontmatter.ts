export type PropValue = string | string[];

export interface Frontmatter {
  /** Properties in the order they were written. */
  data: Record<string, PropValue>;
  /** The note without its frontmatter block. */
  body: string;
  hasFrontmatter: boolean;
}

const BLOCK = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

const unquote = (s: string) => s.trim().replace(/^(["'])(.*)\1$/, "$2");

/** Reads simple YAML frontmatter: `key: value`, `key: [a, b]` and `key:` followed by `- item` lines. */
export function splitFrontmatter(content: string): Frontmatter {
  const m = BLOCK.exec(content);
  if (!m) return { data: {}, body: content, hasFrontmatter: false };
  const data: Record<string, PropValue> = {};
  const lines = (m[1] ?? "").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z0-9_][\w .-]*?)\s*:\s*(.*)$/.exec(lines[i] ?? "");
    if (!kv) continue;
    const key = kv[1]!.trim();
    const raw = (kv[2] ?? "").trim();
    if (raw === "") {
      const items: string[] = [];
      while (/^\s*-\s+/.test(lines[i + 1] ?? "")) items.push(unquote((lines[++i] ?? "").replace(/^\s*-\s+/, "")));
      data[key] = items.length ? items : "";
    } else if (raw.startsWith("[") && raw.endsWith("]")) {
      data[key] = raw.slice(1, -1).split(",").map(unquote).filter(Boolean);
    } else {
      data[key] = unquote(raw);
    }
  }
  return { data, body: content.slice(m[0].length), hasFrontmatter: true };
}

export const propText = (v: PropValue | undefined): string => (Array.isArray(v) ? v.join(", ") : (v ?? ""));
