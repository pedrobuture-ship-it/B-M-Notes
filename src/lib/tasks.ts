export interface Task {
  /** Index among the checkboxes of the note (what `toggleCheckbox` expects). */
  index: number;
  text: string;
  done: boolean;
  line: number;
}

const TASK = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(.*)$/;

/** Every `- [ ]` / `- [x]` outside code fences, numbered like `toggleCheckbox` numbers them. */
export function extractTasks(content: string): Task[] {
  const out: Task[] = [];
  let fence: string | null = null;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const f = line.match(/^\s*(```|~~~)/);
    if (f) {
      if (!fence) fence = f[1] ?? null;
      else if (f[1] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const m = TASK.exec(line);
    if (m) out.push({ index: out.length, text: (m[2] ?? "").trim(), done: m[1] !== " ", line: i });
  }
  return out;
}
