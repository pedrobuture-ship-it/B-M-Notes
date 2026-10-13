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

const isWindows = typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent);
const ASSET_BASE = isWindows ? "http://mural.localhost/" : "mural://localhost/";

export function assetUrl(relPath: string): string {
  return ASSET_BASE + relPath.split("/").map(encodeURIComponent).join("/");
}

const WIKI = /\[\[([^[\]\n|#]+)(?:#([^[\]\n|]*))?(?:\|([^[\]\n]*))?\]\]/g;

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
        const target = (m[1] ?? "").trim();
        const label = (m[3] ?? "").trim() || target;
        parts.push({
          type: "link",
          url: `#wiki:${encodeURIComponent(target)}`,
          children: [{ type: "text", value: label }],
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
      if (node.tagName === "a" && typeof node.properties?.href === "string" && node.properties.href.startsWith("#wiki:")) {
        const target = safeDecode(node.properties.href.slice(6));
        node.properties["data-wiki"] = target;
        node.properties.className = opts.resolves(target) ? ["wikilink"] : ["wikilink", "wikilink-missing"];
      }
    });
  };
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
  },
  protocols: { ...defaultSchema.protocols, href: [...(defaultSchema.protocols?.href ?? []), "mailto"] },
  clobber: [],
};

export interface RenderOptions {
  notePath: string;
  interactiveTasks?: boolean;
  resolves?: (target: string) => boolean;
}

export function renderMarkdown(content: string, options: RenderOptions): string {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
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
