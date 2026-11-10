import { todayKey } from "./dates";
import type { AnimeRecord } from "../types";

/** Clapperboard. Escaped so GBK editors cannot corrupt the default icon. */
export const DEFAULT_ANIME_EMOJI = "\u{1F3AC}";

/** UTF-8 clapperboard mis-decoded as GBK. */
const BROKEN_ANIME_EMOJI_GBK = "\u9984\u6475";

export function normalizeAnimeEmoji(emoji: string | null | undefined) {
  const value = emoji?.trim() ?? "";
  if (!value || value === BROKEN_ANIME_EMOJI_GBK) return DEFAULT_ANIME_EMOJI;
  return value;
}

export function watchedOnDate(anime: AnimeRecord, date: string) {
  return (
    anime.lastWatchedAt != null &&
    todayKey(new Date(anime.lastWatchedAt)) === date
  );
}

export function isAnimeScheduled(anime: AnimeRecord, date: string) {
  if (
    anime.deletedAt != null ||
    anime.status === "completed" ||
    anime.status === "paused"
  ) {
    return false;
  }
  // none：纯进度记录，不参与今天/日历/提醒
  if (anime.scheduleMode === "none") return false;
  // daily：每天都是观看日（老番补番的弹性节奏）
  if (anime.scheduleMode === "daily") return true;
  // weekly：需要固定观看日
  if (anime.watchWeekday == null) return false;
  return new Date(`${date}T00:00:00`).getDay() === anime.watchWeekday;
}

/**
 * 把可能来自旧版本/旧备份的番剧记录补齐新字段默认值。
 * scheduleMode 缺失时按 watchWeekday 推导（有观看日→weekly，否则 none）。
 */
export function normalizeAnimeRecord(item: AnimeRecord): AnimeRecord {
  const airKind = item.airKind === "finished" ? "finished" : "ongoing";
  const scheduleMode =
    item.scheduleMode === "weekly" || item.scheduleMode === "daily"
      ? item.scheduleMode
      : item.watchWeekday != null
        ? "weekly"
        : "none";
  return {
    ...item,
    airKind,
    scheduleMode,
    bgmSubjectId: item.bgmSubjectId ?? null,
    bgmCoverUrl: item.bgmCoverUrl ?? null,
  };
}

export function isAnimeReminderDue(
  anime: AnimeRecord,
  date: string,
  time: string,
) {
  return (
    isAnimeScheduled(anime, date) &&
    anime.reminderTime != null &&
    anime.reminderTime <= time &&
    !watchedOnDate(anime, date)
  );
}

export function animeProgress(anime: AnimeRecord) {
  if (!anime.totalEpisodes || anime.totalEpisodes <= 0) return null;
  return Math.min(
    100,
    Math.round((anime.currentEpisode / anime.totalEpisodes) * 100),
  );
}
