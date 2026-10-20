import { useState } from "react";
import { TextSearch } from "lucide-react";
import { findMention, linkFirstMention } from "@/lib/mentions";
import { basename } from "@/lib/paths";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { linkNameFor } from "./wikiComplete";
import { useTr } from "@/lib/i18n";

/** Notes that mention this note's title or name in plain text but do not link to it. Computed on demand. */
export function UnlinkedMentions({ path }: { path: string }) {
  const tr = useTr();
  const [hits, setHits] = useState<string[] | null>(null);

  const names = () => {
    const m = useWorkspace.getState().index.meta.get(path);
    return [...new Set([m?.title ?? "", m?.name ?? ""].filter(Boolean))];
  };

  const find = () => {
    const ws = useWorkspace.getState();
    const linked = new Set(ws.index.backlinks.get(path) ?? []);
    const n = names();
    const out: string[] = [];
    for (const [p, note] of Object.entries(ws.notes)) {
      if (p === path || linked.has(p) || !findMention(note.content, n)) continue;
      out.push(p);
      if (out.length >= 30) break;
    }
    setHits(out);
  };

  const link = (p: string) => {
    const ws = useWorkspace.getState();
    const note = ws.notes[p];
    const next = note && linkFirstMention(note.content, names(), linkNameFor(path, Object.keys(ws.notes)));
    if (next) ws.setContent(p, next);
    setHits((h) => (h ?? []).filter((x) => x !== p));
  };

  return (
    <div className="backlinks" aria-label={tr("Unlinked mentions")}>
      <div className="flex items-center gap-2">
        <div className="handwritten-label" style={{ fontSize: "1.35rem" }}><TextSearch size={14} className="inline mr-1" />{tr("Unlinked mentions")}</div>
        <button className="btn" onClick={find}>{hits === null ? "Find" : "Refresh"}</button>
      </div>
      {hits !== null && (hits.length === 0 ? (
        <p className="m-0 mt-1" style={{ color: "var(--ink-faint)" }}>{tr("No other note mentions this one without linking to it.")}</p>
      ) : (
        <ul className="m-0 mt-1 p-0 list-none">
          {hits.map((p) => (
            <li key={p} className="flex items-center gap-2" style={{ padding: "2px 0" }}>
              <button className="chip" onClick={() => useUi.getState().openNote(p)} data-tip={p}>{basename(p)}</button>
              <button className="btn" onClick={() => link(p)}>{tr("Link")}</button>
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
