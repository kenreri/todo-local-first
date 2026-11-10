import { afterEach, describe, expect, it } from "vitest";
import { selectVisibleRootTasks, useTodoStore } from "./todoStore";
import type { TaskRecord } from "../types";
const task = (id: string, listId: string, patch: Partial<TaskRecord> = {}): TaskRecord => ({
  id, listId, title: id, note: "", priority: "none", scheduledDate: null, dueDate: null,
  completedAt: null, tags: [], parentId: null, sortOrder: 0, repeatRule: null,
  createdAt: 1, updatedAt: 1, deletedAt: null, ...patch,
});
const tasks = [task("study", "study-list"), task("capture", "inbox"), task("done", "study-list", {completedAt: 1}), task("child", "inbox", {parentId:"capture"}), task("deleted", "inbox", {deletedAt:1})];
const visible = (selectedListId: string | null, search = "", filter: "all" | "active" | "completed" = "all") => selectVisibleRootTasks({tasks, selectedListId, search, filter}).map(t => t.id);
afterEach(() => useTodoStore.setState({tasks: [], view:"list", selectedListId:null, selectedTaskId:null, checkedIds:[]}));
describe("task list scope", () => {
  it("shows roots across lists without deleted records in all-task mode", () => {
    expect(visible(null).sort()).toEqual(["capture", "done", "study"]);
  });
  it("keeps a chosen list isolated and supports search and completion filters globally", () => {
    expect(visible("inbox")).toEqual(["capture"]);
    expect(visible(null, "study")).toEqual(["study"]);
    expect(visible(null, "", "completed")).toEqual(["done"]);
    expect(visible(null, "", "active").sort()).toEqual(["capture", "study"]);
  });
  it("does not narrow all-task scope when opening and closing a task", () => {
    useTodoStore.setState({tasks, view:"list", selectedListId:null});
    useTodoStore.getState().selectTask("study");
    expect(useTodoStore.getState().selectedListId).toBeNull();
    useTodoStore.getState().selectTask(null);
    expect(useTodoStore.getState().selectedListId).toBeNull();
  });
  it("keeps explicit list selection and clears stale bulk selection", () => {
    useTodoStore.setState({tasks, view:"list", selectedListId:null, checkedIds:["capture"]});
    useTodoStore.getState().selectList("study-list");
    useTodoStore.getState().selectTask("study");
    expect(useTodoStore.getState().selectedListId).toBe("study-list");
    expect(useTodoStore.getState().checkedIds).toEqual([]);
  });
});
