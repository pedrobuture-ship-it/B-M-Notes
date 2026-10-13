import { ipc } from "@/lib/ipc";
import { newNote, revealInFolder } from "@/lib/actions";
import { boardCommand } from "@/features/board/boardBus";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { openFolderFlow } from "@/features/onboarding/flows";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  run: () => void | Promise<void>;
}

function onBoard(action: Parameters<typeof boardCommand>[0]) {
  const ui = useUi.getState();
  if (ui.view !== "board") {
    ui.setView("board");
    setTimeout(() => boardCommand(action), 120);
  } else boardCommand(action);
}

export function toggleEditPreview() {
  const ui = useUi.getState();
  if (ui.view !== "note") return;
  ui.setNoteMode(ui.noteMode === "preview" ? "edit" : "preview");
}

export function createNoteCommand() {
  const ui = useUi.getState();
  if (ui.view === "board") boardCommand("newNote");
  else void newNote("");
}

export function getCommands(): Command[] {
  const ui = useUi.getState;
  return [
    { id: "new-note", label: "New note", hint: "Ctrl N", run: createNoteCommand },
    { id: "new-frame", label: "New frame", run: () => onBoard("newFrame") },
    { id: "open-note", label: "Open note", hint: "Ctrl P", run: () => ui().setDialog("search") },
    { id: "search", label: "Search notes", hint: "Ctrl P", run: () => ui().setDialog("search") },
    { id: "open-folder", label: "Open folder", run: () => void openFolderFlow() },
    {
      id: "reveal",
      label: "Reveal file",
      run: () => void revealInFolder(ui().view === "note" && ui().activeNote ? ui().activeNote! : ""),
    },
    { id: "reveal-ws", label: "Reveal workspace in filesystem", run: () => void ipc.reveal("").catch(() => {}) },
    { id: "sidebar", label: "Toggle sidebar", hint: "Ctrl B", run: () => ui().toggleSidebar() },
    { id: "fit", label: "Fit board", hint: "Ctrl 0", run: () => onBoard("fit") },
    { id: "zoom-in", label: "Zoom in", hint: "Ctrl +", run: () => onBoard("zoomIn") },
    { id: "zoom-out", label: "Zoom out", hint: "Ctrl -", run: () => onBoard("zoomOut") },
    { id: "daily", label: "Open daily note", hint: "Ctrl Shift D", run: () => void useWorkspace.getState().openDaily() },
    { id: "toggle-preview", label: "Toggle preview", hint: "Ctrl E", run: () => { if (ui().view === "note") ui().setNoteMode(ui().noteMode === "edit" ? "split" : "edit"); } },
    { id: "toggle-editor", label: "Toggle editor", run: () => { if (ui().view === "note") ui().setNoteMode(ui().noteMode === "preview" ? "split" : "preview"); } },
    { id: "go-board", label: "Go to mural", run: () => ui().setView("board") },
    { id: "go-graph", label: "Explore graph", run: () => ui().setSidebarTab("explore") },
    { id: "settings", label: "Settings", hint: "Ctrl ,", run: () => ui().setDialog("settings") },
    { id: "shortcuts", label: "Keyboard shortcuts", hint: "Ctrl /", run: () => ui().setDialog("shortcuts") },
    { id: "about", label: "About buturenotes", run: () => ui().setDialog("about") },
    { id: "close-ws", label: "Close workspace", run: () => void useWorkspace.getState().closeWorkspace() },
  ];
}
