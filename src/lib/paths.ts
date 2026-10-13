export function basename(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? path : path.slice(i + 1);
}

export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

export function stripExt(name: string): string {
  return name.replace(/\.(md|markdown)$/i, "");
}

export function joinPath(...parts: string[]): string {
  return parts
    .filter((p) => p !== "")
    .join("/")
    .replace(/\/+/g, "/");
}

/** Resolves `rel` (as written in a note, e.g. "../assets/a.png") against the note's folder. */
export function resolveRelative(noteDir: string, rel: string): string | null {
  const out: string[] = noteDir ? noteDir.split("/") : [];
  for (const seg of rel.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") {
      if (out.length === 0) return null;
      out.pop();
    } else out.push(seg);
  }
  return out.join("/");
}

export function isSafeRelativePath(p: string): boolean {
  if (p.startsWith("/") || p.includes("\0") || /^[a-zA-Z]:/.test(p)) return false;
  return !p.split("/").some((s) => s === "..");
}

/** Path of `target` relative to the folder `fromDir` (both workspace-relative). */
export function relativeFrom(fromDir: string, target: string): string {
  const a = fromDir ? fromDir.split("/") : [];
  const b = target.split("/");
  let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return [...Array<string>(a.length - i).fill(".."), ...b.slice(i)].join("/");
}
