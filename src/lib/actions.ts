import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { useSettings } from "@/stores/settings";
import { useBoard } from "@/stores/board";
import { removeWikiLinks } from "./markdownText";
import { basename, dirname, stripExt } from "./paths";
import { slugify } from "./slug";
import { ipc } from "./ipc";

export function resolveWikiTarget(target: string): string | null {
  return useWorkspace.getState().index.resolver.resolve(target);
}

/** Deletes a connection. Auto edges come from [[wiki links]], so the link text is removed from the source note. */
export function removeEdge(id: string, source: string, target: string): void {
  const board = useBoard.getState();
  if (!id.startsWith("auto:")) {
    board.removeConnection(id);
    return;
  }
  const ws = useWorkspace.getState();
  const note = ws.notes[source];
  if (note) ws.setContent(source, removeWikiLinks(note.content, (t) => ws.index.resolver.resolve(t) === target));
  board.setLabel(id, "");
}

/** Opens a wiki link; offers to create the note when it does not exist yet. */
export async function openWikiLink(target: string): Promise<void> {
  const ui = useUi.getState();
  const existing = resolveWikiTarget(target);
  if (existing) {
    ui.openNote(existing);
    return;
  }
  const clean = target.replace(/^\/+/, "").replace(/\.md$/i, "");
  const ok = await ui.confirm({
    title: "Note not found",
    message: `"${clean}" doesn't exist yet. Create it?`,
    confirmLabel: "Create note",
  });
  if (!ok) return;
  const dir = dirname(clean).split("/").map((s) => slugifyKeep(s)).filter(Boolean).join("/");
  const created = await useWorkspace.getState().createNote(dir, slugifyKeep(basename(clean)) || "untitled", `# ${basename(clean)}\n\n`);
  if (created) ui.openNote(created);
}

function slugifyKeep(s: string): string {
  // Keep the user's spelling for wiki targets; only strip characters invalid in file names.
  return s.replace(/[\\/:*?"<>|\0]/g, "").trim();
}

export async function newNote(dir = "", opts: { open?: boolean; name?: string; content?: string } = {}): Promise<string | null> {
  const ws = useWorkspace.getState();
  const name = opts.name ?? "Untitled";
  const path = await ws.createNote(dir, name, opts.content ?? "");
  if (path && opts.open !== false) useUi.getState().openNote(path);
  return path;
}

export async function newFolder(parent = ""): Promise<void> {
  const name = await useUi.getState().prompt({ title: "New folder", label: "Folder name", initial: "New folder", confirmLabel: "Create" });
  if (name) await useWorkspace.getState().createFolder(parent, name);
}

export async function renameEntry(path: string, isDir: boolean): Promise<string | null> {
  const current = isDir ? basename(path) : stripExt(basename(path));
  const name = await useUi.getState().prompt({ title: isDir ? "Rename folder" : "Rename note", label: "New name", initial: current, confirmLabel: "Rename" });
  if (!name || name === current) return null;
  return useWorkspace.getState().renameEntry(path, isDir ? name : name.replace(/\.md$/i, "") + ".md");
}

/** Renames a note from its card title: "Minha ideia" -> minha-ideia.md (and sets a matching H1 if empty). */
export async function renameNoteFromTitle(path: string, title: string): Promise<string | null> {
  const slug = slugify(title);
  const next = slug + ".md";
  if (next === basename(path)) return path;
  const ws = useWorkspace.getState();
  const dir = dirname(path);
  // Avoid collisions: add a numeric suffix until the target is free.
  let candidate = next;
  let n = 2;
  while (ws.notes[(dir ? dir + "/" : "") + candidate] && (dir ? dir + "/" : "") + candidate !== path) candidate = `${slug}-${n++}.md`;
  const result = await ws.renameEntry(path, candidate);
  if (result) {
    const note = useWorkspace.getState().notes[result];
    if (note && !/^#\s/m.test(note.content)) useWorkspace.getState().setContent(result, `# ${title.trim()}\n\n${note.content}`);
  }
  return result;
}

export async function deleteEntry(path: string, isDir: boolean): Promise<boolean> {
  const ui = useUi.getState();
  const label = isDir ? `the folder "${basename(path)}" and everything inside it` : `"${basename(path)}"`;
  const ok = await ui.confirm({
    title: isDir ? "Move folder to trash?" : "Move note to trash?",
    message: `${label} will be moved to the Trash. You can restore it from there.`,
    confirmLabel: "Move to trash",
    danger: true,
  });
  if (!ok) return false;
  return useWorkspace.getState().deleteEntry(path);
}

export async function revealInFolder(path: string): Promise<void> {
  try {
    await ipc.reveal(path);
  } catch (e) {
    useUi.getState().toast(e instanceof Error ? e.message : String(e), "error");
  }
}

export async function copyPath(path: string): Promise<void> {
  try {
    await ipc.copyPath(path);
    useUi.getState().toast("Path copied", "success");
  } catch (e) {
    useUi.getState().toast(e instanceof Error ? e.message : String(e), "error");
  }
}

export async function duplicateNote(path: string): Promise<string | null> {
  const ws = useWorkspace.getState();
  const n = ws.notes[path];
  if (!n) return null;
  return ws.createNote(dirname(path), stripExt(basename(path)) + " copy", n.content);
}

export async function newFrameTitle(): Promise<string | null> {
  return useUi.getState().prompt({ title: "New frame", label: "Frame title", initial: "IDEAS", confirmLabel: "Create" });
}

export function settingsSnapshot() {
  return useSettings.getState().settings;
}
