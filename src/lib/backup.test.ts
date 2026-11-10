import { describe, expect, it } from "vitest";
import { tasksToCsv, validateBackupPayload } from "./backup";

const validBackup = {
  version: 1,
  exportedAt: 1,
  lists: [
    {
      id: "list-1",
      name: "Inbox",
      color: "#000000",
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    },
  ],
  tasks: [],
  pomodoroRecords: [],
  settings: null,
};

describe("backup validation", () => {
  it("preserves optional work time and accepts legacy tasks without it", () => {
    const record = {
      id: "task-time", listId: "list-1", title: "Study", note: "", priority: "none",
      scheduledDate: "2026-10-03", dueDate: null, completedAt: null, tags: [],
      parentId: null, sortOrder: 0, repeatRule: null, createdAt: 1, updatedAt: 1, deletedAt: null,
    };
    expect(validateBackupPayload({ ...validBackup, tasks: [record] }).tasks[0].scheduledTime).toBeNull();
    const timed = validateBackupPayload({ ...validBackup, tasks: [{ ...record, scheduledTime: "19:30" }] });
    expect(timed.tasks[0].scheduledTime).toBe("19:30");
    expect(tasksToCsv(timed.tasks, timed.lists)).toContain("19:30");
    expect(() => validateBackupPayload({ ...validBackup, tasks: [{ ...record, scheduledTime: "25:00" }] })).toThrow();
  });

  it("accepts list-overview settings and preserves the stable inbox identity", () => {
    const normalized = validateBackupPayload({
      ...validBackup,
      settings: {
        id: "app", theme: "system", defaultView: "lists", locale: "zh", inboxListId: "list-1",
        seededAt: 1, updatedAt: 1,
        pomodoroConfig: { workMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, cyclesBeforeLongBreak: 4 },
      },
    });
    expect(normalized.settings?.defaultView).toBe("lists");
    expect(normalized.settings?.inboxListId).toBe("list-1");
  });

  it("accepts a structurally valid backup", () => {
    const normalized = validateBackupPayload(validBackup);
    expect(normalized.lists).toHaveLength(1);
    expect(normalized.version).toBe(3);
    expect(normalized.habits).toEqual([]);
    expect(normalized.anime).toEqual([]);
  });

  it("rejects an orphaned habit check-in", () => {
    expect(() =>
      validateBackupPayload({
        ...validBackup,
        version: 2,
        habits: [],
        habitCheckIns: [
          {
            id: "check-1",
            habitId: "missing-habit",
            date: "2026-08-20",
            status: "completed",
            episode: null,
            createdAt: 1,
            updatedAt: 1,
            deletedAt: null,
          },
        ],
      }),
    ).toThrow("without its habit");
  });

  it("migrates legacy anime habits into the anime list", () => {
    const legacyAnime = {
      id: "anime-habit-1",
      title: "Frieren",
      emoji: "?",
      type: "anime",
      frequency: "weekly",
      weekdays: [4],
      reminderTime: "20:00",
      currentEpisode: 6,
      incrementEpisode: true,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    };
    const normalized = validateBackupPayload({
      ...validBackup,
      version: 2,
      habits: [legacyAnime],
      habitCheckIns: [],
    });
    expect(normalized.anime[0]).toMatchObject({
      title: "Frieren",
      currentEpisode: 6,
      watchWeekday: 4,
    });
    expect(normalized.habits[0]?.deletedAt).toBe(1);
  });

  it("rejects orphaned tasks before import starts", () => {
    const task = {
      id: "task-1",
      listId: "missing-list",
      title: "Task",
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
    };
    expect(() =>
      validateBackupPayload({ ...validBackup, tasks: [task] }),
    ).toThrow("without its list");
  });

  it("normalizes legacy pomodoro settings without rejecting the backup", () => {
    const normalized = validateBackupPayload({
      ...validBackup,
      version: 3,
      habits: [],
      habitCheckIns: [],
      anime: [],
      settings: {
        id: "app",
        theme: "system",
        defaultView: "list",
        locale: "zh",
        seededAt: 1,
        updatedAt: 1,
        pomodoroConfig: {
          workMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 15,
          cyclesBeforeLongBreak: 4,
        },
      },
    });
    expect(normalized.settings?.pomodoroConfig).toMatchObject({
      autoStartBreaks: false,
      autoStartFocus: false,
      soundEnabled: true,
      soundVolume: 70,
      dailyGoalMinutes: 100,
    });
  });

  it("accepts optional mascot settings on a backup", () => {
    const normalized = validateBackupPayload({
      ...validBackup,
      version: 3,
      habits: [],
      habitCheckIns: [],
      anime: [],
      settings: {
        id: "app",
        theme: "system",
        defaultView: "list",
        locale: "zh",
        seededAt: 1,
        updatedAt: 1,
        mascotEnabled: true,
        mascotScale: 1.4,
        mascotLeft: 20,
        mascotTop: 40,
        pomodoroConfig: {
          workMinutes: 25,
          shortBreakMinutes: 5,
          longBreakMinutes: 15,
          cyclesBeforeLongBreak: 4,
        },
      },
    });
    expect(normalized.settings).toMatchObject({
      mascotEnabled: true,
      mascotScale: 1.4,
      mascotLeft: 20,
      mascotTop: 40,
    });
  });

  it("imports anime records that already have watch-plan and Bangumi fields", () => {
    const record = {
      id: "anime-new",
      title: "Frieren",
      emoji: "x",
      status: "watching",
      airKind: "finished",
      scheduleMode: "daily",
      currentEpisode: 6,
      totalEpisodes: 28,
      watchWeekday: null,
      reminderTime: "21:00",
      note: "",
      lastWatchedAt: null,
      bgmSubjectId: 18329,
      bgmCoverUrl: "https://lain.bgm.tv/c.jpg",
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    };
    const normalized = validateBackupPayload({
      ...validBackup,
      version: 3,
      habits: [],
      habitCheckIns: [],
      anime: [record],
    });
    expect(normalized.anime[0]).toMatchObject({
      airKind: "finished",
      scheduleMode: "daily",
      bgmSubjectId: 18329,
      bgmCoverUrl: "https://lain.bgm.tv/c.jpg",
    });
  });

  it("imports legacy anime records missing the new watch-plan fields", () => {
    const oldAnime = {
      id: "anime-old",
      title: "Frieren",
      emoji: "x",
      status: "watching",
      currentEpisode: 6,
      totalEpisodes: 12,
      watchWeekday: 4,
      reminderTime: "20:00",
      note: "",
      lastWatchedAt: null,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
    };
    const normalized = validateBackupPayload({
      ...validBackup,
      version: 3,
      habits: [],
      habitCheckIns: [],
      anime: [oldAnime],
    });
    expect(normalized.anime[0]).toMatchObject({
      title: "Frieren",
      airKind: "ongoing",
      scheduleMode: "weekly",
      bgmSubjectId: null,
      bgmCoverUrl: null,
    });
  });
});
