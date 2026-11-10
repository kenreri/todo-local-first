import { describe, expect, it } from "vitest";
import { expandTaskOccurrences, todayBuckets } from "./repeat";
import type { TaskRecord } from "../types";

function baseTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-1",
    listId: "list-1",
    title: "Task",
    note: "",
    priority: "none",
    dueDate: null,
    scheduledDate: null,
    completedAt: null,
    tags: [],
    parentId: null,
    sortOrder: 0,
    repeatRule: null,
    createdAt: new Date(2026, 7, 1).getTime(),
    updatedAt: new Date(2026, 7, 1).getTime(),
    deletedAt: null,
    ...overrides,
  };
}

function repeatingTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return baseTask({
    title: "Repeat",
    dueDate: "2026-08-01",
    repeatRule: { frequency: "daily", interval: 1, endDate: null },
    ...overrides,
  });
}

describe("repeat rules", () => {
  it("keeps only the current actionable occurrence in Today", () => {
    const buckets = todayBuckets([repeatingTask()], new Date(2026, 7, 20, 12));
    expect(buckets.overdue).toHaveLength(1);
    expect(buckets.overdue[0]?.date).toBe("2026-08-01");
  });

  it("expands selected weekdays for a custom rule", () => {
    const task = repeatingTask({
      dueDate: "2026-08-03",
      repeatRule: {
        frequency: "custom",
        interval: 1,
        weekdays: [1, 3],
        endDate: null,
      },
    });
    expect(
      expandTaskOccurrences(task, "2026-08-03", "2026-08-09").map(
        (item) => item.date,
      ),
    ).toEqual(["2026-08-03", "2026-08-05"]);
  });
});

describe("scheduledDate vs dueDate", () => {
  it("places a long-term task on scheduledDate in Today", () => {
    const task = baseTask({
      dueDate: "2026-09-30",
      scheduledDate: "2026-08-21",
    });
    const buckets = todayBuckets([task], new Date(2026, 7, 20, 12));
    expect(buckets.dueToday).toHaveLength(0);
    expect(buckets.upcoming.map((item) => item.date)).toEqual(["2026-08-21"]);
  });

  it("keeps missed deadlines overdue even when scheduled later", () => {
    const task = baseTask({
      dueDate: "2026-08-10",
      scheduledDate: "2026-08-25",
    });
    const buckets = todayBuckets([task], new Date(2026, 7, 20, 12));
    expect(buckets.overdue).toHaveLength(1);
    expect(buckets.upcoming).toHaveLength(0);
  });

  it("expands calendar placement by scheduledDate first", () => {
    const task = baseTask({
      dueDate: "2026-09-30",
      scheduledDate: "2026-08-22",
    });
    expect(
      expandTaskOccurrences(task, "2026-08-01", "2026-08-31").map(
        (item) => item.date,
      ),
    ).toEqual(["2026-08-22"]);
  });
});
