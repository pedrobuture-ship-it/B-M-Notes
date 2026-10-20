import { useEffect } from "react";
import { useSettings } from "@/stores/settings";
import { usePlugins } from "@/stores/plugins";
import { useWorkspace } from "@/stores/workspace";

/** Loads the approved plugins of the open folder (and stops them when it closes). */
export function usePluginsLoader() {
  const root = useWorkspace((s) => s.info?.root);
  const loaded = useSettings((s) => s.loaded);
  useEffect(() => {
    if (!root || !loaded) {
      usePlugins.getState().stopAll();
      return;
    }
    void usePlugins.getState().load();
    return () => usePlugins.getState().stopAll();
  }, [root, loaded]);
}
