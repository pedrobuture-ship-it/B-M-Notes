import { useEffect } from "react";
import { useSettings } from "@/stores/settings";
import { useSync } from "@/stores/sync";
import { useWorkspace } from "@/stores/workspace";

const SAVE_DELAY = 15_000;
const POLL = 45_000;

/** Optional background sync. Does nothing unless the open folder is linked to a repository and auto-sync is on. */
export function useAutoSync() {
  const root = useWorkspace((s) => s.info?.root);
  const linked = useSync((s) => s.info?.linked ?? false);
  const auto = useSettings((s) => s.settings.sync.auto);

  // A different folder means a different repository (or none).
  useEffect(() => {
    useSync.getState().reset();
    if (root) void useSync.getState().refresh();
  }, [root]);

  useEffect(() => {
    if (!root || !linked || !auto) return;
    const tick = () => {
      if (useSync.getState().info?.conflicts.length) return;
      void useSync.getState().syncNow(true);
    };
    tick();
    const poll = setInterval(tick, POLL);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const unsub = useWorkspace.subscribe((s, prev) => {
      if (s.saveStatus === "saved" && prev.saveStatus === "saving") {
        clearTimeout(debounce);
        debounce = setTimeout(tick, SAVE_DELAY);
      }
    });
    return () => {
      clearInterval(poll);
      clearTimeout(debounce);
      unsub();
    };
  }, [root, linked, auto]);
}
