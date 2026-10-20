import { useEffect, useState } from "react";
import { ipc } from "@/lib/ipc";
import { runBackup } from "@/lib/backup";
import { useSettings } from "@/stores/settings";
import { Row, Toggle } from "./controls";
import { useTr } from "@/lib/i18n";

/** Local ZIP backups: a folder, "Back up now", and an optional once-a-day automatic backup. */
export function BackupPanel() {
  const tr = useTr();
  const backup = useSettings((s) => s.settings.backup);
  const update = useSettings((s) => s.update);
  const [last, setLast] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!backup.folder) {
      setLast(null);
      return;
    }
    ipc.backupNewest(backup.folder).then(setLast).catch(() => setLast(null));
  }, [backup.folder]);

  const choose = async () => {
    const dir = await ipc.pickFolder("Choose where backups are saved");
    if (dir) update((s) => ({ ...s, backup: { ...s.backup, folder: dir } }));
  };

  const now = async () => {
    setBusy(true);
    const r = await runBackup();
    if (r) setLast(Date.now());
    setBusy(false);
  };

  return (
    <>
      <Row title="Backup folder" hint={backup.folder || "Not set. Backups are .zip files of this folder."}>
        <button className="btn" onClick={() => void choose()}>{tr("Choose…")}</button>
      </Row>
      <Row title="Back up now" hint={last ? `Last backup: ${new Date(last).toLocaleString()}` : "No backup yet."}>
        <button className="btn btn-primary" disabled={busy || !backup.folder} onClick={() => void now()}>{busy ? "Saving…" : "Back up now"}</button>
      </Row>
      <Row title="Back up automatically" hint="Once a day, when you open this folder.">
        <Toggle label="Back up automatically" checked={backup.auto} onChange={(v) => update((s) => ({ ...s, backup: { ...s.backup, auto: v } }))} />
      </Row>
      <Row title="Backups to keep" hint="Older ones are deleted. The trash, .git and node_modules are not included.">
        <input className="field" style={{ width: 90 }} type="number" aria-label={tr("Backups to keep")} min={1} max={100} value={backup.keep} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n)) update((s) => ({ ...s, backup: { ...s.backup, keep: n } })); }} />
      </Row>
    </>
  );
}
