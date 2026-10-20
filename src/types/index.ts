export interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

export interface NoteFile {
  path: string;
  content: string;
  mtime: number;
}

export interface WorkspaceInfo {
  root: string;
  name: string;
}

export type CardColor = "paper" | "yellow" | "green" | "blue" | "pink" | "purple" | "dark";
export const CARD_COLORS: CardColor[] = ["paper", "yellow", "green", "blue", "pink", "purple", "dark"];

export interface CardLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  color: CardColor;
}

export interface FrameLayout {
  id: string;
  title: string;
  color: CardColor;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ManualConnection {
  id: string;
  source: string;
  target: string;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface BoardData {
  version: 1;
  viewport: Viewport;
  cards: Record<string, CardLayout>;
  frames: FrameLayout[];
  connections: ManualConnection[];
  /** Labels for edges, keyed by edge id (auto edges use `auto:<src>-><tgt>`). */
  labels: Record<string, string>;
}

export interface Settings {
  appearance: { theme: "dark" | "light"; density: "cozy" | "compact"; fontSize: number };
  editor: { lineNumbers: boolean; wordWrap: boolean; fontSize: number; autosaveDelay: number };
  files: { assetsFolder: string; ignoredFolders: string[]; dailyFolder: string };
  board: { grid: boolean; snap: boolean; showConnections: boolean };
}

export type SaveStatus = "idle" | "saving" | "saved" | "error";
