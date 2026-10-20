import type { BoardData, CardColor, CardLayout, Settings } from "@/types";
import { CARD_COLORS } from "@/types";

export const CARD_W = 280;
export const CARD_H = 200;

export function emptyBoard(): BoardData {
  return { version: 1, viewport: { x: 0, y: 0, zoom: 1 }, cards: {}, frames: [], connections: [], labels: {} };
}

export const DEFAULT_SETTINGS: Settings = {
  appearance: { theme: "dark", density: "cozy", fontSize: 15, language: "auto" },
  editor: { lineNumbers: false, wordWrap: true, fontSize: 15, autosaveDelay: 600 },
  files: { assetsFolder: "assets", ignoredFolders: [], dailyFolder: "daily", trashRetentionDays: 30 },
  board: { grid: true, snap: false, showConnections: true },
  sync: { auto: true },
  search: { saved: [] },
  nav: { pinned: [] },
  shortcuts: {},
  backup: { folder: "", auto: false, keep: 5 },
};

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const str = (v: unknown, d: string): string => (typeof v === "string" ? v : d);
const color = (v: unknown): CardColor => (CARD_COLORS.includes(v as CardColor) ? (v as CardColor) : "paper");
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** Lenient parser: drops anything malformed instead of failing the whole board. */
export function normalizeBoard(raw: unknown): BoardData {
  const r = obj(raw);
  const board = emptyBoard();
  const vp = obj(r.viewport);
  board.viewport = { x: num(vp.x, 0), y: num(vp.y, 0), zoom: Math.min(4, Math.max(0.05, num(vp.zoom, 1))) };
  for (const [path, v] of Object.entries(obj(r.cards))) {
    const c = obj(v);
    board.cards[path] = {
      x: num(c.x, 0),
      y: num(c.y, 0),
      w: Math.max(160, num(c.w, CARD_W)),
      h: Math.max(100, num(c.h, CARD_H)),
      color: color(c.color),
    };
  }
  if (Array.isArray(r.frames)) {
    for (const f of r.frames) {
      const o = obj(f);
      if (typeof o.id !== "string") continue;
      board.frames.push({
        id: o.id,
        title: str(o.title, "Frame"),
        color: color(o.color),
        x: num(o.x, 0),
        y: num(o.y, 0),
        w: Math.max(160, num(o.w, 480)),
        h: Math.max(120, num(o.h, 320)),
      });
    }
  }
  if (Array.isArray(r.connections)) {
    for (const c of r.connections) {
      const o = obj(c);
      if (typeof o.id === "string" && typeof o.source === "string" && typeof o.target === "string") {
        board.connections.push({ id: o.id, source: o.source, target: o.target });
      }
    }
  }
  for (const [k, v] of Object.entries(obj(r.labels))) if (typeof v === "string") board.labels[k] = v;
  return board;
}

export function normalizeSettings(raw: unknown): Settings {
  const r = obj(raw);
  const d = DEFAULT_SETTINGS;
  const a = obj(r.appearance), e = obj(r.editor), f = obj(r.files), b = obj(r.board);
  const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
  return {
    appearance: {
      theme: a.theme === "light" ? "light" : "dark",
      language: a.language === "en" || a.language === "pt-BR" ? a.language : "auto",
      density: a.density === "compact" ? "compact" : "cozy",
      fontSize: Math.min(22, Math.max(12, num(a.fontSize, d.appearance.fontSize))),
    },
    editor: {
      lineNumbers: bool(e.lineNumbers, d.editor.lineNumbers),
      wordWrap: bool(e.wordWrap, d.editor.wordWrap),
      fontSize: Math.min(26, Math.max(11, num(e.fontSize, d.editor.fontSize))),
      autosaveDelay: Math.min(5000, Math.max(200, num(e.autosaveDelay, d.editor.autosaveDelay))),
    },
    files: {
      assetsFolder: safeFolder(str(f.assetsFolder, d.files.assetsFolder), d.files.assetsFolder),
      trashRetentionDays: Math.min(3650, Math.max(0, Math.round(num(f.trashRetentionDays, d.files.trashRetentionDays)))),
      ignoredFolders: Array.isArray(f.ignoredFolders) ? f.ignoredFolders.filter((x): x is string => typeof x === "string") : [],
      dailyFolder: safeFolder(str(f.dailyFolder, d.files.dailyFolder), d.files.dailyFolder),
    },
    board: {
      grid: bool(b.grid, d.board.grid),
      snap: bool(b.snap, d.board.snap),
      showConnections: bool(b.showConnections, d.board.showConnections),
    },
    sync: { auto: bool(obj(r.sync).auto, d.sync.auto) },
    search: {
      saved: (Array.isArray(obj(r.search).saved) ? (obj(r.search).saved as unknown[]) : [])
        .map((x) => obj(x))
        .filter((x) => typeof x.id === "string" && typeof x.name === "string" && typeof x.query === "string")
        .map((x) => ({ id: x.id as string, name: (x.name as string).slice(0, 60), query: (x.query as string).slice(0, 300) }))
        .slice(0, 50),
    },
    nav: { pinned: (Array.isArray(obj(r.nav).pinned) ? (obj(r.nav).pinned as unknown[]) : []).filter((x): x is string => typeof x === "string").slice(0, 100) },
    shortcuts: Object.fromEntries(Object.entries(obj(r.shortcuts)).filter(([k, v]) => typeof v === "string" && k.length < 40 && (v as string).length < 40)) as Record<string, string>,
    backup: {
      folder: str(obj(r.backup).folder, d.backup.folder).slice(0, 500),
      auto: bool(obj(r.backup).auto, d.backup.auto),
      keep: Math.min(100, Math.max(1, Math.round(num(obj(r.backup).keep, d.backup.keep)))),
    },
  };
}

function safeFolder(v: string, fallback: string): string {
  const t = v.trim().replace(/^\/+|\/+$/g, "");
  if (!t || t.split("/").some((s) => s === ".." || s === ".")) return fallback;
  return t;
}

/** Deterministic spiral-free grid placement for cards that have no saved position. */
export function autoLayout(paths: string[], existing: Record<string, CardLayout>): Record<string, CardLayout> {
  const missing = paths.filter((p) => !existing[p]).sort((a, b) => a.localeCompare(b));
  if (missing.length === 0) return existing;
  const out = { ...existing };
  const used = Object.values(existing);
  const startY = used.length ? Math.max(...used.map((c) => c.y + c.h)) + 80 : 0;
  const cols = Math.max(1, Math.ceil(Math.sqrt(missing.length * 1.4)));
  missing.forEach((p, i) => {
    out[p] = {
      x: (i % cols) * (CARD_W + 56),
      y: startY + Math.floor(i / cols) * (CARD_H + 56),
      w: CARD_W,
      h: CARD_H,
      color: "paper",
    };
  });
  return out;
}

/** Stable pseudo-random value in [-1, 1] from a string (for card tilt). */
export function hashUnit(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2000) / 1000 - 1;
}
