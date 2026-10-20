import { maskCode } from "./markdownText";

const MD_LINK = /(!?)\[([^\]\n]*)\]\(\s*(<[^>\n]*>|[^)\s]+)((?:\s+"[^"\n]*")?)\s*\)/g;

/**
 * Rewrites the URL part of `[text](url)` and `![alt](url)`. `fn` receives the URL (without `<>`)
 * and returns its replacement, or null to keep it. Links inside code are left alone.
 */
export function rewriteMarkdownLinks(content: string, fn: (url: string, isImage: boolean) => string | null): { content: string; count: number } {
  const masked = maskCode(content);
  let out = content;
  let count = 0;
  for (const m of [...masked.matchAll(MD_LINK)].reverse()) {
    const raw = m[3] ?? "";
    const wrapped = raw.startsWith("<");
    const url = wrapped ? raw.slice(1, -1) : raw;
    const next = fn(url, m[1] === "!");
    if (next === null || next === url) continue;
    // Position of the URL inside the match: after "[text](" plus any spaces.
    const open = m[0].indexOf("](") + 2;
    const at = m.index + open + (m[0].slice(open).length - m[0].slice(open).trimStart().length);
    out = out.slice(0, at) + (wrapped ? `<${next}>` : next) + out.slice(at + raw.length);
    count++;
  }
  return { content: out, count };
}

/** Relative path from folder `fromDir` ("" = root) to the workspace path `to`. */
export function relativePath(fromDir: string, to: string): string {
  const a = fromDir ? fromDir.split("/") : [];
  const b = to.split("/");
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return "../".repeat(a.length - i) + b.slice(i).join("/");
}
