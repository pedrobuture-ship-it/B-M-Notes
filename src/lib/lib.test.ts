import { describe, expect, it } from "vitest";
import { extractTags, extractTitle, extractWikiLinks, removeWikiLinks, toggleCheckbox } from "./markdownText";
import { slugify } from "./slug";
import { createResolver } from "./wikiResolve";
import { buildIndex, updateIndex } from "./noteIndex";
import { searchNotes, fuzzyScore } from "./search";
import { resolveRelative, isSafeRelativePath, basename, dirname } from "./paths";
import { normalizeBoard, autoLayout } from "./board";
import { renderMarkdown } from "./markdown";
import { planLinkUpdates } from "./renameLinks";

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

describe("planLinkUpdates", () => {
  const notes = {
    "architecture.md": "# Architecture\n",
    "Ideas.md": "See [[architecture]] and [[Architecture|the design]] and [[architecture#Layers]].\n`[[architecture]]`\n",
    "Backend.md": "Uses [[ architecture ]] and [[docs/other]].\n",
    "docs/other.md": "x\n",
  };

  it("rewrites plain, aliased and heading links, keeping the rest", () => {
    const plan = planLinkUpdates(notes, [["architecture.md", "system-design.md"]]);
    expect(plan.total).toBe(4);
    expect(plan.files).toEqual([{ path: "Ideas.md", count: 3 }, { path: "Backend.md", count: 1 }]);
    expect(plan.rewrite(notes["Ideas.md"])).toBe("See [[system-design]] and [[system-design|the design]] and [[system-design#Layers]].\n`[[architecture]]`\n");
    expect(plan.rewrite(notes["Backend.md"])).toBe("Uses [[ system-design ]] and [[docs/other]].\n");
  });

  it("keeps path-qualified links qualified", () => {
    const plan = planLinkUpdates(notes, [["docs/other.md", "docs/renamed.md"]]);
    expect(plan.rewrite(notes["Backend.md"])).toBe("Uses [[ architecture ]] and [[docs/renamed]].\n");
  });

  it("uses the full path when the new plain name would be ambiguous", () => {
    const plan = planLinkUpdates({ "a/x.md": "", "b.md": "", "n.md": "[[b]]" }, [["b.md", "z/x.md"]]);
    expect(plan.rewrite("[[b]]")).toBe("[[z/x]]");
  });

  it("does nothing when the links stay valid", () => {
    expect(planLinkUpdates({ "a.md": "[[b]]", "b.md": "" }, [["b.md", "sub/b.md"]]).total).toBe(0);
  });
});

import { extractHeadings, sectionOf, slugHeading } from "./headings";
import { splitFrontmatter } from "./frontmatter";
import { extractTasks } from "./tasks";
import { findMention, linkFirstMention } from "./mentions";
import { applyTemplate, collectTemplates } from "./templates";

describe("headings", () => {
  const doc = "---\n# not a heading\n---\n# Top\ntext\n## Part *A*\na\n```\n# code\n```\n### Deep\nd\n## Part B\nb\n";
  it("lists headings outside code and frontmatter", () => {
    expect(extractHeadings(doc).map((h) => [h.level, h.text, h.slug])).toEqual([
      [1, "Top", "top"], [2, "Part *A*", "part-a"], [3, "Deep", "deep"], [2, "Part B", "part-b"],
    ]);
    expect(slugHeading("Olá, Mundo! (2)")).toBe("olá-mundo-2");
  });
  it("extracts a section up to the next heading of the same level", () => {
    expect(sectionOf(doc, "Part A")).toBe("a\n```\n# code\n```\n### Deep\nd");
    expect(sectionOf(doc, "part b")).toBe("b");
    expect(sectionOf(doc, "nope")).toBeNull();
  });
});

describe("frontmatter", () => {
  it("parses scalars, inline lists and dash lists", () => {
    const f = splitFrontmatter('---\nstatus: done\ntags: [a, "b c"]\nauthors:\n  - Ana\n  - Bo\nempty:\n---\n# Body\n');
    expect(f.data).toEqual({ status: "done", tags: ["a", "b c"], authors: ["Ana", "Bo"], empty: "" });
    expect(f.body).toBe("# Body\n");
    expect(splitFrontmatter("# x").hasFrontmatter).toBe(false);
  });
});

describe("tasks", () => {
  it("numbers checkboxes the way toggleCheckbox does", () => {
    const c = "- [ ] one\n```\n- [ ] code\n```\n  - [x] two\n> - [ ] three\n";
    const t = extractTasks(c);
    expect(t.map((x) => [x.index, x.text, x.done])).toEqual([[0, "one", false], [1, "two", true], [2, "three", false]]);
    expect(toggleCheckbox(c, 1)).toContain("  - [ ] two");
  });
});

describe("mentions", () => {
  it("finds plain mentions only, not links or code", () => {
    expect(findMention("see [[Alpha]] and `Alpha` and [Alpha](x.md)", ["Alpha"])).toBeNull();
    expect(findMention("an Alphabet of alpha beta", ["Alpha"])?.text).toBe("alpha");
  });
  it("links the first mention keeping the original text as alias", () => {
    expect(linkFirstMention("we met alpha today", ["Alpha"], "Alpha")).toBe("we met [[Alpha|alpha]] today");
    expect(linkFirstMention("Alpha rules", ["Alpha"], "Alpha")).toBe("[[Alpha]] rules");
  });
});

describe("templates", () => {
  it("fills variables and leaves unknown ones", () => {
    const d = new Date(2026, 0, 5, 9, 7);
    expect(applyTemplate("# {{title}} {{date}} {{ time }} {{x}}", "Plan", d)).toBe("# Plan 2026-01-05 09:07 {{x}}");
  });
  it("lists workspace templates before built-ins", () => {
    const t = collectTemplates({ "templates/Weekly.md": { content: "w" }, "a.md": { content: "" } });
    expect(t[0]).toMatchObject({ name: "Weekly", path: "templates/Weekly.md" });
    expect(t.length).toBe(4);
  });
});

describe("embeds and heading links", () => {
  const notes: Record<string, string> = {
    "a.md": "# A\n\n![[b]]\n\n![[c#Part]]\n\n[[b#Intro|see b]]\n",
    "b.md": "---\nk: v\n---\n# B\n\nbody of b\n\n![[a]]\n",
    "c.md": "# C\n\n## Part\n\nonly this\n\n## Other\n\nnot this\n",
  };
  const embed = (t: string) => (notes[`${t}.md`] ? { path: `${t}.md`, content: notes[`${t}.md`]! } : null);
  const html = renderMarkdown(notes["a.md"]!, { notePath: "a.md", embed });

  it("expands embeds, honours sections and survives cycles", () => {
    expect(html).toContain('class="embed"');
    expect(html).toContain("body of b");
    expect(html).not.toContain("k: v");
    expect(html).toContain("only this");
    expect(html).not.toContain("not this");
    // b embeds a, which would embed b again: the cycle stops instead of looping.
    expect((html.match(/class="embed"/g) ?? []).length).toBeLessThan(6);
  });

  it("keeps the heading on wiki links and tags headings", () => {
    expect(html).toContain('data-wiki="b"');
    expect(html).toContain('data-heading-target="Intro"');
    expect(html).toContain('data-heading="a"');
  });

  it("renders embeds as links when no resolver is given", () => {
    expect(renderMarkdown("![[b]]", { notePath: "x.md" })).toContain("↪ b");
  });
});

describe("search filters", () => {
  const idx = buildIndex([
    ["a.md", "---\nstatus: done\nowner: Ana\n---\n# Alpha\nhello #work"],
    ["b.md", "---\nstatus: draft\n---\n# Beta\nhello"],
    ["docs/c.md", "# Gamma\nhello #work"],
  ]);
  const find = (q: string) => searchNotes(idx, () => "", q).map((r) => r.path).sort();
  it("filters by property, tag, path and title, with or without text", () => {
    expect(find("status:done")).toEqual(["a.md"]);
    expect(find("status:d")).toEqual(["a.md", "b.md"]);
    expect(find("hello tag:work")).toEqual(["a.md", "docs/c.md"]);
    expect(find("path:docs")).toEqual(["docs/c.md"]);
    expect(find("title:beta owner:ana")).toEqual([]);
    expect(find("owner:ana hello")).toEqual(["a.md"]);
    expect(find("https://x")).toEqual([]);
  });
});
