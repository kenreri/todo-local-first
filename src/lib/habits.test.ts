import { describe, expect, it } from "vitest";
import { calculateHabitStats, isHabitScheduled } from "./habits";
import type { HabitCheckInRecord, HabitRecord } from "../types";

function habit(overrides: Partial<HabitRecord> = {}): HabitRecord {
  return {
    id: "habit-1",
    title: "Read",
    emoji: "📖",
    type: "general",
    frequency: "daily",
    weekdays: [],
    reminderTime: "20:00",
    currentEpisode: 0,
    incrementEpisode: true,
    createdAt: new Date(2026, 7, 1).getTime(),
    updatedAt: 1,
    deletedAt: null,
    ...overrides,
  };
}

function checkIn(date: string): HabitCheckInRecord {
  return {
    id: `check-${date}`,
    habitId: "habit-1",
    date,
    status: "completed",
    episode: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
  };
}

describe("habit schedule and stats", () => {
  it("does not throw when weekly habits are missing weekdays", () => {
    const weekly = habit({ frequency: "weekly", weekdays: undefined as never });
    expect(isHabitScheduled(weekly, "2026-08-03")).toBe(false);
  });

  it("matches only configured weekdays for weekly habits", () => {
    const weekly = habit({ frequency: "weekly", weekdays: [1, 6] });
    expect(isHabitScheduled(weekly, "2026-08-03")).toBe(true);
    expect(isHabitScheduled(weekly, "2026-08-04")).toBe(false);
    expect(isHabitScheduled(weekly, "2026-08-08")).toBe(true);
  });

  it("calculates current, longest and 30-day completion rate", () => {
    const stats = calculateHabitStats(
      habit(),
      [checkIn("2026-08-01"), checkIn("2026-08-02"), checkIn("2026-08-04")],
      "2026-08-04",
    );
    expect(stats.currentStreak).toBe(1);
    expect(stats.longestStreak).toBe(2);
    expect(stats.completionRate).toBe(75);
  });

  it("treats an explicit skip today as a broken current streak", () => {
    const skipped: HabitCheckInRecord = {
      ...checkIn("2026-08-04"),
      status: "skipped",
    };
    const stats = calculateHabitStats(
      habit(),
      [checkIn("2026-08-03"), skipped],
      "2026-08-04",
    );
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestStreak).toBe(1);
  });
});
