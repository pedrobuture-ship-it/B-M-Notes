import { useEffect } from "react";
import { ipc } from "@/lib/ipc";
import { DAY_MS, runBackup } from "@/lib/backup";
import { useSettings } from "@/stores/settings";
import { useWorkspace } from "@/stores/workspace";

/** Optional: when a folder opens and the last backup is over a day old, make a new one. */
export function useAutoBackup() {
  const root = useWorkspace((s) => s.info?.root);
  const loaded = useSettings((s) => s.loaded);
  useEffect(() => {
    if (!root || !loaded) return;
    const { auto, folder } = useSettings.getState().settings.backup;
    if (!auto || !folder) return;
    let cancelled = false;
    void ipc.backupNewest(folder).then(async (newest) => {
      if (cancelled || (newest !== null && Date.now() - newest < DAY_MS)) return;
      await runBackup(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [root, loaded]);
}
