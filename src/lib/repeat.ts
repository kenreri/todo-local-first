import {
  addDays,
  compareDateKey,
  parseDateKey,
  toDateKey,
  todayKey,
} from "./dates";
import type { RepeatRule, TaskOccurrence, TaskRecord } from "../types";

/** Calendar placement: schedule first, else due (repeat series still anchors on dueDate). */
export function taskPlacementDate(task: TaskRecord): string | null {
  if (task.scheduledDate) return task.scheduledDate;
  if (task.dueDate) return task.dueDate;
  if (task.repeatRule) return toDateKey(new Date(task.createdAt));
  return null;
}

function repeatAnchorDate(task: TaskRecord): string | null {
  if (task.dueDate) return task.dueDate;
  if (task.repeatRule) return toDateKey(new Date(task.createdAt));
  return null;
}

function occurrence(
  task: TaskRecord,
  date: string,
  isVirtual = false,
): TaskOccurrence {
  return {
    task,
    date,
    virtualId: `${task.id}::${date}`,
    isVirtual,
  };
}

export function expandTaskOccurrences(
  task: TaskRecord,
  from: string,
  to: string,
): TaskOccurrence[] {
  if (task.parentId) return [];

  const rule = task.repeatRule;
  if (!rule) {
    const start = taskPlacementDate(task);
    if (!start) return [];

    if (task.completedAt) {
      if (start >= from && start <= to) {
        return [occurrence(task, start)];
      }
      return [];
    }
    if (start >= from && start <= to) {
      return [occurrence(task, start)];
    }
    return [];
  }

  const start = repeatAnchorDate(task);
  if (!start) return [];
  if (task.completedAt) return [];

  const hardEnd = rule.endDate ?? to;
  const rangeEnd = compareDateKey(hardEnd, to) < 0 ? hardEnd : to;
  const interval = Math.max(1, rule.interval || 1);

  if (rule.frequency === "daily") {
    return expandDaily(task, start, from, rangeEnd, interval);
  }
  if (rule.frequency === "weekly" || rule.frequency === "custom") {
    return expandWeekly(task, start, from, rangeEnd, rule, interval);
  }
  if (rule.frequency === "monthly") {
    return expandMonthly(task, start, from, rangeEnd, rule, interval);
  }
  return [];
}

function pushOccurrence(
  results: TaskOccurrence[],
  task: TaskRecord,
  key: string,
) {
  results.push(occurrence(task, key, key !== task.dueDate));
}

function expandDaily(
  task: TaskRecord,
  start: string,
  from: string,
  rangeEnd: string,
  interval: number,
) {
  const results: TaskOccurrence[] = [];
  let key = start;
  while (compareDateKey(key, rangeEnd) <= 0 && results.length < 400) {
    if (compareDateKey(key, from) >= 0) pushOccurrence(results, task, key);
    key = addDays(key, interval);
  }
  return results;
}

function expandWeekly(
  task: TaskRecord,
  start: string,
  from: string,
  rangeEnd: string,
  rule: RepeatRule,
  interval: number,
) {
  const results: TaskOccurrence[] = [];
  const weekdays =
    rule.weekdays && rule.weekdays.length > 0
      ? [...new Set(rule.weekdays)].sort((a, b) => a - b)
      : [parseDateKey(start).getDay()];
  const startDate = parseDateKey(start);
  const startWeek = Date.UTC(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate() - startDate.getDay(),
  );

  let key = start;
  let guard = 0;
  while (
    compareDateKey(key, rangeEnd) <= 0 &&
    results.length < 400 &&
    guard < 800
  ) {
    guard += 1;
    const day = parseDateKey(key);
    const weekday = day.getDay();
    if (weekdays.includes(weekday) && compareDateKey(key, from) >= 0) {
      const curWeek = Date.UTC(
        day.getFullYear(),
        day.getMonth(),
        day.getDate() - day.getDay(),
      );
      const weeks = Math.round((curWeek - startWeek) / (7 * 24 * 3600 * 1000));
      if (weeks >= 0 && weeks % interval === 0) {
        pushOccurrence(results, task, key);
      }
    }
    key = addDays(key, 1);
  }
  return results;
}

function expandMonthly(
  task: TaskRecord,
  start: string,
  from: string,
  rangeEnd: string,
  rule: RepeatRule,
  interval: number,
) {
  const results: TaskOccurrence[] = [];
  const monthDay = rule.monthDay ?? parseDateKey(start).getDate();
  const cursor = parseDateKey(start);
  cursor.setDate(1);

  for (let count = 0; count < 240 && results.length < 400; count += 1) {
    const lastDay = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    const day = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      Math.min(monthDay, lastDay),
    );
    const key = toDateKey(day);
    if (compareDateKey(key, start) >= 0 && compareDateKey(key, from) >= 0) {
      if (compareDateKey(key, rangeEnd) > 0) break;
      pushOccurrence(results, task, key);
    }
    cursor.setMonth(cursor.getMonth() + interval);
  }
  return results;
}

export function nextOccurrenceAfter(
  task: TaskRecord,
  afterDate: string,
): string | null {
  const from = addDays(afterDate, 1);
  const to = addDays(afterDate, 370);
  const items = expandTaskOccurrences(
    { ...task, completedAt: null, dueDate: task.dueDate ?? afterDate },
    from,
    to,
  );
  return items[0]?.date ?? null;
}

export function occurrencesForRange(
  tasks: TaskRecord[],
  from: string,
  to: string,
): TaskOccurrence[] {
  return tasks.flatMap((task) => expandTaskOccurrences(task, from, to));
}

export function todayBuckets(tasks: TaskRecord[], now = new Date()) {
  const today = todayKey(now);
  const upcomingEnd = addDays(today, 7);
  const overdue: TaskOccurrence[] = [];
  const dueToday: TaskOccurrence[] = [];
  const upcoming: TaskOccurrence[] = [];

  for (const task of tasks) {
    if (task.parentId || task.completedAt) continue;

    if (task.repeatRule) {
      const date = repeatAnchorDate(task);
      if (!date || compareDateKey(date, upcomingEnd) > 0) continue;
      if (
        task.repeatRule.endDate &&
        compareDateKey(date, task.repeatRule.endDate) > 0
      ) {
        continue;
      }
      const item = occurrence(task, date);
      if (date < today) overdue.push(item);
      else if (date === today) dueToday.push(item);
      else upcoming.push(item);
      continue;
    }

    const scheduled = task.scheduledDate;
    const due = task.dueDate;

    if (scheduled === today) {
      dueToday.push(occurrence(task, today));
      continue;
    }
    if (due != null && due < today) {
      overdue.push(occurrence(task, due));
      continue;
    }
    if (scheduled != null && scheduled < today) {
      overdue.push(occurrence(task, scheduled));
      continue;
    }
    if (scheduled == null && due === today) {
      dueToday.push(occurrence(task, today));
      continue;
    }

    const placement = scheduled ?? due;
    if (
      placement &&
      compareDateKey(placement, today) > 0 &&
      compareDateKey(placement, upcomingEnd) <= 0
    ) {
      upcoming.push(occurrence(task, placement));
    }
  }

  return { overdue, dueToday, upcoming, today };
}
