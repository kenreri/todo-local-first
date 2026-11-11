import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "./db";
import {
  DEFAULT_POMODORO_CONFIG,
  type AnimeRecord,
  type HabitCheckInRecord,
  type HabitRecord,
  type ListRecord,
  type PomodoroRecord,
  type SettingsRecord,
  type TaskRecord,
} from "./types";

type LegacyTask = Omit<
  TaskRecord,
  "sortOrder" | "repeatRule" | "scheduledDate" | "scheduledTime"
> & Partial<Pick<TaskRecord, "sortOrder" | "repeatRule" | "scheduledDate" | "scheduledTime">>;
type LegacySettings = Omit<SettingsRecord, "defaultView" | "pomodoroConfig"> &
  Partial<Pick<SettingsRecord, "defaultView" | "pomodoroConfig">>;
type LegacyAnime = Omit<
  AnimeRecord,
  "airKind" | "scheduleMode" | "bgmSubjectId" | "bgmCoverUrl"
> & Partial<Pick<AnimeRecord, "airKind" | "scheduleMode" | "bgmSubjectId" | "bgmCoverUrl">>;

const createdAt = new Date(2026, 7, 24, 9).getTime();
const updatedAt = createdAt + 1_000;
const deletedAt = createdAt + 2_000;
const customConfig = { ...DEFAULT_POMODORO_CONFIG, workMinutes: 37, soundVolume: 23 };
const openedLegacyDatabases: Dexie[] = [];

// Build actual historical stores, without running the current class to manufacture fixtures.
function legacyDatabase(version: number) {
  const legacy = new Dexie(db.name);
  const stores: Record<string, string> = {
    lists: "id, sortOrder, updatedAt, deletedAt",
    tasks: "id, listId, parentId, dueDate, completedAt, updatedAt, deletedAt",
    settings: "id",
  };
  if (version >= 2) stores.tasks += ", sortOrder";
  if (version >= 3) stores.pomodoroRecords = "id, taskId, startAt, createdAt";
  if (version >= 4) {
    stores.habits = version === 4 ? "id, type, updatedAt, deletedAt" : "id, updatedAt, deletedAt";
    stores.habitCheckIns = "id, habitId, date, status, updatedAt, deletedAt, [habitId+date]";
  }
  if (version >= 5) stores.anime = "id, status, watchWeekday, updatedAt, deletedAt";
  if (version >= 6) stores.tasks += ", scheduledDate";
  legacy.version(version).stores(stores);
  openedLegacyDatabases.push(legacy);
  return legacy;
}

function fixtures(version: number) {
  const lists: ListRecord[] = [
    { id: "inbox", name: "收件箱", color: "#0f6e56", sortOrder: 3, createdAt, updatedAt, deletedAt: null },
    { id: "old-list", name: "历史清单", color: "#123456", sortOrder: 9, createdAt, updatedAt, deletedAt },
  ];
  const parent: LegacyTask = {
    id: "parent", listId: "inbox", parentId: null, title: "保留标题", note: "正文\nhttps://example.com/资料",
    priority: "high", dueDate: "2026-09-30", completedAt: null, tags: ["研究", "保留"], createdAt, updatedAt, deletedAt: null,
    ...(version >= 2 ? { sortOrder: 17, repeatRule: null } : {}),
    ...(version >= 6 ? { scheduledDate: "2026-09-27" } : {}),
    ...(version >= 8 ? { scheduledTime: "09:15" } : {}),
  };
  const child: LegacyTask = {
    ...parent, id: "child", parentId: "parent", title: "子任务", createdAt: createdAt + 10,
    ...(version >= 2 ? { sortOrder: 23, repeatRule: { frequency: "weekly", interval: 2, weekdays: [2], endDate: "2027-01-01" } } : {}),
  };
  const removed: LegacyTask = {
    ...parent, id: "removed", listId: "old-list", title: "保留墓碑", completedAt: updatedAt, deletedAt,
  };
  const settings: LegacySettings = {
    id: "app", theme: "dark", locale: "en", seededAt: createdAt, updatedAt,
    wallpaperEnabled: false, sakuraEnabled: false,
    ...(version >= 2 ? { defaultView: "today" } : {}),
    ...(version >= 3 ? { pomodoroConfig: customConfig } : {}),
  };
  const habit: HabitRecord = {
    id: "habit", title: "阅读", emoji: "B", type: "general", frequency: "weekly", weekdays: [1, 3],
    reminderTime: "20:30", currentEpisode: 0, incrementEpisode: false, createdAt, updatedAt, deletedAt: null,
  };
  const removedHabit: HabitRecord = { ...habit, id: "removed-habit", deletedAt };
  const checkIns: HabitCheckInRecord[] = [
    { id: "check-in", habitId: habit.id, date: "2026-08-24", status: "completed", episode: null, createdAt, updatedAt, deletedAt: null },
    { id: "old-check-in", habitId: removedHabit.id, date: "2026-08-23", status: "skipped", episode: null, createdAt, updatedAt, deletedAt },
  ];
  const anime: LegacyAnime = {
    id: "anime", title: "作品", emoji: "A", status: "paused", currentEpisode: 7, totalEpisodes: 12,
    watchWeekday: 2, reminderTime: "21:00", note: "保留进度与笔记", lastWatchedAt: updatedAt,
    createdAt, updatedAt, deletedAt: null,
    ...(version >= 7 ? { airKind: "finished", scheduleMode: "daily", bgmSubjectId: 42, bgmCoverUrl: "https://example.com/cover.jpg" } : {}),
  };
  const removedAnime: LegacyAnime = {
    ...anime, id: "removed-anime", watchWeekday: null, deletedAt,
    ...(version >= 7 ? { scheduleMode: "none" } : {}),
  };
  const focus: PomodoroRecord = {
    id: "focus", taskId: parent.id, startAt: createdAt, endAt: updatedAt, duration: 1, createdAt: updatedAt,
  };
  return { lists, tasks: [parent, child, removed], settings, habits: [habit, removedHabit], checkIns, anime: [anime, removedAnime], focus };
}

async function populateLegacy(version: number) {
  const legacy = legacyDatabase(version);
  await legacy.open();
  const data = fixtures(version);
  await legacy.transaction("rw", legacy.tables, async () => {
    await legacy.table<ListRecord, string>("lists").bulkPut(data.lists);
    await legacy.table<LegacyTask, string>("tasks").bulkPut(data.tasks);
    await legacy.table<LegacySettings, string>("settings").put(data.settings);
    if (version >= 3) await legacy.table<PomodoroRecord, string>("pomodoroRecords").put(data.focus);
    if (version >= 4) {
      await legacy.table<HabitRecord, string>("habits").bulkPut(data.habits);
      await legacy.table<HabitCheckInRecord, string>("habitCheckIns").bulkPut(data.checkIns);
    }
    if (version >= 5) await legacy.table<LegacyAnime, string>("anime").bulkPut(data.anime);
  });
  legacy.close();
  return data;
}

async function snapshot(database: Dexie) {
  return Object.fromEntries(await Promise.all(database.tables.map(async table => [
    table.name, await database.table<unknown, string>(table.name).toArray(),
  ])));
}

function expectCurrentSchema() {
  const expectedIndexes: Record<string, string[]> = {
    lists: ["sortOrder", "updatedAt", "deletedAt"],
    tasks: ["listId", "parentId", "dueDate", "scheduledDate", "completedAt", "updatedAt", "deletedAt", "sortOrder"],
    settings: [],
    pomodoroRecords: ["taskId", "startAt", "createdAt"],
    habits: ["updatedAt", "deletedAt"],
    habitCheckIns: ["habitId", "date", "status", "updatedAt", "deletedAt", "[habitId+date]"],
    anime: ["status", "watchWeekday", "updatedAt", "deletedAt"],
    workspaceItems: ["kind", "taskId", "archivedAt", "updatedAt", "deletedAt"],
    attachments: ["itemId", "updatedAt", "deletedAt"],
    attachmentBlobs: [],
  };
  const native = db.backendDB();
  expect(Array.from(native.objectStoreNames)).toEqual(Object.keys(expectedIndexes).sort());
  const transaction = native.transaction(Object.keys(expectedIndexes), "readonly");
  for (const [name, indexes] of Object.entries(expectedIndexes)) {
    const store = transaction.objectStore(name);
    expect(store.keyPath).toBe("id");
    expect(store.autoIncrement).toBe(false);
    expect(Array.from(store.indexNames)).toEqual([...indexes].sort());
    for (const name of indexes) {
      const index = store.index(name);
      expect(index.keyPath).toEqual(name === "[habitId+date]" ? ["habitId", "date"] : name);
      expect(index.unique).toBe(false);
      expect(index.multiEntry).toBe(false);
    }
  }
}

beforeEach(async () => {
  await db.delete();
});

afterEach(async () => {
  for (const legacy of openedLegacyDatabases.splice(0)) legacy.close();
  await db.delete();
});

describe("historical IndexedDB upgrades", () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8])("upgrades a real v%i database to v9 without losing records or relationships", async version => {
    const data = await populateLegacy(version);
    await db.open();
    expect(db.verno).toBe(9);
    expectCurrentSchema();
    expect(await db.lists.toArray()).toEqual(data.lists);
    expect(await db.tasks.count()).toBe(3);
    for (const task of data.tasks) {
      expect(await db.tasks.get(task.id)).toEqual({
        ...task,
        sortOrder: task.sortOrder ?? task.createdAt,
        repeatRule: task.repeatRule ?? null,
        scheduledDate: task.scheduledDate ?? null,
        scheduledTime: task.scheduledTime ?? null,
      });
    }
    expect(await db.tasks.where("parentId").equals("parent").primaryKeys()).toEqual(["child"]);
    expect(await db.tasks.where("listId").equals("old-list").primaryKeys()).toEqual(["removed"]);
    expect(await db.settings.get("app")).toEqual({
      ...data.settings,
      defaultView: "workspace",
      pomodoroConfig: version < 3 ? DEFAULT_POMODORO_CONFIG : customConfig,
    });
    expect(await db.pomodoroRecords.toArray()).toEqual(version >= 3 ? [data.focus] : []);
    expect(await db.habits.toArray()).toEqual(version >= 4 ? data.habits : []);
    expect(await db.habitCheckIns.toArray()).toEqual(version >= 4 ? data.checkIns : []);
    if (version >= 4) {
      expect(await db.habitCheckIns.where("[habitId+date]").equals(["habit", "2026-08-24"]).primaryKeys()).toEqual(["check-in"]);
    }
    expect(await db.anime.count()).toBe(version >= 5 ? 2 : 0);
    if (version >= 5) {
      for (const anime of data.anime) {
        expect(await db.anime.get(anime.id)).toEqual({
          airKind: "ongoing", scheduleMode: anime.watchWeekday === null ? "none" : "weekly",
          bgmSubjectId: null, bgmCoverUrl: null, ...anime,
        });
      }
    }
    expect(await db.workspaceItems.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
    expect(await db.attachmentBlobs.count()).toBe(0);

    const upgraded = await snapshot(db);
    db.close();
    await db.open();
    expect(await snapshot(db)).toEqual(upgraded);
  });

  it("migrates active v4 anime habits once, retaining their history and existing tombstones", async () => {
    const data = await populateLegacy(4);
    const weekly: HabitRecord = {
      ...data.habits[0], id: "legacy-anime", title: "旧追番", type: "anime", currentEpisode: 7,
      emoji: "A", frequency: "weekly", weekdays: [2, 5], incrementEpisode: true,
    };
    const daily: HabitRecord = {
      ...weekly, id: "daily-anime", title: "每天看", emoji: "", frequency: "daily", weekdays: [], currentEpisode: 0,
    };
    const removed: HabitRecord = { ...weekly, id: "removed-anime", deletedAt };
    const checkIn: HabitCheckInRecord = {
      id: "legacy-episode", habitId: weekly.id, date: "2026-08-24", status: "completed", episode: 7,
      createdAt, updatedAt, deletedAt: null,
    };
    const legacy = legacyDatabase(4);
    await legacy.open();
    await legacy.table<HabitRecord, string>("habits").bulkPut([weekly, daily, removed]);
    await legacy.table<HabitCheckInRecord, string>("habitCheckIns").put(checkIn);
    legacy.close();

    const upgradeStarted = Date.now();
    await db.open();
    expect(await db.anime.count()).toBe(2);
    for (const [habit, weekday, emoji] of [[weekly, 2, "A"], [daily, new Date(createdAt).getDay(), "\u{1f4fa}"]] as const) {
      const tombstone = await db.habits.get(habit.id);
      expect(tombstone?.deletedAt).toBeGreaterThanOrEqual(upgradeStarted);
      expect(tombstone?.deletedAt).toBeLessThanOrEqual(Date.now());
      expect(tombstone).toEqual({ ...habit, deletedAt: tombstone?.updatedAt, updatedAt: tombstone?.updatedAt });
      expect(await db.anime.get(habit.id)).toEqual({
        id: habit.id, title: habit.title, emoji, status: "watching", currentEpisode: habit.currentEpisode,
        totalEpisodes: null, watchWeekday: weekday, reminderTime: habit.reminderTime,
        note: "", lastWatchedAt: null, createdAt: habit.createdAt, updatedAt: tombstone?.updatedAt, deletedAt: null,
        airKind: "ongoing", scheduleMode: "weekly", bgmSubjectId: null, bgmCoverUrl: null,
      });
    }
    expect(await db.habits.get(data.habits[0].id)).toEqual(data.habits[0]);
    expect(await db.habits.get(removed.id)).toEqual(removed);
    expect(await db.anime.get(removed.id)).toBeUndefined();
    expect(await db.habitCheckIns.get(checkIn.id)).toEqual(checkIn);
    const migrated = await snapshot(db);
    db.close();
    await db.open();
    expect(await snapshot(db)).toEqual(migrated);
  });

  it("rolls back the entire upgrade when a later migration write fails, then permits retry", async () => {
    const data = await populateLegacy(4);
    const legacy = legacyDatabase(4);
    await legacy.open();
    await legacy.table<HabitRecord, string>("habits").put({ ...data.habits[0], type: "anime", currentEpisode: 3 });
    const original = await snapshot(legacy);
    legacy.close();

    let sawAnimeWrite = false;
    const observeAnimeWrite = () => { sawAnimeWrite = true; };
    const failSettingsWrite = () => { throw new Error("migration settings write failed"); };
    db.anime.hook("creating", observeAnimeWrite);
    db.settings.hook("updating", failSettingsWrite);
    try {
      await expect(db.open()).rejects.toThrow("migration settings write failed");
      expect(sawAnimeWrite).toBe(true);
    } finally {
      db.anime.hook("creating").unsubscribe(observeAnimeWrite);
      db.settings.hook("updating").unsubscribe(failSettingsWrite);
      db.close();
    }

    const stillOld = legacyDatabase(4);
    await stillOld.open();
    expect(stillOld.verno).toBe(4);
    expect(await snapshot(stillOld)).toEqual(original);
    expect(Array.from(stillOld.backendDB().objectStoreNames)).not.toContain("anime");
    expect(Array.from(stillOld.backendDB().objectStoreNames)).not.toContain("workspaceItems");
    stillOld.close();

    await db.open();
    expect(db.verno).toBe(9);
    expect(await db.anime.get("habit")).toMatchObject({ currentEpisode: 3, deletedAt: null });
    expect((await db.habits.get("habit"))?.deletedAt).toBeTypeOf("number");
    expect(await db.tasks.count()).toBe(3);
    expect((await db.settings.get("app"))?.defaultView).toBe("workspace");
  });
});
