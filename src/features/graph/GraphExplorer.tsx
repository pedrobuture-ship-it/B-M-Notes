import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useWorkspace } from "@/stores/workspace";
import { useUi } from "@/stores/ui";
import { hashUnit } from "@/lib/board";
import { EmptyBoard } from "@/components/doodles";

interface GNode { id: string; title: string; x: number; y: number; vx: number; vy: number; degree: number; tags: string[] }
interface GEdge { s: string; t: string }

const COLORS = ["#d9a441", "#86a873", "#6f9bb5", "#c98a9a", "#9c86b5", "#c8553d", "#e6c75a"];

/** Small force-directed layout; runs a bounded number of iterations then rests. */
function layout(nodes: GNode[], edges: GEdge[], iterations: number) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const k = 90;
  for (let it = 0; it < iterations; it++) {
    const cool = 1 - it / iterations;
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 > 90000) continue;
        if (d2 < 1) { dx = hashUnit(a.id + b.id); dy = hashUnit(b.id + a.id); d2 = 1; }
        const f = (k * k) / d2;
        a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    for (const e of edges) {
      const a = byId.get(e.s), b = byId.get(e.t);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - k) * 0.012;
      a.vx += (dx / d) * f * d * 0.05; a.vy += (dy / d) * f * d * 0.05;
      b.vx -= (dx / d) * f * d * 0.05; b.vy -= (dy / d) * f * d * 0.05;
    }
    for (const n of nodes) {
      n.vx -= n.x * 0.004; n.vy -= n.y * 0.004;
      n.x += Math.max(-30, Math.min(30, n.vx)) * cool * 0.5;
      n.y += Math.max(-30, Math.min(30, n.vy)) * cool * 0.5;
      n.vx *= 0.6; n.vy *= 0.6;
    }
  }
}

function wobblyPath(a: GNode, b: GNode): string {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const bend = hashUnit(a.id + b.id) * len * 0.12;
  const mx = a.x + dx / 2 + (-dy / len) * bend;
  const my = a.y + dy / 2 + (dx / len) * bend;
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function GraphExplorer() {
  const meta = useWorkspace((s) => s.index.meta);
  const tagsIdx = useWorkspace((s) => s.index.tags);
  const openNote = useUi((s) => s.openNote);
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  const { nodes, edges } = useMemo(() => {
    const list: GNode[] = [...meta.values()].map((m, i) => ({
      id: m.path, title: m.title, tags: m.tags, degree: 0,
      x: Math.cos(i * 2.4) * (40 + i * 6), y: Math.sin(i * 2.4) * (40 + i * 6), vx: 0, vy: 0,
    }));
    const es: GEdge[] = [];
    const deg = new Map<string, number>();
    for (const m of meta.values()) {
      for (const t of m.links) {
        es.push({ s: m.path, t });
        deg.set(m.path, (deg.get(m.path) ?? 0) + 1);
        deg.set(t, (deg.get(t) ?? 0) + 1);
      }
    }
    for (const n of list) n.degree = deg.get(n.id) ?? 0;
    layout(list, es, list.length > 1500 ? 60 : 220);
    return { nodes: list, edges: es };
  }, [meta]);

  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const q = query.trim().toLowerCase();
  const tagSet = tag ? new Set(tagsIdx.get(tag) ?? []) : null;
  const matches = (n: GNode) => (!q || n.title.toLowerCase().includes(q) || n.id.toLowerCase().includes(q)) && (!tagSet || tagSet.has(n.id));
  const neighbors = useMemo(() => {
    const s = new Set<string>();
    if (hover) {
      s.add(hover);
      for (const e of edges) {
        if (e.s === hover) s.add(e.t);
        if (e.t === hover) s.add(e.s);
      }
    }
    return s;
  }, [hover, edges]);

  // wheel zoom around the cursor (non-passive so we can prevent page scroll)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const mx = e.clientX - r.left - r.width / 2, my = e.clientY - r.top - r.height / 2;
      setView((v) => {
        const k = Math.max(0.1, Math.min(4, v.k * Math.exp(-e.deltaY * 0.0015)));
        return { k, x: mx - ((mx - v.x) * k) / v.k, y: my - ((my - v.y) * k) / v.k };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);

  const allTags = useMemo(() => [...tagsIdx.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 12), [tagsIdx]);

  if (nodes.length === 0) {
    return (
      <div className="empty h-full"><EmptyBoard /><p className="hand">Nothing to explore yet.</p><p>Create notes and link them with [[wiki links]].</p></div>
    );
  }

  return (
    <div className="graph-root">
      <div className="board-hud">
        <div className="relative" style={{ width: 240 }}>
          <Search size={15} className="absolute" style={{ left: 10, top: 10, color: "var(--ink-faint)" }} />
          <input className="field" style={{ paddingLeft: 32 }} placeholder="Find a note…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the graph" />
        </div>
        {allTags.map(([t, p]) => (
          <button key={t} className="chip" data-active={tag === t} onClick={() => setTag(tag === t ? null : t)}>#{t} <span style={{ opacity: 0.6 }}>{p.length}</span></button>
        ))}
        {(tag || query) && <button className="btn btn-ghost btn-icon" onClick={() => { setTag(null); setQuery(""); }} aria-label="Clear filters"><X size={14} /></button>}
      </div>
      <svg
        ref={svgRef}
        role="img"
        aria-label="Note graph"
        onPointerDown={(e) => {
          if ((e.target as Element).closest(".graph-node")) return;
          (e.currentTarget as Element).setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d) setView((v) => ({ ...v, x: d.vx + e.clientX - d.x, y: d.vy + e.clientY - d.y }));
        }}
        onPointerUp={() => (drag.current = null)}
        style={{ cursor: drag.current ? "grabbing" : "grab", touchAction: "none" }}
      >
        <g style={{ transform: `translate(calc(50% + ${view.x}px), calc(50% + ${view.y}px)) scale(${view.k})` }}>
          {edges.map((e, i) => {
            const a = byId.get(e.s), b = byId.get(e.t);
            if (!a || !b) return null;
            const hot = hover !== null && (e.s === hover || e.t === hover);
            const dim = (hover !== null && !hot) || !matches(a) || !matches(b);
            return <path key={i} className="graph-edge" d={wobblyPath(a, b)} data-hot={hot} data-dim={dim} />;
          })}
          {nodes.map((n) => {
            const dim = !matches(n) || (hover !== null && !neighbors.has(n.id));
            const r = 6 + Math.min(14, Math.sqrt(n.degree) * 3.2);
            const color = COLORS[Math.floor((hashUnit(n.tags[0] ?? "x") + 1) * 3.49) % COLORS.length]!;
            return (
              <g
                key={n.id}
                className="graph-node"
                data-dim={dim}
                transform={`translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover(null)}
                onClick={() => openNote(n.id)}
                tabIndex={0}
                role="button"
                aria-label={`Open ${n.title}`}
                onKeyDown={(e) => e.key === "Enter" && openNote(n.id)}
              >
                <circle r={r} fill={n.tags.length ? color : "#b9ad96"} />
                {(view.k > 0.55 || hover === n.id || neighbors.has(n.id) || (q && matches(n))) && <text y={r + 16} textAnchor="middle">{n.title.slice(0, 28)}</text>}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
