export type Align = "left" | "center" | "right" | null;

export interface Table {
  header: string[];
  align: Align[];
  rows: string[][];
}

const SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

/** Splits a row on unescaped pipes, dropping the optional leading and trailing one. */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (c === "\\" && line[i + 1] === "|") {
      cur += "\\|";
      i++;
    } else if (c === "|") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  const t = line.trim();
  if (t.startsWith("|")) out.shift();
  if (t.endsWith("|") && !t.endsWith("\\|")) out.pop();
  return out.map((s) => s.trim());
}

const alignOf = (s: string): Align => {
  const l = s.startsWith(":");
  const r = s.endsWith(":");
  return l && r ? "center" : r ? "right" : l ? "left" : null;
};

/** Parses a block of Markdown table lines (header, separator, rows). */
export function parseTable(text: string): Table | null {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2 || !SEP.test(lines[1]!)) return null;
  const header = cells(lines[0]!);
  const n = header.length;
  const align = cells(lines[1]!).map(alignOf);
  while (align.length < n) align.push(null);
  const rows = lines.slice(2).map((l) => {
    const r = cells(l);
    while (r.length < n) r.push("");
    return r.slice(0, n);
  });
  return { header, align: align.slice(0, n), rows };
}

const sepCell = (a: Align, w: number) => {
  const dashes = "-".repeat(Math.max(3, w));
  return a === "center" ? `:${dashes.slice(2)}:` : a === "right" ? `${dashes.slice(1)}:` : a === "left" ? `:${dashes.slice(1)}` : dashes;
};

/** Pretty-printed table with aligned columns. */
export function serializeTable(t: Table): string {
  const widths = t.header.map((h, i) => Math.max(3, h.length, ...t.rows.map((r) => (r[i] ?? "").length)));
  const pad = (s: string, i: number) => {
    const w = widths[i]!;
    const a = t.align[i];
    return a === "right" ? s.padStart(w) : a === "center" ? s.padStart(Math.floor((w + s.length) / 2)).padEnd(w) : s.padEnd(w);
  };
  const row = (r: string[]) => `| ${r.map((c, i) => pad(c, i)).join(" | ")} |`;
  return [row(t.header), `| ${t.align.map((a, i) => sepCell(a, widths[i]!)).join(" | ")} |`, ...t.rows.map(row)].join("\n");
}

export function emptyTable(cols = 3, rows = 2): Table {
  return { header: Array.from({ length: cols }, (_, i) => `Column ${i + 1}`), align: Array(cols).fill(null), rows: Array.from({ length: rows }, () => Array(cols).fill("")) };
}

/** The table around `pos` in `doc`: its character range and text, or null when `pos` is not inside one. */
export function findTableAt(doc: string, pos: number): { from: number; to: number; text: string } | null {
  const lines = doc.split("\n");
  const starts: number[] = [];
  let off = 0;
  for (const l of lines) {
    starts.push(off);
    off += l.length + 1;
  }
  const at = starts.findIndex((s, i) => pos >= s && pos <= s + lines[i]!.length);
  if (at === -1) return null;
  const isRow = (i: number) => lines[i] !== undefined && lines[i]!.includes("|") && lines[i]!.trim() !== "";
  if (!isRow(at)) return null;
  let a = at;
  let b = at;
  while (a > 0 && isRow(a - 1)) a--;
  while (b < lines.length - 1 && isRow(b + 1)) b++;
  // The header is the line right before the separator; the block may start with stray pipe lines.
  const sep = [...Array(b - a + 1).keys()].map((k) => a + k).find((i) => i > a && SEP.test(lines[i]!));
  if (sep === undefined || sep - 1 < a) return null;
  a = sep - 1;
  if (at < a) return null;
  return { from: starts[a]!, to: starts[b]! + lines[b]!.length, text: lines.slice(a, b + 1).join("\n") };
}
