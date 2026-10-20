export interface Template {
  id: string;
  name: string;
  content: string;
  /** Path of the note in the workspace's templates/ folder; absent for built-ins. */
  path?: string;
}

export const TEMPLATE_DIR = "templates";

export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "builtin:meeting",
    name: "Meeting",
    content: "# {{title}}\n\n**Date:** {{date}} {{time}}\n**People:** \n\n## Agenda\n\n- \n\n## Notes\n\n## Decisions\n\n## Action items\n\n- [ ] \n",
  },
  {
    id: "builtin:project",
    name: "Project",
    content: "# {{title}}\n\n**Started:** {{date}}\n\n## Goal\n\n## Next steps\n\n- [ ] \n\n## Links\n\n#project\n",
  },
  {
    id: "builtin:reading",
    name: "Reading notes",
    content: "# {{title}}\n\n**Author:** \n**Read on:** {{date}}\n\n## Summary\n\n## Highlights\n\n- \n\n## My thoughts\n\n#reading\n",
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Fills {{title}}, {{date}} (YYYY-MM-DD) and {{time}} (HH:MM). Unknown {{x}} are left alone. */
export function applyTemplate(content: string, title: string, now = new Date()): string {
  const vars: Record<string, string> = {
    title,
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
  return content.replace(/\{\{\s*(\w+)\s*\}\}/g, (all, k: string) => vars[k] ?? all);
}

/** Built-ins plus every note inside the workspace's `templates/` folder. */
export function collectTemplates(notes: Record<string, { content: string }>): Template[] {
  const own: Template[] = Object.keys(notes)
    .filter((p) => p.startsWith(TEMPLATE_DIR + "/"))
    .sort()
    .map((p) => ({ id: p, path: p, name: p.slice(TEMPLATE_DIR.length + 1).replace(/\.md$/i, ""), content: notes[p]!.content }));
  return [...own, ...BUILTIN_TEMPLATES];
}
