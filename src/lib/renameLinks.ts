import { rewriteWikiTargets } from "./markdownText";
import { basename, stripExt } from "./paths";
import { createResolver } from "./wikiResolve";

export interface LinkPlan {
  /** Number of [[links]] that would change. */
  total: number;
  /** Notes that contain such links (by their path after the rename), with the number of links in each. */
  files: { path: string; count: number }[];
  /** Rewrites one note's text. Pure: safe to call again later with fresh content. */
  rewrite: (content: string) => string;
}

/**
 * Plans the [[link]] updates for renaming/moving notes. `pairs` are [oldPath, newPath] for every note affected.
 * A link keeps its style: path-qualified links stay path-qualified, plain names stay plain unless the new name is ambiguous.
 */
export function planLinkUpdates(notes: Record<string, string>, pairs: [string, string][]): LinkPlan {
  const map = new Map(pairs);
  const oldPaths = Object.keys(notes);
  const oldResolver = createResolver(oldPaths);
  const newResolver = createResolver(oldPaths.map((p) => map.get(p) ?? p));
  const fn = (raw: string): string | null => {
    const old = oldResolver.resolve(raw);
    const next = old ? map.get(old) : undefined;
    if (!next) return null;
    const plain = stripExt(basename(next));
    return !raw.includes("/") && newResolver.resolve(plain) === next ? plain : stripExt(next);
  };
  const files: LinkPlan["files"] = [];
  let total = 0;
  for (const p of oldPaths) {
    const { count } = rewriteWikiTargets(notes[p] ?? "", fn);
    if (count) {
      files.push({ path: map.get(p) ?? p, count });
      total += count;
    }
  }
  return { total, files, rewrite: (content) => rewriteWikiTargets(content, fn).content };
}
