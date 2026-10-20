import { create } from "zustand";

/** Passwords of notes unlocked in this session. Memory only: never written to disk. */
interface LockState {
  passwords: Record<string, string>;
  remember: (path: string, password: string) => void;
  forget: (path: string) => void;
  remap: (map: (p: string) => string) => void;
}

export const useLocks = create<LockState>((set) => ({
  passwords: {},
  remember: (path, password) => set((s) => ({ passwords: { ...s.passwords, [path]: password } })),
  forget: (path) => set((s) => {
    const next = { ...s.passwords };
    delete next[path];
    return { passwords: next };
  }),
  remap: (map) => set((s) => ({ passwords: Object.fromEntries(Object.entries(s.passwords).map(([p, v]) => [map(p), v])) })),
}));
