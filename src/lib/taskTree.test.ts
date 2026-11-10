import { describe, expect, it } from "vitest";
import {
  collectTaskTreeIds,
  sortRootTasksForDisplay,
  sortTasksByManualOrder,
} from "./taskTree";
import type { Priority, TaskRecord } from "../types";

function task(
  id: string,
  parentId: string | null,
  sortOrder = 0,
  patch: Partial<TaskRecord> = {},
): TaskRecord {
  return {
    id,
    listId: "list-1",
    title: id,
    note: "",
    priority: "none",
    dueDate: null,
    scheduledDate: null,
    completedAt: null,
    tags: [],
    parentId,
    sortOrder,
    repeatRule: null,
    createdAt: sortOrder,
    updatedAt: sortOrder,
    deletedAt: null,
    ...patch,
  };
}

describe("task tree helpers", () => {
  it("collects every descendant without including unrelated tasks", () => {
    const tasks = [
      task("root", null),
      task("child", "root"),
      task("grandchild", "child"),
      task("other", null),
    ];
    expect([...collectTaskTreeIds(tasks, ["root"])]).toEqual([
      "root",
      "child",
      "grandchild",
    ]);
  });

  it("sorts by persisted manual order", () => {
    expect(
      sortTasksByManualOrder([
        task("later", null, 3),
        task("first", null, 0),
      ]).map((item) => item.id),
    ).toEqual(["first", "later"]);
  });

  it("partitions incomplete before completed while keeping zone order", () => {
    expect(
      sortRootTasksForDisplay([
        task("done-early", null, 0, { completedAt: 10 }),
        task("active-late", null, 2),
        task("done-late", null, 3, { completedAt: 20 }),
        task("active-early", null, 1),
      ]).map((item) => item.id),
    ).toEqual(["active-early", "active-late", "done-early", "done-late"]);
  });

  it("keeps priority within the same completion zone", () => {
    const high: Priority = "high";
    const low: Priority = "low";
    expect(
      sortRootTasksForDisplay([
        task("low-active", null, 0, { priority: low }),
        task("high-active", null, 0, { priority: high }),
        task("high-done", null, 0, { priority: high, completedAt: 1 }),
        task("low-done", null, 0, { priority: low, completedAt: 2 }),
      ]).map((item) => item.id),
    ).toEqual(["high-active", "low-active", "high-done", "low-done"]);
  });

  it("priority wins over manual order when reordering after a priority change", () => {
    const high: Priority = "high";
    const medium: Priority = "medium";
    const low: Priority = "low";
    expect(
      sortRootTasksForDisplay([
        task("dragged-first", null, 0, { priority: low }),
        task("dragged-second", null, 1, { priority: medium }),
        task("dragged-third", null, 2, { priority: high }),
      ]).map((item) => item.id),
    ).toEqual(["dragged-third", "dragged-second", "dragged-first"]);
  });
});
