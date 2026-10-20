import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Link2, Check, CircleAlert, Loader2, Pin, PinOff } from "lucide-react";
import { togglePin } from "@/lib/actions";
import { useWorkspace } from "@/stores/workspace";
import { useSettings } from "@/stores/settings";
import { useUi, type NoteMode } from "@/stores/ui";
import { basename } from "@/lib/paths";
import { extractHeadings } from "@/lib/headings";
import { propText, splitFrontmatter } from "@/lib/frontmatter";
import { UnlinkedMentions } from "./UnlinkedMentions";
import { MarkdownEditor } from "./MarkdownEditor";
import { Preview } from "./Preview";
import { Squiggle } from "@/components/doodles";

export function SaveIndicator() {
  const status = useWorkspace((s) => s.saveStatus);
  if (status === "idle") return <span className="save-pill" data-status="idle" aria-live="polite">&nbsp;</span>;
  return (
    <span className="save-pill" data-status={status} aria-live="polite">
      {status === "saving" && <><Loader2 size={14} className="animate-spin" /> Saving...</>}
      {status === "saved" && <><Check size={14} /> Saved</>}
      {status === "error" && <><CircleAlert size={14} /> Save failed</>}
    </span>
  );
}

export function NotePane({ path }: { path: string }) {
  const note = useWorkspace((s) => s.notes[path]);
  const setContent = useWorkspace((s) => s.setContent);
  const resolveConflict = useWorkspace((s) => s.resolveConflict);
  const backlinks = useWorkspace((s) => s.index.backlinks.get(path));
  const meta = useWorkspace((s) => s.index.meta);
  const editor = useSettings((s) => s.settings.editor);
  const mode = useUi((s) => s.noteMode);
  const setMode = useUi((s) => s.setNoteMode);
  const openNote = useUi((s) => s.openNote);
  const setView = useUi((s) => s.setView);

  const pinned = useSettings((s) => s.settings.nav.pinned.includes(path));
  const pending = useUi((s) => s.pendingHeading);
  const [jump, setJump] = useState<{ line: number; nonce: number } | null>(null);
  const previewRef = useRef<HTMLElement>(null);
  const noteContent = note?.content;
  // Opened through [[note#Section]]: scroll the preview and put the editor cursor on that heading.
  useEffect(() => {
    if (!pending || noteContent === undefined) return;
    const h = extractHeadings(noteContent).find((x) => x.slug === pending);
    if (h) setJump({ line: h.line, nonce: Date.now() });
    requestAnimationFrame(() => previewRef.current?.querySelector(`[data-heading="${CSS.escape(pending)}"]`)?.scrollIntoView({ block: "start" }));
    useUi.getState().setPendingHeading(null);
  }, [pending, noteContent]);

  const props = useMemo(() => (noteContent ? Object.entries(splitFrontmatter(noteContent).data).filter(([, v]) => (Array.isArray(v) ? v.length : v !== "")) : []), [noteContent]);

  const options = useMemo(() => ({ lineNumbers: editor.lineNumbers, wordWrap: editor.wordWrap, fontSize: editor.fontSize }), [editor.lineNumbers, editor.wordWrap, editor.fontSize]);

  if (!note) {
    return (
      <div className="empty h-full">
        <p className="hand">This note is gone.</p>
        <button className="btn" onClick={() => setView("board")}>Back to the mural</button>
      </div>
    );
  }

  const modes: { id: NoteMode; label: string }[] = [
    { id: "edit", label: "Edit" },
    { id: "split", label: "Split" },
    { id: "preview", label: "Preview" },
  ];

  return (
    <div className="note-pane">
      <div className="note-toolbar">
        <button className="btn btn-ghost btn-icon" onClick={() => setView("board")} aria-label="Back to mural" data-tip="Back to mural"><ArrowLeft size={16} /></button>
        <span className="handwritten-label" style={{ fontSize: "1.6rem" }}>{basename(path)}</span>
        <div className="flex-1" />
        <SaveIndicator />
        <button className="btn btn-ghost btn-icon" onClick={() => togglePin(path)} aria-label={pinned ? "Unpin note" : "Pin note"} data-tip={pinned ? "Unpin" : "Pin to top of the sidebar"}>{pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
        <div className="segmented" role="group" aria-label="View mode">
          {modes.map((m) => (
            <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>
      </div>

      {note.conflict !== null && (
        <div className="banner" role="alert">
          <CircleAlert size={16} />
          <span className="flex-1">This file changed on disk while you have unsaved edits.</span>
          <button className="btn" onClick={() => resolveConflict(path, true)}>Keep mine</button>
          <button className="btn" onClick={() => resolveConflict(path, false)}>Load disk version</button>
        </div>
      )}

      {props.length > 0 && (
        <div className="props-bar" aria-label="Properties">
          {props.map(([k, v]) => (
            <span key={k} className="chip" data-tip={k}><b>{k}:</b> {propText(v)}</span>
          ))}
        </div>
      )}

      <div className="note-body" data-mode={mode}>
        {mode !== "preview" && (
          <section className="note-editor-wrap" aria-label="Editor">
            <MarkdownEditor docKey={path} value={note.content} revision={note.revision} onChange={(v) => setContent(path, v)} options={options} autoFocus scrollToLine={jump} />
          </section>
        )}
        {mode !== "edit" && (
          <section ref={previewRef} className="note-preview-wrap" aria-label="Preview">
            {note.content.trim() ? (
              <Preview path={path} content={note.content} embeds />
            ) : (
              <div className="empty"><Squiggle style={{ color: "var(--amber)" }} /><p className="hand">Nothing here yet.</p><p>Start typing in the editor.</p></div>
            )}
          </section>
        )}
      </div>

      <div className="backlinks" aria-label="Backlinks">
        <div className="handwritten-label" style={{ fontSize: "1.35rem" }}><Link2 size={14} className="inline mr-1" />Backlinks</div>
        {backlinks && backlinks.length > 0 ? (
          <ul className="m-0 mt-1 p-0 list-none flex flex-wrap gap-2">
            {backlinks.map((p) => (
              <li key={p}>
                <button className="chip" onClick={() => openNote(p)} data-tip={p}>{meta.get(p)?.title ?? basename(p)}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 mt-1" style={{ color: "var(--ink-faint)" }}>No other note links here yet. Use [[{basename(path).replace(/\.md$/i, "")}]] from another note.</p>
        )}
      </div>
      <UnlinkedMentions path={path} />
    </div>
  );
}
