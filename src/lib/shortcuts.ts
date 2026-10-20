export type ActionId =
  | "palette" | "search" | "newNote" | "templates" | "daily" | "togglePreview" | "sidebar" | "settings" | "shortcuts"
  | "back" | "forward" | "zen" | "fit" | "zoomIn" | "zoomOut";

export interface ActionDef {
  id: ActionId;
  label: string;
  /** Combo like "Ctrl+Shift+D". */
  default: string;
}

/** App-wide shortcuts that can be rebound. Editor shortcuts (CodeMirror) are fixed. */
export const ACTIONS: ActionDef[] = [
  { id: "palette", label: "Command palette", default: "Ctrl+K" },
  { id: "search", label: "Search notes", default: "Ctrl+P" },
  { id: "newNote", label: "New note", default: "Ctrl+N" },
  { id: "templates", label: "New note from template", default: "Ctrl+Shift+N" },
  { id: "daily", label: "Open today's daily note", default: "Ctrl+Shift+D" },
  { id: "togglePreview", label: "Toggle edit / preview", default: "Ctrl+E" },
  { id: "sidebar", label: "Toggle sidebar", default: "Ctrl+B" },
  { id: "settings", label: "Settings", default: "Ctrl+," },
  { id: "shortcuts", label: "Keyboard shortcuts", default: "Ctrl+/" },
  { id: "back", label: "Back", default: "Alt+ArrowLeft" },
  { id: "forward", label: "Forward", default: "Alt+ArrowRight" },
  { id: "zen", label: "Focus mode", default: "Ctrl+Shift+F" },
  { id: "fit", label: "Fit board", default: "Ctrl+0" },
  { id: "zoomIn", label: "Zoom in", default: "Ctrl+=" },
  { id: "zoomOut", label: "Zoom out", default: "Ctrl+-" },
];

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta", "AltGraph", "CapsLock"]);

/** Normalised combo for a key event ("Ctrl+Shift+D"), or "" for a bare modifier press. Ctrl and Cmd are the same. */
export function comboFromEvent(e: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">): string {
  if (MODIFIER_KEYS.has(e.key)) return "";
  let key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
  let shift = e.shiftKey;
  if (key === "+") { key = "="; shift = false; }
  if (key === "_") { key = "-"; shift = false; }
  return [e.ctrlKey || e.metaKey ? "Ctrl" : "", e.altKey ? "Alt" : "", shift ? "Shift" : "", key].filter(Boolean).join("+");
}

/** App shortcuts need Ctrl or Alt so they never swallow normal typing. */
export function isValidCombo(combo: string): boolean {
  const parts = combo.split("+");
  return parts.length >= 2 && (parts.includes("Ctrl") || parts.includes("Alt")) && !!parts[parts.length - 1];
}

export function effectiveCombos(overrides: Record<string, string>): Record<ActionId, string> {
  return Object.fromEntries(ACTIONS.map((a) => [a.id, overrides[a.id] ?? a.default])) as Record<ActionId, string>;
}

/** The action that already uses `combo` (other than `id`), if any. */
export function findConflict(overrides: Record<string, string>, id: ActionId, combo: string): ActionDef | null {
  const eff = effectiveCombos(overrides);
  return ACTIONS.find((a) => a.id !== id && eff[a.id] === combo) ?? null;
}

/** "Ctrl+Shift+D" -> "Ctrl + Shift + D", arrows as glyphs. */
export function formatCombo(combo: string): string {
  return combo.split("+").map((p) => ({ ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓" })[p] ?? p).join(" + ");
}

export interface ShortcutDef {
  keys: string;
  label: string;
  group: "General" | "Mural" | "Editor";
  /** When set, `keys` follows the user's binding for this action. */
  action?: ActionId;
}

const act = (id: ActionId, group: ShortcutDef["group"] = "General"): ShortcutDef => {
  const a = ACTIONS.find((x) => x.id === id)!;
  return { keys: formatCombo(a.default), label: a.label, group, action: id };
};

export const SHORTCUTS: ShortcutDef[] = [
  act("palette"),
  act("search"),
  act("newNote"),
  act("templates"),
  act("daily"),
  act("togglePreview"),
  act("sidebar"),
  act("settings"),
  act("shortcuts"),
  act("back"),
  act("forward"),
  act("zen"),
  { keys: "Esc", label: "Close dialog / leave card editing", group: "General" },
  { keys: "Double-click canvas", label: "Create a note at that spot", group: "Mural" },
  { keys: "Double-click card", label: "Edit the note in place", group: "Mural" },
  { keys: "Space + drag", label: "Pan the canvas", group: "Mural" },
  { keys: "Scroll", label: "Zoom", group: "Mural" },
  { keys: "Drag on empty canvas", label: "Select an area", group: "Mural" },
  { keys: "Shift + click", label: "Add to selection", group: "Mural" },
  act("fit", "Mural"),
  act("zoomIn", "Mural"),
  act("zoomOut", "Mural"),
  { keys: "Delete", label: "Delete selected card (asks first)", group: "Mural" },
  { keys: "Ctrl + Shift + B", label: "Bold", group: "Editor" },
  { keys: "Ctrl + I", label: "Italic", group: "Editor" },
  { keys: "Ctrl + Shift + C", label: "Inline code", group: "Editor" },
  { keys: "Ctrl + Shift + L", label: "Insert link", group: "Editor" },
  { keys: "Ctrl + Shift + T", label: "Toggle task checkbox", group: "Editor" },
  { keys: "Ctrl + Alt + T", label: "Edit table as a grid", group: "Editor" },
  { keys: "Ctrl + Alt + 1-3", label: "Heading 1-3", group: "Editor" },
  { keys: "Ctrl + V", label: "Paste an image (saved to assets/)", group: "Editor" },
];
