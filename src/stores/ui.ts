import { create } from "zustand";

export type SidebarTab = "notes" | "tags" | "files" | "explore";
export type MainView = "board" | "graph" | "note";
export type NoteMode = "edit" | "preview" | "split";
export type DialogName = "palette" | "search" | "shortcuts" | "settings" | "about" | null;

export interface Toast {
  id: number;
  kind: "info" | "error" | "success";
  message: string;
}

interface ConfirmReq {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

interface PromptReq {
  title: string;
  label?: string;
  initial?: string;
  confirmLabel?: string;
  resolve: (value: string | null) => void;
}

interface UiState {
  sidebarOpen: boolean;
  sidebarTab: SidebarTab;
  view: MainView;
  activeNote: string | null;
  noteMode: NoteMode;
  dialog: DialogName;
  settingsSection: string;
  tagFilter: string | null;
  editingCard: string | null;
  renamingCard: string | null;
  toasts: Toast[];
  confirmReq: ConfirmReq | null;
  promptReq: PromptReq | null;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
  setSidebarTab: (t: SidebarTab) => void;
  setView: (v: MainView) => void;
  openNote: (path: string) => void;
  closeNote: () => void;
  setNoteMode: (m: NoteMode) => void;
  setDialog: (d: DialogName) => void;
  openSettings: (section: string) => void;
  setTagFilter: (t: string | null) => void;
  setEditingCard: (p: string | null) => void;
  setRenamingCard: (p: string | null) => void;
  toast: (message: string, kind?: Toast["kind"]) => void;
  dismissToast: (id: number) => void;
  confirm: (req: Omit<ConfirmReq, "resolve">) => Promise<boolean>;
  prompt: (req: Omit<PromptReq, "resolve">) => Promise<string | null>;
  resolveConfirm: (ok: boolean) => void;
  resolvePrompt: (v: string | null) => void;
}

let toastId = 1;

export const useUi = create<UiState>((set, get) => ({
  sidebarOpen: true,
  sidebarTab: "files",
  view: "board",
  activeNote: null,
  noteMode: "split",
  dialog: null,
  settingsSection: "Appearance",
  tagFilter: null,
  editingCard: null,
  renamingCard: null,
  toasts: [],
  confirmReq: null,
  promptReq: null,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarTab: (sidebarTab) => set({ sidebarTab, sidebarOpen: true, ...(sidebarTab === "explore" ? { view: "graph" as const } : {}) }),
  setView: (view) => set({ view, editingCard: null }),
  openNote: (path) => set({ activeNote: path, view: "note", editingCard: null, dialog: null }),
  closeNote: () => set({ activeNote: null, view: "board" }),
  setNoteMode: (noteMode) => set({ noteMode }),
  setDialog: (dialog) => set({ dialog }),
  openSettings: (settingsSection) => set({ settingsSection, dialog: "settings" }),
  setTagFilter: (tagFilter) => set({ tagFilter }),
  setEditingCard: (editingCard) => set({ editingCard }),
  setRenamingCard: (renamingCard) => set({ renamingCard }),
  toast: (message, kind = "info") => {
    const id = toastId++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }));
    setTimeout(() => get().dismissToast(id), kind === "error" ? 6000 : 3000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  confirm: (req) => new Promise((resolve) => set({ confirmReq: { ...req, resolve } })),
  prompt: (req) => new Promise((resolve) => set({ promptReq: { ...req, resolve } })),
  resolveConfirm: (ok) => {
    get().confirmReq?.resolve(ok);
    set({ confirmReq: null });
  },
  resolvePrompt: (v) => {
    get().promptReq?.resolve(v);
    set({ promptReq: null });
  },
}));
