import { create } from "zustand";
import { createId, db, now } from "../db";
import {
  activeWorkSecondsAt,
  isFocusBindingLocked,
  phaseDurationSeconds,
  remainingSecondsAt,
  resolveSessionTaskId,
  shouldAutoStartPhase,
} from "../lib/pomodoro";
import { normalizePomodoroConfig } from "../lib/pomodoroConfig";
import {
  playPhaseEndThenMaybeStart,
  playPomodoroCue,
  unlockPomodoroAudio,
} from "../lib/pomodoroSound";
import {
  getSettings,
  updatePomodoroConfig as persistPomodoroConfig,
} from "../seed";
import type { PomodoroConfig, PomodoroPhase } from "../types";
import { DEFAULT_POMODORO_CONFIG } from "../types";

const RUNTIME_KEY = "todo-pomodoro-runtime-v1";
let tickTimer: ReturnType<typeof setInterval> | null = null;
let hydrated = false;
let hydrationPromise: Promise<void> | null = null;

interface PomodoroRuntime {
  phase: PomodoroPhase;
  running: boolean;
  remainingSeconds: number;
  boundTaskId: string | null;
  sessionTaskId: string | null;
  workCycles: number;
  sessionStartedAt: number | null;
  accumulatedWorkSeconds: number;
  activeSegmentStartedAt: number | null;
  phaseEndsAt: number | null;
}

interface PomodoroState extends PomodoroRuntime {
  config: PomodoroConfig;
  hydrateConfig: () => Promise<void>;
  updateConfig: (patch: Partial<PomodoroConfig>) => Promise<void>;
  bindTask: (taskId: string | null) => void;
  startWork: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => Promise<void>;
}

function defaultRuntime(): PomodoroRuntime {
  return {
    phase: "idle",
    running: false,
    remainingSeconds: DEFAULT_POMODORO_CONFIG.workMinutes * 60,
    boundTaskId: null,
    sessionTaskId: null,
    workCycles: 0,
    sessionStartedAt: null,
    accumulatedWorkSeconds: 0,
    activeSegmentStartedAt: null,
    phaseEndsAt: null,
  };
}

function readRuntime(): PomodoroRuntime {
  if (typeof window === "undefined") return defaultRuntime();
  try {
    const value = JSON.parse(
      localStorage.getItem(RUNTIME_KEY) ?? "null",
    ) as Partial<PomodoroRuntime> | null;
    const validPhase = ["idle", "work", "shortBreak", "longBreak"].includes(
      value?.phase ?? "",
    );
    if (!value || !validPhase) return defaultRuntime();
    const isCounter = (number: unknown) =>
      typeof number === "number" && Number.isSafeInteger(number) && number >= 0;
    for (const key of [
      "remainingSeconds",
      "workCycles",
      "accumulatedWorkSeconds",
    ] as const) {
      if (value[key] !== undefined && !isCounter(value[key]))
        return defaultRuntime();
    }
    for (const key of [
      "sessionStartedAt",
      "activeSegmentStartedAt",
      "phaseEndsAt",
    ] as const) {
      if (value[key] != null && !isCounter(value[key])) return defaultRuntime();
    }
    if (value.running !== undefined && typeof value.running !== "boolean")
      return defaultRuntime();
    const boundTaskId =
      typeof value.boundTaskId === "string" ? value.boundTaskId : null;
    const runtime: PomodoroRuntime = {
      phase: value.phase as PomodoroPhase,
      running: value.running === true,
      remainingSeconds:
        value.remainingSeconds ?? defaultRuntime().remainingSeconds,
      workCycles: value.workCycles ?? 0,
      boundTaskId,
      sessionTaskId: isFocusBindingLocked(
        value.phase as PomodoroPhase,
        value.sessionStartedAt ?? null,
      )
        ? resolveSessionTaskId(
            typeof value.sessionTaskId === "string"
              ? value.sessionTaskId
              : null,
            boundTaskId,
          )
        : null,
      accumulatedWorkSeconds: value.accumulatedWorkSeconds ?? 0,
      sessionStartedAt: value.sessionStartedAt ?? null,
      activeSegmentStartedAt: value.running
        ? (value.activeSegmentStartedAt ?? null)
        : null,
      phaseEndsAt: value.running ? (value.phaseEndsAt ?? null) : null,
    };
    if (
      runtime.running &&
      (runtime.phase === "idle" ||
        runtime.phaseEndsAt == null ||
        (runtime.phase === "work" &&
          (runtime.sessionStartedAt == null ||
            runtime.activeSegmentStartedAt == null)))
    ) {
      return defaultRuntime();
    }
    return runtime;
  } catch {
    return defaultRuntime();
  }
}

function persistRuntime(state: PomodoroState) {
  if (typeof window === "undefined") return;
  const runtime: PomodoroRuntime = {
    phase: state.phase,
    running: state.running,
    remainingSeconds: state.remainingSeconds,
    boundTaskId: state.boundTaskId,
    sessionTaskId: state.sessionTaskId,
    workCycles: state.workCycles,
    sessionStartedAt: state.sessionStartedAt,
    accumulatedWorkSeconds: state.accumulatedWorkSeconds,
    activeSegmentStartedAt: state.activeSegmentStartedAt,
    phaseEndsAt: state.phaseEndsAt,
  };
  try {
    localStorage.setItem(RUNTIME_KEY, JSON.stringify(runtime));
  } catch (error) {
    // Losing reload recovery must not prevent the in-memory clock from running.
    console.warn("Could not persist the pomodoro runtime", error);
  }
}

function clearTick() {
  if (tickTimer === null) return;
  clearInterval(tickTimer);
  tickTimer = null;
}

function playCuesForPhaseTransition(
  config: PomodoroConfig,
  autoStartNext: boolean,
) {
  if (!config.soundEnabled) return;
  playPhaseEndThenMaybeStart(config.soundVolume, autoStartNext);
}

function playStartCueIfEnabled(config: PomodoroConfig) {
  if (!config.soundEnabled) return;
  playPomodoroCue("start", config.soundVolume);
}

function notify(title: string, body: string) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    new Notification(title, { body });
  } catch {
    // Notifications are optional.
  }
}

async function persistWorkSession(state: PomodoroState, endAt: number) {
  if (state.sessionStartedAt == null) return false;
  const duration = Math.min(
    activeWorkSecondsAt(state, endAt),
    phaseDurationSeconds("work", state.config),
  );
  if (duration < 1) return false;
  await db.pomodoroRecords.put({
    id: createId(),
    taskId: state.sessionTaskId,
    startAt: state.sessionStartedAt,
    endAt,
    duration,
    createdAt: endAt,
  });
  return true;
}

async function notifyWorkComplete(taskId: string | null) {
  try {
    const chinese = document.documentElement.lang.startsWith("zh");
    const task = taskId ? await db.tasks.get(taskId) : null;
    notify(
      chinese ? "专注完成" : "Focus complete",
      task?.title
        ? chinese
          ? `已完成「${task.title}」的一轮专注。`
          : `Finished a focus session for “${task.title}”.`
        : chinese
          ? "本轮专注已完成。"
          : "Focus session complete.",
    );
  } catch (error) {
    console.warn("Could not show the focus completion notification", error);
  }
}

function notifyBreakComplete() {
  const chinese = document.documentElement.lang.startsWith("zh");
  notify(
    chinese ? "休息结束" : "Break complete",
    chinese ? "准备开始下一轮专注。" : "Ready for the next focus session.",
  );
}

const restoredRuntime = readRuntime();

export const usePomodoroStore = create<PomodoroState>((set, get) => {
  const save = () => persistRuntime(get());

  let transition: Promise<void> | null = null;
  let runtimeRevision = 0;

  // Natural completion and manual finishing share one in-flight operation.
  const finishPhase = (skipped = false): Promise<void> => {
    if (transition) return transition;
    const state = get();
    if (
      state.phase === "idle" ||
      (skipped && state.phase === "work" && state.sessionStartedAt == null)
    ) {
      return Promise.resolve();
    }
    const revision = runtimeRevision;
    const finishedAt =
      state.running && state.phaseEndsAt != null
        ? Math.min(now(), state.phaseEndsAt)
        : now();
    clearTick();

    const operation = Promise.resolve()
      .then(async () => {
        if (revision !== runtimeRevision) return;
        // Freeze elapsed time before writing. A failed write leaves a retryable session.
        set({
          running: false,
          remainingSeconds: remainingSecondsAt(state, finishedAt),
          accumulatedWorkSeconds:
            state.phase === "work"
              ? activeWorkSecondsAt(state, finishedAt)
              : state.accumulatedWorkSeconds,
          activeSegmentStartedAt: null,
          phaseEndsAt: null,
        });
        save();

        const recorded =
          state.phase === "work" &&
          (await persistWorkSession(state, finishedAt));
        // Reset can start another session while the previous database write is pending.
        if (revision !== runtimeRevision) return;
        const workCycles =
          state.workCycles +
          (state.phase === "work" && (!skipped || recorded) ? 1 : 0);
        const nextPhase: PomodoroPhase =
          state.phase === "work"
            ? workCycles > 0 &&
              workCycles % state.config.cyclesBeforeLongBreak === 0
              ? "longBreak"
              : "shortBreak"
            : "work";
        const autoStart = shouldAutoStartPhase(nextPhase, state.config);
        const remainingSeconds = phaseDurationSeconds(nextPhase, state.config);
        const startedAt = now();
        const startsWork = nextPhase === "work" && autoStart;
        set({
          phase: nextPhase,
          running: autoStart,
          remainingSeconds,
          workCycles,
          sessionTaskId: startsWork ? state.boundTaskId : null,
          sessionStartedAt: startsWork ? startedAt : null,
          accumulatedWorkSeconds: 0,
          activeSegmentStartedAt: startsWork ? startedAt : null,
          phaseEndsAt: autoStart ? startedAt + remainingSeconds * 1000 : null,
        });
        save();
        if (autoStart) startTicking();
        playCuesForPhaseTransition(state.config, autoStart);
        if (!skipped) {
          if (state.phase === "work")
            void notifyWorkComplete(state.sessionTaskId);
          else notifyBreakComplete();
        }
      })
      .catch((error) => {
        // Keep the frozen runtime; the user can retry finishing or resume it.
        console.error("Could not save the focus session", error);
      })
      .finally(() => {
        if (transition === operation) transition = null;
      });
    transition = operation;
    return operation;
  };

  const startTicking = () => {
    clearTick();
    tickTimer = setInterval(() => {
      const state = get();
      if (!state.running) return;
      const remainingSeconds = remainingSecondsAt(state, now());
      if (remainingSeconds <= 0) {
        void finishPhase();
        return;
      }
      if (remainingSeconds !== state.remainingSeconds)
        set({ remainingSeconds });
    }, 1000);
  };

  return {
    ...restoredRuntime,
    config: DEFAULT_POMODORO_CONFIG,

    hydrateConfig: () => {
      if (hydrated) return Promise.resolve();
      if (hydrationPromise) return hydrationPromise;
      hydrationPromise = (async () => {
        const settings = await getSettings();
        const config = normalizePomodoroConfig(settings.pomodoroConfig);
        const state = get();
        const remainingSeconds = remainingSecondsAt(state, now());

        if (state.running && remainingSeconds <= 0) {
          set({ config, remainingSeconds: 0 });
          await finishPhase();
        } else {
          set({
            config,
            remainingSeconds:
              state.phase === "idle"
                ? phaseDurationSeconds("work", config)
                : remainingSeconds,
          });
          save();
          if (state.running) startTicking();
        }
        hydrated = true;
      })().finally(() => {
        hydrationPromise = null;
      });
      return hydrationPromise;
    },

    updateConfig: async (patch) => {
      unlockPomodoroAudio();
      await persistPomodoroConfig(patch);
      const config = normalizePomodoroConfig({ ...get().config, ...patch });
      const state = get();
      set({
        config,
        remainingSeconds:
          state.phase === "idle"
            ? phaseDurationSeconds("work", config)
            : state.remainingSeconds,
      });
      save();
    },

    bindTask: (taskId) => {
      const state = get();
      if (
        transition ||
        isFocusBindingLocked(state.phase, state.sessionStartedAt)
      )
        return;
      set({ boundTaskId: taskId });
      save();
    },

    startWork: () => {
      if (transition || get().running) return;
      unlockPomodoroAudio();
      const state = get();
      const startedAt = now();
      const phase: PomodoroPhase =
        state.phase === "idle" ? "work" : state.phase;
      const remainingSeconds =
        state.phase === "idle"
          ? phaseDurationSeconds("work", state.config)
          : state.remainingSeconds;
      playStartCueIfEnabled(state.config);
      set({
        phase,
        running: true,
        remainingSeconds,
        phaseEndsAt: startedAt + remainingSeconds * 1000,
        sessionStartedAt:
          phase === "work"
            ? (state.sessionStartedAt ?? startedAt)
            : state.sessionStartedAt,
        sessionTaskId:
          phase === "work"
            ? resolveSessionTaskId(state.sessionTaskId, state.boundTaskId)
            : state.sessionTaskId,
        accumulatedWorkSeconds:
          phase === "work" ? state.accumulatedWorkSeconds : 0,
        activeSegmentStartedAt: phase === "work" ? startedAt : null,
      });
      save();
      startTicking();
    },

    pause: () => {
      const state = get();
      if (transition || !state.running) return;
      const pausedAt = now();
      if (remainingSecondsAt(state, pausedAt) <= 0) {
        void finishPhase();
        return;
      }
      clearTick();
      set({
        running: false,
        remainingSeconds: remainingSecondsAt(state, pausedAt),
        accumulatedWorkSeconds:
          state.phase === "work"
            ? activeWorkSecondsAt(state, pausedAt)
            : state.accumulatedWorkSeconds,
        activeSegmentStartedAt: null,
        phaseEndsAt: null,
      });
      save();
    },

    resume: () => {
      if (transition || get().running) return;
      unlockPomodoroAudio();
      const state = get();
      if (state.phase === "idle") {
        get().startWork();
        return;
      }
      const resumedAt = now();
      set({
        running: true,
        phaseEndsAt: resumedAt + state.remainingSeconds * 1000,
        sessionStartedAt:
          state.phase === "work"
            ? (state.sessionStartedAt ?? resumedAt)
            : state.sessionStartedAt,
        sessionTaskId:
          state.phase === "work"
            ? resolveSessionTaskId(state.sessionTaskId, state.boundTaskId)
            : state.sessionTaskId,
        activeSegmentStartedAt: state.phase === "work" ? resumedAt : null,
      });
      save();
      startTicking();
    },

    reset: () => {
      runtimeRevision += 1;
      transition = null;
      clearTick();
      const state = get();
      set({
        ...defaultRuntime(),
        boundTaskId: state.boundTaskId,
        workCycles: state.workCycles,
        remainingSeconds: phaseDurationSeconds("work", state.config),
      });
      save();
    },

    skip: () => {
      unlockPomodoroAudio();
      return finishPhase(true);
    },
  };
});
