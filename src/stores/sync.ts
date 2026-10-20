import { create } from "zustand";
import { ipc, type Presence, type SyncInfo } from "@/lib/ipc";
import { useUi } from "./ui";
import { useWorkspace } from "./workspace";

interface SyncState {
  info: SyncInfo | null;
  busy: boolean;
  error: string | null;
  lastSync: number | null;
  /** GitHub login of this user (for presence). */
  login: string | null;
  presence: Presence[];
  setPresence: (p: Presence[]) => void;
  setLogin: (l: string | null) => void;
  /** Fetches and refreshes `remoteChanged` (at most every 20 s). */
  check: () => Promise<void>;
  setPrivate: (paths: string[]) => Promise<void>;
  unsetPrivate: (path: string) => Promise<void>;
  reset: () => void;
  refresh: () => Promise<void>;
  syncNow: (silent?: boolean) => Promise<void>;
  link: (url: string) => Promise<boolean>;
  resolve: (path: string, choice: "mine" | "theirs" | "both") => Promise<void>;
  unlink: () => Promise<void>;
}

let lastCheck = 0;
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
    login: null,
    presence: [],
    setPresence: (presence) => set({ presence }),
    setLogin: (login) => set({ login }),
    check: async () => {
      const { info, busy } = get();
      if (!info?.linked || busy || Date.now() - lastCheck < 20_000) return;
      lastCheck = Date.now();
      try {
        set({ info: await ipc.syncCheck() });
      } catch {
        /* offline: the banner just stays as it was */
      }
    },
    setPrivate: async (paths) => {
      const ui = useUi.getState();
      try {
        const tracked = await ipc.syncSetPrivate(paths, false);
        if (tracked.length) {
          const ok = await ui.confirm({
            title: "Stop sharing?",
            message: `${tracked.join(", ")} ${tracked.length === 1 ? "is" : "are"} already shared. Keeping ${tracked.length === 1 ? "it" : "them"} private removes ${tracked.length === 1 ? "it" : "them"} from the repository, and the other people lose their copy on their next sync (the history still has it). Your own file stays.`,
            confirmLabel: "Keep private",
            danger: true,
          });
          if (!ok) return;
          await ipc.syncSetPrivate(paths, true);
        }
        set({ info: await ipc.syncStatus() });
        ui.toast("Kept private on this computer", "success");
      } catch (e) {
        ui.toast(msg(e), "error");
      }
    },
    unsetPrivate: async (path) => {
      try {
        set({ info: await ipc.syncUnsetPrivate(path) });
        useUi.getState().toast("Will be shared on the next sync", "info");
      } catch (e) {
        useUi.getState().toast(msg(e), "error");
      }
    },
    reset: () => set({ info: null, busy: false, error: null, lastSync: null, presence: [] }),
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
