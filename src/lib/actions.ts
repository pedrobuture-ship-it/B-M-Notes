import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";
import { useSettings } from "@/stores/settings";
import { useBoard, MAIN_BOARD } from "@/stores/board";
import { tr } from "./i18n";
import { removeWikiLinks } from "./markdownText";
import { basename, dirname, stripExt } from "./paths";
import { slugify } from "./slug";
import { slugHeading } from "./headings";
import { ipc } from "./ipc";
import { decryptText, encryptText, isEncrypted } from "./crypto";
import { useLocks } from "@/stores/locks";
import { useSync } from "@/stores/sync";

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
export async function openWikiLink(target: string, heading?: string): Promise<void> {
  const ui = useUi.getState();
  const existing = resolveWikiTarget(target);
  if (existing) {
    ui.openNote(existing);
    if (heading) ui.setPendingHeading(slugHeading(heading));
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

export function isPinned(path: string): boolean {
  return useSettings.getState().settings.nav.pinned.includes(path);
}

export function togglePin(path: string): void {
  useSettings.getState().update((s) => ({
    ...s,
    nav: { pinned: s.nav.pinned.includes(path) ? s.nav.pinned.filter((p) => p !== path) : [path, ...s.nav.pinned] },
  }));
}

/** Saves a search under a name (asks for it) so it can be reopened from the sidebar and the palette. */
export async function saveSearch(query: string): Promise<void> {
  const q = query.trim();
  if (!q) return;
  const name = await useUi.getState().prompt({ title: "Save search", label: "Name", initial: q.slice(0, 40), confirmLabel: "Save" });
  if (!name) return;
  useSettings.getState().update((s) => ({ ...s, search: { saved: [...s.search.saved, { id: `s-${Date.now().toString(36)}`, name, query: q }].slice(-50) } }));
}

export function deleteSavedSearch(id: string): void {
  useSettings.getState().update((s) => ({ ...s, search: { saved: s.search.saved.filter((x) => x.id !== id) } }));
}

/** Encrypts a note with a password the user types twice. The file then holds only ciphertext. */
export async function lockNote(path: string, knownPassword?: string): Promise<boolean> {
  const ui = useUi.getState();
  const ws = useWorkspace.getState();
  const note = ws.notes[path];
  if (!note) return false;
  if (isEncrypted(note.content)) {
    ui.toast("This note is already encrypted.", "info");
    return false;
  }
  let password = knownPassword;
  if (!password) {
    password = (await ui.prompt({ title: "Encrypt note", label: "Password (there is no way to recover it)", confirmLabel: "Next", secret: true })) ?? undefined;
    if (!password) return false;
    const again = await ui.prompt({ title: "Encrypt note", label: "Type the password again", confirmLabel: "Encrypt", secret: true });
    if (again !== password) {
      if (again !== null) ui.toast("The passwords do not match.", "error");
      return false;
    }
  }
  try {
    ws.setContent(path, await encryptText(note.content, password));
    useLocks.getState().forget(path);
    await ws.saveNow(path);
    ui.toast("Note encrypted", "success");
    return true;
  } catch (e) {
    ui.toast(`Could not encrypt: ${e instanceof Error ? e.message : String(e)}`, "error");
    return false;
  }
}

/** Decrypts a note for editing and remembers the password (memory only) so it can be locked again with one click. */
export async function unlockNote(path: string, password: string): Promise<boolean> {
  const ws = useWorkspace.getState();
  const note = ws.notes[path];
  if (!note) return false;
  try {
    const plain = await decryptText(note.content, password);
    ws.setContent(path, plain);
    useLocks.getState().remember(path, password);
    await ws.saveNow(path);
    return true;
  } catch (e) {
    useUi.getState().toast(e instanceof Error ? e.message : String(e), "error");
    return false;
  }
}

/** Encrypts an unlocked note again with the password used to unlock it (asks if it was forgotten). */
export async function relockNote(path: string): Promise<boolean> {
  return lockNote(path, useLocks.getState().passwords[path]);
}

/** Keeps a note, folder or mural file out of the shared repository (or shares it again). */
export async function togglePrivate(path: string): Promise<void> {
  const sync = useSync.getState();
  if (sync.info?.private.includes(path)) await sync.unsetPrivate(path);
  else await sync.setPrivate([path]);
}

export function isPrivate(path: string): boolean {
  return useSync.getState().info?.private.includes(path) ?? false;
}

/** Extra murals other than the one on screen, so the card menu can offer "add / move to another mural". */
export function otherMurals(includeCurrent = false) {
  const { boards, activeId } = useBoard.getState();
  return boards.filter((b) => b.id !== MAIN_BOARD && (includeCurrent || b.id !== activeId));
}

/** Asks which extra mural to use (searchable, for long lists) and adds or moves `paths` there. */
export async function sendToMural(paths: string[], mode: "add" | "move", includeCurrent = false): Promise<void> {
  const murals = otherMurals(includeCurrent && mode === "add");
  const ui = useUi.getState();
  if (paths.length === 0 || murals.length === 0) return;
  const n = paths.length;
  const id = await ui.pick({
    title: mode === "move" ? (n > 1 ? tr("Move {n} notes to…", { n }) : tr("Move to mural…")) : (n > 1 ? tr("Add {n} notes to…", { n }) : tr("Add to mural…")),
    placeholder: "Search murals…",
    items: murals.map((b) => ({ value: b.id, label: b.name, hint: b.id === useBoard.getState().activeId ? tr("on screen") : undefined })),
  });
  const target = murals.find((b) => b.id === id);
  if (!target) return;
  const board = useBoard.getState();
  if (mode === "move") {
    const ok = await board.moveToBoard(target.id, paths);
    ui.toast(ok ? tr("Moved to {name}", { name: target.name }) : tr("Couldn't write that mural."), ok ? "success" : "error");
  } else {
    await board.addToBoard(target.id, paths);
    ui.toast(tr("Added to {name}", { name: target.name }), "success");
  }
}
