import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { NoteFile, TreeNode, WorkspaceInfo } from "@/types";

export interface FsChange {
  changed: string[];
  removed: string[];
  structure: boolean;
}

export interface GithubDevice {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  interval: number;
  expiresIn: number;
}

export interface GithubUser {
  login: string;
  name: string | null;
}

export interface SyncInfo {
  gitAvailable: boolean;
  linked: boolean;
  remote: string | null;
  branch: string | null;
  conflicts: string[];
  dirty: boolean;
  ahead: number;
  behind: number;
  largeFiles: string[];
}

export interface GithubRepo {
  fullName: string;
  private: boolean;
  url: string;
}

export interface TrashItem {
  id: string;
  name: string;
  originalPath: string;
  isDir: boolean;
  deletedAt: number;
}

export interface MetaRead {
  content: string | null;
  backup: string | null;
}

function errMessage(e: unknown): string {
  return typeof e === "string" ? e : e instanceof Error ? e.message : "Unknown error";
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw new Error(errMessage(e), { cause: e });
  }
}

export const ipc = {
  pickFolder: async (title = "Choose a folder"): Promise<string | null> => {
    const res = await openDialog({ directory: true, multiple: false, title });
    return typeof res === "string" ? res : null;
  },
  openWorkspace: (path: string) => call<WorkspaceInfo>("open_workspace", { path }),
  closeWorkspace: () => call<void>("close_workspace"),
  scan: (ignored: string[]) => call<TreeNode[]>("scan_workspace", { ignored }),
  readAll: (ignored: string[]) => call<NoteFile[]>("read_all_notes", { ignored }),
  readNote: (path: string) => call<NoteFile>("read_note", { path }),
  writeNote: (path: string, content: string) => call<number>("write_note", { path, content }),
  createNote: (dir: string, name: string, content: string) => call<string>("create_note", { dir, name, content }),
  createDir: (parent: string, name: string) => call<string>("create_dir", { parent, name }),
  rename: (path: string, newName: string) => call<string>("rename_entry", { path, newName }),
  move: (path: string, newParent: string) => call<string>("move_entry", { path, newParent }),
  remove: (path: string) => call<void>("delete_entry", { path }),
  listTrash: (retentionDays: number) => call<TrashItem[]>("list_trash", { retentionDays }),
  restoreTrash: (id: string) => call<string>("restore_trash", { id }),
  deleteTrash: (id: string) => call<void>("delete_trash", { id }),
  emptyTrash: () => call<void>("empty_trash"),
  saveAsset: (assetsDir: string, fileName: string, dataBase64: string) =>
    call<string>("save_asset", { assetsDir, fileName, dataBase64 }),
  absolutePath: (path: string) => call<string>("absolute_path", { path }),
  readMeta: (file: string) => call<MetaRead>("read_meta", { file }),
  launchPath: () => call<string | null>("launch_path"),
  writeMeta: (file: string, content: string) => call<void>("write_meta", { file, content }),
  deleteMeta: (file: string) => call<void>("delete_meta", { file }),
  reveal: async (path: string) => revealItemInDir(await call<string>("absolute_path", { path })),
  copyPath: async (path: string) => {
    await navigator.clipboard.writeText(await call<string>("absolute_path", { path }));
  },
  openExternal: (url: string) => openUrl(url),
  githubLoginStart: () => call<GithubDevice>("github_login_start"),
  githubLoginPoll: (deviceCode: string) => call<{ status: "pending" | "slow_down" | "done"; login: string | null }>("github_login_poll", { deviceCode }),
  githubStatus: () => call<GithubUser | null>("github_status"),
  githubLogout: () => call<void>("github_logout"),
  githubListRepos: () => call<GithubRepo[]>("github_list_repos"),
  githubCreateRepo: (name: string, isPrivate: boolean) => call<GithubRepo>("github_create_repo", { name, private: isPrivate }),
  syncStatus: () => call<SyncInfo>("sync_status"),
  syncLink: (url: string) => call<SyncInfo>("sync_link", { url }),
  syncNow: () => call<SyncInfo>("sync_now"),
  syncResolve: (path: string, choice: "mine" | "theirs" | "both") => call<SyncInfo>("sync_resolve", { path, choice }),
  syncUnlink: () => call<SyncInfo>("sync_unlink"),
  onFsChange: (cb: (c: FsChange) => void): Promise<UnlistenFn> => listen<FsChange>("fs-change", (e) => cb(e.payload)),
};

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
