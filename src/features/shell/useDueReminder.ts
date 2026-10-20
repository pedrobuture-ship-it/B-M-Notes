import { useEffect } from "react";
import { dueSummary } from "@/lib/dates";
import { tr } from "@/lib/i18n";
import { dayKey } from "@/lib/timeline";
import { useUi } from "@/stores/ui";
import { useWorkspace } from "@/stores/workspace";

/** One gentle toast when a folder opens and tasks with an @date are due today or overdue. */
export function useDueReminder() {
  const root = useWorkspace((s) => s.info?.root);
  useEffect(() => {
    if (!root) return;
    const t = setTimeout(() => {
      const notes = Object.fromEntries(Object.entries(useWorkspace.getState().notes).map(([p, n]) => [p, n.content]));
      const s = dueSummary(notes, dayKey(Date.now()));
      if (s.overdue + s.today === 0) return;
      useUi.getState().toast(tr("Tasks: {today} due today, {overdue} overdue. Open the Calendar.", { today: s.today, overdue: s.overdue }), s.overdue ? "error" : "info");
    }, 1500);
    return () => clearTimeout(t);
  }, [root]);
}
