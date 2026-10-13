import { basename, stripExt } from "./paths";

export interface LinkResolver {
  resolve(target: string, fromPath?: string): string | null;
}

/** Builds a resolver for wiki-link targets: full path first, then unique basename. */
export function createResolver(paths: string[]): LinkResolver {
  const byPath = new Map<string, string>();
  const byBase = new Map<string, string>();
  for (const p of [...paths].sort()) {
    byPath.set(stripExt(p).toLowerCase(), p);
    const base = stripExt(basename(p)).toLowerCase();
    if (!byBase.has(base)) byBase.set(base, p);
  }
  return {
    resolve(target) {
      const t = stripExt(target.trim().replace(/^\/+/, "")).toLowerCase();
      return byPath.get(t) ?? byBase.get(basename(t)) ?? null;
    },
  };
}
