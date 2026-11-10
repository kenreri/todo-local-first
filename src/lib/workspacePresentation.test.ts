import { describe, expect, it } from "vitest";
import type { TaskRecord } from "../types";
import {
  workspaceAgenda,
  workspaceDisplayTitle,
  workspaceExcerpt,
} from "./workspacePresentation";
import {
  draftPatch,
  setWorkspaceDraft,
  useWorkspaceUiStore,
} from "../store/workspaceUiStore";

const base: TaskRecord = {
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
  sortOrder: 1,
  repeatRule: null,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: null,
};
const task = (id: string, changes: Partial<TaskRecord>): TaskRecord => ({
  ...base,
  id,
  ...changes,
});

describe("workspace agenda", () => {
  it("separates explicit plans from deadlines without treating a due date as a plan", () => {
    const agenda = workspaceAgenda(
      [
        task("planned", { scheduledDate: "2026-11-11", dueDate: "2026-11-15" }),
        task("due-only", { dueDate: "2026-11-11" }),
        task("later", { scheduledDate: "2026-11-12", dueDate: "2026-11-11" }),
      ],
      "2026-11-11",
    );
    expect(agenda.today.map((item) => item.task.id)).toEqual(["planned"]);
    expect(agenda.upcoming.map((item) => item.id)).toEqual([
      "due-only",
      "later",
      "planned",
    ]);
  });
  it("keeps overdue deadlines separate from upcoming deadlines", () => {
    const agenda = workspaceAgenda(
      [
        task("future", { dueDate: "2026-11-13" }),
        task("older", { dueDate: "2026-11-09" }),
        task("yesterday", { dueDate: "2026-11-10" }),
      ],
      "2026-11-11",
    );
    expect(agenda.overdue.map((item) => item.id)).toEqual([
      "older",
      "yesterday",
    ]);
    expect(agenda.upcoming.map((item) => item.id)).toEqual(["future"]);
  });
  it("excludes deleted, completed and child tasks", () => {
    const agenda = workspaceAgenda(
      [
        task("deleted", { deletedAt: 1, dueDate: "2026-11-10" }),
        task("done", { completedAt: 1, scheduledDate: "2026-11-11" }),
        task("child", { parentId: "parent", dueDate: "2026-11-11" }),
      ],
      "2026-11-11",
    );
    expect(agenda).toEqual({ today: [], overdue: [], upcoming: [] });
  });
  it("keeps today's virtual recurring occurrence without copying tasks", () => {
    const recurring = task("repeat", {
      dueDate: "2026-11-09",
      repeatRule: { frequency: "daily", interval: 1 },
    });
    const snapshot = structuredClone(recurring);
    const agenda = workspaceAgenda([recurring], "2026-11-11");
    expect(agenda.today.map((item) => item.task.id)).toEqual(["repeat"]);
    expect(recurring).toEqual(snapshot);
  });
});

describe("material browsing and drafts", () => {
  it("uses a readable app destination for URI-only captures without fetching metadata", () => {
    expect(
      workspaceDisplayTitle(
        "obsidian://open?vault=Notes&file=%E8%AF%BB%E4%B9%A6%2F%E7%AC%94%E8%AE%B0",
      ),
    ).toBe("Obsidian · 读书/笔记");
    expect(workspaceDisplayTitle("论文笔记")).toBe("论文笔记");
  });
  it("shows the useful excerpt without repeating the title or raw app URL", () => {
    expect(
      workspaceExcerpt(
        "阅读笔记",
        "阅读笔记\n理解这段方法。\n[原笔记](obsidian://open?vault=Notes&file=A)",
      ),
    ).toBe("理解这段方法。\n原笔记");
  });
  it("only saves fields the user changed, preserving unrelated concurrent updates", () => {
    const original = {
      title: "标题",
      body: "正文",
      kind: "note" as const,
      intention: "want" as const,
    };
    const patch = draftPatch({
      original,
      values: { ...original, title: "新标题" },
    });
    expect({ ...original, body: "另一处更新的正文", ...patch }).toEqual({
      ...original,
      title: "新标题",
      body: "另一处更新的正文",
    });
  });
  it("retains a draft across view changes and only discards the chosen record", () => {
    const original = {
      title: "标题",
      body: "正文",
      kind: "note" as const,
      intention: "want" as const,
    };
    setWorkspaceDraft("first", {
      original,
      values: { ...original, body: "未保存" },
    });
    setWorkspaceDraft("second", {
      original,
      values: { ...original, title: "另一条" },
    });
    useWorkspaceUiStore.setState({ editingId: "second", search: "标题" });
    expect(useWorkspaceUiStore.getState().drafts.first.values.body).toBe(
      "未保存",
    );
    setWorkspaceDraft("second", null);
    expect(useWorkspaceUiStore.getState().drafts.first.values.body).toBe(
      "未保存",
    );
    expect(useWorkspaceUiStore.getState().drafts.second).toBeUndefined();
    setWorkspaceDraft("first", null);
    useWorkspaceUiStore.setState({ editingId: null, search: "" });
  });
});
