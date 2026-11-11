import "fake-indexeddb/auto";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "../db";
import type { TaskRecord } from "../types";
import { useTodoStore } from "./todoStore";

let revision = 0;
const task = (id: string, patch: Partial<TaskRecord> = {}): TaskRecord => ({
  id,
  listId: "source",
  title: id,
  note: "",
  priority: "none",
  scheduledDate: null,
  scheduledTime: null,
  dueDate: null,
  completedAt: null,
  tags: [],
  parentId: null,
  sortOrder: 0,
  repeatRule: null,
  createdAt: 1,
  updatedAt: revision,
  deletedAt: null,
  ...patch,
});

beforeAll(async () => {
  vi.stubGlobal("window", {
    setTimeout,
    clearTimeout,
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal("document", {
    documentElement: { dataset: {}, style: {}, lang: "zh-CN" },
  });
  await useTodoStore.getState().bootstrap();
});

beforeEach(async () => {
  revision += 1;
  await db.transaction(
    "rw",
    db.tasks,
    db.lists,
    db.settings,
    db.pomodoroRecords,
    async () => {
      await db.tasks.clear();
      await db.lists.clear();
      await db.pomodoroRecords.clear();
      await db.lists.bulkPut(
        ["source", "target"].map((id, sortOrder) => ({
          id,
          name: id,
          color: "",
          sortOrder,
          createdAt: 1,
          updatedAt: revision,
          deletedAt: null,
        })),
      );
      await db.tasks.bulkPut([
        task("root"),
        task("child", { parentId: "root" }),
        task("other"),
      ]);
      await db.settings.update("app", { theme: "light", updatedAt: revision });
    },
  );
  useTodoStore.setState({
    selectedListId: null,
    selectedTaskId: null,
    checkedIds: [],
  });
  await vi.waitFor(() => {
    const state = useTodoStore.getState();
    expect(state.tasks).toHaveLength(3);
    expect(state.tasks.every((item) => item.updatedAt === revision)).toBe(true);
    expect(state.lists).toHaveLength(2);
    expect(state.pomodoroRecords).toHaveLength(0);
    expect(state.theme).toBe("light");
  });
});

afterEach(() => vi.restoreAllMocks());
afterAll(() => {
  db.close();
  vi.unstubAllGlobals();
});

describe("task writes preserve concurrent changes", () => {
  it("keeps undefined task fields and clears only explicit nulls", async () => {
    await db.tasks.update("root", { note: "kept", dueDate: "2026-11-20", scheduledTime: "09:30" });
    await useTodoStore.getState().updateTask("root", { note: undefined, dueDate: undefined, scheduledTime: null });
    expect(await db.tasks.get("root")).toMatchObject({ note: "kept", dueDate: "2026-11-20", scheduledTime: null });
  });

  it("rolls back every task tree when a later batch move fails", async () => {
    useTodoStore.setState({ checkedIds: ["root", "other"] });
    const failSecondTree = (changes: Partial<TaskRecord>, id: string) => {
      if (id === "other" && changes.listId === "target") throw new Error("second tree failed");
    };
    db.tasks.hook("updating", failSecondTree);
    try {
      await expect(useTodoStore.getState().batchMove(["root", "other"], "target")).rejects.toThrow("second tree failed");
    } finally {
      db.tasks.hook("updating").unsubscribe(failSecondTree);
    }
    expect((await db.tasks.toArray()).map(row => row.listId)).toEqual(["source", "source", "source"]);
    expect(useTodoStore.getState().checkedIds).toEqual(["root", "other"]);
  });

  it("keeps concurrent tag additions and removes only the requested tag", async () => {
    const { addTaskTag, removeTaskTag } = useTodoStore.getState();
    await Promise.all([addTaskTag("root", "first"), addTaskTag("root", "second")]);
    expect((await db.tasks.get("root"))?.tags).toEqual(["first", "second"]);
    await Promise.all([removeTaskTag("root", "first"), addTaskTag("root", "third")]);
    expect((await db.tasks.get("root"))?.tags).toEqual(["second", "third"]);
    await addTaskTag("root", "third");
    expect((await db.tasks.get("root"))?.tags).toEqual(["second", "third"]);
  });

  it("removes exact legacy tag values without normalizing another tag", async () => {
    await db.tasks.update("root", { tags: [" keep ", "keep", ""] });
    await useTodoStore.getState().removeTaskTag("root", " keep ");
    expect((await db.tasks.get("root"))?.tags).toEqual(["keep", ""]);
    await useTodoStore.getState().removeTaskTag("root", "");
    expect((await db.tasks.get("root"))?.tags).toEqual(["keep"]);
  });

  it("does not revive a deleted task through a late tag change", async () => {
    await useTodoStore.getState().deleteTask("root");
    await useTodoStore.getState().addTaskTag("root", "late");
    expect(await db.tasks.get("root")).toMatchObject({ tags: [], deletedAt: expect.any(Number) });
  });

  it("keeps both fields when edits are submitted together", async () => {
    const { updateTask } = useTodoStore.getState();
    await Promise.all([
      updateTask("root", { title: "  Updated title  " }),
      updateTask("root", { note: "Updated note" }),
    ]);
    expect(await db.tasks.get("root")).toMatchObject({
      title: "Updated title",
      note: "Updated note",
    });
  });

  it("keeps a deadline when changing the planned day at the same time", async () => {
    const { setTaskDueDate, setTaskScheduledDate } = useTodoStore.getState();
    await Promise.all([
      setTaskDueDate("root", "2026-11-20"),
      setTaskScheduledDate("root", "2026-11-15"),
    ]);
    expect(await db.tasks.get("root")).toMatchObject({
      dueDate: "2026-11-20",
      scheduledDate: "2026-11-15",
    });
  });

  it("keeps completion when editing the note at the same time", async () => {
    const { toggleTask, updateTask } = useTodoStore.getState();
    await Promise.all([
      toggleTask("root"),
      updateTask("root", { note: "Done" }),
    ]);
    const saved = await db.tasks.get("root");
    expect(saved?.completedAt).not.toBeNull();
    expect(saved?.note).toBe("Done");
  });

  it("moves a task and its children without losing a concurrent edit", async () => {
    const { updateTask } = useTodoStore.getState();
    await Promise.all([
      updateTask("root", { listId: "target", title: "Moved task" }),
      updateTask("root", { note: "Keep this note" }),
    ]);
    expect(await db.tasks.get("root")).toMatchObject({
      listId: "target",
      title: "Moved task",
      note: "Keep this note",
    });
    expect(await db.tasks.get("child")).toMatchObject({ listId: "target" });
    expect(useTodoStore.getState().selectedTaskId).toBeNull();
    expect(useTodoStore.getState().selectedListId).toBeNull();
  });

  it("does not resurrect a deleted task when an earlier edit finishes", async () => {
    const { updateTask, deleteTask } = useTodoStore.getState();
    await Promise.all([
      updateTask("root", { note: "Last edit" }),
      deleteTask("root"),
    ]);
    expect((await db.tasks.get("root"))?.deletedAt).not.toBeNull();
    expect((await db.tasks.get("child"))?.deletedAt).not.toBeNull();
  });

  it("clears the planned time together with the planned day", async () => {
    await useTodoStore
      .getState()
      .updateTask("root", {
        scheduledDate: "2026-11-15",
        scheduledTime: "09:00",
      });
    await useTodoStore.getState().setTaskScheduledDate("root", null);
    expect(await db.tasks.get("root")).toMatchObject({
      scheduledDate: null,
      scheduledTime: null,
    });
  });

  it("rolls back the entire task move if saving the edited fields fails", async () => {
    const put = db.tasks.put.bind(db.tasks);
    vi.spyOn(db.tasks, "put").mockImplementation((record, key) => {
      if (record.id === "root" && record.note === "Fail this write")
        throw new Error("Write failed");
      return put(record, key);
    });
    await expect(
      useTodoStore
        .getState()
        .updateTask("root", { listId: "target", note: "Fail this write" }),
    ).rejects.toThrow("Write failed");
    expect(await db.tasks.get("root")).toMatchObject({
      listId: "source",
      note: "",
    });
    expect(await db.tasks.get("child")).toMatchObject({ listId: "source" });
  });
});

describe("live database snapshots", () => {
  it("changes settings without rereading or replacing unrelated collections", async () => {
    const before = useTodoStore.getState();
    const taskReads = vi.spyOn(db.tasks, "toArray");
    const listReads = vi.spyOn(db.lists, "toArray");
    await db.settings.update("app", { theme: "dark" });
    await vi.waitFor(() => expect(useTodoStore.getState().theme).toBe("dark"));
    const after = useTodoStore.getState();
    expect(taskReads).not.toHaveBeenCalled();
    expect(listReads).not.toHaveBeenCalled();
    for (const key of [
      "tasks",
      "lists",
      "habits",
      "habitCheckIns",
      "anime",
      "pomodoroRecords",
    ] as const) {
      expect(after[key]).toBe(before[key]);
    }
  });

  it("preserves unchanged task objects when another task changes", async () => {
    const before = useTodoStore.getState();
    await db.tasks.update("root", {
      title: "Changed",
      updatedAt: revision + 100,
    });
    await vi.waitFor(() =>
      expect(
        useTodoStore.getState().tasks.find((item) => item.id === "root")?.title,
      ).toBe("Changed"),
    );
    const after = useTodoStore.getState();
    expect(after.tasks).not.toBe(before.tasks);
    expect(after.tasks.find((item) => item.id === "other")).toBe(
      before.tasks.find((item) => item.id === "other"),
    );
    expect(after.lists).toBe(before.lists);
  });

  it("applies restored fields even when the timestamp is unchanged", async () => {
    await db.tasks.update("root", {
      note: "Restored note",
      tags: ["restored"],
      repeatRule: { frequency: "weekly", interval: 1, weekdays: [1, 3] },
    });
    await vi.waitFor(() =>
      expect(
        useTodoStore.getState().tasks.find((item) => item.id === "root"),
      ).toMatchObject({
        note: "Restored note",
        tags: ["restored"],
        updatedAt: revision,
        repeatRule: { frequency: "weekly", interval: 1, weekdays: [1, 3] },
      }),
    );
  });

  it("refreshes a restored focus record with the same id", async () => {
    await db.pomodoroRecords.put({
      id: "session",
      taskId: "root",
      startAt: 1,
      endAt: 60_001,
      duration: 60,
      createdAt: 1,
    });
    await vi.waitFor(() =>
      expect(useTodoStore.getState().pomodoroRecords[0]?.duration).toBe(60),
    );
    await db.pomodoroRecords.update("session", { duration: 30 });
    await vi.waitFor(() =>
      expect(useTodoStore.getState().pomodoroRecords[0]?.duration).toBe(30),
    );
  });

  it("clears deleted selections when the watched collections become empty", async () => {
    useTodoStore.getState().selectList("source");
    useTodoStore.getState().selectTask("root");
    await useTodoStore.getState().deleteList("source");
    await vi.waitFor(() => {
      const state = useTodoStore.getState();
      expect(state.tasks).toEqual([]);
      expect(state.lists.map((list) => list.id)).toEqual(["target"]);
      expect(state.selectedListId).toBeNull();
      expect(state.selectedTaskId).toBeNull();
    });
  });
});
