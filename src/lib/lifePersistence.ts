import { createId, db, now } from "../db";
import { normalizeAnimeEmoji } from "./anime";
import type {
  AnimeRecord,
  AnimeScheduleMode,
  HabitCheckInStatus,
  HabitRecord,
} from "../types";

type HabitInput = Pick<
  HabitRecord,
  "title" | "emoji" | "frequency" | "weekdays" | "reminderTime"
>;
type AnimeInput = Pick<
  AnimeRecord,
  | "title"
  | "emoji"
  | "status"
  | "airKind"
  | "scheduleMode"
  | "currentEpisode"
  | "totalEpisodes"
  | "watchWeekday"
  | "reminderTime"
  | "note"
> &
  Partial<Pick<AnimeRecord, "bgmSubjectId" | "bgmCoverUrl">>;

export interface LifeActions {
  createHabit: (input: HabitInput) => Promise<void>;
  updateHabit: (id: string, patch: Partial<HabitInput>) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  setHabitCheckIn: (
    habitId: string,
    date: string,
    status: HabitCheckInStatus | null,
  ) => Promise<void>;
  createAnime: (input: AnimeInput) => Promise<void>;
  updateAnime: (id: string, patch: Partial<AnimeInput>) => Promise<void>;
  incrementAnimeEpisode: (id: string) => Promise<void>;
  linkAnimeBgm: (
    id: string,
    info: {
      subjectId: number;
      title: string;
      coverUrl: string | null;
      totalEpisodes: number | null;
    },
  ) => Promise<void>;
  deleteAnime: (id: string) => Promise<void>;
}

/** Life-domain rules and transactions, independent of UI state. */
export const lifeActions: LifeActions = {
  createHabit: async (input) => {
    if (!input.title.trim()) return;
    const stamp = now();
    await db.habits.put({
      id: createId(),
      title: input.title.trim(),
      emoji: input.emoji.trim() || "✨",
      type: "general",
      frequency: input.frequency,
      weekdays:
        input.frequency === "weekly"
          ? [...new Set(input.weekdays)].sort((a, b) => a - b)
          : [],
      reminderTime: input.reminderTime || null,
      currentEpisode: 0,
      incrementEpisode: false,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
  },

  updateHabit: async (id, patch) => {
    await db.transaction("rw", db.habits, async () => {
      const habit = await db.habits.get(id);
      if (!habit || habit.deletedAt != null) return;
      const nextFrequency = patch.frequency ?? habit.frequency;
      await db.habits.put({
        ...habit,
        frequency: nextFrequency,
        reminderTime:
          patch.reminderTime === undefined
            ? habit.reminderTime
            : patch.reminderTime,
        title: patch.title?.trim() || habit.title,
        emoji: patch.emoji?.trim() || habit.emoji,
        weekdays:
          nextFrequency === "weekly"
            ? [...new Set(patch.weekdays ?? habit.weekdays)].sort(
                (a, b) => a - b,
              )
            : [],
        type: "general",
        currentEpisode: 0,
        incrementEpisode: false,
        updatedAt: now(),
      });
    });
  },

  deleteHabit: async (id) => {
    const stamp = now();
    await db.transaction("rw", db.habits, db.habitCheckIns, async () => {
      const habit = await db.habits.get(id);
      if (!habit || habit.deletedAt != null) return;
      await db.habits.put({ ...habit, deletedAt: stamp, updatedAt: stamp });
      const related = await db.habitCheckIns
        .where("habitId")
        .equals(id)
        .toArray();
      await Promise.all(
        related
          .filter((item) => item.deletedAt == null)
          .map((item) =>
            db.habitCheckIns.put({
              ...item,
              deletedAt: stamp,
              updatedAt: stamp,
            }),
          ),
      );
    });
  },

  setHabitCheckIn: async (habitId, date, status) => {
    const stamp = now();
    await db.transaction("rw", db.habits, db.habitCheckIns, async () => {
      const habit = await db.habits.get(habitId);
      if (!habit || habit.deletedAt != null) return;
      const records = await db.habitCheckIns
        .where("[habitId+date]")
        .equals([habitId, date])
        .toArray();
      const existing = records.find((item) => item.deletedAt == null);
      if (status == null) {
        if (existing) {
          await db.habitCheckIns.put({
            ...existing,
            deletedAt: stamp,
            updatedAt: stamp,
          });
        }
      } else if (existing) {
        await db.habitCheckIns.put({
          ...existing,
          status,
          episode: null,
          updatedAt: stamp,
        });
      } else {
        await db.habitCheckIns.put({
          id: createId(),
          habitId,
          date,
          status,
          episode: null,
          createdAt: stamp,
          updatedAt: stamp,
          deletedAt: null,
        });
      }
    });
  },

  createAnime: async (input) => {
    if (!input.title.trim()) return;
    const stamp = now();
    const totalEpisodes =
      input.totalEpisodes == null
        ? null
        : Math.max(1, Math.floor(input.totalEpisodes));
    const currentEpisode = Math.max(0, Math.floor(input.currentEpisode));
    const airKind = input.airKind === "finished" ? "finished" : "ongoing";
    const scheduleMode: AnimeScheduleMode =
      input.scheduleMode === "weekly" || input.scheduleMode === "daily"
        ? input.scheduleMode
        : input.watchWeekday != null
          ? "weekly"
          : "none";
    const watchWeekday = scheduleMode === "weekly" ? input.watchWeekday : null;
    await db.anime.put({
      id: createId(),
      title: input.title.trim(),
      emoji: normalizeAnimeEmoji(input.emoji),
      status: input.status,
      airKind,
      scheduleMode,
      currentEpisode:
        totalEpisodes == null
          ? currentEpisode
          : Math.min(currentEpisode, totalEpisodes),
      totalEpisodes,
      watchWeekday,
      reminderTime: scheduleMode === "none" ? null : input.reminderTime || null,
      note: input.note.trim(),
      lastWatchedAt: null,
      bgmSubjectId: input.bgmSubjectId ?? null,
      bgmCoverUrl: input.bgmCoverUrl ?? null,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
  },

  updateAnime: async (id, patch) => {
    await db.transaction("rw", db.anime, async () => {
      const anime = await db.anime.get(id);
      if (!anime || anime.deletedAt != null) return;
      const totalEpisodes =
        patch.totalEpisodes === undefined
          ? anime.totalEpisodes
          : patch.totalEpisodes == null
            ? null
            : Math.max(1, Math.floor(patch.totalEpisodes));
      const requestedEpisode = Math.max(
        0,
        Math.floor(patch.currentEpisode ?? anime.currentEpisode),
      );
      const currentEpisode =
        totalEpisodes == null
          ? requestedEpisode
          : Math.min(requestedEpisode, totalEpisodes);
      const airKind =
        patch.airKind === "finished"
          ? "finished"
          : patch.airKind === "ongoing"
            ? "ongoing"
            : anime.airKind;
      const scheduleMode: AnimeScheduleMode =
        patch.scheduleMode === "weekly" ||
        patch.scheduleMode === "daily" ||
        patch.scheduleMode === "none"
          ? patch.scheduleMode
          : anime.scheduleMode;
      const watchWeekday =
        scheduleMode === "weekly"
          ? patch.watchWeekday === undefined
            ? anime.watchWeekday
            : patch.watchWeekday
          : null;
      await db.anime.put({
        ...anime,
        status: patch.status ?? anime.status,
        title: patch.title?.trim() || anime.title,
        emoji: normalizeAnimeEmoji(patch.emoji ?? anime.emoji),
        note: patch.note?.trim() ?? anime.note,
        currentEpisode,
        totalEpisodes,
        airKind,
        scheduleMode,
        watchWeekday,
        reminderTime:
          scheduleMode === "none"
            ? null
            : patch.reminderTime === undefined
              ? anime.reminderTime
              : patch.reminderTime || null,
        bgmSubjectId:
          patch.bgmSubjectId === undefined
            ? anime.bgmSubjectId
            : patch.bgmSubjectId,
        bgmCoverUrl:
          patch.bgmCoverUrl === undefined
            ? anime.bgmCoverUrl
            : patch.bgmCoverUrl,
        updatedAt: now(),
      });
    });
  },

  incrementAnimeEpisode: async (id) => {
    await db.transaction("rw", db.anime, async () => {
      const anime = await db.anime.get(id);
      if (!anime || anime.deletedAt != null) return;
      const stamp = now();
      const nextEpisode = anime.totalEpisodes
        ? Math.min(anime.currentEpisode + 1, anime.totalEpisodes)
        : anime.currentEpisode + 1;
      await db.anime.put({
        ...anime,
        currentEpisode: nextEpisode,
        status:
          anime.totalEpisodes != null && nextEpisode >= anime.totalEpisodes
            ? "completed"
            : "watching",
        lastWatchedAt: stamp,
        updatedAt: stamp,
      });
    });
  },

  linkAnimeBgm: async (id, info) => {
    await db.transaction("rw", db.anime, async () => {
      const item = await db.anime.get(id);
      if (!item || item.deletedAt != null) return;
      await db.anime.put({
        ...item,
        bgmSubjectId: info.subjectId,
        bgmCoverUrl: info.coverUrl,
        title: info.title.trim() || item.title,
        totalEpisodes: item.totalEpisodes ?? info.totalEpisodes,
        updatedAt: now(),
      });
    });
  },

  deleteAnime: async (id) => {
    await db.transaction("rw", db.anime, async () => {
      const anime = await db.anime.get(id);
      if (!anime || anime.deletedAt != null) return;
      const stamp = now();
      await db.anime.put({ ...anime, deletedAt: stamp, updatedAt: stamp });
    });
  },
};
