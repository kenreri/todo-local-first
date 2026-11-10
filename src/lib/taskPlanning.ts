import { addDays, todayKey } from "./dates";
import { expandTaskOccurrences, taskPlacementDate } from "./repeat";
import type { Locale, TaskOccurrence, TaskRecord } from "../types";

/** Today's plan and carry-over are separate; each task appears at most once. */
export function dailyPlan(tasks: TaskRecord[], today = todayKey()) {
  const current: TaskOccurrence[] = [];
  const previous: TaskOccurrence[] = [];
  const upcoming: TaskOccurrence[] = [];
  for (const task of tasks) {
    if (task.deletedAt != null || task.parentId != null || task.completedAt != null) continue;
    const date = taskPlacementDate(task);
    if (task.repeatRule) {
      // Show today's occurrence, never accumulate missed virtual instances.
      // A user-selected work day overrides the recurring display for this task.
      if (task.scheduledDate) {
        const item = { task, date: task.scheduledDate, virtualId: `${task.id}::${task.scheduledDate}`, isVirtual: false };
        if (item.date === today) current.push(item);
        else if (item.date < today) previous.push(item);
        else if (item.date <= addDays(today, 7)) upcoming.push(item);
      } else {
        current.push(...expandTaskOccurrences(task, today, today));
        const future = expandTaskOccurrences(task, addDays(today, 1), addDays(today, 7))[0];
        if (!current.some((item) => item.task.id === task.id) && future) upcoming.push(future);
      }
      continue;
    }
    if (!date) continue;
    const item = { task, date, virtualId: `${task.id}::${date}`, isVirtual: false };
    if (date === today) current.push(item);
    else if (date < today) previous.push(item);
    else if (date <= addDays(today, 7)) upcoming.push(item);
  }
  return { current, previous, upcoming };
}

export function planningLabel(date: string | null, locale: Locale, today = todayKey()) {
  if (!date) return locale === "zh" ? "待安排" : "Unscheduled";
  if (date === today) return locale === "zh" ? "今天做" : "Today";
  if (date === addDays(today, 1)) return locale === "zh" ? "明天做" : "Tomorrow";
  return locale === "zh" ? `${date} 做` : date;
}

export function validScheduledTime(value: unknown): boolean {
  return value == null || (typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}
