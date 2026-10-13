import { create } from "zustand";
import { DEFAULT_SETTINGS, normalizeSettings } from "@/lib/board";
import { ipc } from "@/lib/ipc";
import type { Settings } from "@/types";

interface SettingsState {
  settings: Settings;
  loaded: boolean;
  load: () => Promise<void>;
  reset: () => void;
  update: (fn: (s: Settings) => Settings) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  load: async () => {
    try {
      const { content } = await ipc.readMeta("settings.json");
      set({ settings: content ? normalizeSettings(JSON.parse(content)) : DEFAULT_SETTINGS, loaded: true });
    } catch {
      // Corrupt or unreadable settings must never block the app: fall back to defaults.
      set({ settings: DEFAULT_SETTINGS, loaded: true });
    }
  },
  reset: () => {
    clearTimeout(timer);
    set({ settings: DEFAULT_SETTINGS, loaded: false });
  },
  update: (fn) => {
    set({ settings: normalizeSettings(fn(get().settings)) });
    clearTimeout(timer);
    // Settings.json is only created once the user actually changes something.
    timer = setTimeout(() => {
      ipc.writeMeta("settings.json", JSON.stringify(get().settings, null, 2)).catch(() => {});
    }, 300);
  },
}));
