import type { PomodoroConfig } from "../types";
import { DEFAULT_POMODORO_CONFIG } from "../types";

export const POMODORO_PRESETS = [
  {
    id: "classic",
    workMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    cyclesBeforeLongBreak: 4,
  },
  {
    id: "deep",
    workMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 20,
    cyclesBeforeLongBreak: 2,
  },
] as const;

type LegacyPomodoroConfig = Partial<PomodoroConfig> | null | undefined;

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const number = typeof value === "number" ? value : Number.NaN;
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

export function normalizePomodoroConfig(
  value: LegacyPomodoroConfig,
): PomodoroConfig {
  return {
    workMinutes: boundedInteger(
      value?.workMinutes,
      DEFAULT_POMODORO_CONFIG.workMinutes,
      1,
      180,
    ),
    shortBreakMinutes: boundedInteger(
      value?.shortBreakMinutes,
      DEFAULT_POMODORO_CONFIG.shortBreakMinutes,
      1,
      180,
    ),
    longBreakMinutes: boundedInteger(
      value?.longBreakMinutes,
      DEFAULT_POMODORO_CONFIG.longBreakMinutes,
      1,
      180,
    ),
    cyclesBeforeLongBreak: boundedInteger(
      value?.cyclesBeforeLongBreak,
      DEFAULT_POMODORO_CONFIG.cyclesBeforeLongBreak,
      1,
      12,
    ),
    autoStartBreaks:
      typeof value?.autoStartBreaks === "boolean"
        ? value.autoStartBreaks
        : DEFAULT_POMODORO_CONFIG.autoStartBreaks,
    autoStartFocus:
      typeof value?.autoStartFocus === "boolean"
        ? value.autoStartFocus
        : DEFAULT_POMODORO_CONFIG.autoStartFocus,
    soundEnabled:
      typeof value?.soundEnabled === "boolean"
        ? value.soundEnabled
        : DEFAULT_POMODORO_CONFIG.soundEnabled,
    soundVolume: boundedInteger(
      value?.soundVolume,
      DEFAULT_POMODORO_CONFIG.soundVolume,
      0,
      100,
    ),
    dailyGoalMinutes: boundedInteger(
      value?.dailyGoalMinutes,
      DEFAULT_POMODORO_CONFIG.dailyGoalMinutes,
      1,
      1440,
    ),
  };
}

export function pomodoroConfigEquals(
  left: Partial<PomodoroConfig> | null | undefined,
  right: PomodoroConfig,
) {
  if (!left) return false;
  return (Object.keys(DEFAULT_POMODORO_CONFIG) as Array<keyof PomodoroConfig>).every(
    (key) => left[key] === right[key],
  );
}

export function matchesPomodoroPreset(
  config: PomodoroConfig,
  preset: (typeof POMODORO_PRESETS)[number],
) {
  return (
    config.workMinutes === preset.workMinutes &&
    config.shortBreakMinutes === preset.shortBreakMinutes &&
    config.longBreakMinutes === preset.longBreakMinutes &&
    config.cyclesBeforeLongBreak === preset.cyclesBeforeLongBreak
  );
}
