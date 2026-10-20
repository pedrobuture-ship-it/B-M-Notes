import { maskCode } from "./markdownText";

/**
 * Keeps prices and other lone dollar signs from being read as maths. A `$...$` pair is only left alone when it
 * follows the usual rules (no space just inside the delimiters, closing `$` not followed by a digit); every
 * other single `$` is escaped. `$$` blocks and code are untouched.
 */
export function protectCurrency(content: string): string {
  if (!content.includes("$")) return content;
  const masked = maskCode(content);
  const lines = masked.split("\n");
  const orig = content.split("\n");
  let inBlock = false;
  const out: string[] = [];
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]!;
    const raw = orig[li]!;
    const dd = (line.match(/\$\$/g) ?? []).length;
    const wasBlock = inBlock;
    if (dd % 2 === 1) inBlock = !inBlock;
    if (wasBlock || dd > 0 || !line.includes("$")) {
      out.push(raw);
      continue;
    }
    // Positions of single dollars that are not already escaped.
    const pos: number[] = [];
    for (let i = 0; i < line.length; i++) if (line[i] === "$" && line[i - 1] !== "\\") pos.push(i);
    const keep = new Set<number>();
    for (let a = 0; a < pos.length; a++) {
      if (keep.has(pos[a]!)) continue;
      const i = pos[a]!;
      if (/\s|^$/.test(line[i + 1] ?? " ")) continue;
      // Maths never contains another `$`, so only the very next dollar can close it.
      const j = pos[a + 1];
      if (j !== undefined && j > i + 1 && !/\s/.test(line[j - 1] ?? " ") && !/\d/.test(line[j + 1] ?? "")) {
        keep.add(i);
        keep.add(j);
        a++;
      }
    }
    let res = "";
    for (let i = 0; i < raw.length; i++) res += pos.includes(i) && !keep.has(i) ? "\\$" : raw[i];
    out.push(res);
  }
  return out.join("\n");
}
