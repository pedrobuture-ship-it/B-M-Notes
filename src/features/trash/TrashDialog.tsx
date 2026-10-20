import { useCallback, useEffect, useState } from "react";
import { Dialog } from "@/components/Dialogs";
import { ipc, type TrashItem } from "@/lib/ipc";
import { useSettings } from "@/stores/settings";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { useTr } from "@/lib/i18n";

export function timeAgo(ms: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const units: [number, string][] = [[60, "min"], [3600, "h"], [86400, "day"]];
  let out = `${Math.round(s / 60)} min ago`;
  for (const [size, name] of units) {
    if (s >= size) {
      const n = Math.floor(s / size);
      out = name === "day" ? `${n} ${n === 1 ? "day" : "days"} ago` : `${n} ${name} ago`;
    }
  }
  return out;
}

export function TrashDialog() {
  const tr = useTr();
  const setDialog = useUi((s) => s.setDialog);
  const days = useSettings((s) => s.settings.files.trashRetentionDays);
  const [items, setItems] = useState<TrashItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await ipc.listTrash(days));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [days]);
  useEffect(() => { void load(); }, [load]);

  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const restore = async (it: TrashItem) => {
    try {
      const path = await ipc.restoreTrash(it.id);
      await useWorkspace.getState().syncWithDisk();
      useUi.getState().toast(`Restored to ${path}`, "success");
      await load();
    } catch (e) {
      fail(e);
    }
  };

  const remove = async (it: TrashItem) => {
    const ok = await useUi.getState().confirm({ title: "Delete permanently?", message: `"${it.name}" will be deleted for good. This can't be undone.`, confirmLabel: "Delete permanently", danger: true });
    if (!ok) return;
    try {
      await ipc.deleteTrash(it.id);
      await load();
    } catch (e) {
      fail(e);
    }
  };

  const empty = async () => {
    const ok = await useUi.getState().confirm({ title: "Empty the trash?", message: `All ${items?.length ?? 0} items will be deleted for good. This can't be undone.`, confirmLabel: "Empty trash", danger: true });
    if (!ok) return;
    try {
      await ipc.emptyTrash();
      await load();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Dialog title="Trash" onClose={() => setDialog(null)} width={620}>
      <div className="px-5 pb-2" style={{ color: "var(--ink-faint)" }}>
        {days > 0 ? `Items are removed for good after ${days} days.` : "Items stay here until you delete them."}
      </div>
      {error && <p role="alert" className="px-5" style={{ color: "var(--red)", fontWeight: 700 }}>{error}</p>}
      <div className="overflow-auto px-5" style={{ maxHeight: "50vh" }}>
        {items === null && !error && <small>{tr("Loading…")}</small>}
        {items?.length === 0 && <p style={{ color: "var(--ink-dim)", padding: "12px 0" }}>{tr("The trash is empty.")}</p>}
        {items?.map((it) => (
          <div key={it.id} className="shortcut-row" style={{ alignItems: "center", gap: 10 }}>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.isDir ? "📁 " : ""}{it.name}</div>
              <small style={{ color: "var(--ink-faint)" }}>{it.originalPath === it.name ? "" : `${it.originalPath} · `}Deleted {timeAgo(it.deletedAt)}</small>
            </div>
            <button className="btn" onClick={() => void restore(it)}>{tr("Restore")}</button>
            <button className="btn btn-danger" onClick={() => void remove(it)}>{tr("Delete permanently")}</button>
          </div>
        ))}
      </div>
      <div className="flex justify-between px-5 py-4">
        <button className="btn btn-danger" disabled={!items?.length} onClick={() => void empty()}>{tr("Empty trash")}</button>
        <button className="btn" onClick={() => setDialog(null)}>{tr("Close")}</button>
      </div>
    </Dialog>
  );
}
