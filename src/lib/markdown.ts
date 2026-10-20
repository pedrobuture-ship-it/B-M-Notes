import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { Options as Schema } from "rehype-sanitize";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import type { Root as MdRoot, Text, PhrasingContent, Parent } from "mdast";
import type { Root as HRoot, Element } from "hast";
import { visit, SKIP } from "unist-util-visit";
import { dirname, resolveRelative } from "./paths";
import { slugHeading, sectionOf } from "./headings";
import { splitFrontmatter } from "./frontmatter";

const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
const ASSET_BASE = isWindows ? "http://mural.localhost/" : "mural://localhost/";

export function assetUrl(relPath: string): string {
  return ASSET_BASE + relPath.split("/").map(encodeURIComponent).join("/");
}

const WIKI = /(!?)\[\[([^[\]\n|#]+)(?:#([^[\]\n|]*))?(?:\|([^[\]\n]*))?\]\]/g;
const EMBED_ONLY = /^!\[\[([^[\]\n|#]+)(?:#([^[\]\n|]*))?(?:\|([^[\]\n]*))?\]\]$/;
const MAX_EMBED_DEPTH = 2;

export interface EmbedSource {
  path: string;
  content: string;
}

const wikiHref = (target: string, heading?: string) => `#wiki:${encodeURIComponent(target)}${heading ? `#${encodeURIComponent(heading)}` : ""}`;

/** Replaces a paragraph that is just `![[note]]` or `![[note#Section]]` with the embedded content. */
function remarkEmbeds(embed?: (target: string) => EmbedSource | null) {
  const parseMd = (text: string): MdRoot => unified().use(remarkParse).use(remarkGfm).parse(text) as MdRoot;
  const expand = (tree: MdRoot, depth: number, seen: Set<string>) => {
    visit(tree, "paragraph", (node, index, parent: Parent | undefined) => {
      if (!parent || index === undefined || node.children.length !== 1) return;
      const only = node.children[0];
      const m = only?.type === "text" ? EMBED_ONLY.exec(only.value.trim()) : null;
      if (!m) return;
      const target = (m[1] ?? "").trim();
      const heading = (m[2] ?? "").trim();
      const src = depth < MAX_EMBED_DEPTH ? embed?.(target) : null;
      if (!src || seen.has(src.path)) return;
      let body = splitFrontmatter(src.content).body;
      if (heading) body = sectionOf(body, heading) ?? "";
      const inner = parseMd(body);
      expand(inner, depth + 1, new Set(seen).add(src.path));
      const label = (m[3] ?? "").trim() || (heading ? `${target} › ${heading}` : target);
      parent.children.splice(index, 1, {
        type: "blockquote",
        data: { hName: "div", hProperties: { className: ["embed"] } },
        children: [
          { type: "paragraph", children: [{ type: "link", url: wikiHref(target, heading), children: [{ type: "text", value: `↪ ${label}` }] }] },
          ...inner.children,
        ],
      } as never);
      return [SKIP, index + 1];
    });
  };
  return (tree: MdRoot) => expand(tree, 0, new Set());
}

/** Turns `[[target|alias]]` in text nodes into links with a `#wiki:` href. */
function remarkWikiLinks() {
  return (tree: MdRoot) => {
    visit(tree, "text", (node: Text, index, parent: Parent | undefined) => {
      if (!parent || index === undefined || !node.value.includes("[[")) return;
      const parts: PhrasingContent[] = [];
      let last = 0;
      for (const m of node.value.matchAll(WIKI)) {
        const at = m.index ?? 0;
        if (at > last) parts.push({ type: "text", value: node.value.slice(last, at) });
        const target = (m[2] ?? "").trim();
        const heading = (m[3] ?? "").trim();
        const label = (m[4] ?? "").trim() || target;
        parts.push({
          type: "link",
          url: wikiHref(target, heading),
          children: [{ type: "text", value: m[1] ? `↪ ${label}` : label }],
        });
        last = at + m[0].length;
      }
      if (parts.length === 0) return;
      if (last < node.value.length) parts.push({ type: "text", value: node.value.slice(last) });
      parent.children.splice(index, 1, ...parts);
      return [SKIP, index + parts.length];
    });
  };
}

interface RehypeOpts {
  notePath: string;
  interactiveTasks: boolean;
  resolves: (target: string) => boolean;
}

function rehypeNoteFeatures(opts: RehypeOpts) {
  return (tree: HRoot) => {
    let taskIndex = 0;
    const noteDir = dirname(opts.notePath);
    visit(tree, "element", (node: Element) => {
      if (node.tagName === "input" && node.properties?.type === "checkbox") {
        node.properties["data-task"] = String(taskIndex++);
        if (opts.interactiveTasks) delete node.properties.disabled;
        else node.properties.disabled = true;
      }
      if (node.tagName === "img" && typeof node.properties?.src === "string") {
        const src = node.properties.src;
        if (!/^[a-z][a-z0-9+.-]*:/i.test(src) && !src.startsWith("//")) {
          const decoded = safeDecode(src);
          const resolved = decoded.startsWith("/") ? decoded.slice(1) : resolveRelative(noteDir, decoded);
          if (resolved) node.properties.src = assetUrl(resolved);
          else delete node.properties.src;
        }
        node.properties.loading = "lazy";
      }
      if (/^h[1-6]$/.test(node.tagName)) node.properties = { ...node.properties, "data-heading": slugHeading(hastText(node)) };
      if (node.tagName === "a" && typeof node.properties?.href === "string" && node.properties.href.startsWith("#wiki:")) {
        const rest = node.properties.href.slice(6);
        const hash = rest.indexOf("#");
        const target = safeDecode(hash === -1 ? rest : rest.slice(0, hash));
        if (hash !== -1) node.properties["data-heading-target"] = safeDecode(rest.slice(hash + 1));
        node.properties["data-wiki"] = target;
        node.properties.className = opts.resolves(target) ? ["wikilink"] : ["wikilink", "wikilink-missing"];
      }
    });
  };
}

function hastText(node: Element | { children?: unknown[]; value?: string }): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  return ((node.children ?? []) as (Element | { value?: string })[]).map((c) => hastText(c as Element)).join("");
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const schema: Schema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code ?? []), ["className", /^(hljs|language-.*)$/]],
    span: [...(defaultSchema.attributes?.span ?? []), ["className", /^hljs.*$/]],
    input: [...(defaultSchema.attributes?.input ?? []), "checked", "disabled", "type"],
    div: [...(defaultSchema.attributes?.div ?? []), ["className", "embed"]],
  },
  protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? []), "mailto"] },
  clobber: [],
};

export interface RenderOptions {
  notePath: string;
  interactiveTasks?: boolean;
  resolves?: (target: string) => boolean;
  /** Looks up a note for `![[note]]` embeds. Without it, embeds render as plain links. */
  embed?: (target: string) => EmbedSource | null;
}

export function renderMarkdown(content: string, options: RenderOptions): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkEmbeds, options.embed)
    .use(remarkWikiLinks)
    .use(remarkRehype)
    .use(rehypeSanitize, schema)
    .use(rehypeHighlight, { detect: false, ignoreMissing: true })
    .use(rehypeNoteFeatures, {
      notePath: options.notePath,
      interactiveTasks: options.interactiveTasks ?? false,
      resolves: options.resolves ?? (() => true),
    })
    .use(rehypeStringify);
  return String(processor.processSync(content));
}
