import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANIME_EMOJI,
  animeProgress,
  isAnimeReminderDue,
  isAnimeScheduled,
  normalizeAnimeEmoji,
  normalizeAnimeRecord,
} from "./anime";
import type { AnimeRecord } from "../types";

function anime(overrides: Partial<AnimeRecord> = {}): AnimeRecord {
  return {
    id: "anime-1",
    title: "Frieren",
    emoji: DEFAULT_ANIME_EMOJI,
    status: "watching",
    airKind: "ongoing",
    scheduleMode: "weekly",
    currentEpisode: 6,
    totalEpisodes: 12,
    watchWeekday: 4,
    reminderTime: "20:00",
    note: "",
    lastWatchedAt: null,
    bgmSubjectId: null,
    bgmCoverUrl: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...overrides,
  };
}

describe("anime schedule and progress", () => {
  it("schedules active entries on their selected weekday", () => {
    expect(isAnimeScheduled(anime(), "2026-08-20")).toBe(true);
    expect(isAnimeScheduled(anime(), "2026-08-21")).toBe(false);
    expect(isAnimeScheduled(anime({ status: "planned" }), "2026-08-20")).toBe(
      true,
    );
    expect(isAnimeScheduled(anime({ status: "paused" }), "2026-08-20")).toBe(
      false,
    );
  });

  it("treats daily schedule as every day", () => {
    expect(
      isAnimeScheduled(
        anime({ scheduleMode: "daily", watchWeekday: null }),
        "2026-08-20",
      ),
    ).toBe(true);
    expect(
      isAnimeScheduled(
        anime({ scheduleMode: "daily", watchWeekday: null }),
        "2026-08-21",
      ),
    ).toBe(true);
  });

  it("never schedules when mode is none", () => {
    expect(isAnimeScheduled(anime({ scheduleMode: "none" }), "2026-08-20")).toBe(
      false,
    );
  });

  it("reminds after the configured time unless watched today", () => {
    expect(isAnimeReminderDue(anime(), "2026-08-20", "20:01")).toBe(true);
    expect(isAnimeReminderDue(anime(), "2026-08-20", "19:59")).toBe(false);
    expect(
      isAnimeReminderDue(
        anime({ lastWatchedAt: new Date(2026, 7, 20, 12).getTime() }),
        "2026-08-20",
        "20:01",
      ),
    ).toBe(false);
  });

  it("restores the default icon when empty or GBK-mojibake", () => {
    expect(normalizeAnimeEmoji("")).toBe(DEFAULT_ANIME_EMOJI);
    expect(normalizeAnimeEmoji(" \u9984\u6475 ")).toBe(DEFAULT_ANIME_EMOJI);
    expect(normalizeAnimeEmoji("\u{1F4FA}")).toBe("\u{1F4FA}");
  });

  it("calculates bounded episode progress", () => {
    expect(animeProgress(anime())).toBe(50);
    expect(animeProgress(anime({ currentEpisode: 15 }))).toBe(100);
    expect(animeProgress(anime({ totalEpisodes: null }))).toBeNull();
  });

  it("fills missing watch-plan fields from weekday", () => {
    const withWeekday = normalizeAnimeRecord({
      ...anime(),
      airKind: undefined,
      scheduleMode: undefined,
      bgmSubjectId: undefined,
      bgmCoverUrl: undefined,
    } as unknown as AnimeRecord);
    expect(withWeekday).toMatchObject({
      airKind: "ongoing",
      scheduleMode: "weekly",
      bgmSubjectId: null,
      bgmCoverUrl: null,
    });

    const withoutWeekday = normalizeAnimeRecord({
      ...anime({ watchWeekday: null }),
      airKind: undefined,
      scheduleMode: undefined,
    } as unknown as AnimeRecord);
    expect(withoutWeekday.scheduleMode).toBe("none");
  });
});
