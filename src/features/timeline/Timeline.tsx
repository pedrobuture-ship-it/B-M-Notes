import { useMemo, useState } from "react";
import { basename, dirname, stripExt } from "@/lib/paths";
import { dayLabel, groupByDay } from "@/lib/timeline";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { useTr } from "@/lib/i18n";

type By = "mtime" | "created";

function snippet(content: string): string {
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (t && !t.startsWith("#") && !t.startsWith("---") && !t.startsWith("<!--")) return t.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a: string, b?: string) => b ?? a).slice(0, 140);
  }
  return "";
}

/** Notes in time order, grouped by day. Switch between last edited and created. */
export function Timeline() {
  const notes = useWorkspace((s) => s.notes);
  const meta = useWorkspace((s) => s.index.meta);
  const openNote = useUi((s) => s.openNote);
  const [by, setBy] = useState<By>("mtime");
  const tr = useTr();

  const groups = useMemo(() => groupByDay(Object.entries(notes).map(([path, n]) => ({ path, time: by === "mtime" ? n.mtime : n.created, snippet: snippet(n.content) }))), [notes, by]);
  const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="timeline">
      <div className="timeline-bar">
        <span className="handwritten-label" style={{ fontSize: "1.6rem" }}>{tr("Timeline")}</span>
        <div className="segmented" role="group" aria-label={tr("Order by")}>
          <button aria-pressed={by === "mtime"} onClick={() => setBy("mtime")}>{tr("Edited")}</button>
          <button aria-pressed={by === "created"} onClick={() => setBy("created")}>{tr("Created")}</button>
        </div>
      </div>
      {groups.length === 0 && <p className="empty hand">{tr("No notes yet.")}</p>}
      {groups.map((g) => (
        <section key={g.day} className="timeline-day">
          <h3 className="handwritten-label">{dayLabel(g.day)}</h3>
          {g.items.map((it) => (
            <button key={it.path} className="timeline-item paper-card" data-color="paper" onClick={() => openNote(it.path)}>
              <span className="timeline-time">{time(it.time)}</span>
              <span className="timeline-title">{meta.get(it.path)?.title ?? stripExt(basename(it.path))}</span>
              {dirname(it.path) && <span className="timeline-dir">{dirname(it.path)}</span>}
              {it.snippet && <span className="timeline-snippet">{it.snippet}</span>}
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}
