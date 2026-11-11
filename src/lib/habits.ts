import { addDays, parseDateKey, toDateKey } from "./dates";
import type { HabitCheckInRecord, HabitRecord } from "../types";

export function isHabitScheduled(habit: HabitRecord, dateKey: string) {
  if (habit.deletedAt != null) return false;
  const startDate = toDateKey(new Date(habit.createdAt));
  if (dateKey < startDate) return false;
  if (habit.frequency === "daily") return true;
  return (habit.weekdays ?? []).includes(parseDateKey(dateKey).getDay());
}

export function getHabitCheckIn(
  checkIns: HabitCheckInRecord[],
  habitId: string,
  date: string,
) {
  return checkIns.find(
    (item) =>
      item.habitId === habitId && item.date === date && item.deletedAt == null,
  );
}

export function calculateHabitStats(
  habit: HabitRecord,
  checkIns: HabitCheckInRecord[],
  today: string,
) {
  const completedDates = new Set(
    checkIns
      .filter(
        (item) =>
          item.habitId === habit.id &&
          item.status === "completed" &&
          item.deletedAt == null &&
          item.date <= today,
      )
      .map((item) => item.date),
  );
  const skippedDates = new Set(
    checkIns
      .filter(
        (item) =>
          item.habitId === habit.id &&
          item.status === "skipped" &&
          item.deletedAt == null &&
          item.date <= today,
      )
      .map((item) => item.date),
  );

  let longestStreak = 0;
  let runningStreak = 0;
  let cursor = toDateKey(new Date(habit.createdAt));
  while (cursor <= today) {
    if (isHabitScheduled(habit, cursor)) {
      if (completedDates.has(cursor)) {
        runningStreak += 1;
        longestStreak = Math.max(longestStreak, runningStreak);
      } else {
        runningStreak = 0;
      }
    }
    cursor = addDays(cursor, 1);
  }

  let currentStreak = 0;
  cursor = today;
  while (cursor >= toDateKey(new Date(habit.createdAt))) {
    if (isHabitScheduled(habit, cursor)) {
      if (!completedDates.has(cursor)) {
        if (cursor === today && !skippedDates.has(cursor)) {
          cursor = addDays(cursor, -1);
          continue;
        }
        break;
      }
      currentStreak += 1;
    }
    cursor = addDays(cursor, -1);
  }

  const periodStart = addDays(today, -29);
  let scheduled = 0;
  let completed = 0;
  cursor = periodStart;
  while (cursor <= today) {
    if (isHabitScheduled(habit, cursor)) {
      scheduled += 1;
      if (completedDates.has(cursor)) completed += 1;
    }
    cursor = addDays(cursor, 1);
  }

  return {
    currentStreak,
    longestStreak,
    completedLast30Days: completed,
    scheduledLast30Days: scheduled,
    completionRate:
      scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
  };
}

export type HabitEditFields = Pick<HabitRecord, 'title' | 'emoji' | 'frequency' | 'weekdays' | 'reminderTime'>;

/** Preserve fields changed elsewhere while this explicit-save form was open. */
export function habitEditPatch(before: HabitEditFields, after: HabitEditFields): Partial<HabitEditFields> {
  const patch: Partial<HabitEditFields> = {};
  if (before.title !== after.title) patch.title = after.title;
  if (before.emoji !== after.emoji) patch.emoji = after.emoji;
  if (before.frequency !== after.frequency) patch.frequency = after.frequency;
  if (before.reminderTime !== after.reminderTime) patch.reminderTime = after.reminderTime;
  const oldDays = [...new Set(before.weekdays)].sort();
  const newDays = [...new Set(after.weekdays)].sort();
  if (oldDays.length !== newDays.length || oldDays.some((day, index) => day !== newDays[index])) patch.weekdays = newDays;
  return patch;
}
