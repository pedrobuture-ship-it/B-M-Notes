import { useEffect } from "react";
import { ipc } from "@/lib/ipc";
import { useSettings } from "@/stores/settings";
import { useSync } from "@/stores/sync";
import { useUi } from "@/stores/ui";

const HEARTBEAT = 60_000;
const POLL = 30_000;

/** Shares which note you have open with the people you sync with, and shows who else is around. Optional. */
export function usePresence() {
  const linked = useSync((s) => s.info?.linked ?? false);
  const enabled = useSettings((s) => s.settings.sync.presence);
  const note = useUi((s) => (s.view === "note" ? s.activeNote : null));

  // Who am I? (GitHub login, needed for the presence branch name)
  useEffect(() => {
    if (!linked || !enabled || useSync.getState().login) return;
    ipc.githubStatus().then((u) => useSync.getState().setLogin(u?.login ?? null)).catch(() => {});
  }, [linked, enabled]);

  const login = useSync((s) => s.login);

  // Publish when the open note changes (debounced) and as a heartbeat.
  useEffect(() => {
    if (!linked || !enabled || !login) return;
    const publish = () => void ipc.syncPresencePublish(login, note).catch(() => {});
    const t = setTimeout(publish, 2000);
    const hb = setInterval(publish, HEARTBEAT);
    return () => {
      clearTimeout(t);
      clearInterval(hb);
    };
  }, [linked, enabled, login, note]);

  // Look at the others.
  useEffect(() => {
    if (!linked || !enabled || !login) {
      useSync.getState().setPresence([]);
      return;
    }
    const look = () => void ipc.syncPresenceList(login).then((p) => useSync.getState().setPresence(p)).catch(() => {});
    look();
    const poll = setInterval(look, POLL);
    return () => clearInterval(poll);
  }, [linked, enabled, login]);
}
