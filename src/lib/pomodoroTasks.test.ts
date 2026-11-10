import { describe, expect, it } from "vitest";
import {
  ALL_FOCUS_LISTS,
  buildFocusTaskGroups,
  countFocusableTasksByList,
} from "./pomodoroTasks";
import type { ListRecord, TaskRecord } from "../types";

function list(id: string, sortOrder: number): ListRecord {
  return {
    id,
    name: id,
    color: "var(--accent)",
    sortOrder,
    createdAt: sortOrder,
    updatedAt: sortOrder,
    deletedAt: null,
  };
}

function task(
  id: string,
  listId: string,
  patch: Partial<TaskRecord> = {},
): TaskRecord {
  return {
    id,
    listId,
    title: id,
    note: "",
    priority: "none",
    dueDate: null,
    scheduledDate: null,
    completedAt: null,
    tags: [],
    parentId: null,
    sortOrder: 0,
    repeatRule: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...patch,
  };
}

describe("pomodoro task grouping", () => {
  const lists = [list("work", 0), list("study", 1)];
  const tasks = [
    task("future", "work", { dueDate: "2026-08-22", priority: "high" }),
    task("today", "work", { dueDate: "2026-08-20", priority: "low" }),
    task("typescript", "study", {
      note: "read handbook",
      tags: ["learning"],
    }),
    task("done", "study", { completedAt: 10 }),
    task("child", "study", { parentId: "typescript" }),
  ];

  it("keeps every list in the all-tasks view and prioritizes due work", () => {
    const groups = buildFocusTaskGroups({
      tasks,
      lists,
      listId: ALL_FOCUS_LISTS,
      today: "2026-08-20",
    });

    expect(groups.map((group) => group.list.id)).toEqual(["work", "study"]);
    expect(groups[0].tasks.map((item) => item.id)).toEqual(["today", "future"]);
    expect(groups[1].tasks.map((item) => item.id)).toEqual(["typescript"]);
  });

  it("filters by one list without losing the all-tasks source", () => {
    const groups = buildFocusTaskGroups({
      tasks,
      lists,
      listId: "study",
      query: "LEARNING",
      today: "2026-08-20",
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((item) => item.id)).toEqual(["typescript"]);
    expect(countFocusableTasksByList(tasks).get("study")).toBe(1);
  });
});
