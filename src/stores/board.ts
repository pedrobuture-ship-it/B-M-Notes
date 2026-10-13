import { create } from "zustand";
import { autoLayout, emptyBoard, normalizeBoard } from "@/lib/board";
import { ipc } from "@/lib/ipc";
import { timeStamp } from "@/lib/daily";
import type { BoardData, CardLayout, FrameLayout, Viewport } from "@/types";

interface BoardState {
  board: BoardData;
  ready: boolean;
  /** True when .mural/board.json exists (or has been written) for this workspace. */
  hasFile: boolean;
  recovered: "none" | "backup" | "fresh";
  load: (notePaths: string[]) => Promise<void>;
  reset: () => void;
  syncPaths: (notePaths: string[]) => void;
  patchCards: (patch: Record<string, Partial<CardLayout>>) => void;
  ensureCard: (path: string, at: { x: number; y: number }) => void;
  addFrame: (frame: FrameLayout) => void;
  patchFrame: (id: string, patch: Partial<FrameLayout>) => void;
  patchFrames: (patch: Record<string, Partial<FrameLayout>>) => void;
  removeFrame: (id: string) => void;
  addConnection: (source: string, target: string) => string;
  removeConnection: (id: string) => void;
  setLabel: (edgeId: string, label: string) => void;
  setViewport: (vp: Viewport) => void;
  remapPaths: (from: string, to: string) => void;
  removePaths: (prefix: string) => void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let loadToken = 0;

function schedulePersist(get: () => BoardState, set: (p: Partial<BoardState>) => void) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      await ipc.writeMeta("board.json", JSON.stringify(get().board, null, 2));
      set({ hasFile: true });
    } catch {
      // Metadata failures never touch Markdown; the next change retries.
    }
  }, 600);
}

export const useBoard = create<BoardState>((set, get) => {
  const mutate = (fn: (b: BoardData) => BoardData) => {
    set({ board: fn(get().board) });
    schedulePersist(get, set);
  };
  return {
    board: emptyBoard(),
    ready: false,
    hasFile: false,
    recovered: "none",
    reset: () => {
      clearTimeout(timer);
      loadToken++;
      set({ board: emptyBoard(), ready: false, hasFile: false, recovered: "none" });
    },
    load: async (notePaths) => {
      const token = ++loadToken;
      let board = emptyBoard();
      let hasFile = false;
      let recovered: BoardState["recovered"] = "none";
      try {
        const { content, backup } = await ipc.readMeta("board.json");
        if (content !== null) {
          hasFile = true;
          try {
            board = normalizeBoard(JSON.parse(content));
          } catch {
            // Corrupt board.json: keep the broken file aside, restore the newest valid snapshot.
            await ipc.writeMeta("board.corrupt.json", content).catch(() => {});
            if (backup) {
              board = normalizeBoard(JSON.parse(backup));
              recovered = "backup";
            } else recovered = "fresh";
            await ipc.writeMeta("board.json", JSON.stringify(board, null, 2)).catch(() => {});
          }
        }
      } catch {
        recovered = "none";
      }
      if (token !== loadToken) return;
      const present = new Set(notePaths);
      for (const p of Object.keys(board.cards)) if (!present.has(p)) delete board.cards[p];
      board.connections = board.connections.filter((c) => present.has(c.source) && present.has(c.target));
      board.cards = autoLayout(notePaths, board.cards);
      set({ board, ready: true, hasFile, recovered });
    },
    syncPaths: (notePaths) => {
      const { board, ready } = get();
      if (!ready) return;
      const present = new Set(notePaths);
      let changed = false;
      const cards = { ...board.cards };
      for (const p of Object.keys(cards)) {
        if (!present.has(p)) {
          delete cards[p];
          changed = true;
        }
      }
      const laidOut = autoLayout(notePaths, cards);
      const connections = board.connections.filter((c) => present.has(c.source) && present.has(c.target));
      if (connections.length !== board.connections.length) changed = true;
      set({ board: { ...board, cards: laidOut, connections } });
      if (changed && get().hasFile) schedulePersist(get, set);
    },
    patchCards: (patch) =>
      mutate((b) => {
        const cards = { ...b.cards };
        for (const [p, v] of Object.entries(patch)) {
          const cur = cards[p];
          if (cur) cards[p] = { ...cur, ...v };
        }
        return { ...b, cards };
      }),
    ensureCard: (path, at) =>
      mutate((b) => ({ ...b, cards: { ...b.cards, [path]: b.cards[path] ?? { x: at.x, y: at.y, w: 280, h: 200, color: "paper" } } })),
    addFrame: (frame) => mutate((b) => ({ ...b, frames: [...b.frames, frame] })),
    patchFrame: (id, patch) => mutate((b) => ({ ...b, frames: b.frames.map((f) => (f.id === id ? { ...f, ...patch } : f)) })),
    patchFrames: (patch) => mutate((b) => ({ ...b, frames: b.frames.map((f) => (patch[f.id] ? { ...f, ...patch[f.id] } : f)) })),
    removeFrame: (id) => mutate((b) => ({ ...b, frames: b.frames.filter((f) => f.id !== id) })),
    addConnection: (source, target) => {
      const id = `c-${timeStamp()}-${Math.random().toString(36).slice(2, 6)}`;
      mutate((b) => ({ ...b, connections: [...b.connections, { id, source, target }] }));
      return id;
    },
    removeConnection: (id) =>
      mutate((b) => {
        const labels = { ...b.labels };
        delete labels[id];
        return { ...b, connections: b.connections.filter((c) => c.id !== id), labels };
      }),
    setLabel: (edgeId, label) =>
      mutate((b) => {
        const labels = { ...b.labels };
        if (label.trim()) labels[edgeId] = label.trim();
        else delete labels[edgeId];
        return { ...b, labels };
      }),
    setViewport: (viewport) => {
      set({ board: { ...get().board, viewport } });
      if (get().hasFile) schedulePersist(get, set);
    },
    remapPaths: (from, to) => {
      const map = (p: string) => (p === from ? to : p.startsWith(from + "/") ? to + p.slice(from.length) : p);
      mutate((b) => {
        const cards: Record<string, CardLayout> = {};
        for (const [p, v] of Object.entries(b.cards)) cards[map(p)] = v;
        const labels: Record<string, string> = {};
        for (const [k, v] of Object.entries(b.labels)) {
          const m = /^auto:(.*)->(.*)$/.exec(k);
          labels[m ? `auto:${map(m[1] ?? "")}->${map(m[2] ?? "")}` : k] = v;
        }
        return {
          ...b,
          cards,
          labels,
          connections: b.connections.map((c) => ({ ...c, source: map(c.source), target: map(c.target) })),
        };
      });
    },
    removePaths: (prefix) => {
      const hit = (p: string) => p === prefix || p.startsWith(prefix + "/");
      mutate((b) => {
        const cards: Record<string, CardLayout> = {};
        for (const [p, v] of Object.entries(b.cards)) if (!hit(p)) cards[p] = v;
        return { ...b, cards, connections: b.connections.filter((c) => !hit(c.source) && !hit(c.target)) };
      });
    },
  };
});
