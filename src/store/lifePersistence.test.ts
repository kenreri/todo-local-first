import "fake-indexeddb/auto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db } from "../db";
import { habitEditPatch } from "../lib/habits";
import { animeFormFromRecord, animeFormPatch } from "../lib/animeForm";
import {
  ensureInbox,
  ensureSeedData,
  getSettings,
  updatePomodoroConfig,
} from "../seed";
import { useTodoStore } from "./todoStore";

beforeAll(() => {
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }) });
  vi.stubGlobal("document", {
    documentElement: { dataset: {}, style: {}, lang: "zh-CN" },
  });
});
beforeEach(async () => {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
  await ensureSeedData();
  await useTodoStore.getState().createHabit({
    title: "Read",
    emoji: "A",
    frequency: "daily",
    weekdays: [],
    reminderTime: "09:00",
  });
  await useTodoStore.getState().createAnime({
    title: "Series",
    emoji: "A",
    status: "watching",
    airKind: "ongoing",
    scheduleMode: "weekly",
    currentEpisode: 0,
    totalEpisodes: 2,
    watchWeekday: 1,
    reminderTime: "20:00",
    note: "Keep",
  });
});
afterAll(() => {
  db.close();
  vi.unstubAllGlobals();
});
const habitId = async () => (await db.habits.toArray())[0].id;
const animeId = async () => (await db.anime.toArray())[0].id;

describe("settings transactions", () => {
  it("keeps concurrent independent settings across every UI entry", async () => {
    const state = useTodoStore.getState();
    await Promise.all([
      state.setTheme("dark"),
      state.setLocale("en"),
      state.setWallpaperDim(75),
      state.setSakuraEnabled(false),
      state.setWallpaperEnabled(false),
      state.setWallpaperUrl("https://example.com/image.png"),
      state.setMascotEnabled(true),
      state.setMascotScale(2),
      state.setMascotPosition(123, 456),
      state.setView("today"),
      state.setSidebarCollapsed(true),
      state.setListsGroupCollapsed(true),
    ]);
    expect(await getSettings()).toMatchObject({
      theme: "dark",
      locale: "en",
      wallpaperDim: 75,
      sakuraEnabled: false,
      wallpaperEnabled: false,
      wallpaperUrl: "https://example.com/image.png",
      mascotEnabled: true,
      mascotScale: 2,
      mascotLeft: 123,
      mascotTop: 456,
      defaultView: "today",
      sidebarCollapsed: true,
      listsGroupCollapsed: true,
    });
  });
  it("merges nested pomodoro patches and other settings", async () => {
    await Promise.all([
      updatePomodoroConfig({ workMinutes: 50 }),
      updatePomodoroConfig({ soundVolume: 12 }),
      useTodoStore.getState().setTheme("dark"),
    ]);
    expect(await getSettings()).toMatchObject({
      theme: "dark",
      pomodoroConfig: {
        workMinutes: 50,
        soundVolume: 12,
        shortBreakMinutes: 5,
      },
    });
  });
  it("normalizes a legacy row while preserving concurrent settings", async () => {
    await db.settings.update("app", {
      wallpaperDim: undefined,
      mascotScale: undefined,
      pomodoroConfig: undefined,
    });
    await Promise.all([
      ensureSeedData(),
      useTodoStore.getState().setSakuraEnabled(false),
      updatePomodoroConfig({ workMinutes: 50 }),
    ]);
    expect(await getSettings()).toMatchObject({
      wallpaperDim: 40,
      mascotScale: 1.5,
      sakuraEnabled: false,
      pomodoroConfig: { workMinutes: 50, soundVolume: 70 },
    });
  });
  it("initializes once when two pages seed together", async () => {
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) await table.clear();
    });
    await Promise.all([ensureSeedData(), ensureSeedData()]);
    expect(await db.lists.count()).toBe(1);
    expect(await db.tasks.count()).toBe(1);
  });
  it("keeps settings when inbox creation and initial reads race", async () => {
    await db.settings.clear();
    await Promise.all([
      getSettings(),
      getSettings(),
      ensureInbox(),
      useTodoStore.getState().setTheme("dark"),
    ]);
    expect(await getSettings()).toMatchObject({
      theme: "dark",
      inboxListId: expect.any(String),
    });
  });
  it("undefined pomodoro patches preserve existing values", async () => {
    await updatePomodoroConfig({ workMinutes: 50 });
    await updatePomodoroConfig({ workMinutes: undefined, soundVolume: 12 });
    expect((await getSettings()).pomodoroConfig.workMinutes).toBe(50);
  });
});

describe("habit and anime transactions", () => {
  it("keeps concurrent habit title and emoji edits", async () => {
    const id = await habitId();
    await Promise.all([
      useTodoStore.getState().updateHabit(id, { title: "New title" }),
      useTodoStore.getState().updateHabit(id, { emoji: "B" }),
    ]);
    expect(await db.habits.get(id)).toMatchObject({
      title: "New title",
      emoji: "B",
    });
  });
  it.each([false, true])(
    "habit edit/delete stays deleted, delete first = %s",
    async (deleteFirst) => {
      const id = await habitId();
      const edit = () =>
        useTodoStore.getState().updateHabit(id, { title: "Late" });
      const remove = () => useTodoStore.getState().deleteHabit(id);
      await Promise.all(deleteFirst ? [remove(), edit()] : [edit(), remove()]);
      expect((await db.habits.get(id))?.deletedAt).not.toBeNull();
    },
  );
  it("concurrent increments count twice and complete at the cap", async () => {
    const id = await animeId();
    await Promise.all([
      useTodoStore.getState().incrementAnimeEpisode(id),
      useTodoStore.getState().incrementAnimeEpisode(id),
    ]);
    expect(await db.anime.get(id)).toMatchObject({
      currentEpisode: 2,
      status: "completed",
    });
    await Promise.all([
      useTodoStore.getState().incrementAnimeEpisode(id),
      useTodoStore.getState().incrementAnimeEpisode(id),
    ]);
    expect(await db.anime.get(id)).toMatchObject({
      currentEpisode: 2,
      status: "completed",
    });
  });
  it.each([false, true])(
    "anime edit/delete stays deleted, delete first = %s",
    async (deleteFirst) => {
      const id = await animeId();
      const edit = () =>
        useTodoStore.getState().updateAnime(id, { note: "Late" });
      const remove = () => useTodoStore.getState().deleteAnime(id);
      await Promise.all(deleteFirst ? [remove(), edit()] : [edit(), remove()]);
      expect((await db.anime.get(id))?.deletedAt).not.toBeNull();
    },
  );
  it("binding a fetched Bangumi result preserves concurrent progress and notes", async () => {
    const id = await animeId();
    await Promise.all([
      useTodoStore.getState().incrementAnimeEpisode(id),
      useTodoStore.getState().linkAnimeBgm(id, {
        subjectId: 123,
        title: "Bound",
        coverUrl: "https://example.com/cover",
        totalEpisodes: 12,
      }),
      useTodoStore.getState().updateAnime(id, { note: "Updated" }),
    ]);
    expect(await db.anime.get(id)).toMatchObject({
      currentEpisode: 1,
      bgmSubjectId: 123,
      bgmCoverUrl: "https://example.com/cover",
      note: "Updated",
      totalEpisodes: 2,
    });
  });
  it("late Bangumi binding cannot resurrect a deleted item", async () => {
    const id = await animeId();
    await Promise.all([
      useTodoStore.getState().deleteAnime(id),
      useTodoStore.getState().linkAnimeBgm(id, {
        subjectId: 123,
        title: "Bound",
        coverUrl: null,
        totalEpisodes: 12,
      }),
    ]);
    expect((await db.anime.get(id))?.deletedAt).not.toBeNull();
  });
  it("keeps one check-in per day; repeated status sets are idempotent", async () => {
    const id = await habitId();
    await Promise.all([
      useTodoStore.getState().setHabitCheckIn(id, "2026-11-11", "completed"),
      useTodoStore.getState().setHabitCheckIn(id, "2026-11-11", "completed"),
    ]);
    expect(
      (await db.habitCheckIns.toArray()).filter(
        (item) => item.deletedAt == null,
      ),
    ).toHaveLength(1);
    await useTodoStore.getState().setHabitCheckIn(id, "2026-11-11", "skipped");
    expect(
      (await db.habitCheckIns.toArray()).filter(
        (item) => item.deletedAt == null,
      )[0].status,
    ).toBe("skipped");
    await Promise.all([
      useTodoStore.getState().setHabitCheckIn(id, "2026-11-11", null),
      useTodoStore.getState().setHabitCheckIn(id, "2026-11-11", null),
    ]);
    expect(
      (await db.habitCheckIns.toArray()).filter(
        (item) => item.deletedAt == null,
      ),
    ).toHaveLength(0);
  });
  it("check-in racing with deletion leaves no live orphan", async () => {
    const id = await habitId();
    await Promise.all([
      useTodoStore.getState().setHabitCheckIn(id, "2026-11-11", "completed"),
      useTodoStore.getState().deleteHabit(id),
    ]);
    expect(
      (await db.habitCheckIns.toArray()).filter(
        (item) => item.deletedAt == null,
      ),
    ).toHaveLength(0);
  });
  it("undefined leaves nullable fields alone and null clears them", async () => {
    const hid = await habitId();
    const aid = await animeId();
    await useTodoStore
      .getState()
      .updateHabit(hid, { frequency: undefined, reminderTime: undefined });
    await useTodoStore.getState().updateAnime(aid, {
      status: undefined,
      reminderTime: undefined,
      totalEpisodes: undefined,
    });
    expect(await db.habits.get(hid)).toMatchObject({
      frequency: "daily",
      reminderTime: "09:00",
    });
    expect(await db.anime.get(aid)).toMatchObject({
      status: "watching",
      reminderTime: "20:00",
      totalEpisodes: 2,
    });
    await useTodoStore.getState().updateHabit(hid, { reminderTime: null });
    await useTodoStore
      .getState()
      .updateAnime(aid, { reminderTime: null, totalEpisodes: null });
    expect((await db.habits.get(hid))?.reminderTime).toBeNull();
    expect(await db.anime.get(aid)).toMatchObject({
      reminderTime: null,
      totalEpisodes: null,
    });
  });
});

describe("draft and list competition", () => {
  it("renaming a list cannot resurrect it after deletion starts", async () => {
    const list = (await db.lists.toArray())[0];
    await Promise.all([
      useTodoStore.getState().deleteList(list.id),
      useTodoStore.getState().renameList(list.id, "Late rename"),
    ]);
    expect((await db.lists.get(list.id))?.deletedAt).not.toBeNull();
    expect(
      (await db.tasks.toArray()).every((task) => task.deletedAt != null),
    ).toBe(true);
  });
  it("saving a note draft keeps progress changed while the form was open", async () => {
    const item = (await db.anime.toArray())[0];
    const baseline = animeFormFromRecord(item);
    await useTodoStore.getState().incrementAnimeEpisode(item.id);
    await useTodoStore
      .getState()
      .updateAnime(
        item.id,
        animeFormPatch(baseline, { ...baseline, note: "Edited draft" }),
      );
    expect(await db.anime.get(item.id)).toMatchObject({
      currentEpisode: 1,
      note: "Edited draft",
      status: "watching",
    });
  });
});


describe("habit edit drafts", () => {
  it("saves only changed fields and keeps a concurrent emoji edit", async () => {
    const baseline = (await db.habits.toArray())[0];
    await useTodoStore.getState().updateHabit(baseline.id, { emoji: "B" });
    await useTodoStore.getState().updateHabit(baseline.id, habitEditPatch(baseline, { ...baseline, title: "Changed title" }));
    expect(await db.habits.get(baseline.id)).toMatchObject({ title: "Changed title", emoji: "B" });
  });
  it("compares weekday values and retains an explicit reminder clearing", async () => {
    const baseline = { ...(await db.habits.toArray())[0], weekdays: [1, 3] };
    expect(habitEditPatch(baseline, { ...baseline, weekdays: [3, 1], reminderTime: null })).toEqual({ reminderTime: null });
    expect(habitEditPatch(baseline, { ...baseline, weekdays: [1, 4] })).toEqual({ weekdays: [1, 4] });
  });
});
