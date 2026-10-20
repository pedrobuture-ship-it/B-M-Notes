import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { extractHeadings } from "@/lib/headings";
import { basename, stripExt } from "@/lib/paths";
import { useWorkspace } from "@/stores/workspace";

/** Name to write inside [[ ]] for a note: its plain file name, or the path when another note shares the name. */
export function linkNameFor(path: string, allPaths: string[]): string {
  const plain = stripExt(basename(path));
  const clash = allPaths.some((p) => p !== path && stripExt(basename(p)).toLowerCase() === plain.toLowerCase());
  return clash ? stripExt(path) : plain;
}

/** Suggests notes after `[[`, headings after `[[note#`, and tags after `#`. */
export function wikiCompletions(ctx: CompletionContext): CompletionResult | null {
  const ws = useWorkspace.getState();
  const link = ctx.matchBefore(/\[\[[^\]\n|]*/);
  if (link) {
    const typed = link.text.slice(2);
    const from = link.from + 2;
    const close = ctx.state.sliceDoc(ctx.pos, ctx.pos + 2) === "]]" ? "" : "]]";
    const hash = typed.indexOf("#");
    if (hash !== -1) {
      const path = ws.index.resolver.resolve(typed.slice(0, hash));
      const note = path ? ws.notes[path] : undefined;
      if (!note) return null;
      const options: Completion[] = extractHeadings(note.content).map((h) => ({ label: h.text, apply: h.text + close, type: "text" }));
      return { from: from + hash + 1, options, validFor: /^[^\]\n|]*$/ };
    }
    const paths = Object.keys(ws.notes);
    const options: Completion[] = paths.map((p) => {
      const name = linkNameFor(p, paths);
      return { label: name, detail: p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : undefined, apply: name + close, type: "text" };
    });
    return { from, options, validFor: /^[^\]\n|#]*$/ };
  }
  const tag = ctx.matchBefore(/(?:^|\s)#[\p{L}\p{N}_/-]*/u);
  if (tag) {
    const lead = /^\s/.test(tag.text) ? 1 : 0;
    const typed = tag.text.slice(lead + 1);
    if (!typed && !ctx.explicit) return null;
    const options: Completion[] = [...ws.index.tags.keys()].map((t) => ({ label: t, type: "keyword" }));
    return { from: tag.from + lead + 1, options, validFor: /^[\p{L}\p{N}_/-]*$/u };
  }
  return null;
}
