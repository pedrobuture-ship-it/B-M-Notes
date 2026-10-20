import { Cloud, CloudAlert, Command, FolderOpen, Moon, RefreshCw, Search, Settings, Sun } from "lucide-react";
import { LogoMark } from "@/components/doodles";
import { useUi } from "@/stores/ui";
import { useSettings } from "@/stores/settings";
import { useSync } from "@/stores/sync";
import { openFolderFlow } from "@/features/onboarding/flows";

export function Header() {
  const setDialog = useUi((s) => s.setDialog);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
  const theme = useSettings((s) => s.settings.appearance.theme);
  const update = useSettings((s) => s.update);
  const sync = useSync((s) => s.info);
  const syncing = useSync((s) => s.busy);
  const syncError = useSync((s) => s.error);
  const syncNow = useSync((s) => s.syncNow);
  const next = theme === "dark" ? "light" : "dark";
  return (
    <header className="header">
      <button className="logo" onClick={toggleSidebar} aria-label="b&m notes — toggle sidebar" data-tip="Toggle sidebar (Ctrl+B)">
        <LogoMark />
        <span>b&amp;m <b>notes</b></span>
      </button>
      <button className="search-trigger" onClick={() => setDialog("search")} aria-label="Search notes">
        <Search size={16} />
        <span className="flex-1">Search notes…</span>
        <span className="kbd">Ctrl P</span>
      </button>
      <button className="btn" onClick={() => setDialog("palette")} aria-label="Command palette">
        <Command size={15} /> <span className="kbd">Ctrl K</span>
      </button>
      <div className="flex-1" />
      {sync?.linked && (
        <button
          className="btn btn-ghost btn-icon"
          style={sync.conflicts.length || syncError ? { color: "var(--red)" } : undefined}
          aria-label="Sync status"
          data-tip={syncing ? "Syncing…" : sync.conflicts.length ? "Conflicts to resolve" : syncError ? `Sync failed: ${syncError}` : "Synced with GitHub (click to sync now)"}
          onClick={() => (sync.conflicts.length ? useUi.getState().openSettings("Sync") : void syncNow())}
        >
          {syncing ? <RefreshCw size={17} className="spin" /> : sync.conflicts.length || syncError ? <CloudAlert size={17} /> : <Cloud size={17} />}
        </button>
      )}
      <button className="btn btn-ghost btn-icon" onClick={() => update((s) => ({ ...s, appearance: { ...s.appearance, theme: next } }))} aria-label={`Switch to ${next} theme`} data-tip={`Switch to ${next} theme`}>{theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}</button>
      <button className="btn btn-ghost btn-icon" onClick={() => setDialog("settings")} aria-label="Settings" data-tip="Settings (Ctrl+,)"><Settings size={17} /></button>
      <button className="btn" onClick={() => void openFolderFlow()}><FolderOpen size={16} /> Open folder</button>
    </header>
  );
}
