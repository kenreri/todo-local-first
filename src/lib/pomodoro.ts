import { toDateKey } from "./dates";
import type { PomodoroConfig, PomodoroPhase, PomodoroRecord } from "../types";

export function formatPomodoroTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface TimerClockState {
  running: boolean;
  remainingSeconds: number;
  phaseEndsAt: number | null;
  accumulatedWorkSeconds: number;
  activeSegmentStartedAt: number | null;
}

export function phaseDurationSeconds(
  phase: PomodoroPhase,
  config: PomodoroConfig,
) {
  if (phase === "shortBreak") return config.shortBreakMinutes * 60;
  if (phase === "longBreak") return config.longBreakMinutes * 60;
  return config.workMinutes * 60;
}

export function shouldAutoStartPhase(
  phase: PomodoroPhase,
  config: PomodoroConfig,
) {
  if (phase === "shortBreak" || phase === "longBreak") {
    return config.autoStartBreaks;
  }
  return phase === "work" && config.autoStartFocus;
}

export function timerProgress(remainingSeconds: number, totalSeconds: number) {
  if (totalSeconds <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds));
}

export function isFocusBindingLocked(
  phase: PomodoroPhase,
  sessionStartedAt: number | null,
) {
  return phase === "work" && sessionStartedAt != null;
}

export function resolveSessionTaskId(
  sessionTaskId: string | null,
  boundTaskId: string | null,
) {
  return sessionTaskId ?? boundTaskId;
}

export function summarizeFocusDay(records: PomodoroRecord[], dateKey: string) {
  const recordsForDay = records.filter(
    (record) => toDateKey(new Date(record.endAt)) === dateKey,
  );
  const seconds = recordsForDay.reduce(
    (total, record) => total + record.duration,
    0,
  );
  return {
    sessions: recordsForDay.length,
    seconds,
    minutes: Math.round(seconds / 60),
  };
}

export function remainingSecondsAt(state: TimerClockState, timestamp: number) {
  if (!state.running || state.phaseEndsAt == null)
    return state.remainingSeconds;
  return Math.max(0, Math.ceil((state.phaseEndsAt - timestamp) / 1000));
}

export function activeWorkSecondsAt(state: TimerClockState, timestamp: number) {
  const currentSegment =
    state.running && state.activeSegmentStartedAt != null
      ? Math.max(
          0,
          Math.floor((timestamp - state.activeSegmentStartedAt) / 1000),
        )
      : 0;
  return state.accumulatedWorkSeconds + currentSegment;
}
