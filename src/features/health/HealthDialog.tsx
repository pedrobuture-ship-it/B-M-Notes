import { useMemo } from "react";
import { Dialog } from "@/components/Dialogs";
import { analyzeVault } from "@/lib/health";
import { rewriteWikiTargets } from "@/lib/markdownText";
import { basename, stripExt } from "@/lib/paths";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { useTr } from "@/lib/i18n";

const SHOW = 100;

/** Broken links (with suggestions), orphan notes and notes without a title. Updates as you edit. */
export function HealthDialog() {
  const tr = useTr();
  const setDialog = useUi((s) => s.setDialog);
  const notes = useWorkspace((s) => s.notes);
  const index = useWorkspace((s) => s.index);
  const health = useMemo(() => analyzeVault(Object.fromEntries(Object.entries(notes).map(([p, n]) => [p, n.content])), index), [notes, index]);

  const open = (p: string) => useUi.getState().openNote(p);
  const fix = (from: string, target: string, to: string) => {
    const ws = useWorkspace.getState();
    const cur = ws.notes[from]?.content;
    if (cur !== undefined) ws.setContent(from, rewriteWikiTargets(cur, (t) => (t === target ? to : null)).content);
  };
  const create = async (target: string) => {
    const name = basename(target.replace(/\.md$/i, "")).replace(/[\\/:*?"<>|]/g, "").trim();
    if (name) await useWorkspace.getState().createNote("", name, `# ${name}\n\n`);
  };

  const clean = health.broken.length === 0 && health.orphans.length === 0 && health.untitled.length === 0;
  return (
    <Dialog title="Notes health" onClose={() => setDialog(null)} width={700}>
      <div className="overflow-auto px-5 pb-4" style={{ maxHeight: "65vh" }}>
        {clean && <p style={{ color: "var(--ink-dim)" }}>{tr("Everything looks good: no broken links, no orphan notes, every note has a title.")}</p>}

        {health.broken.length > 0 && (
          <section>
            <div className="handwritten-label" style={{ fontSize: "1.4rem" }}>Broken links ({health.broken.length})</div>
            {health.broken.slice(0, SHOW).map((b) => (
              <div key={`${b.from}|${b.target}`} className="flex items-center gap-2 flex-wrap" style={{ padding: "3px 0" }}>
                <button className="chip" onClick={() => open(b.from)} data-tip={b.from}>{stripExt(basename(b.from))}</button>
                <span>→ <code>[[{b.target}]]</code></span>
                <span className="flex-1" />
                {b.suggestion && <button className="btn" onClick={() => fix(b.from, b.target, b.suggestion!)}>Fix → {b.suggestion}</button>}
                <button className="btn" onClick={() => void create(b.target)}>{tr("Create note")}</button>
              </div>
            ))}
          </section>
        )}

        {health.orphans.length > 0 && (
          <section style={{ marginTop: 14 }}>
            <div className="handwritten-label" style={{ fontSize: "1.4rem" }}>Orphan notes ({health.orphans.length})</div>
            <small style={{ color: "var(--ink-faint)" }}>{tr("No links in or out. Connect them or delete them.")}</small>
            <div className="flex flex-wrap gap-2" style={{ marginTop: 4 }}>
              {health.orphans.slice(0, SHOW).map((p) => <button key={p} className="chip" onClick={() => open(p)} data-tip={p}>{stripExt(basename(p))}</button>)}
            </div>
          </section>
        )}

        {health.untitled.length > 0 && (
          <section style={{ marginTop: 14 }}>
            <div className="handwritten-label" style={{ fontSize: "1.4rem" }}>Without a title ({health.untitled.length})</div>
            <small style={{ color: "var(--ink-faint)" }}>{tr("Add a “# Title” line so they read well in lists and the graph.")}</small>
            <div className="flex flex-wrap gap-2" style={{ marginTop: 4 }}>
              {health.untitled.slice(0, SHOW).map((p) => <button key={p} className="chip" onClick={() => open(p)} data-tip={p}>{stripExt(basename(p))}</button>)}
            </div>
          </section>
        )}
      </div>
    </Dialog>
  );
}
