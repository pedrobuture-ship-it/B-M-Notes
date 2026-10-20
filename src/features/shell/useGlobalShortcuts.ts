import { useEffect } from "react";
import { useUi } from "@/stores/ui";
import { useSettings } from "@/stores/settings";
import { useWorkspace } from "@/stores/workspace";
import { boardCommand } from "@/features/board/boardBus";
import { createNoteCommand, toggleEditPreview } from "@/features/search/commands";
import { comboFromEvent, effectiveCombos, type ActionId } from "@/lib/shortcuts";

function run(id: ActionId) {
  const ui = useUi.getState();
  const board = (a: Parameters<typeof boardCommand>[0]) => {
    if (ui.view === "board") boardCommand(a);
  };
  switch (id) {
    case "palette": return ui.setDialog(ui.dialog === "palette" ? null : "palette");
    case "search": return ui.setDialog(ui.dialog === "search" ? null : "search");
    case "newNote": return createNoteCommand();
    case "templates": return ui.setDialog("templates");
    case "daily": return void useWorkspace.getState().openDaily();
    case "togglePreview": return toggleEditPreview();
    case "sidebar": return ui.toggleSidebar();
    case "settings": return ui.setDialog("settings");
    case "shortcuts": return ui.setDialog("shortcuts");
    case "back": return ui.goBack();
    case "forward": return ui.goForward();
    case "zen": return ui.setZen(!ui.zen);
    case "fit": return board("fit");
    case "zoomIn": return board("zoomIn");
    case "zoomOut": return board("zoomOut");
  }
}

/** App-wide shortcuts, rebindable in Settings → Keyboard. Editor-specific ones live in the CodeMirror keymap. */
export function useGlobalShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const ui = useUi.getState();
      if (e.key === "Escape") {
        if (ui.editingCard) ui.setEditingCard(null);
        else if (ui.zen && !ui.dialog && !ui.confirmReq && !ui.promptReq && !ui.choiceReq && !ui.pickReq) ui.setZen(false);
        return;
      }
      const combo = comboFromEvent(e);
      if (!combo || ui.confirmReq || ui.promptReq) return;
      const id = (Object.entries(effectiveCombos(useSettings.getState().settings.shortcuts)).find(([, c]) => c === combo)?.[0] ?? null) as ActionId | null;
      if (!id) return;
      // Combos without Ctrl (e.g. Alt+Arrow) must not hijack text editing keys.
      if (!combo.startsWith("Ctrl") && (e.target as HTMLElement | null)?.closest("input, textarea, .cm-editor")) return;
      e.preventDefault();
      run(id);
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
