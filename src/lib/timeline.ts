export interface TimelineItem {
  path: string;
  /** Milliseconds since the epoch. */
  time: number;
}

export interface DayGroup<T extends TimelineItem> {
  /** Local date as YYYY-MM-DD. */
  day: string;
  items: T[];
}

const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Newest first, grouped by local calendar day. */
export function groupByDay<T extends TimelineItem>(items: T[]): DayGroup<T>[] {
  const sorted = [...items].sort((a, b) => b.time - a.time || a.path.localeCompare(b.path));
  const groups: DayGroup<T>[] = [];
  for (const it of sorted) {
    const day = dayKey(it.time);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(it);
    else groups.push({ day, items: [it] });
  }
  return groups;
}

/** "Today", "Yesterday" or a long local date. */
export function dayLabel(day: string, now = Date.now(), locale?: string): string {
  if (day === dayKey(now)) return "Today";
  if (day === dayKey(now - 86_400_000)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y!, m! - 1, d).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
