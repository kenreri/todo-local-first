import { describe, expect, it } from "vitest";
import { buildDueReminderSummary } from "./dueReminder";
import type { TaskRecord } from "../types";

const baseTask: TaskRecord = {
  id: "task",
  listId: "list",
  title: "Task",
  note: "",
  priority: "none",
  scheduledDate: null,
  dueDate: null,
  completedAt: null,
  tags: [],
  parentId: null,
  sortOrder: 0,
  repeatRule: null,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};

function task(patch: Partial<TaskRecord>): TaskRecord {
  return { ...baseTask, ...patch };
}

describe("buildDueReminderSummary", () => {
  it("counts overdue and due-today root tasks", () => {
    const result = buildDueReminderSummary(
      [
        task({ id: "today", dueDate: "2026-09-24" }),
        task({ id: "overdue", dueDate: "2026-09-20" }),
        task({ id: "future", dueDate: "2026-09-25" }),
      ],
      "2026-09-24",
    );

    expect(result.total).toBe(2);
    expect(result.overdue).toBe(1);
    expect(result.dueToday).toBe(1);
    expect(result.tasks.map((item) => item.id)).toEqual(["overdue", "today"]);
  });

  it("ignores completed tasks and subtasks", () => {
    const result = buildDueReminderSummary(
      [
        task({ id: "completed", dueDate: "2026-09-20", completedAt: 1 }),
        task({ id: "subtask", dueDate: "2026-09-20", parentId: "parent" }),
      ],
      "2026-09-24",
    );

    expect(result).toMatchObject({ total: 0, overdue: 0, dueToday: 0 });
  });
});
