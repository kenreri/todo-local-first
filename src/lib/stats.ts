import { addDays, todayKey, toDateKey } from "./dates";
import type { PomodoroRecord, TaskRecord } from "../types";

function recentDateRange(days: number, end: string) {
  const length = Math.max(1, Math.floor(days));
  return { length, start: addDays(end, -(length - 1)), end };
}

function isTimestampInRange(timestamp: number, start: string, end: string) {
  const key = toDateKey(new Date(timestamp));
  return key >= start && key <= end;
}

export function buildCompletionTrend(tasks: TaskRecord[], days = 14, endDate = todayKey()) {
  const { length, start } = recentDateRange(days, endDate);
  const map = new Map<string, number>();
  for (let i = 0; i < length; i += 1) {
    map.set(addDays(start, i), 0);
  }

  for (const task of tasks) {
    if (!task.completedAt || task.parentId) continue;
    const key = toDateKey(new Date(task.completedAt));
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }

  return [...map.entries()].map(([date, count]) => ({ date, count }));
}

export function buildCompletionRate(tasks: TaskRecord[], days = 14, endDate = todayKey()) {
  const { start, end } = recentDateRange(days, endDate);
  const roots = tasks.filter(
    (task) =>
      task.parentId == null && isTimestampInRange(task.createdAt, start, end),
  );
  const total = roots.length;
  const completed = roots.filter((task) => task.completedAt != null).length;
  return {
    total,
    completed,
    rate: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function buildTagDistribution(tasks: TaskRecord[], days = 14, endDate = todayKey()) {
  const { start, end } = recentDateRange(days, endDate);
  const map = new Map<string, number>();
  for (const task of tasks) {
    if (
      task.parentId ||
      task.completedAt == null ||
      !isTimestampInRange(task.completedAt, start, end)
    )
      continue;
    for (const tag of task.tags ?? []) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildFocusMinutes(records: PomodoroRecord[], days = 14, endDate = todayKey()) {
  const { length, start } = recentDateRange(days, endDate);
  const map = new Map<string, number>();
  for (let i = 0; i < length; i += 1) {
    map.set(addDays(start, i), 0);
  }

  for (const record of records) {
    const key = toDateKey(new Date(record.endAt));
    if (!map.has(key)) continue;
    map.set(key, (map.get(key) ?? 0) + record.duration);
  }

  return [...map.entries()].map(([date, seconds]) => ({
    date,
    minutes: Math.round(seconds / 60),
  }));
}

export function totalFocusMinutes(records: PomodoroRecord[], days = 14, endDate = todayKey()) {
  const { start, end } = recentDateRange(days, endDate);
  return Math.round(
    records
      .filter((item) => isTimestampInRange(item.endAt, start, end))
      .reduce((sum, item) => sum + item.duration, 0) / 60,
  );
}

export function buildReviewInsights(tasks: TaskRecord[], records: PomodoroRecord[], days = 14, endDate = todayKey()) {
  const { start, end } = recentDateRange(days, endDate);
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(days - 1));
  const countCompleted = (from: string, to: string) =>
    tasks.filter((task) => !task.parentId && task.completedAt != null &&
      isTimestampInRange(task.completedAt, from, to)).length;
  const focusSeconds = (from: string, to: string) =>
    records.filter((record) => isTimestampInRange(record.endAt, from, to))
      .reduce((sum, record) => sum + record.duration, 0);
  const completed = countCompleted(start, end);
  const minutes = Math.round(focusSeconds(start, end) / 60);
  const trend = buildCompletionTrend(tasks, days, endDate);
  const bestDay = trend.reduce((best, day) => day.count > best.count ? day : best, trend[0]);
  const activeFocusDays = new Set(records.filter((record) =>
    record.duration > 0 && isTimestampInRange(record.endAt, start, end))
    .map((record) => toDateKey(new Date(record.endAt)))).size;
  return {
    completed, minutes, bestDay, activeFocusDays,
    hasActivity: completed > 0 || activeFocusDays > 0,
    completionDelta: completed - countCompleted(previousStart, previousEnd),
    focusDelta: minutes - Math.round(focusSeconds(previousStart, previousEnd) / 60),
    averageFocusMinutes: activeFocusDays ? Math.round(minutes / activeFocusDays) : 0,
  };
}
