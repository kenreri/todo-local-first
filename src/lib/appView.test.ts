import { describe, expect, it } from "vitest";
import { coerceAppView, coerceLocale, coerceTheme } from "./appView";

describe("coerce persisted UI settings", () => {
  it("falls back when defaultView is unknown", () => {
    expect(coerceAppView("focus")).toBe("list");
    expect(coerceAppView("habits")).toBe("habits");
    expect(coerceAppView("pomodoro", "today")).toBe("pomodoro");
  });

  it("only keeps supported locale and theme values", () => {
    expect(coerceLocale("en")).toBe("en");
    expect(coerceLocale("zh-CN")).toBe("zh");
    expect(coerceTheme("dark")).toBe("dark");
    expect(coerceTheme("dim")).toBe("system");
  });
});
