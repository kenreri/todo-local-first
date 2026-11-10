import { describe, expect, it } from "vitest";
import {
  activeWorkSecondsAt,
  isFocusBindingLocked,
  phaseDurationSeconds,
  remainingSecondsAt,
  resolveSessionTaskId,
  shouldAutoStartPhase,
  summarizeFocusDay,
  timerProgress,
} from "./pomodoro";

describe("pomodoro clock calculations", () => {
  it("derives remaining time from the deadline", () => {
    expect(
      remainingSecondsAt(
        {
          running: true,
          remainingSeconds: 60,
          phaseEndsAt: 70_000,
          accumulatedWorkSeconds: 0,
          activeSegmentStartedAt: 10_000,
        },
        40_500,
      ),
    ).toBe(30);
  });

  it("counts active segments but excludes paused time", () => {
    expect(
      activeWorkSecondsAt(
        {
          running: true,
          remainingSeconds: 60,
          phaseEndsAt: 90_000,
          accumulatedWorkSeconds: 25,
          activeSegmentStartedAt: 40_000,
        },
        50_900,
      ),
    ).toBe(35);
    expect(
      activeWorkSecondsAt(
        {
          running: false,
          remainingSeconds: 60,
          phaseEndsAt: null,
          accumulatedWorkSeconds: 25,
          activeSegmentStartedAt: null,
        },
        500_000,
      ),
    ).toBe(25);
  });

  it("calculates phase duration and clamps progress", () => {
    const config = {
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
      autoStartBreaks: false,
      autoStartFocus: false,
      soundEnabled: true,
      soundVolume: 70,
      dailyGoalMinutes: 100,
    };
    expect(phaseDurationSeconds("work", config)).toBe(1500);
    expect(phaseDurationSeconds("shortBreak", config)).toBe(300);
    expect(timerProgress(750, 1500)).toBe(0.5);
    expect(timerProgress(-10, 1500)).toBe(1);
  });

  it("only auto-starts the phases enabled by the user", () => {
    const config = {
      workMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      cyclesBeforeLongBreak: 4,
      autoStartBreaks: true,
      autoStartFocus: false,
      soundEnabled: true,
      soundVolume: 70,
      dailyGoalMinutes: 100,
    };
    expect(shouldAutoStartPhase("shortBreak", config)).toBe(true);
    expect(shouldAutoStartPhase("longBreak", config)).toBe(true);
    expect(shouldAutoStartPhase("work", config)).toBe(false);
    expect(shouldAutoStartPhase("idle", config)).toBe(false);
  });

  it("locks an active work session to its starting task", () => {
    expect(isFocusBindingLocked("work", 100)).toBe(true);
    expect(isFocusBindingLocked("work", null)).toBe(false);
    expect(isFocusBindingLocked("shortBreak", 100)).toBe(false);
    expect(resolveSessionTaskId("started-task", "new-selection")).toBe(
      "started-task",
    );
    expect(resolveSessionTaskId(null, "selected-task")).toBe("selected-task");
  });

  it("summarizes focus sessions for one local day", () => {
    const noon = new Date(2026, 7, 20, 12).getTime();
    const tomorrow = new Date(2026, 7, 21, 12).getTime();
    const records = [
      {
        id: "a",
        taskId: null,
        startAt: noon - 1_500_000,
        endAt: noon,
        duration: 1500,
        createdAt: noon,
      },
      {
        id: "b",
        taskId: null,
        startAt: noon,
        endAt: noon + 600_000,
        duration: 600,
        createdAt: noon + 600_000,
      },
      {
        id: "c",
        taskId: null,
        startAt: tomorrow - 300_000,
        endAt: tomorrow,
        duration: 300,
        createdAt: tomorrow,
      },
    ];

    expect(summarizeFocusDay(records, "2026-08-20")).toEqual({
      sessions: 2,
      seconds: 2100,
      minutes: 35,
    });
  });
});
