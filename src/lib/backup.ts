import { ipc, type BackupResult } from "./ipc";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

const pad = (n: number) => String(n).padStart(2, "0");

/** `YYYYMMDD-HHMM` in local time, used in the backup file name. */
export function backupStamp(d = new Date()): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

export const DAY_MS = 86_400_000;

/** Writes a ZIP of the open folder into the configured backup folder. Returns null (with a toast) on failure. */
export async function runBackup(silent = false): Promise<BackupResult | null> {
  const { folder, keep } = useSettings.getState().settings.backup;
  const ui = useUi.getState();
  if (!folder) {
    ui.toast("Choose a backup folder in Settings → Backup first.", "error");
    return null;
  }
  try {
    await useWorkspace.getState().flushAll();
    const r = await ipc.backupNow(folder, backupStamp(), keep);
    if (!silent) ui.toast(`Backup saved (${r.files} files)`, "success");
    return r;
  } catch (e) {
    ui.toast(`Backup failed: ${e instanceof Error ? e.message : String(e)}`, "error");
    return null;
  }
}
