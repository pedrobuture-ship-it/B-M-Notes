import { memo, useMemo, type MouseEvent } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { toggleCheckbox } from "@/lib/markdownText";
import { ipc } from "@/lib/ipc";
import { openWikiLink, resolveWikiTarget } from "@/lib/actions";
import { useWorkspace } from "@/stores/workspace";

const cache = new Map<string, string>();
const CACHE_MAX = 400;

function cachedRender(path: string, content: string, interactive: boolean, resolveStamp: number): string {
  const key = `${path}\u0000${interactive ? 1 : 0}\u0000${resolveStamp}\u0000${content}`;
  const hit = cache.get(key);
  if (hit !== undefined) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  let html: string;
  try {
    html = renderMarkdown(content, { notePath: path, interactiveTasks: interactive, resolves: (t) => resolveWikiTarget(t) !== null });
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
  className?: string;
  /** Called for clicks that aren't links/checkboxes (cards use it for selection). */
  onPlainClick?: (e: MouseEvent) => void;
}

/** Rendered Markdown. Wiki links open notes; task checkboxes edit the real file. */
export const Preview = memo(function Preview({ path, content, interactive = true, className = "", onPlainClick }: Props) {
  // Re-render when notes are created/deleted so missing/existing wiki links update.
  const stamp = useWorkspace((s) => s.index.meta.size);
  const html = useMemo(() => cachedRender(path, content, interactive, stamp), [path, content, interactive, stamp]);

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
      if (wiki) void openWikiLink(wiki);
      else if (/^(https?:|mailto:)/i.test(href)) void ipc.openExternal(href);
      return;
    }
    onPlainClick?.(e);
  };

  return <div className={`md-prose selectable ${className}`} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />;
});
