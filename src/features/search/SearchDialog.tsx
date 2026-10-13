import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Search } from "lucide-react";
import { Dialog } from "@/components/Dialogs";
import { EmptySearch } from "@/components/doodles";
import { useWorkspace } from "@/stores/workspace";
import { useUi } from "@/stores/ui";
import { searchNotes, type SearchResult } from "@/lib/search";

function Marked({ text, marks }: { text: string; marks: [number, number][] }) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  marks.forEach(([a, b], i) => {
    if (a < last) return;
    parts.push(<Fragment key={`t${i}`}>{text.slice(last, a)}</Fragment>, <mark key={`m${i}`}>{text.slice(a, b)}</mark>);
    last = b;
  });
  parts.push(<Fragment key="end">{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}

export function SearchDialog() {
  const setDialog = useUi((s) => s.setDialog);
  const openNote = useUi((s) => s.openNote);
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // debounce so typing stays fluid on large vaults
  useEffect(() => {
    const t = setTimeout(() => setQuery(input), 90);
    return () => clearTimeout(t);
  }, [input]);

  const results: SearchResult[] = useMemo(() => {
    const { index, notes } = useWorkspace.getState();
    return searchNotes(index, (p) => notes[p]?.content ?? "", query);
  }, [query]);

  useEffect(() => setSel(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const go = (r?: SearchResult) => {
    if (r) openNote(r.path);
  };

  return (
    <Dialog onClose={() => setDialog(null)} width={640}>
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <Search size={18} style={{ color: "var(--amber)" }} />
        <input
          className="field"
          autoFocus
          placeholder="Search by name, title, tag (#tag) or content…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          aria-label="Search notes"
          role="combobox"
          aria-expanded="true"
          aria-controls="search-results"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
            if (e.key === "Enter") go(results[sel]);
          }}
        />
      </div>
      <div className="palette-list" id="search-results" role="listbox" ref={listRef} style={{ minHeight: 120 }}>
        {query.trim() === "" ? (
          <p className="px-3 py-6 m-0 text-center" style={{ color: "var(--ink-faint)" }}>Type to search every note in this workspace.</p>
        ) : results.length === 0 ? (
          <div className="empty"><EmptySearch /><p className="hand">No notes found.</p></div>
        ) : (
          results.map((r, i) => (
            <button key={r.path} role="option" aria-selected={i === sel} className="palette-item" onMouseMove={() => setSel(i)} onClick={() => go(r)}>
              <FileText size={16} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{r.title}</span>
                <span className="snippet"><Marked text={r.snippet} marks={r.marks} /></span>
              </span>
              <span className="count text-xs shrink-0" style={{ color: "var(--ink-faint)" }}>{r.path}</span>
            </button>
          ))
        )}
      </div>
    </Dialog>
  );
}
