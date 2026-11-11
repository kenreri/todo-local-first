import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  DEFAULT_POMODORO_CONFIG,
  type AnimeRecord,
  type HabitCheckInRecord,
  type HabitRecord,
  type ListRecord,
  type PomodoroRecord,
  type SettingsRecord,
  type TaskRecord,
} from "../types";
import { importBackupJson } from "./backup";

type LegacyTask = Omit<TaskRecord, "scheduledDate" | "scheduledTime">;
type LegacyAnime = Omit<AnimeRecord, "airKind" | "scheduleMode" | "bgmSubjectId" | "bgmCoverUrl">;

const createdAt = 1_000;
const updatedAt = 2_000;
const deletedAt = 3_000;
const exportedAt = 4_000;
const list: ListRecord = {
  id: "inbox", name: "收件箱", color: "#123456", sortOrder: 2,
  createdAt, updatedAt, deletedAt: null,
};
const removedList: ListRecord = { ...list, id: "removed-list", name: "历史清单", deletedAt };
const parent: LegacyTask = {
  id: "parent", listId: list.id, parentId: null, title: "标题与📝", note: "第一行\nhttps://example.com/资料",
  priority: "high", dueDate: "2026-12-01", completedAt: null, tags: ["学习", "资料"],
  sortOrder: 9, repeatRule: null, createdAt, updatedAt, deletedAt: null,
};
const child: LegacyTask = {
  ...parent, id: "child", parentId: parent.id, title: "子任务", completedAt: updatedAt,
  repeatRule: { frequency: "weekly", interval: 2, weekdays: [2, 5], endDate: "2027-01-01" },
};
const removedTask: LegacyTask = { ...parent, id: "removed-task", listId: removedList.id, deletedAt };
const focus: PomodoroRecord = {
  id: "focus", taskId: parent.id, startAt: createdAt, endAt: updatedAt, duration: 1, createdAt: updatedAt,
};
const removedTaskFocus: PomodoroRecord = { ...focus, id: "removed-task-focus", taskId: removedTask.id };
const generalHabit: HabitRecord = {
  id: "habit", title: "阅读", emoji: "📚", type: "general", frequency: "weekly", weekdays: [1, 3],
  reminderTime: "20:30", currentEpisode: 0, incrementEpisode: false, createdAt, updatedAt, deletedAt: null,
};
const removedHabit: HabitRecord = { ...generalHabit, id: "removed-habit", deletedAt };
const weeklyAnimeHabit: HabitRecord = {
  ...generalHabit, id: "weekly-anime", title: "旧追番", emoji: "📺", type: "anime", weekdays: [4],
  currentEpisode: 7, incrementEpisode: true,
};
const removedAnimeHabit: HabitRecord = { ...weeklyAnimeHabit, id: "removed-anime-habit", deletedAt };
const checkIn: HabitCheckInRecord = {
  id: "check-in", habitId: generalHabit.id, date: "2026-11-01", status: "completed", episode: null,
  createdAt, updatedAt, deletedAt: null,
};
const removedCheckIn: HabitCheckInRecord = { ...checkIn, id: "removed-check-in", habitId: removedHabit.id, deletedAt };
const animeCheckIn: HabitCheckInRecord = { ...checkIn, id: "anime-check-in", habitId: weeklyAnimeHabit.id, episode: 7 };
const legacyAnime: LegacyAnime = {
  id: "anime", title: "旧版独立追番", emoji: "🎬", status: "watching", currentEpisode: 3,
  totalEpisodes: 12, watchWeekday: 2, reminderTime: "21:00", note: "保留观看笔记", lastWatchedAt: updatedAt,
  createdAt, updatedAt, deletedAt: null,
};
const removedAnime: AnimeRecord = {
  ...legacyAnime, id: "removed-anime", status: "completed", currentEpisode: 12, airKind: "finished",
  scheduleMode: "daily", watchWeekday: null, bgmSubjectId: 42, bgmCoverUrl: "https://example.com/cover.jpg", deletedAt,
};
const legacySettings = {
  id: "app", theme: "dark", defaultView: "today", locale: "en", inboxListId: list.id,
  seededAt: createdAt, updatedAt,
  pomodoroConfig: { workMinutes: 37, shortBreakMinutes: 6, longBreakMinutes: 19, cyclesBeforeLongBreak: 3 },
};
const existingSettings: SettingsRecord = {
  id: "app", theme: "light", defaultView: "workspace", locale: "zh", seededAt: createdAt, updatedAt,
  inboxListId: list.id, wallpaperEnabled: true, wallpaperUrl: "https://example.com/wallpaper.jpg", wallpaperDim: 35,
  sakuraEnabled: false, mascotEnabled: true, mascotScale: 1.3, sidebarCollapsed: true,
  pomodoroConfig: { ...DEFAULT_POMODORO_CONFIG, workMinutes: 48, soundVolume: 23 },
};

function historicalBackup(version: number) {
  return {
    version, exportedAt,
    lists: [list, removedList],
    tasks: [parent, child, removedTask],
    pomodoroRecords: [focus, removedTaskFocus],
    settings: legacySettings,
    ...(version >= 2 ? {
      habits: version === 2
        ? [generalHabit, removedHabit, weeklyAnimeHabit, removedAnimeHabit]
        : [generalHabit, removedHabit],
      habitCheckIns: version === 2 ? [checkIn, removedCheckIn, animeCheckIn] : [checkIn, removedCheckIn],
    } : {}),
    ...(version >= 3 ? { anime: [legacyAnime, removedAnime] } : {}),
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  // Populate every current table so restoring an older format must replace, not merge.
  await db.transaction("rw", db.tables, async () => {
    await db.lists.put({ ...list, id: "existing-list" });
    await db.tasks.put({ ...parent, id: "existing-task", listId: "existing-list", scheduledDate: null });
    await db.pomodoroRecords.put({ ...focus, id: "existing-focus", taskId: "existing-task" });
    await db.habits.put({ ...generalHabit, id: "existing-habit" });
    await db.habitCheckIns.put({ ...checkIn, id: "existing-check-in", habitId: "existing-habit" });
    await db.anime.put({ ...removedAnime, id: "existing-anime", deletedAt: null });
    await db.settings.put(existingSettings);
    await db.workspaceItems.put({
      id: "existing-item", title: "旧材料", body: "旧正文", kind: "note", taskId: "existing-task",
      intention: "want", archivedAt: null, createdAt, updatedAt, deletedAt: null,
    });
    await db.attachments.put({
      id: "existing-file", itemId: "existing-item", name: "旧文件.bin", mime: "application/octet-stream",
      size: 3, createdAt, updatedAt, deletedAt: null,
    });
    await db.attachmentBlobs.put({ id: "existing-file", data: new Blob([new Uint8Array([0, 255, 128])]) });
  });
});

afterEach(async () => {
  await db.delete();
});

async function importAndReopen(payload: unknown) {
  const parsed: unknown = JSON.parse(JSON.stringify(payload));
  await importBackupJson(parsed);
  db.close();
  await db.open();
}

async function expectRestoredRecords(version: number) {
  expect(await db.lists.toArray()).toEqual([list, removedList]);
  expect(await db.tasks.toArray()).toEqual([child, parent, removedTask].map(task => ({
    ...task, scheduledDate: null, scheduledTime: null,
  })));
  expect(await db.tasks.where("parentId").equals(parent.id).primaryKeys()).toEqual([child.id]);
  expect(await db.tasks.where("listId").equals(removedList.id).primaryKeys()).toEqual([removedTask.id]);
  expect(await db.pomodoroRecords.toArray()).toEqual([focus, removedTaskFocus]);
  expect(await db.pomodoroRecords.where("taskId").equals(removedTask.id).primaryKeys()).toEqual([removedTaskFocus.id]);
  expect(await db.workspaceItems.count()).toBe(0);
  expect(await db.attachments.count()).toBe(0);
  expect(await db.attachmentBlobs.count()).toBe(0);

  if (version === 1) {
    expect(await db.habits.count()).toBe(0);
    expect(await db.habitCheckIns.count()).toBe(0);
    expect(await db.anime.count()).toBe(0);
    return;
  }
  expect(await db.habitCheckIns.where("[habitId+date]").equals([generalHabit.id, checkIn.date]).toArray()).toEqual([checkIn]);
  if (version === 2) {
    expect(await db.habits.toArray()).toEqual([
      generalHabit, removedAnimeHabit, removedHabit,
      { ...weeklyAnimeHabit, updatedAt: exportedAt, deletedAt: exportedAt },
    ]);
    expect(await db.habitCheckIns.toArray()).toEqual([animeCheckIn, checkIn, removedCheckIn]);
    expect(await db.anime.toArray()).toEqual([{
      id: weeklyAnimeHabit.id, title: weeklyAnimeHabit.title, emoji: weeklyAnimeHabit.emoji,
      status: "watching", airKind: "ongoing", scheduleMode: "weekly", currentEpisode: 7, totalEpisodes: null,
      watchWeekday: 4, reminderTime: weeklyAnimeHabit.reminderTime, note: "", lastWatchedAt: null,
      bgmSubjectId: null, bgmCoverUrl: null, createdAt, updatedAt: exportedAt, deletedAt: null,
    }]);
  } else {
    expect(await db.habits.toArray()).toEqual([generalHabit, removedHabit]);
    expect(await db.habitCheckIns.toArray()).toEqual([checkIn, removedCheckIn]);
    expect(await db.anime.toArray()).toEqual([
      { ...legacyAnime, airKind: "ongoing", scheduleMode: "weekly", bgmSubjectId: null, bgmCoverUrl: null },
      removedAnime,
    ]);
  }
}

describe("historical JSON restoration in IndexedDB", () => {
  it.each([1, 2, 3])("restores nonempty v%i JSON, relationships and tombstones after reopening", async version => {
    const started = Date.now();
    await importAndReopen(historicalBackup(version));
    await expectRestoredRecords(version);
    const restored = await db.settings.get("app");
    expect(restored).toEqual({
      ...legacySettings,
      pomodoroConfig: { ...DEFAULT_POMODORO_CONFIG, ...legacySettings.pomodoroConfig },
      updatedAt: expect.any(Number),
    });
    expect(restored?.updatedAt).toBeGreaterThanOrEqual(started);
    expect(restored?.updatedAt).toBeLessThanOrEqual(Date.now());
  });

  it.each([1, 2, 3])("preserves existing settings when nonempty v%i JSON has settings=null", async version => {
    await importAndReopen({ ...historicalBackup(version), settings: null });
    await expectRestoredRecords(version);
    expect(await db.settings.toArray()).toEqual([existingSettings]);
  });
});
