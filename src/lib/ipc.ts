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
  saveAsset: (assetsDir: string, fileName: string, dataBase64: string) =>
    call<string>("save_asset", { assetsDir, fileName, dataBase64 }),
  absolutePath: (path: string) => call<string>("absolute_path", { path }),
  readMeta: (file: string) => call<MetaRead>("read_meta", { file }),
  launchPath: () => call<string | null>("launch_path"),
  writeMeta: (file: string, content: string) => call<void>("write_meta", { file, content }),
  reveal: async (path: string) => revealItemInDir(await call<string>("absolute_path", { path })),
  copyPath: async (path: string) => {
    await navigator.clipboard.writeText(await call<string>("absolute_path", { path }));
  },
  openExternal: (url: string) => openUrl(url),
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
