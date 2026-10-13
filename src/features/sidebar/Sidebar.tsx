import { useMemo, useState } from "react";
import { ChevronRight, FileText, FilePlus, Folder, FolderOpen, FolderPlus, Hash, Network, StickyNote, X } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { useUi, type SidebarTab } from "@/stores/ui";
import { Menu, useContextMenu, type MenuEntry } from "@/components/Menu";
import { EmptyFiles, EmptyTags } from "@/components/doodles";
import { VirtualList } from "@/components/VirtualList";
import { basename, dirname, stripExt } from "@/lib/paths";
import { copyPath, deleteEntry, newFolder, newNote, renameEntry, revealInFolder } from "@/lib/actions";
import { ipc } from "@/lib/ipc";
import type { TreeNode } from "@/types";

const TABS: { id: SidebarTab; label: string; icon: typeof FileText }[] = [
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "tags", label: "Tags", icon: Hash },
  { id: "files", label: "Files", icon: Folder },
  { id: "explore", label: "Explore", icon: Network },
];

export function Sidebar() {
  const tab = useUi((s) => s.sidebarTab);
  const setTab = useUi((s) => s.setSidebarTab);
  const name = useWorkspace((s) => s.info?.name);
  const count = useWorkspace((s) => s.index.meta.size);
  const root = useWorkspace((s) => s.info?.root);
  return (
    <aside className="sidebar" aria-label="Sidebar">
      <div className="ws-name" title={root}>{name}</div>
      <div className="sidebar-tabs" role="tablist" aria-label="Sidebar sections">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} className="tab" onClick={() => setTab(id)}>
            <Icon size={17} />
            {label}
          </button>
        ))}
      </div>
      <div className="sidebar-scroll" role="tabpanel" data-virtual={tab === "notes" || tab === "files"}>
        {tab === "notes" && <NotesPanel />}
        {tab === "tags" && <TagsPanel />}
        {tab === "files" && <FilesPanel />}
        {tab === "explore" && <ExplorePanel />}
      </div>
      <div className="sidebar-foot">
        <span>{count} {count === 1 ? "note" : "notes"}</span>
        <span className="flex-1" />
        <button className="btn btn-ghost btn-icon" onClick={() => void ipc.reveal("").catch(() => {})} data-tip="Reveal workspace in filesystem" aria-label="Reveal workspace in filesystem"><FolderOpen size={15} /></button>
      </div>
    </aside>
  );
}

// ---------- Notes ----------

const ROW_H = 28;

function NotesPanel() {
  const meta = useWorkspace((s) => s.index.meta);
  const tags = useWorkspace((s) => s.index.tags);
  const filter = useUi((s) => s.tagFilter);
  const setFilter = useUi((s) => s.setTagFilter);
  const active = useUi((s) => s.activeNote);
  const openNote = useUi((s) => s.openNote);
  const items = useMemo(() => {
    const paths = filter ? new Set(tags.get(filter) ?? []) : null;
    return [...meta.values()].filter((m) => !paths || paths.has(m.path)).sort((a, b) => a.title.localeCompare(b.title));
  }, [meta, tags, filter]);
  return (
    <div className="flex flex-col min-h-0 h-full">
      {filter && (
        <div className="px-2 pb-2 flex items-center gap-2">
          <span className="chip" data-active="true">#{filter}</span>
          <button className="btn btn-ghost btn-icon" onClick={() => setFilter(null)} aria-label="Clear tag filter"><X size={14} /></button>
        </div>
      )}
      {items.length === 0 ? (
        <div className="empty">
          <EmptyFiles />
          <p className="hand">{filter ? "No notes with this tag." : "No Markdown files yet."}</p>
          {!filter && <button className="btn" onClick={() => void newNote("")}><FilePlus size={15} /> New note</button>}
        </div>
      ) : (
        <VirtualList
          items={items}
          rowHeight={ROW_H}
          render={(m) => (
            <button key={m.path} className="tree-row" data-active={active === m.path} onClick={() => openNote(m.path)}>
              <FileText size={15} />
              <span className="label">{m.title}</span>
            </button>
          )}
        />
      )}
    </div>
  );
}

// ---------- Tags ----------

function TagsPanel() {
  const tags = useWorkspace((s) => s.index.tags);
  const filter = useUi((s) => s.tagFilter);
  const setFilter = useUi((s) => s.setTagFilter);
  const setTab = useUi((s) => s.setSidebarTab);
  const list = useMemo(() => [...tags.entries()].map(([t, p]) => ({ tag: t, count: p.length })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)), [tags]);
  if (list.length === 0) {
    return (
      <div className="empty">
        <EmptyTags />
        <p className="hand">No tags yet.</p>
        <p>Write <span className="kbd">#idea</span> in any note.</p>
      </div>
    );
  }
  return (
    <div>
      {list.map(({ tag, count }) => (
        <button
          key={tag}
          className="tree-row"
          data-active={filter === tag}
          onClick={() => {
            setFilter(filter === tag ? null : tag);
            if (filter !== tag) setTab("notes");
          }}
        >
          <Hash size={14} />
          <span className="label">{tag}</span>
          <span className="count">{count}</span>
        </button>
      ))}
    </div>
  );
}

// ---------- Explore ----------

function ExplorePanel() {
  const meta = useWorkspace((s) => s.index.meta);
  const backlinks = useWorkspace((s) => s.index.backlinks);
  const openNote = useUi((s) => s.openNote);
  const top = useMemo(
    () => [...meta.values()].map((m) => ({ m, degree: m.links.length + (backlinks.get(m.path)?.length ?? 0) })).filter((x) => x.degree > 0).sort((a, b) => b.degree - a.degree).slice(0, 12),
    [meta, backlinks],
  );
  return (
    <div>
      <p className="px-3 mt-0" style={{ color: "var(--ink-dim)" }}>The graph shows every note and the [[wiki links]] between them.</p>
      <div className="handwritten-label px-3 pt-2" style={{ fontSize: "1.3rem" }}>Most connected</div>
      {top.length === 0 ? (
        <p className="px-3" style={{ color: "var(--ink-faint)" }}>Link notes with [[double brackets]] to see them here.</p>
      ) : (
        top.map(({ m, degree }) => (
          <button key={m.path} className="tree-row" onClick={() => openNote(m.path)}>
            <FileText size={15} />
            <span className="label">{m.title}</span>
            <span className="count">{degree}</span>
          </button>
        ))
      )}
    </div>
  );
}

// ---------- Files ----------

interface Row {
  node: TreeNode;
  depth: number;
}

function flatten(nodes: TreeNode[], expanded: Set<string>, depth = 0, out: Row[] = []): Row[] {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.isDir && expanded.has(node.path)) flatten(node.children, expanded, depth + 1, out);
  }
  return out;
}

function FilesPanel() {
  const tree = useWorkspace((s) => s.tree);
  const move = useWorkspace((s) => s.moveEntry);
  const { menu, open, close } = useContextMenu();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [dropRoot, setDropRoot] = useState(false);
  const rows = useMemo(() => flatten(tree, expanded), [tree, expanded]);

  const toggle = (p: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  const expand = (p: string) => setExpanded((s) => (s.has(p) ? s : new Set(s).add(p)));

  const rootEntries: MenuEntry[] = [
    { label: "New note", icon: <FilePlus size={15} />, onSelect: () => void newNote("") },
    { label: "New folder", icon: <FolderPlus size={15} />, onSelect: () => void newFolder("") },
  ];

  return (
    <div
      className="flex flex-col min-h-0 h-full"
      onContextMenu={(e) => open(e, rootEntries)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-mural-path")) {
          e.preventDefault();
          setDropRoot(true);
        }
      }}
      onDragLeave={() => setDropRoot(false)}
      onDrop={(e) => {
        setDropRoot(false);
        const p = e.dataTransfer.getData("application/x-mural-path");
        if (p && dirname(p) !== "") void move(p, "");
      }}
      style={dropRoot ? { outline: "2px dashed var(--amber)", outlineOffset: -4, borderRadius: 8 } : undefined}
    >
      <div className="flex gap-1 px-1 pb-2">
        <button className="btn btn-icon" onClick={() => void newNote("")} data-tip="New note" aria-label="New note"><FilePlus size={15} /></button>
        <button className="btn btn-icon" onClick={() => void newFolder("")} data-tip="New folder" aria-label="New folder"><FolderPlus size={15} /></button>
      </div>
      {rows.length === 0 ? (
        <div className="empty">
          <EmptyFiles />
          <p className="hand">No Markdown files yet.</p>
          <p>Create a note or drop <span className="kbd">.md</span> files into the folder.</p>
        </div>
      ) : (
        <VirtualList items={rows} rowHeight={ROW_H} render={({ node, depth }) => <TreeRow key={node.path} node={node} depth={depth} expanded={expanded.has(node.path)} toggle={toggle} expand={expand} openMenu={open} />} />
      )}
      {menu && <Menu {...menu} onClose={close} />}
    </div>
  );
}

interface ItemProps {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  toggle: (p: string) => void;
  expand: (p: string) => void;
  openMenu: ReturnType<typeof useContextMenu>["open"];
}

function TreeRow({ node, depth, expanded: isOpen, toggle, expand, openMenu }: ItemProps) {
  const active = useUi((s) => s.activeNote);
  const openNote = useUi((s) => s.openNote);
  const move = useWorkspace((s) => s.moveEntry);
  const [drop, setDrop] = useState(false);

  const entries: MenuEntry[] = node.isDir
    ? [
        { label: "New note here", icon: <FilePlus size={15} />, onSelect: () => { expand(node.path); void newNote(node.path); } },
        { label: "New folder here", icon: <FolderPlus size={15} />, onSelect: () => { expand(node.path); void newFolder(node.path); } },
        { separator: true },
        { label: "Rename", onSelect: () => void renameEntry(node.path, true) },
        { label: "Reveal in file manager", onSelect: () => void revealInFolder(node.path) },
        { label: "Copy path", onSelect: () => void copyPath(node.path) },
        { separator: true },
        { label: "Delete", danger: true, onSelect: () => void deleteEntry(node.path, true) },
      ]
    : [
        { label: "Open", onSelect: () => openNote(node.path) },
        { label: "Rename", onSelect: () => void renameEntry(node.path, false) },
        { label: "Move to…", onSelect: () => void promptMove(node.path) },
        { label: "Reveal in file manager", onSelect: () => void revealInFolder(node.path) },
        { label: "Copy path", onSelect: () => void copyPath(node.path) },
        { separator: true },
        { label: "Delete", danger: true, onSelect: () => void deleteEntry(node.path, false) },
      ];

  return (
    <button
      className="tree-row"
      style={{ ["--depth" as string]: depth }}
      data-active={!node.isDir && active === node.path}
      data-drop={drop}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/x-mural-path", node.path);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(e) => {
        if (node.isDir && e.dataTransfer.types.includes("application/x-mural-path")) {
          e.preventDefault();
          e.stopPropagation();
          setDrop(true);
        }
      }}
      onDragLeave={() => setDrop(false)}
      onDrop={(e) => {
        setDrop(false);
        const p = e.dataTransfer.getData("application/x-mural-path");
        if (!node.isDir || !p) return;
        e.preventDefault();
        e.stopPropagation();
        if (p === node.path || node.path.startsWith(p + "/") || dirname(p) === node.path) return;
        expand(node.path);
        void move(p, node.path);
      }}
      onClick={() => (node.isDir ? toggle(node.path) : openNote(node.path))}
      onContextMenu={(e) => openMenu(e, entries)}
      aria-expanded={node.isDir ? isOpen : undefined}
    >
      {node.isDir ? <ChevronRight size={14} style={{ transform: isOpen ? "rotate(90deg)" : undefined, transition: "transform .15s" }} /> : <span style={{ width: 14 }} />}
      {node.isDir ? (isOpen ? <FolderOpen size={15} /> : <Folder size={15} />) : <FileText size={15} />}
      <span className="label">{node.isDir ? node.name : stripExt(node.name)}</span>
    </button>
  );
}

async function promptMove(path: string) {
  const dest = await useUi.getState().prompt({
    title: "Move note",
    label: `Destination folder for ${basename(path)} (empty = workspace root)`,
    initial: dirname(path) || "/",
    confirmLabel: "Move",
  });
  if (dest === null) return;
  const clean = dest.replace(/^\/+|\/+$/g, "");
  await useWorkspace.getState().moveEntry(path, clean);
}
