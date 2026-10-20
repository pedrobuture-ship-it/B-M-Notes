import { memo, useMemo, type MouseEvent } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { isEncrypted } from "@/lib/crypto";
import { toggleCheckbox } from "@/lib/markdownText";
import { ipc } from "@/lib/ipc";
import { openWikiLink, resolveWikiTarget } from "@/lib/actions";
import { useWorkspace } from "@/stores/workspace";

const cache = new Map<string, string>();
const CACHE_MAX = 400;

const EMBEDS = /!\[\[([^[\]\n|#]+)/g;

/** Text of every note this one embeds (one level), so edits to an embedded note refresh the embed. */
function embedStamp(content: string): string {
  if (!content.includes("![[")) return "";
  const { notes } = useWorkspace.getState();
  let out = "";
  for (const m of content.matchAll(EMBEDS)) {
    const p = resolveWikiTarget((m[1] ?? "").trim());
    out += `${p ?? ""}:${(p && notes[p]?.content) || ""}\u0001`;
  }
  return out;
}

function embedLookup(target: string): { path: string; content: string } | null {
  const p = resolveWikiTarget(target);
  const n = p ? useWorkspace.getState().notes[p] : undefined;
  return p && n ? { path: p, content: n.content } : null;
}

function cachedRender(path: string, content: string, interactive: boolean, resolveStamp: number, embeds: boolean): string {
  const key = `${path}\u0000${interactive ? 1 : 0}\u0000${resolveStamp}\u0000${content}\u0000${embeds ? embedStamp(content) : ""}`;
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  let html: string;
  try {
    html = renderMarkdown(content, { notePath: path, interactiveTasks: interactive, resolves: (t) => resolveWikiTarget(t) !== null, embed: embeds ? embedLookup : undefined });
  } catch {
    html = `<pre>${content.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c)}</pre>`;
  }
  cache.set(key, html);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value as string);
  return html;
}

interface Props {
  path: string;
  content: string;
  interactive?: boolean;
  /** Expand `![[note]]` embeds (note pages do; cards keep them as links). */
  embeds?: boolean;
  className?: string;
  /** Called for clicks that aren't links/checkboxes (cards use it for selection). */
  onPlainClick?: (e: MouseEvent) => void;
}

/** Rendered Markdown. Wiki links open notes; task checkboxes edit the real file. */
export const Preview = memo(function Preview({ path, content, interactive = true, embeds = false, className = "", onPlainClick }: Props) {
  // Re-render when notes are created/deleted so missing/existing wiki links update.
  const locked = isEncrypted(content);
  const stamp = useWorkspace((s) => s.index.meta.size);
  // Embedded notes are looked up in the store at render time, so edits to them must re-render this note.
  const embedded = useWorkspace((s) => (embeds && content.includes("![[") ? s.notes : null));
  const html = useMemo(() => cachedRender(path, locked ? "" : content, interactive, stamp, embeds), [path, content, locked, interactive, stamp, embeds, embedded]);

  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const checkbox = target.closest<HTMLInputElement>("input[type=checkbox][data-task]");
    if (checkbox && interactive) {
      e.preventDefault();
      const idx = Number(checkbox.dataset.task);
      const ws = useWorkspace.getState();
      const cur = ws.notes[path]?.content;
      if (cur !== undefined) {
        const next = toggleCheckbox(cur, idx);
        if (next !== null) ws.setContent(path, next);
      }
      return;
    }
    const a = target.closest<HTMLAnchorElement>("a");
    if (a) {
      e.preventDefault();
      const wiki = a.dataset.wiki;
      const href = a.getAttribute("href") ?? "";
      if (wiki) void openWikiLink(wiki, a.dataset.headingTarget);
      else if (/^(https?:|mailto:)/i.test(href)) void ipc.openExternal(href);
      return;
    }
    onPlainClick?.(e);
  };

  if (locked) return <p className={`m-0 ${className}`} style={{ opacity: 0.7 }}>🔒 Encrypted note. Open it to unlock.</p>;
  return <div className={`md-prose selectable ${className}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
});
