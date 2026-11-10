import { describe, expect, it } from "vitest";
import {
  matchesPomodoroPreset,
  normalizePomodoroConfig,
  POMODORO_PRESETS,
} from "./pomodoroConfig";

describe("pomodoro preferences", () => {
  it("fills new preferences when reading a legacy config", () => {
    expect(
      normalizePomodoroConfig({
        workMinutes: 30,
        shortBreakMinutes: 6,
        longBreakMinutes: 18,
        cyclesBeforeLongBreak: 3,
      }),
    ).toEqual({
      workMinutes: 30,
      shortBreakMinutes: 6,
      longBreakMinutes: 18,
      cyclesBeforeLongBreak: 3,
      autoStartBreaks: false,
      autoStartFocus: false,
      soundEnabled: true,
      soundVolume: 70,
      dailyGoalMinutes: 100,
    });
  });

  it("clamps invalid numeric preferences", () => {
    const config = normalizePomodoroConfig({
      workMinutes: 0,
      shortBreakMinutes: 999,
      longBreakMinutes: Number.NaN,
      cyclesBeforeLongBreak: 30,
      dailyGoalMinutes: -10,
      soundVolume: 250,
    });
    expect(config.workMinutes).toBe(1);
    expect(config.shortBreakMinutes).toBe(180);
    expect(config.longBreakMinutes).toBe(15);
    expect(config.cyclesBeforeLongBreak).toBe(12);
    expect(config.dailyGoalMinutes).toBe(1);
    expect(config.soundVolume).toBe(100);
  });

  it("detects the active duration preset without changing other preferences", () => {
    const config = normalizePomodoroConfig({
      ...POMODORO_PRESETS[1],
      autoStartBreaks: true,
    });
    expect(matchesPomodoroPreset(config, POMODORO_PRESETS[1])).toBe(true);
    expect(config.autoStartBreaks).toBe(true);
  });
});
