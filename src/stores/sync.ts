import { create } from "zustand";
import { ipc, type SyncInfo } from "@/lib/ipc";
import { useUi } from "./ui";
import { useWorkspace } from "./workspace";

interface SyncState {
  info: SyncInfo | null;
  busy: boolean;
  error: string | null;
  lastSync: number | null;
  reset: () => void;
  refresh: () => Promise<void>;
  syncNow: (silent?: boolean) => Promise<void>;
  link: (url: string) => Promise<boolean>;
  resolve: (path: string, choice: "mine" | "theirs" | "both") => Promise<void>;
  unlink: () => Promise<void>;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const useSync = create<SyncState>((set, get) => {
  /** Runs one sync operation, keeping `busy`, `error`, conflicts and large-file warnings consistent. */
  const run = async (op: () => Promise<SyncInfo>, silent = false): Promise<boolean> => {
    if (get().busy) return false;
    set({ busy: true, error: null });
    try {
      await useWorkspace.getState().flushAll();
      const info = await op();
      set({ info, lastSync: Date.now() });
      const ui = useUi.getState();
      if (info.conflicts.length && !silent) ui.toast(`${info.conflicts.length} note(s) changed on both sides. Open Settings → Sync to resolve.`, "error");
      if (info.largeFiles.length) ui.toast(`Large file synced: ${info.largeFiles[0]}. Big files make the repository heavy.`, "info");
      return true;
    } catch (e) {
      if (msg(e) !== "busy") set({ error: msg(e) });
      return false;
    } finally {
      set({ busy: false });
    }
  };

  return {
    info: null,
    busy: false,
    error: null,
    lastSync: null,
    reset: () => set({ info: null, busy: false, error: null, lastSync: null }),
    refresh: async () => {
      try {
        set({ info: await ipc.syncStatus() });
      } catch {
        set({ info: null });
      }
    },
    syncNow: async (silent = false) => {
      if (!get().info?.linked) return;
      await run(() => ipc.syncNow(), silent);
    },
    link: (url) => run(() => ipc.syncLink(url)),
    resolve: async (path, choice) => {
      await run(() => ipc.syncResolve(path, choice));
    },
    unlink: async () => {
      await run(() => ipc.syncUnlink());
    },
  };
});
