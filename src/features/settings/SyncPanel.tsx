import { useEffect, useState } from "react";
import { ipc, type GithubRepo } from "@/lib/ipc";
import { slugify } from "@/lib/slug";
import { useSettings } from "@/stores/settings";
import { useSync } from "@/stores/sync";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { Row, Toggle } from "./controls";

type Mode = null | "create" | "pick" | "url";

function CreateRepo({ onDone }: { onDone: () => void }) {
  const link = useSync((s) => s.link);
  const busy = useSync((s) => s.busy);
  const folder = useWorkspace((s) => s.info?.name ?? "notes");
  const [name, setName] = useState(slugify(folder) || "notes");
  const [isPrivate, setPrivate] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setError(null);
    try {
      const repo = await ipc.githubCreateRepo(name.trim(), isPrivate);
      if (await link(repo.url)) onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <input className="field" aria-label="Repository name" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="flex items-center gap-2"><Toggle label="Private repository" checked={isPrivate} onChange={setPrivate} /> Private repository</label>
      {error && <p role="alert" style={{ color: "var(--red)", fontWeight: 700 }}>{error}</p>}
      <div><button className="btn btn-primary" disabled={busy || !name.trim()} onClick={() => void create()}>{busy ? "Creating…" : "Create and sync"}</button></div>
    </div>
  );
}

function PickRepo({ onDone }: { onDone: () => void }) {
  const link = useSync((s) => s.link);
  const busy = useSync((s) => s.busy);
  const [repos, setRepos] = useState<GithubRepo[] | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ipc.githubListRepos().then(setRepos).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  const shown = (repos ?? []).filter((r) => r.fullName.toLowerCase().includes(filter.toLowerCase())).slice(0, 40);
  return (
    <div className="flex flex-col gap-2">
      <input className="field" aria-label="Filter repositories" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {error && <p role="alert" style={{ color: "var(--red)", fontWeight: 700 }}>{error}</p>}
      {!repos && !error && <small>Loading repositories…</small>}
      <div className="overflow-auto flex flex-col gap-1" style={{ maxHeight: 200 }}>
        {shown.map((r) => (
          <button key={r.fullName} className="btn" style={{ justifyContent: "space-between" }} disabled={busy} onClick={async () => { if (await link(r.url)) onDone(); }}>
            <span>{r.fullName}</span><small>{r.private ? "private" : "public"}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

function PasteUrl({ onDone }: { onDone: () => void }) {
  const link = useSync((s) => s.link);
  const busy = useSync((s) => s.busy);
  const [url, setUrl] = useState("");
  return (
    <div className="flex gap-2">
      <input className="field" aria-label="Repository" placeholder="owner/name or https://github.com/owner/name" value={url} onChange={(e) => setUrl(e.target.value)} />
      <button className="btn btn-primary" disabled={busy || !url.trim()} onClick={async () => { if (await link(url)) onDone(); }}>{busy ? "Linking…" : "Link"}</button>
    </div>
  );
}

function statusText(info: NonNullable<ReturnType<typeof useSync.getState>["info"]>, busy: boolean): string {
  if (busy) return "Syncing…";
  if (info.conflicts.length) return `${info.conflicts.length} conflict(s) to resolve`;
  const parts = [];
  if (info.ahead) parts.push(`${info.ahead} to send`);
  if (info.behind) parts.push(`${info.behind} to receive`);
  return parts.length ? parts.join(", ") : info.dirty ? "Changes waiting to sync" : "Up to date";
}

export function SyncPanel() {
  const { info, busy, error, lastSync, syncNow, resolve, unlink } = useSync();
  const auto = useSettings((s) => s.settings.sync.auto);
  const update = useSettings((s) => s.update);
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => { void useSync.getState().refresh(); }, []);
  if (!info) return null;
  if (!info.gitAvailable) return <p role="alert" style={{ color: "var(--red)", fontWeight: 700 }}>Git is not installed. Install it to sync (https://git-scm.com).</p>;

  if (!info.linked) {
    return (
      <>
        <Row title="Repository" hint="Where this folder is backed up and shared. Choose one to start syncing.">
          <div className="flex gap-2">
            {(["create", "pick", "url"] as const).map((m) => (
              <button key={m} className="btn" aria-pressed={mode === m} onClick={() => setMode(mode === m ? null : m)}>{m === "create" ? "Create new" : m === "pick" ? "Choose existing" : "Paste URL"}</button>
            ))}
          </div>
        </Row>
        <div style={{ marginBottom: 12 }}>
          {mode === "create" && <CreateRepo onDone={() => setMode(null)} />}
          {mode === "pick" && <PickRepo onDone={() => setMode(null)} />}
          {mode === "url" && <PasteUrl onDone={() => setMode(null)} />}
        </div>
        {error && <p role="alert" style={{ color: "var(--red)", fontWeight: 700 }}>{error}</p>}
      </>
    );
  }

  const remote = (info.remote ?? "").replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
  return (
    <>
      <Row title={remote} hint={`${statusText(info, busy)}${lastSync ? ` · last sync ${new Date(lastSync).toLocaleTimeString()}` : ""}`}>
        <button className="btn btn-primary" disabled={busy} onClick={() => void syncNow()}>{busy ? "Syncing…" : "Sync now"}</button>
      </Row>
      <Row title="Sync automatically" hint="Sends your changes shortly after you stop typing and checks for your friend's changes every minute.">
        <Toggle label="Sync automatically" checked={auto} onChange={(v) => update((s) => ({ ...s, sync: { auto: v } }))} />
      </Row>
      {error && <p role="alert" style={{ color: "var(--red)", fontWeight: 700 }}>{error}</p>}
      {info.conflicts.length > 0 && (
        <div className="paper-card" style={{ padding: "12px 16px", margin: "8px 0 12px" }}>
          <div className="handwritten-label" style={{ fontSize: "1.4rem" }}>Changed on both sides</div>
          <small>Pick which version to keep for each note. Nothing is lost: “both” keeps the other version as a copy.</small>
          {info.conflicts.map((p) => (
            <div key={p} className="flex items-center gap-2 flex-wrap" style={{ marginTop: 8 }}>
              <span className="flex-1" style={{ minWidth: 120 }}>{p}</span>
              <button className="btn" disabled={busy} onClick={() => void resolve(p, "mine")}>Keep mine</button>
              <button className="btn" disabled={busy} onClick={() => void resolve(p, "theirs")}>Keep theirs</button>
              <button className="btn" disabled={busy} onClick={() => void resolve(p, "both")}>Keep both</button>
            </div>
          ))}
        </div>
      )}
      <Row title="Unlink this folder" hint="Stops syncing. Your notes and their history stay as they are.">
        <button
          className="btn btn-danger"
          disabled={busy}
          onClick={async () => {
            if (await useUi.getState().confirm({ title: "Unlink repository?", message: "This folder will stop syncing with GitHub. Nothing is deleted.", confirmLabel: "Unlink", danger: true })) void unlink();
          }}
        >
          Unlink
        </button>
      </Row>
    </>
  );
}
