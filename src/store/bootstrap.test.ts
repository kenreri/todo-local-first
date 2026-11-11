import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { useTodoStore } from "./todoStore";

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

beforeEach(async () => {
  useTodoStore.getState().disposeBootstrap();
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("document", {
    documentElement: { dataset: {}, style: {}, lang: "zh-CN" },
  });
  await db.delete();
  await db.open();
  useTodoStore.setState({ tasks: [], lists: [], selectedListId: null, view: "workspace" });
});
afterEach(async () => {
  useTodoStore.getState().disposeBootstrap();
  vi.restoreAllMocks();
  await db.delete();
  vi.unstubAllGlobals();
});

describe("database startup lifecycle", () => {
  it("reports a failed initial subscription and allows a successful retry", async () => {
    const read = vi.spyOn(db.tasks, "toArray").mockRejectedValueOnce(new Error("storage unavailable"));
    await useTodoStore.getState().bootstrap();
    expect(useTodoStore.getState()).toMatchObject({
      ready: false, startupStatus: "error", startupError: "storage unavailable",
    });
    read.mockRestore();
    await useTodoStore.getState().bootstrap();
    expect(useTodoStore.getState()).toMatchObject({ ready: true, startupStatus: "ready", startupError: null });
    expect(useTodoStore.getState().tasks).toHaveLength(1);
  });

  it("shares the pending initialization and does not duplicate subscriptions", async () => {
    const read = vi.spyOn(db.tasks, "toArray");
    const first = useTodoStore.getState().bootstrap();
    const second = useTodoStore.getState().bootstrap();
    expect(first).toBe(second);
    await first;
    await useTodoStore.getState().bootstrap();
    expect(read).toHaveBeenCalledTimes(1);
    await db.tasks.update(useTodoStore.getState().tasks[0].id, { title: "changed" });
    await vi.waitFor(() => expect(useTodoStore.getState().tasks[0].title).toBe("changed"));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps slow data loading beyond the old three-second deadline", async () => {
    const original = db.tasks.toArray.bind(db.tasks);
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(db.tasks, "toArray").mockImplementationOnce(() => original().then(async tasks => {
      await gate;
      return tasks;
    }));
    const pending = useTodoStore.getState().bootstrap();
    await wait(3100);
    expect(useTodoStore.getState()).toMatchObject({ ready: false, startupStatus: "loading" });
    release();
    await pending;
    expect(useTodoStore.getState().ready).toBe(true);
  });

  it("cleans partial subscriptions after failure and ignores their late responses", async () => {
    const original = db.tasks.toArray.bind(db.tasks);
    let release: () => void = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.spyOn(db.tasks, "toArray").mockImplementationOnce(() => original().then(async tasks => {
      await gate;
      return tasks.map(task => ({ ...task, title: "obsolete" }));
    }));
    vi.spyOn(db.anime, "toArray").mockRejectedValueOnce(new Error("partial failure"));
    await useTodoStore.getState().bootstrap();
    expect(useTodoStore.getState().startupStatus).toBe("error");
    await useTodoStore.getState().bootstrap();
    release();
    await wait(50);
    expect(useTodoStore.getState().ready).toBe(true);
    expect(useTodoStore.getState().tasks[0].title).not.toBe("obsolete");
  });

  it("reports a live subscription failure instead of keeping a stale ready page", async () => {
    await useTodoStore.getState().bootstrap();
    const read = vi.spyOn(db.tasks, "toArray").mockRejectedValueOnce(new Error("read lost"));
    await db.tasks.update(useTodoStore.getState().tasks[0].id, { title: "new title" });
    await vi.waitFor(() => expect(useTodoStore.getState().startupStatus).toBe("error"));
    expect(useTodoStore.getState().ready).toBe(false);
    read.mockRestore();
    await useTodoStore.getState().bootstrap();
    expect(useTodoStore.getState().tasks[0].title).toBe("new title");
  });

  it("disposes subscriptions and resumes without resetting navigation", async () => {
    await useTodoStore.getState().bootstrap();
    useTodoStore.setState({ view: "today", selectedListId: null });
    useTodoStore.getState().disposeBootstrap();
    const read = vi.spyOn(db.tasks, "toArray");
    await db.tasks.update((await db.tasks.toArray())[0].id, { title: "after disposal" });
    read.mockClear();
    await wait(30);
    expect(read).not.toHaveBeenCalled();
    await useTodoStore.getState().bootstrap();
    expect(useTodoStore.getState().view).toBe("today");
    expect(useTodoStore.getState().selectedListId).toBeNull();
    expect(useTodoStore.getState().tasks[0].title).toBe("after disposal");
  });

  it("shows upgrade blocking until the other database connection closes", async () => {
    await db.delete();
    const legacy = new Dexie(db.name);
    legacy.version(8).stores({
      lists: "id, sortOrder, updatedAt, deletedAt",
      tasks: "id, listId, parentId, dueDate, scheduledDate, completedAt, updatedAt, deletedAt, sortOrder",
      settings: "id",
      pomodoroRecords: "id, taskId, startAt, createdAt",
      habits: "id, updatedAt, deletedAt",
      habitCheckIns: "id, habitId, date, status, updatedAt, deletedAt, [habitId+date]",
      anime: "id, status, watchWeekday, updatedAt, deletedAt",
    });
    legacy.on("versionchange", () => false);
    await legacy.open();
    const opening = db.open();
    const pending = useTodoStore.getState().bootstrap();
    try {
      await vi.waitFor(() => expect(useTodoStore.getState().startupStatus).toBe("blocked"));
      expect(useTodoStore.getState().ready).toBe(false);
    } finally {
      legacy.close();
    }
    await opening;
    await pending;
    expect(useTodoStore.getState().startupStatus).toBe("ready");
  });
});
