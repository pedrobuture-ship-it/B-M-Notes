import { create } from "zustand";
import { ipc } from "@/lib/ipc";
import { PluginHost, sha256Hex, type HostApi } from "@/lib/plugins/host";
import { useSettings } from "./settings";
import { useUi } from "./ui";
import { useWorkspace } from "./workspace";

export type PluginStatus = "running" | "pending" | "changed" | "error";

export interface PluginEntry {
  name: string;
  code: string;
  hash: string;
  status: PluginStatus;
}

export interface PluginCommandEntry {
  /** `plugin-file:command-id`, unique across plugins. */
  key: string;
  plugin: string;
  label: string;
}

interface PluginsState {
  plugins: PluginEntry[];
  commands: PluginCommandEntry[];
  load: () => Promise<void>;
  approve: (name: string) => void;
  revoke: (name: string) => void;
  run: (key: string) => Promise<void>;
  stopAll: () => void;
}

const hosts = new Map<string, PluginHost>();

const api: HostApi = {
  listNotes: () => {
    const { notes, index } = useWorkspace.getState();
    return Object.keys(notes).map((path) => ({ path, title: index.meta.get(path)?.title ?? path }));
  },
  readNote: (path) => useWorkspace.getState().notes[path]?.content ?? null,
  writeNote: (path, content) => {
    const ws = useWorkspace.getState();
    if (!ws.notes[path]) throw new Error("No such note");
    ws.setContent(path, content);
  },
  createNote: async (name, content) => {
    const clean = name.replace(/[\\/:*?"<>|\0]/g, "").trim().slice(0, 120);
    if (!clean) throw new Error("Invalid name");
    return useWorkspace.getState().createNote("", clean, content);
  },
  openNote: (path) => {
    if (useWorkspace.getState().notes[path]) useUi.getState().openNote(path);
  },
  prompt: (title) => useUi.getState().prompt({ title: title.slice(0, 80), confirmLabel: "OK" }),
  toast: (message) => useUi.getState().toast(message, "info"),
};

function spawn(name: string, code: string, set: (fn: (s: PluginsState) => Partial<PluginsState>) => void): PluginHost {
  const host = new PluginHost(
    name,
    code,
    api,
    (source) => new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })), { name }) as never,
    (c) => set((s) => ({ commands: [...s.commands, { key: `${name}:${c.id}`, plugin: name.replace(/\.js$/, ""), label: c.label }] })),
    (message) => {
      useUi.getState().toast(message, "error");
      set((s) => ({ plugins: s.plugins.map((p) => (p.name === name ? { ...p, status: "error" as const } : p)) }));
    },
  );
  host.start();
  return host;
}

export const usePlugins = create<PluginsState>((set, get) => ({
  plugins: [],
  commands: [],
  load: async () => {
    get().stopAll();
    try {
      const files = await ipc.listPlugins();
      const approved = useSettings.getState().settings.plugins.approved;
      const plugins: PluginEntry[] = [];
      for (const f of files) {
        const hash = await sha256Hex(f.code);
        const status: PluginStatus = approved[f.name] === hash ? "running" : approved[f.name] ? "changed" : "pending";
        plugins.push({ name: f.name, code: f.code, hash, status });
      }
      set({ plugins, commands: [] });
      for (const p of plugins) if (p.status === "running") hosts.set(p.name, spawn(p.name, p.code, set));
    } catch {
      set({ plugins: [], commands: [] });
    }
  },
  approve: (name) => {
    const p = get().plugins.find((x) => x.name === name);
    if (!p) return;
    useSettings.getState().update((s) => ({ ...s, plugins: { approved: { ...s.plugins.approved, [name]: p.hash } } }));
    hosts.get(name)?.stop();
    set((s) => ({ plugins: s.plugins.map((x) => (x.name === name ? { ...x, status: "running" as const } : x)), commands: s.commands.filter((c) => !c.key.startsWith(`${name}:`)) }));
    hosts.set(name, spawn(name, p.code, set));
  },
  revoke: (name) => {
    useSettings.getState().update((s) => {
      const next = { ...s.plugins.approved };
      delete next[name];
      return { ...s, plugins: { approved: next } };
    });
    hosts.get(name)?.stop();
    hosts.delete(name);
    set((s) => ({ plugins: s.plugins.map((x) => (x.name === name ? { ...x, status: "pending" as const } : x)), commands: s.commands.filter((c) => !c.key.startsWith(`${name}:`)) }));
  },
  run: async (key) => {
    const [name, ...rest] = key.split(":");
    const host = name ? hosts.get(name) : undefined;
    if (!host) return;
    try {
      await host.run(rest.join(":"));
    } catch {
      /* the host already reported the failure */
    }
  },
  stopAll: () => {
    for (const h of hosts.values()) h.stop();
    hosts.clear();
    set({ commands: [] });
  },
}));
