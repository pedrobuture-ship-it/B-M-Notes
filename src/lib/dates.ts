import { maskCode } from "./markdownText";
import { extractTasks } from "./tasks";

export interface DateMention {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM when written as `@2026-11-01 14:30`. */
  time: string | null;
  /** Zero-based line. */
  line: number;
  /** The line's text, trimmed. */
  text: string;
  /** Index among the note's checkboxes when the line is a task, else null. */
  taskIndex: number | null;
  done: boolean;
}

export const DATE_TOKEN = /(?<![\w@])@(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?(?!\d)/g;

export function isRealDate(y: number, m: number, d: number): boolean {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Every `@YYYY-MM-DD` (optionally with a time) outside code, with its line and task status. */
export function extractDates(content: string): DateMention[] {
  const masked = maskCode(content).split("\n");
  const lines = content.split("\n");
  const tasks = new Map(extractTasks(content).map((t) => [t.line, t]));
  const out: DateMention[] = [];
  masked.forEach((line, i) => {
    for (const m of line.matchAll(DATE_TOKEN)) {
      if (!isRealDate(Number(m[1]), Number(m[2]), Number(m[3]))) continue;
      const task = tasks.get(i);
      out.push({
        date: `${m[1]}-${m[2]}-${m[3]}`,
        time: m[4] ? `${m[4]}:${m[5]}` : null,
        line: i,
        text: (lines[i] ?? "").trim(),
        taskIndex: task ? task.index : null,
        done: task ? task.done : false,
      });
    }
  });
  return out;
}

/** Open tasks due before `today` / on `today` across `notes` (path -> content). */
export function dueSummary(notes: Record<string, string>, today: string): { overdue: number; today: number } {
  let overdue = 0;
  let due = 0;
  for (const c of Object.values(notes)) {
    if (!c.includes("@")) continue;
    for (const d of extractDates(c)) {
      if (d.taskIndex === null || d.done) continue;
      if (d.date < today) overdue++;
      else if (d.date === today) due++;
    }
  }
  return { overdue, today: due };
}

/** Month grid (weeks start on `weekStart`, 0 = Sunday) as YYYY-MM-DD, or null for padding cells. */
export function monthGrid(year: number, month: number, weekStart = 0): (string | null)[][] {
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const offset = (first.getDay() - weekStart + 7) % 7;
  const pad = (n: number) => String(n).padStart(2, "0");
  const cells: (string | null)[] = [...Array<null>(offset).fill(null), ...Array.from({ length: days }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
