import { Command, FolderOpen, Moon, Search, Settings } from "lucide-react";
import { LogoMark } from "@/components/doodles";
import { useUi } from "@/stores/ui";
import { openFolderFlow } from "@/features/onboarding/flows";

export function Header() {
  const setDialog = useUi((s) => s.setDialog);
  const toggleSidebar = useUi((s) => s.toggleSidebar);
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
      <button className="btn btn-ghost btn-icon" disabled aria-label="Theme: dark (light theme coming later)" data-tip="Dark theme (light comes later)"><Moon size={17} /></button>
      <button className="btn btn-ghost btn-icon" onClick={() => setDialog("settings")} aria-label="Settings" data-tip="Settings (Ctrl+,)"><Settings size={17} /></button>
      <button className="btn" onClick={() => void openFolderFlow()}><FolderOpen size={16} /> Open folder</button>
    </header>
  );
}
