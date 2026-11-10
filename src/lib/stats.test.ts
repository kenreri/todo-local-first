import { describe, expect, it } from "vitest";
import { addDays, parseDateKey, todayKey } from "./dates";
import {
  buildCompletionRate,
  buildCompletionTrend,
  buildFocusMinutes,
  buildTagDistribution,
  buildReviewInsights,
  totalFocusMinutes,
} from "./stats";
import type { PomodoroRecord, TaskRecord } from "../types";

function timestampAtOffset(offset: number) {
  const date = parseDateKey(addDays(todayKey(), offset));
  date.setHours(12);
  return date.getTime();
}

function task(
  id: string,
  createdOffset: number,
  completedOffset: number | null,
  tags: string[] = [],
  parentId: string | null = null,
): TaskRecord {
  return {
    id,
    listId: "list-1",
    title: id,
    note: "",
    priority: "none",
    dueDate: null,
    scheduledDate: null,
    completedAt:
      completedOffset == null ? null : timestampAtOffset(completedOffset),
    tags,
    parentId,
    sortOrder: 0,
    repeatRule: null,
    createdAt: timestampAtOffset(createdOffset),
    updatedAt: timestampAtOffset(completedOffset ?? createdOffset),
    deletedAt: null,
  };
}

function focusRecord(
  id: string,
  endOffset: number,
  duration: number,
): PomodoroRecord {
  const endAt = timestampAtOffset(endOffset);
  return {
    id,
    taskId: null,
    startAt: endAt - duration * 1_000,
    endAt,
    duration,
    createdAt: endAt,
  };
}

describe("stats date ranges", () => {
  it("compares adjacent periods and includes older tasks completed recently", () => {
    const insights = buildReviewInsights([
      task("old-recent", -30, -1),
      task("previous", -10, -8),
      task("child", -1, -1, [], "old-recent"),
    ], [focusRecord("recent", -1, 120), focusRecord("previous", -8, 60)], 7);
    expect(insights).toMatchObject({
      completed: 1, minutes: 2, completionDelta: 0, focusDelta: 1,
      activeFocusDays: 1, averageFocusMinutes: 2, hasActivity: true,
    });
    expect(buildReviewInsights([], [], 7).hasActivity).toBe(false);
  });
  it("applies the selected window to completion KPIs and tags", () => {
    const tasks = [
      task("recent-done", -2, -1, ["work"]),
      task("recent-open", -3, null),
      task("old-done", -20, -20, ["old"]),
      task("old-created-recent-done", -20, -1, ["return"]),
      task("subtask", -1, -1, ["child"], "recent-done"),
    ];

    expect(buildCompletionRate(tasks, 7)).toEqual({
      total: 2,
      completed: 1,
      rate: 50,
    });
    expect(
      buildCompletionTrend(tasks, 7).reduce((sum, item) => sum + item.count, 0),
    ).toBe(2);
    expect(buildTagDistribution(tasks, 7)).toEqual([
      { tag: "work", count: 1 },
      { tag: "return", count: 1 },
    ]);
  });

  it("limits focus totals to the selected window", () => {
    const records = [
      focusRecord("recent-a", -1, 90),
      focusRecord("recent-b", -1, 30),
      focusRecord("old", -20, 600),
    ];

    const daily = buildFocusMinutes(records, 7);
    expect(daily.reduce((sum, item) => sum + item.minutes, 0)).toBe(2);
    expect(totalFocusMinutes(records, 7)).toBe(2);
  });
});
