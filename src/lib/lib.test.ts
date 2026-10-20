import { describe, expect, it } from "vitest";
import { extractTags, extractTitle, extractWikiLinks, removeWikiLinks, toggleCheckbox } from "./markdownText";
import { slugify } from "./slug";
import { createResolver } from "./wikiResolve";
import { buildIndex, updateIndex } from "./noteIndex";
import { searchNotes, fuzzyScore } from "./search";
import { resolveRelative, isSafeRelativePath, basename, dirname } from "./paths";
import { normalizeBoard, autoLayout } from "./board";
import { renderMarkdown } from "./markdown";

describe("wiki links", () => {
  it("extracts targets, aliases and headings", () => {
    const links = extractWikiLinks("a [[arquitetura]] b [[faculdade/calculo|Cálculo]] c [[nota#sec]]");
    expect(links.map((l) => l.target)).toEqual(["arquitetura", "faculdade/calculo", "nota"]);
    expect(links[1]?.alias).toBe("Cálculo");
  });
  it("ignores code and leaves normal links alone", () => {
    expect(extractWikiLinks("`[[x]]`\n```\n[[y]]\n```\n[txt](http://a.b) [[ok]]").map((l) => l.target)).toEqual(["ok"]);
  });
  it("resolves by path or unique basename, case-insensitively", () => {
    const r = createResolver(["faculdade/Calculo.md", "ideias.md"]);
    expect(r.resolve("faculdade/calculo")).toBe("faculdade/Calculo.md");
    expect(r.resolve("calculo")).toBe("faculdade/Calculo.md");
    expect(r.resolve("Ideias.md")).toBe("ideias.md");
    expect(r.resolve("nope")).toBeNull();
  });
});

describe("tags", () => {
  it("detects tags but not headings, numbers, urls or code", () => {
    const t = extractTags("# Title\n#projeto and #Faculdade/ads\nissue #123 http://x.com/#frag `#code`\n```\n#fence\n```\n");
    expect(t.sort()).toEqual(["faculdade/ads", "projeto"]);
  });
});

describe("titles", () => {
  it("uses the first h1 outside code", () => {
    expect(extractTitle("```\n# no\n```\n# Real title #\n", "f")).toBe("Real title");
    expect(extractTitle("text", "fallback")).toBe("fallback");
  });
});

describe("checkboxes", () => {
  const src = "- [ ] Fazer prova\n```\n- [ ] in code\n```\n  - [x] pronta\n1. [ ] third\n";
  it("toggles only the requested task and preserves the rest", () => {
    expect(toggleCheckbox(src, 0)).toBe(src.replace("- [ ] Fazer", "- [x] Fazer"));
    expect(toggleCheckbox(src, 1)).toBe(src.replace("[x] pronta", "[ ] pronta"));
    expect(toggleCheckbox(src, 2)).toBe(src.replace("1. [ ]", "1. [x]"));
    expect(toggleCheckbox(src, 3)).toBeNull();
  });
});

describe("slug and paths", () => {
  it("slugifies safely", () => {
    expect(slugify("Minha ideia")).toBe("minha-ideia");
    expect(slugify("  Ação ../ perigosa!! ")).toBe("acao-perigosa");
    expect(slugify("///")).toBe("untitled");
  });
  it("resolves and validates relative paths", () => {
    expect(resolveRelative("a/b", "../assets/x.png")).toBe("a/assets/x.png");
    expect(resolveRelative("", "../x.png")).toBeNull();
    expect(isSafeRelativePath("../x")).toBe(false);
    expect(isSafeRelativePath("a/b.md")).toBe(true);
    expect(basename("a/b/c.md")).toBe("c.md");
    expect(dirname("c.md")).toBe("");
  });
});

describe("index + search", () => {
  const notes = new Map([
    ["frontend.md", "# Frontend\nusa [[arquitetura]] #projeto"],
    ["arquitetura.md", "# Arquitetura\nreact e tauri"],
    ["roadmap.md", "# Roadmap\n[[arquitetura]] [[frontend]]"],
  ]);
  const idx = buildIndex(notes);
  it("computes backlinks and tags", () => {
    expect(idx.backlinks.get("arquitetura.md")?.sort()).toEqual(["frontend.md", "roadmap.md"]);
    expect(idx.tags.get("projeto")).toEqual(["frontend.md"]);
  });
  it("updates incrementally", () => {
    const next = updateIndex(idx, [{ path: "roadmap.md", content: "# Roadmap" }]);
    expect(next.backlinks.get("arquitetura.md")).toEqual(["frontend.md"]);
    expect(updateIndex(idx, [{ path: "frontend.md", content: null }]).meta.has("frontend.md")).toBe(false);
  });
  it("ranks name matches above content matches and builds snippets", () => {
    const r = searchNotes(idx, (p) => notes.get(p) ?? "", "tauri");
    expect(r[0]?.path).toBe("arquitetura.md");
    expect(r[0]?.marks.length).toBeGreaterThan(0);
    expect(searchNotes(idx, (p) => notes.get(p) ?? "", "arquitetura")[0]?.path).toBe("arquitetura.md");
    expect(searchNotes(idx, (p) => notes.get(p) ?? "", "#projeto")[0]?.path).toBe("frontend.md");
    expect(searchNotes(idx, () => "", "zzzz")).toEqual([]);
  });
  it("fuzzy matches subsequences", () => {
    expect(fuzzyScore("Toggle sidebar", "tgsb")).not.toBeNull();
    expect(fuzzyScore("Fit board", "zzz")).toBeNull();
  });
});

describe("board", () => {
  it("normalizes corrupt data without throwing", () => {
    const b = normalizeBoard({ cards: { "a.md": { x: "bad", w: 5 }, "b.md": null }, frames: [{ nope: 1 }], connections: [1] });
    expect(b.cards["a.md"]?.x).toBe(0);
    expect(b.cards["a.md"]?.w).toBe(160);
    expect(b.frames).toEqual([]);
    expect(normalizeBoard("garbage").version).toBe(1);
  });
  it("auto layout keeps existing cards in place", () => {
    const existing = { "a.md": { x: 10, y: 10, w: 280, h: 200, color: "paper" as const } };
    const out = autoLayout(["a.md", "b.md"], existing);
    expect(out["a.md"]).toBe(existing["a.md"]);
    expect(out["b.md"]).toBeDefined();
  });
});

describe("markdown render", () => {
  it("renders wiki links, tasks and rewrites images", () => {
    const html = renderMarkdown("[[Foo|bar]] [x](http://a.b)\n\n- [ ] t\n\n![](<assets/a b.png>)\n\n```ts\nconst a = 1;\n```", {
      notePath: "n/x.md",
      interactiveTasks: true,
      resolves: () => false,
    });
    expect(html).toContain('data-wiki="Foo"');
    expect(html).toContain("wikilink-missing");
    expect(html).toContain('data-task="0"');
    expect(html).not.toContain("disabled");
    expect(html).toContain("n/assets/a%20b.png");
    expect(html).toContain("hljs");
  });
  it("strips scripts", () => {
    expect(renderMarkdown("<script>alert(1)</script><img src=x onerror=alert(1)>", { notePath: "a.md" })).not.toMatch(/script|onerror/);
  });
});

import { relativeFrom } from "./paths";
import { dailyTemplate, dateStamp, timeStamp } from "./daily";

describe("relative asset paths and daily notes", () => {
  it("computes paths from the note folder to the asset", () => {
    expect(relativeFrom("", "assets/a.png")).toBe("assets/a.png");
    expect(relativeFrom("projetos", "assets/a.png")).toBe("../assets/a.png");
    expect(relativeFrom("a/b", "a/assets/x.png")).toBe("../assets/x.png");
  });
  it("formats stamps and the daily template", () => {
    const d = new Date(2026, 0, 5, 7, 8, 9);
    expect(dateStamp(d)).toBe("2026-01-05");
    expect(timeStamp(d)).toBe("2026-01-05-070809");
    expect(dailyTemplate("2026-01-05")).toBe("# 2026-01-05\n\n## Notes\n\n- \n\n## Tasks\n\n- [ ] \n");
  });
});

describe("removeWikiLinks", () => {
  const is = (t: string) => (x: string) => x === t;
  it("removes a link alone on its line along with the line", () => {
    expect(removeWikiLinks("# A\n\n[[b]]\n[[c]]\n", is("b"))).toBe("# A\n\n[[c]]\n");
  });
  it("removes an inline link and its leading space", () => {
    expect(removeWikiLinks("see [[b]] now", is("b"))).toBe("see now");
  });
  it("removes aliased links and leaves code alone", () => {
    expect(removeWikiLinks("x\n[[b|Bee]]\n`[[b]]`", is("b"))).toBe("x\n`[[b]]`");
  });
});
