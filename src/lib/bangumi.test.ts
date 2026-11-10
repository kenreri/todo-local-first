import { describe, expect, it } from "vitest";
import {
  parseBangumiCover,
  parseBangumiEpisodes,
  parseBangumiSubject,
  parseBangumiTitle,
} from "./bangumi";

describe("bangumi parsers", () => {
  it("prefers eps (main episodes) over total_episodes (often includes specials)", () => {
    expect(
      parseBangumiEpisodes({ total_episodes: 16, eps: 12 }),
    ).toBe(12);
  });

  it("falls back to total_episodes when eps is missing", () => {
    expect(parseBangumiEpisodes({ total_episodes: 24 })).toBe(24);
    expect(parseBangumiEpisodes({ eps: 0, total_episodes: 13 })).toBe(13);
  });

  it("returns null for missing or invalid episode counts", () => {
    expect(parseBangumiEpisodes({})).toBeNull();
    expect(parseBangumiEpisodes({ eps: 0 })).toBeNull();
    expect(parseBangumiEpisodes({ total_episodes: -1 })).toBeNull();
  });

  it("falls back cover sizes large > common > medium", () => {
    expect(
      parseBangumiCover({
        common: "https://lain.bgm.tv/c.jpg",
        medium: "https://lain.bgm.tv/m.jpg",
        large: "https://lain.bgm.tv/l.jpg",
      }),
    ).toBe("https://lain.bgm.tv/l.jpg");
    expect(
      parseBangumiCover({
        medium: "https://lain.bgm.tv/m.jpg",
        large: "https://lain.bgm.tv/l.jpg",
      }),
    ).toBe("https://lain.bgm.tv/l.jpg");
    expect(parseBangumiCover({ large: "https://lain.bgm.tv/l.jpg" })).toBe(
      "https://lain.bgm.tv/l.jpg",
    );
    expect(parseBangumiCover(null)).toBeNull();
    expect(parseBangumiCover({ common: "/relative.jpg" })).toBeNull();
  });

  it("prefers name_cn and falls back to name", () => {
    expect(
      parseBangumiTitle({ name: "Frieren", name_cn: "\u846c\u9001\u7684\u8299\u8389\u83b2" }),
    ).toBe("\u846c\u9001\u7684\u8299\u8389\u83b2");
    expect(parseBangumiTitle({ name: "Frieren", name_cn: "  " })).toBe(
      "Frieren",
    );
    expect(parseBangumiTitle({ name: "Frieren" })).toBe("Frieren");
  });

  it("parses a subject and rejects records without id or title", () => {
    expect(
      parseBangumiSubject({
        id: 18329,
        name: "Sousou no Frieren",
        name_cn: "\u846c\u9001\u7684\u8299\u8389\u83b2",
        date: "2023-09-29",
        images: { large: "https://lain.bgm.tv/l.jpg", common: "https://lain.bgm.tv/c.jpg" },
        total_episodes: 28,
        rating: { score: 9.0 },
      }),
    ).toMatchObject({
      subjectId: 18329,
      title: "\u846c\u9001\u7684\u8299\u8389\u83b2",
      name: "Sousou no Frieren",
      coverUrl: "https://lain.bgm.tv/l.jpg",
      totalEpisodes: 28,
      score: 9.0,
    });
    expect(parseBangumiSubject({ name: "No id" })).toBeNull();
    expect(parseBangumiSubject({ id: 1, name: "", name_cn: "" })).toBeNull();
  });
});
