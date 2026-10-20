export interface ShortcutDef {
  keys: string;
  label: string;
  group: "General" | "Mural" | "Editor";
}

export const SHORTCUTS: ShortcutDef[] = [
  { keys: "Ctrl + K", label: "Command palette", group: "General" },
  { keys: "Ctrl + P", label: "Search notes", group: "General" },
  { keys: "Ctrl + N", label: "New note", group: "General" },
  { keys: "Ctrl + Shift + D", label: "Open today's daily note", group: "General" },
  { keys: "Ctrl + E", label: "Toggle edit / preview", group: "General" },
  { keys: "Ctrl + B", label: "Toggle sidebar", group: "General" },
  { keys: "Ctrl + ,", label: "Settings", group: "General" },
  { keys: "Ctrl + /", label: "Keyboard shortcuts", group: "General" },
  { keys: "Alt + ← / →", label: "Back / forward", group: "General" },
  { keys: "Esc", label: "Close dialog / leave card editing", group: "General" },
  { keys: "Double-click canvas", label: "Create a note at that spot", group: "Mural" },
  { keys: "Double-click card", label: "Edit the note in place", group: "Mural" },
  { keys: "Space + drag", label: "Pan the canvas", group: "Mural" },
  { keys: "Scroll", label: "Zoom", group: "Mural" },
  { keys: "Drag on empty canvas", label: "Select an area", group: "Mural" },
  { keys: "Shift + click", label: "Add to selection", group: "Mural" },
  { keys: "Ctrl + 0", label: "Fit board", group: "Mural" },
  { keys: "Ctrl + +", label: "Zoom in", group: "Mural" },
  { keys: "Ctrl + -", label: "Zoom out", group: "Mural" },
  { keys: "Delete", label: "Delete selected card (asks first)", group: "Mural" },
  { keys: "Ctrl + Shift + B", label: "Bold", group: "Editor" },
  { keys: "Ctrl + I", label: "Italic", group: "Editor" },
  { keys: "Ctrl + Shift + C", label: "Inline code", group: "Editor" },
  { keys: "Ctrl + Shift + L", label: "Insert link", group: "Editor" },
  { keys: "Ctrl + Shift + T", label: "Toggle task checkbox", group: "Editor" },
  { keys: "Ctrl + Alt + 1-3", label: "Heading 1-3", group: "Editor" },
  { keys: "Ctrl + V", label: "Paste an image (saved to assets/)", group: "Editor" },
];
