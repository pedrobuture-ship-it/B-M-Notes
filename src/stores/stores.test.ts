import { beforeEach, describe, expect, it, vi } from "vitest";

const files = new Map<string, string>();
const meta = new Map<string, string>();
let backup: string | null = null;
const writes: { path: string; content: string }[] = [];

vi.mock("@/lib/ipc", () => ({
  ipc: {
    openWorkspace: async () => ({ root: "/w", name: "w" }),
    closeWorkspace: async () => {},
    scan: async () => [...files.keys()].map((p) => ({ name: p, path: p, isDir: false, children: [] })),
    readAll: async () => [...files].map(([path, content]) => ({ path, content, mtime: 1 })),
    readNote: async (path: string) => ({ path, content: files.get(path) ?? "", mtime: 2 }),
    writeNote: async (path: string, content: string) => {
      writes.push({ path, content });
      files.set(path, content);
      return 3;
    },
    readMeta: async (file: string) => ({ content: meta.get(file) ?? null, backup: file === "board.json" ? backup : null }),
    writeMeta: async (file: string, content: string) => void meta.set(file, content),
    onFsChange: async () => () => {},
    deleteMeta: async (file: string) => void meta.delete(file),
    rename: async (path: string, newName: string) => {
      const next = newName;
      files.set(next, files.get(path) ?? "");
      files.delete(path);
      return next;
    },
  },
}));

import { useWorkspace } from "./workspace";
import { useBoard } from "./board";
import { useUi } from "./ui";

beforeEach(async () => {
  vi.useRealTimers();
  files.clear();
  meta.clear();
  backup = null;
  writes.length = 0;
  files.set("a.md", "# A\n[[b]]");
  files.set("b.md", "# B");
  await useWorkspace.getState().closeWorkspace();
});

describe("workspace store", () => {
  it("loads notes, builds the index and lays out the board", async () => {
    expect(await useWorkspace.getState().openWorkspace("/w")).toBe(true);
    const s = useWorkspace.getState();
    expect(Object.keys(s.notes).sort()).toEqual(["a.md", "b.md"]);
    expect(s.index.backlinks.get("b.md")).toEqual(["a.md"]);
    expect(Object.keys(useBoard.getState().board.cards).sort()).toEqual(["a.md", "b.md"]);
    // Opening must not create .mural metadata by itself.
    expect(meta.size).toBe(0);
  });

  it("debounces autosave and writes only the latest content", async () => {
    await useWorkspace.getState().openWorkspace("/w");
    vi.useFakeTimers();
    const { setContent } = useWorkspace.getState();
    setContent("b.md", "# B1");
    setContent("b.md", "# B2");
    expect(writes).toHaveLength(0);
    expect(useWorkspace.getState().saveStatus).toBe("saving");
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toEqual([{ path: "b.md", content: "# B2" }]);
    expect(useWorkspace.getState().saveStatus).toBe("saved");
  });

  it("reloads a clean note changed on disk and flags a conflict on a dirty one", async () => {
    await useWorkspace.getState().openWorkspace("/w");
    files.set("b.md", "# B from disk");
    await useWorkspace.getState().handleFsChange({ changed: ["b.md"], removed: [], structure: false });
    let b = useWorkspace.getState().notes["b.md"]!;
    expect(b.content).toBe("# B from disk");
    expect(b.revision).toBe(1);

    useWorkspace.getState().setContent("b.md", "# B local");
    files.set("b.md", "# B external again");
    await useWorkspace.getState().handleFsChange({ changed: ["b.md"], removed: [], structure: false });
    b = useWorkspace.getState().notes["b.md"]!;
    expect(b.content).toBe("# B local");
    expect(b.conflict).toBe("# B external again");

    useWorkspace.getState().resolveConflict("b.md", false);
    b = useWorkspace.getState().notes["b.md"]!;
    expect(b.content).toBe("# B external again");
    expect(b.conflict).toBeNull();
  });
});

describe("board recovery", () => {
  it("restores the latest backup when board.json is corrupt, keeping the broken file aside", async () => {
    meta.set("board.json", "{not json");
    backup = JSON.stringify({ version: 1, cards: { "a.md": { x: 5, y: 6, w: 300, h: 200, color: "blue" } } });
    await useWorkspace.getState().openWorkspace("/w");
    const st = useBoard.getState();
    expect(st.recovered).toBe("backup");
    expect(st.board.cards["a.md"]).toMatchObject({ x: 5, y: 6, color: "blue" });
    expect(meta.get("board.corrupt.json")).toBe("{not json");
    expect(files.get("a.md")).toBe("# A\n[[b]]"); // markdown untouched
  });

  it("starts a fresh layout when there is no usable backup", async () => {
    meta.set("board.json", "💥");
    await useWorkspace.getState().openWorkspace("/w");
    expect(useBoard.getState().recovered).toBe("fresh");
    expect(Object.keys(useBoard.getState().board.cards)).toHaveLength(2);
  });

  it("drops cards for notes that no longer exist", async () => {
    meta.set("board.json", JSON.stringify({ version: 1, cards: { "gone.md": { x: 1, y: 1, w: 200, h: 120, color: "paper" } } }));
    await useWorkspace.getState().openWorkspace("/w");
    expect(useBoard.getState().board.cards["gone.md"]).toBeUndefined();
  });
});

describe("smart rename", () => {
  it("rewrites [[links]] in other notes when the user accepts", async () => {
    await useWorkspace.getState().openWorkspace("/w");
    const choose = vi.spyOn(useUi.getState(), "choose").mockResolvedValue("update");
    expect(await useWorkspace.getState().renameEntry("b.md", "system-design.md")).toBe("system-design.md");
    expect(choose).toHaveBeenCalledOnce();
    expect(useWorkspace.getState().notes["a.md"]?.content).toBe("# A\n[[system-design]]");
    await useWorkspace.getState().flushAll();
    expect(files.get("a.md")).toBe("# A\n[[system-design]]");
    choose.mockRestore();
  });

  it("leaves links alone on 'rename only' and does nothing on cancel", async () => {
    await useWorkspace.getState().openWorkspace("/w");
    const choose = vi.spyOn(useUi.getState(), "choose").mockResolvedValueOnce("skip").mockResolvedValueOnce(null);
    expect(await useWorkspace.getState().renameEntry("b.md", "c.md")).toBe("c.md");
    expect(useWorkspace.getState().notes["a.md"]?.content).toBe("# A\n[[b]]");
    files.set("a.md", "# A\n[[c]]");
    await useWorkspace.getState().handleFsChange({ changed: ["a.md"], removed: [], structure: false });
    expect(await useWorkspace.getState().renameEntry("c.md", "d.md")).toBeNull();
    expect(files.has("c.md")).toBe(true);
    choose.mockRestore();
  });
});

describe("multiple murals", () => {
  it("keeps extra murals curated and drops notes from all of them on delete", async () => {
    const { useBoard: B } = await import("./board");
    await useWorkspace.getState().openWorkspace("/w");
    expect(B.getState().boards.map((b) => b.id)).toEqual(["main"]);
    const paths = () => Object.keys(useWorkspace.getState().notes);
    const id = await B.getState().createBoard("Study Plan", false, paths());
    expect(id).toBe("study-plan");
    expect(B.getState().activeId).toBe("study-plan");
    expect(Object.keys(B.getState().board.cards)).toEqual([]);
    // Notes are not added automatically to an extra mural.
    B.getState().syncPaths(paths());
    expect(Object.keys(B.getState().board.cards)).toEqual([]);
    await B.getState().addToBoard("study-plan", "a.md");
    expect(Object.keys(B.getState().board.cards)).toEqual(["a.md"]);
    // Removing from this mural leaves the other one alone.
    B.getState().removePaths("a.md", false);
    expect(Object.keys(B.getState().board.cards)).toEqual([]);
    await B.getState().switchBoard("main", paths());
    expect(Object.keys(B.getState().board.cards).sort()).toEqual(["a.md", "b.md"]);
    expect(JSON.parse(meta.get("boards.json") ?? "{}").boards).toEqual([{ id: "study-plan", name: "Study Plan" }]);
    await B.getState().deleteBoard("study-plan", paths());
    expect(B.getState().boards.map((b) => b.id)).toEqual(["main"]);
  });
});
