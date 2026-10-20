import { useEffect, useRef } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Network, X, LayoutDashboard } from "lucide-react";
import { Header } from "@/features/shell/Header";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { Board } from "@/features/board/Board";
import { NotePane, SaveIndicator } from "@/features/editor/NotePane";
import { GraphExplorer } from "@/features/graph/GraphExplorer";
import { Onboarding } from "@/features/onboarding/Onboarding";
import { SearchDialog } from "@/features/search/SearchDialog";
import { CommandPalette } from "@/features/search/CommandPalette";
import { SettingsDialog, ShortcutsDialog, AboutDialog } from "@/features/settings/Dialogs";
import { useGlobalShortcuts } from "@/features/shell/useGlobalShortcuts";
import { ConfirmDialog, PromptDialog, Toasts } from "@/components/Dialogs";
import { useWorkspace, getLastWorkspace } from "@/stores/workspace";
import { useSettings } from "@/stores/settings";
import { useBoard } from "@/stores/board";
import { useUi } from "@/stores/ui";
import { basename } from "@/lib/paths";
import { ipc } from "@/lib/ipc";
import { useAutoSync } from "@/features/shell/useAutoSync";

function MainArea() {
  const view = useUi((s) => s.view);
  const active = useUi((s) => s.activeNote);
  const setView = useUi((s) => s.setView);
  const closeNote = useUi((s) => s.closeNote);
  const boardReady = useBoard((s) => s.ready);
  return (
    <div className="main">
      <div className="main-tabs" role="tablist">
        <button role="tab" className="main-tab" aria-selected={view === "board"} onClick={() => setView("board")}><LayoutDashboard size={15} /><span className="label">Mural</span></button>
        <button role="tab" className="main-tab" aria-selected={view === "graph"} onClick={() => setView("graph")}><Network size={15} /><span className="label">Explore</span></button>
        {active && (
          <div role="tab" className="main-tab" aria-selected={view === "note"} tabIndex={0} onClick={() => useUi.getState().openNote(active)} onKeyDown={(e) => e.key === "Enter" && useUi.getState().openNote(active)}>
            <span className="label">{basename(active)}</span>
            <button aria-label="Close note" onClick={(e) => { e.stopPropagation(); closeNote(); }} className="btn-ghost" style={{ lineHeight: 0 }}><X size={14} /></button>
          </div>
        )}
        <div className="flex-1" />
        <div className="pb-1.5 pr-1"><SaveIndicator /></div>
      </div>
      <div className="main-content">
        {view === "board" && (boardReady ? <Board /> : <div className="empty h-full"><p className="hand">Laying out the wall…</p></div>)}
        {view === "graph" && <GraphExplorer />}
        {view === "note" && active && <NotePane path={active} />}
      </div>
    </div>
  );
}

export function App() {
  const info = useWorkspace((s) => s.info);
  const loading = useWorkspace((s) => s.loading);
  const openWorkspace = useWorkspace((s) => s.openWorkspace);
  const sidebarOpen = useUi((s) => s.sidebarOpen);
  const dialog = useUi((s) => s.dialog);
  const appearance = useSettings((s) => s.settings.appearance);
  const booted = useRef(false);

  useGlobalShortcuts(!!info);

  // Reopen the last workspace automatically.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    // A folder given on the command line wins over the remembered workspace.
    void ipc.launchPath().catch(() => null).then((cli) => {
      const target = cli ?? getLastWorkspace();
      if (target) void openWorkspace(target);
    });
  }, [openWorkspace]);

  useEffect(() => {
    document.documentElement.style.setProperty("--ui-size", `${appearance.fontSize}px`);
    document.documentElement.dataset.density = appearance.density;
    document.documentElement.dataset.theme = appearance.theme;
    document.documentElement.style.colorScheme = appearance.theme;
  }, [appearance]);

  useAutoSync();

  // Flush pending saves when the window is closing / hidden.
  useEffect(() => {
    const flush = () => void useWorkspace.getState().flushAll();
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", () => document.hidden && flush());
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  return (
    <ReactFlowProvider>
      <div className="app">
        <Header />
        {info ? (
          <div className="body">
            {sidebarOpen && <Sidebar />}
            <MainArea />
          </div>
        ) : loading ? (
          <div className="empty h-full"><p className="hand">Opening your notes…</p></div>
        ) : (
          <Onboarding />
        )}
      </div>
      {info && dialog === "search" && <SearchDialog />}
      {info && dialog === "palette" && <CommandPalette />}
      {dialog === "settings" && <SettingsDialog />}
      {dialog === "shortcuts" && <ShortcutsDialog />}
      {dialog === "about" && <AboutDialog />}
      <ConfirmDialog />
      <PromptDialog />
      <Toasts />
    </ReactFlowProvider>
  );
}
