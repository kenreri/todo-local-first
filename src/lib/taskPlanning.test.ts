import { describe, expect, it } from "vitest";
import { dailyPlan, planningLabel, validScheduledTime } from "./taskPlanning";
import { nextOccurrenceAfter } from "./repeat";
import type { TaskRecord } from "../types";

function task(patch: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task", listId: "inbox", title: "Task", note: "", priority: "none",
    scheduledDate: null, dueDate: null, completedAt: null, tags: [], parentId: null,
    sortOrder: 0, repeatRule: null, createdAt: new Date("2026-09-01T12:00:00").getTime(),
    updatedAt: 1, deletedAt: null, ...patch,
  };
}

describe("daily planning", () => {
  it("keeps carry-over separate, while preserving explicit today choices even past a deadline", () => {
    const plan = dailyPlan([
      task({ id: "previous", scheduledDate: "2026-10-02" }),
      task({ id: "today", scheduledDate: "2026-10-03", dueDate: "2026-10-01" }),
      task({ id: "later", scheduledDate: "2026-10-04" }),
      task({ id: "capture" }),
    ], "2026-10-03");
    expect(plan.current.map(item => item.task.id)).toEqual(["today"]);
    expect(plan.previous.map(item => item.task.id)).toEqual(["previous"]);
    expect(plan.upcoming.map(item => item.task.id)).toEqual(["later"]);
  });

  it("keeps deadline-only tasks visible and excludes completed, deleted and child tasks", () => {
    const plan = dailyPlan([
      task({ id: "deadline", dueDate: "2026-10-03" }),
      task({ id: "late", dueDate: "2026-10-01" }),
      task({ completedAt: 1, scheduledDate: "2026-10-03" }),
      task({ deletedAt: 1, scheduledDate: "2026-10-03" }),
      task({ parentId: "parent", scheduledDate: "2026-10-03" }),
    ], "2026-10-03");
    expect(plan.current.map(item => item.task.id)).toEqual(["deadline"]);
    expect(plan.previous.map(item => item.task.id)).toEqual(["late"]);
  });

  it("does not accumulate missed recurring dates and advances from the displayed occurrence", () => {
    const recurring = task({ dueDate: "2026-09-01", repeatRule: { frequency: "daily", interval: 1 } });
    const plan = dailyPlan([recurring], "2026-10-03");
    expect(plan.current).toHaveLength(1);
    expect(plan.current[0].date).toBe("2026-10-03");
    expect(plan.previous).toEqual([]);
    expect(plan.upcoming).toEqual([]);
    expect(nextOccurrenceAfter(recurring, plan.current[0].date)).toBe("2026-10-04");
  });

  it("honors custom weekdays, end dates and manual scheduling without duplicate occurrences", () => {
    const weekly = task({ dueDate: "2026-09-01", repeatRule: { frequency: "custom", interval: 1, weekdays: [1] } });
    expect(dailyPlan([weekly], "2026-10-03").current).toEqual([]);
    expect(dailyPlan([weekly], "2026-10-03").upcoming).toHaveLength(1);
    expect(dailyPlan([{ ...weekly, scheduledDate: "2026-10-03" }], "2026-10-03").current).toHaveLength(1);
    expect(dailyPlan([{ ...weekly, repeatRule: { ...weekly.repeatRule!, endDate: "2026-09-30" } }], "2026-10-03").upcoming).toEqual([]);
  });

  it("formats relative plans and validates optional local times", () => {
    expect(planningLabel(null, "zh", "2026-10-03")).toBe("待安排");
    expect(planningLabel("2026-10-03", "zh", "2026-10-03")).toBe("今天做");
    expect(planningLabel("2026-10-04", "en", "2026-10-03")).toBe("Tomorrow");
    expect(validScheduledTime(undefined)).toBe(true);
    expect(validScheduledTime("23:59")).toBe(true);
    expect(validScheduledTime("24:00")).toBe(false);
    expect(validScheduledTime("09:60")).toBe(false);
  });
});
