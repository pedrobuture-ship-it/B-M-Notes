import { useEffect } from "react";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { boardCommand } from "@/features/board/boardBus";
import { createNoteCommand, toggleEditPreview } from "@/features/search/commands";

/** App-wide shortcuts. Editor-specific ones live in the CodeMirror keymap. */
export function useGlobalShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const ui = useUi.getState();
      if (e.key === "Escape") {
        if (ui.editingCard) ui.setEditingCard(null);
        return;
      }
      if (e.altKey && !mod && (e.key === "ArrowLeft" || e.key === "ArrowRight") && !(e.target as HTMLElement | null)?.closest("input, textarea, .cm-editor")) {
        e.preventDefault();
        if (e.key === "ArrowLeft") ui.goBack();
        else ui.goForward();
        return;
      }
      if (!mod) return;
      const key = e.key.toLowerCase();
      const blockedByModal = ui.confirmReq || ui.promptReq;
      if (blockedByModal) return;
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      const board = (a: Parameters<typeof boardCommand>[0]) => {
        if (ui.view === "board") boardCommand(a);
      };
      if (key === "k" && !e.shiftKey) run(() => ui.setDialog(ui.dialog === "palette" ? null : "palette"));
      else if (key === "p" && !e.shiftKey) run(() => ui.setDialog(ui.dialog === "search" ? null : "search"));
      else if (key === "n" && !e.shiftKey) run(createNoteCommand);
      else if (key === "d" && e.shiftKey) run(() => void useWorkspace.getState().openDaily());
      else if (key === "e" && !e.shiftKey) run(toggleEditPreview);
      else if (key === "b" && !e.shiftKey) run(ui.toggleSidebar);
      else if (key === "," ) run(() => ui.setDialog("settings"));
      else if (key === "/" ) run(() => ui.setDialog("shortcuts"));
      else if (key === "0") run(() => board("fit"));
      else if (key === "=" || key === "+") run(() => board("zoomIn"));
      else if (key === "-" || key === "_") run(() => board("zoomOut"));
    };
    window.addEventListener("keydown", handler);
    // Webviews otherwise show a native context menu / reload on some combos.
    const noCtx = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("input, textarea, .cm-editor, .selectable")) e.preventDefault();
    };
    window.addEventListener("contextmenu", noCtx);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("contextmenu", noCtx);
    };
  }, [enabled]);
}
