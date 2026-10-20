import { useState } from "react";
import { ipc, type UpdateInfo } from "@/lib/ipc";
import { useTr } from "@/lib/i18n";
import { useSettings } from "@/stores/settings";
import { Row, Toggle } from "./controls";

/** Optional update check. The app only contacts GitHub when you click the button or turn the option on. */
export function UpdatesPanel() {
  const tr = useTr();
  const enabled = useSettings((s) => s.settings.updates.check);
  const update = useSettings((s) => s.update);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    setBusy(true);
    setError(null);
    try {
      setInfo(await ipc.checkUpdate());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Row title={tr("Check now")} hint={info ? (info.newer ? tr("Version {v} is available (you have {c}).", { v: info.latest, c: info.current }) : tr("You are up to date ({c}).", { c: info.current })) : tr("Looks for a newer release on GitHub.")}>
        <button className="btn btn-primary" disabled={busy} onClick={() => void check()}>{busy ? tr("Checking…") : tr("Check for updates")}</button>
      </Row>
      {info?.newer && (
        <div className="paper-card" style={{ padding: "12px 16px", margin: "6px 0 12px" }}>
          <div className="handwritten-label" style={{ fontSize: "1.4rem" }}>{tr("What's new in {v}", { v: info.latest })}</div>
          <p className="selectable" style={{ whiteSpace: "pre-line", margin: "4px 0 8px", fontSize: "0.9rem" }}>{info.notes || tr("See the release page for details.")}</p>
          <button className="btn btn-primary" onClick={() => void ipc.openExternal(info.url)}>{tr("Open the download page")}</button>
        </div>
      )}
      {error && <p role="alert" style={{ color: "var(--red)", fontWeight: 700 }}>{error}</p>}
      <Row title={tr("Check at startup")} hint={tr("At most once a day. Off by default: nothing is sent unless you turn it on.")}>
        <Toggle label={tr("Check at startup")} checked={enabled} onChange={(v) => update((s) => ({ ...s, updates: { check: v } }))} />
      </Row>
    </>
  );
}
