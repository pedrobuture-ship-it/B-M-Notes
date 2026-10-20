import { extractHeadings, type Heading } from "./headings";

export interface MindNode {
  id: string;
  text: string;
  depth: number;
  x: number;
  y: number;
  /** Heading slug to jump to (empty for the root). */
  slug: string;
  children: MindNode[];
}

export interface MindLink {
  from: MindNode;
  to: MindNode;
}

export interface MindMap {
  root: MindNode;
  nodes: MindNode[];
  links: MindLink[];
  width: number;
  height: number;
}

export const COL = 230;
export const ROW = 44;
const MAX_LEVEL = 3;

/**
 * Tree of the note's `#`, `##` and `###` headings, laid out left to right.
 * A single top-level `#` becomes the root; otherwise the note's own title is the root.
 */
export function buildMindMap(content: string, fallbackTitle: string): MindMap {
  let heads: Heading[] = extractHeadings(content).filter((h) => h.level <= MAX_LEVEL);
  const tops = heads.filter((h) => h.level === 1);
  let rootText = fallbackTitle;
  let rootSlug = "";
  if (tops.length === 1 && heads[0] === tops[0]) {
    rootText = tops[0]!.text;
    rootSlug = tops[0]!.slug;
    heads = heads.slice(1);
  }
  const root: MindNode = { id: "root", text: rootText, depth: 0, x: 0, y: 0, slug: rootSlug, children: [] };
  const stack: { level: number; node: MindNode }[] = [{ level: 0, node: root }];
  heads.forEach((h, i) => {
    while (stack.length > 1 && stack[stack.length - 1]!.level >= h.level) stack.pop();
    const parent = stack[stack.length - 1]!.node;
    const node: MindNode = { id: `h${i}`, text: h.text, depth: parent.depth + 1, x: 0, y: 0, slug: h.slug, children: [] };
    parent.children.push(node);
    stack.push({ level: h.level, node });
  });

  let leaf = 0;
  const nodes: MindNode[] = [];
  const links: MindLink[] = [];
  const place = (n: MindNode) => {
    nodes.push(n);
    n.x = n.depth * COL;
    if (n.children.length === 0) n.y = leaf++ * ROW;
    else {
      n.children.forEach((c) => {
        links.push({ from: n, to: c });
        place(c);
      });
      n.y = (n.children[0]!.y + n.children[n.children.length - 1]!.y) / 2;
    }
  };
  place(root);
  const maxDepth = Math.max(...nodes.map((n) => n.depth));
  return { root, nodes, links, width: maxDepth * COL + COL, height: Math.max(1, leaf) * ROW };
}
