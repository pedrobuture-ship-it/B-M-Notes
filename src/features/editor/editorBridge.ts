import type { EditorView } from "@codemirror/view";

/** The editor that last had focus, so dialogs and commands can read and edit its text. */
let current: EditorView | null = null;

export const editorBridge = {
  set(view: EditorView | null) {
    current = view;
  },
  clear(view: EditorView) {
    if (current === view) current = null;
  },
  get(): EditorView | null {
    return current;
  },
  /** Cursor position and the whole document of the focused editor. */
  state(): { doc: string; pos: number } | null {
    return current ? { doc: current.state.doc.toString(), pos: current.state.selection.main.head } : null;
  },
  replace(from: number, to: number, text: string): boolean {
    if (!current) return false;
    current.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length } });
    current.focus();
    return true;
  },
};
