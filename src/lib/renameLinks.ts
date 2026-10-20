import { rewriteWikiTargets } from "./markdownText";
import { rewriteMarkdownLinks, relativePath } from "./mdLinks";
import { basename, dirname, resolveRelative, stripExt } from "./paths";
import { createResolver } from "./wikiResolve";

export interface LinkPlan {
  /** Number of links ([[wiki]] and [text](markdown)) that would change. */
  total: number;
  /** Notes that contain such links (by their path after the rename), with the number of links in each. */
  files: { path: string; count: number }[];
  /** Rewrites one note's text. `currentPath` is where the note lives when called (after the move). Pure. */
  rewrite: (content: string, currentPath?: string) => string;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function decode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Plans the link updates for renaming/moving notes. `pairs` are [oldPath, newPath] for every note affected.
 * [[wiki]] links keep their style (path-qualified stays qualified; plain names stay plain unless the new name is ambiguous).
 * Relative markdown links `[text](note.md)` and images are recomputed from the note's new location, which also
 * fixes the links of a note that itself moved.
 */
export function planLinkUpdates(notes: Record<string, string>, pairs: [string, string][]): LinkPlan {
  const map = new Map(pairs);
  const back = new Map(pairs.map(([o, n]) => [n, o]));
  const oldPaths = Object.keys(notes);
  const oldResolver = createResolver(oldPaths);
  const newResolver = createResolver(oldPaths.map((p) => map.get(p) ?? p));

  const wiki = (raw: string): string | null => {
    const old = oldResolver.resolve(raw);
    const next = old ? map.get(old) : undefined;
    if (!next) return null;
    const plain = stripExt(basename(next));
    return !raw.includes("/") && newResolver.resolve(plain) === next ? plain : stripExt(next);
  };

  const md = (oldP: string, newP: string) => (url: string): string | null => {
    if (SCHEME.test(url) || url.startsWith("//") || url.startsWith("#") || url.startsWith("/")) return null;
    const cut = url.search(/[#?]/);
    const pathPart = cut === -1 ? url : url.slice(0, cut);
    if (!pathPart) return null;
    const target = resolveRelative(dirname(oldP), decode(pathPart));
    if (!target) return null;
    const moved = map.get(target) ?? target;
    if (moved === target && dirname(oldP) === dirname(newP)) return null;
    let rel = relativePath(dirname(newP), moved);
    if (pathPart.includes("%")) rel = rel.split("/").map(encodeURIComponent).join("/");
    return rel === pathPart ? null : rel + (cut === -1 ? "" : url.slice(cut));
  };

  const rewriteAt = (content: string, oldP: string, newP: string) => {
    const a = rewriteWikiTargets(content, wiki);
    const b = rewriteMarkdownLinks(a.content, md(oldP, newP));
    return { content: b.content, count: a.count + b.count };
  };

  const files: LinkPlan["files"] = [];
  let total = 0;
  for (const p of oldPaths) {
    const newP = map.get(p) ?? p;
    const { count } = rewriteAt(notes[p] ?? "", p, newP);
    if (count) {
      files.push({ path: newP, count });
      total += count;
    }
  }
  return {
    total,
    files,
    rewrite: (content, currentPath) => {
      const oldP = currentPath ? (back.get(currentPath) ?? currentPath) : undefined;
      if (oldP === undefined) return rewriteWikiTargets(content, wiki).content;
      return rewriteAt(content, oldP, currentPath!).content;
    },
  };
}
