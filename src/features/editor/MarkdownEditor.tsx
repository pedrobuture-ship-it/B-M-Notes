import { useEffect, useRef } from "react";
import { autocompletion } from "@codemirror/autocomplete";
import { wikiCompletions } from "./wikiComplete";
import { editorBridge } from "./editorBridge";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, syntaxHighlighting, indentOnInput } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { tags as t } from "@lezer/highlight";
import { importAttachment, isSupportedAttachment, pastedName } from "@/lib/images";
import { useUi } from "@/stores/ui";

const highlight = HighlightStyle.define([
  { tag: t.heading1, color: "var(--hl-heading)", fontWeight: "700", fontSize: "1.35em" },
  { tag: t.heading2, color: "var(--hl-heading)", fontWeight: "700", fontSize: "1.2em" },
  { tag: [t.heading3, t.heading4, t.heading5, t.heading6], color: "var(--hl-heading)", fontWeight: "700" },
  { tag: t.strong, fontWeight: "700", color: "var(--hl-strong)" },
  { tag: t.emphasis, fontStyle: "italic", color: "var(--hl-em)" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "var(--hl-link)" },
  { tag: t.url, color: "var(--hl-url)", textDecoration: "underline" },
  { tag: t.monospace, fontFamily: "var(--font-mono)", color: "var(--hl-string)" },
  { tag: t.quote, color: "var(--hl-quote)", fontStyle: "italic" },
  { tag: t.list, color: "var(--hl-list)" },
  { tag: t.processingInstruction, color: "var(--hl-meta)" },
  { tag: t.contentSeparator, color: "var(--hl-meta)" },
  { tag: [t.keyword, t.operator], color: "var(--hl-keyword)" },
  { tag: [t.string, t.regexp], color: "var(--hl-string)" },
  { tag: [t.number, t.bool, t.null], color: "var(--hl-number)" },
  { tag: t.comment, color: "var(--hl-comment)", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.definition(t.variableName), t.propertyName], color: "var(--hl-link)" },
  { tag: [t.typeName, t.className], color: "var(--hl-type)" },
]);

const baseTheme = EditorView.theme(
  {
    "&": { height: "100%", color: "var(--ink)", backgroundColor: "transparent" },
    ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "1.7", padding: "8px 0" },
    ".cm-content": { padding: "8px 18px", caretColor: "var(--amber)" },
    "&.cm-focused": { outline: "none" },
    ".cm-cursor": { borderLeftColor: "var(--amber)", borderLeftWidth: "2px" },
    ".cm-activeLine": { backgroundColor: "var(--active-line)" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "rgb(217 164 65 / 0.3) !important" },
    ".cm-gutters": { backgroundColor: "transparent", color: "var(--ink-faint)", border: "none" },
    ".cm-placeholder": { color: "var(--ink-faint)" },
  },
  { dark: true },
);

const compactTheme = EditorView.theme({
  ".cm-scroller": { padding: "2px 0", lineHeight: "1.55" },
  ".cm-content": { padding: "4px 10px" },
});

function wrap(view: EditorView, open: string, close = open) {
  view.dispatch(
    view.state.changeByRange((r) => {
      const text = view.state.sliceDoc(r.from, r.to);
      const already = text.length >= open.length + close.length && text.startsWith(open) && text.endsWith(close);
      if (already) {
        const inner = text.slice(open.length, text.length - close.length);
        return { changes: { from: r.from, to: r.to, insert: inner }, range: EditorSelection.range(r.from, r.from + inner.length) };
      }
      return {
        changes: { from: r.from, to: r.to, insert: open + text + close },
        range: EditorSelection.range(r.from + open.length, r.from + open.length + text.length),
      };
    }),
  );
  return true;
}

function toggleTask(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const m = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]\s/.exec(line.text);
  if (m) {
    const at = line.from + m[1]!.length + 1;
    view.dispatch({ changes: { from: at, to: at + 1, insert: m[2] === " " ? "x" : " " } });
    return true;
  }
  const list = /^(\s*)([-*+]|\d+[.)])\s+/.exec(line.text);
  if (list) view.dispatch({ changes: { from: line.from + list[0].length, insert: "[ ] " } });
  else {
    const indent = /^\s*/.exec(line.text)![0];
    view.dispatch({ changes: { from: line.from + indent.length, insert: "- [ ] " } });
  }
  return true;
}

function heading(level: number) {
  return (view: EditorView) => {
    const line = view.state.doc.lineAt(view.state.selection.main.head);
    const stripped = line.text.replace(/^#{1,6}\s+/, "");
    const prefix = "#".repeat(level) + " ";
    view.dispatch({ changes: { from: line.from, to: line.to, insert: line.text.startsWith(prefix) ? stripped : prefix + stripped } });
    return true;
  };
}

function link(view: EditorView) {
  const r = view.state.selection.main;
  const text = view.state.sliceDoc(r.from, r.to) || "text";
  view.dispatch({
    changes: { from: r.from, to: r.to, insert: `[${text}](url)` },
    selection: { anchor: r.from + text.length + 3, head: r.from + text.length + 6 },
  });
  return true;
}

export interface EditorOptions {
  lineNumbers: boolean;
  wordWrap: boolean;
  fontSize: number;
}

interface Props {
  /** Stable id of the document (note path). The editor is rebuilt when it changes. */
  docKey: string;
  value: string;
  /** Bump to force-replace the document with `value` (external reload). */
  revision: number;
  onChange: (value: string) => void;
  options: EditorOptions;
  compact?: boolean;
  autoFocus?: boolean;
  onEscape?: () => void;
  placeholderText?: string;
  /** Moves the cursor to this zero-based line and scrolls it into view. `nonce` lets the same line be requested again. */
  scrollToLine?: { line: number; nonce: number } | null;
}

const sizeTheme = (px: number) => EditorView.theme({ ".cm-scroller": { fontSize: `${px}px` } });

export function MarkdownEditor({ docKey, value, revision, onChange, options, compact, autoFocus, onEscape, placeholderText, scrollToLine }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onEscapeRef = useRef(onEscape);
  const valueRef = useRef(value);
  const optionsRef = useRef(options);
  const compartments = useRef({ nums: new Compartment(), wrap: new Compartment(), size: new Compartment() });
  onChangeRef.current = onChange;
  onEscapeRef.current = onEscape;
  valueRef.current = value;
  optionsRef.current = options;

  useEffect(() => {
    if (!host.current) return;
    const c = compartments.current;
    const o = optionsRef.current;
    const insertImages = async (view: EditorView, files: File[], pos?: number) => {
      const parts: string[] = [];
      for (const f of files) {
        try {
          parts.push(await importAttachment(docKey, f, f.name && !/^image\.\w+$/.test(f.name) ? f.name : pastedName(f)));
        } catch (e) {
          useUi.getState().toast(e instanceof Error ? e.message : String(e), "error");
        }
      }
      if (parts.length === 0) return;
      const at = Math.min(pos ?? view.state.selection.main.head, view.state.doc.length);
      const insert = parts.join("\n") + "\n";
      view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length } });
    };
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: valueRef.current,
        extensions: [
          c.nums.of(o.lineNumbers ? lineNumbers() : []),
          c.wrap.of(o.wordWrap ? EditorView.lineWrapping : []),
          c.size.of(sizeTheme(o.fontSize)),
          history(),
          drawSelection(),
          highlightActiveLine(),
          indentOnInput(),
          markdown({ base: markdownLanguage, codeLanguages: languages }),
          syntaxHighlighting(highlight),
          autocompletion({ override: [wikiCompletions], icons: false, maxRenderedOptions: 60 }),
          baseTheme,
          compact ? compactTheme : [],
          placeholderText ? placeholder(placeholderText) : [],
          keymap.of([
            { key: "Mod-Shift-b", run: (v) => wrap(v, "**") },
            { key: "Mod-i", run: (v) => wrap(v, "*") },
            { key: "Mod-Shift-c", run: (v) => wrap(v, "`") },
            { key: "Mod-Shift-l", run: link },
            { key: "Mod-Shift-t", run: toggleTask },
            { key: "Mod-Alt-t", run: () => (useUi.getState().setDialog("table"), true) },
            { key: "Mod-Alt-1", run: heading(1) },
            { key: "Mod-Alt-2", run: heading(2) },
            { key: "Mod-Alt-3", run: heading(3) },
            { key: "Escape", run: () => (onEscapeRef.current ? (onEscapeRef.current(), true) : false) },
            indentWithTab,
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              const text = u.state.doc.toString();
              valueRef.current = text;
              onChangeRef.current(text);
            }
          }),
          EditorView.domEventHandlers({
            focus(_e, v) {
              editorBridge.set(v);
              return false;
            },
            paste(e, v) {
              const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
              if (files.length === 0) return false; // plain text: CodeMirror pastes normally
              e.preventDefault();
              void insertImages(v, files);
              return true;
            },
            drop(e, v) {
              const files = [...(e.dataTransfer?.files ?? [])].filter(isSupportedAttachment);
              if (files.length === 0) return false;
              e.preventDefault();
              void insertImages(v, files, v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? undefined);
              return true;
            },
          }),
        ],
      }),
    });
    viewRef.current = view;
    editorBridge.set(view);
    if (autoFocus) {
      view.focus();
      view.dispatch({ selection: { anchor: view.state.doc.length } });
    }
    return () => {
      editorBridge.clear(view);
      view.destroy();
      viewRef.current = null;
    };
    // Rebuilt only when the document identity changes; the rest syncs through refs/compartments.
  }, [docKey]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const c = compartments.current;
    view.dispatch({
      effects: [
        c.nums.reconfigure(options.lineNumbers ? lineNumbers() : []),
        c.wrap.reconfigure(options.wordWrap ? EditorView.lineWrapping : []),
        c.size.reconfigure(sizeTheme(options.fontSize)),
      ],
    });
  }, [options.lineNumbers, options.wordWrap, options.fontSize]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !scrollToLine) return;
    const line = view.state.doc.line(Math.min(view.state.doc.lines, Math.max(1, scrollToLine.line + 1)));
    view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "start", yMargin: 24 }) });
    view.focus();
  }, [scrollToLine]);

  // External replacement (disk reload / conflict resolution).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const cur = view.state.doc.toString();
    if (cur !== valueRef.current) {
      const head = Math.min(view.state.selection.main.head, valueRef.current.length);
      view.dispatch({ changes: { from: 0, to: cur.length, insert: valueRef.current }, selection: { anchor: head } });
    }
  }, [revision]);

  return <div ref={host} className="h-full w-full" style={{ minHeight: 0 }} />;
}
