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
    return {
      ...defaultRuntime(),
      ...value,
      running: Boolean(value.running),
      remainingSeconds: Math.max(0, Number(value.remainingSeconds) || 0),
      workCycles: Math.max(0, Number(value.workCycles) || 0),
      sessionTaskId: isFocusBindingLocked(
        value.phase as PomodoroPhase,
        value.sessionStartedAt ?? null,
      )
        ? resolveSessionTaskId(
            value.sessionTaskId ?? null,
            value.boundTaskId ?? null,
          )
        : null,
      accumulatedWorkSeconds: Math.max(
        0,
        Number(value.accumulatedWorkSeconds) || 0,
      ),
    };
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
  localStorage.setItem(RUNTIME_KEY, JSON.stringify(runtime));
}

function clearTick() {
  if (!tickTimer) return;
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
  if (!state.sessionStartedAt) return false;
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

  const finishPhase = async () => {
    clearTick();
    const state = get();
    const finishedAt = now();

    if (state.phase === "work") {
      await persistWorkSession(state, finishedAt);
      await notifyWorkComplete(state.sessionTaskId);
      const nextCycles = state.workCycles + 1;
      const longBreak = nextCycles % state.config.cyclesBeforeLongBreak === 0;
      const nextPhase: PomodoroPhase = longBreak ? "longBreak" : "shortBreak";
      const autoStart = shouldAutoStartPhase(nextPhase, state.config);
      const remainingSeconds = phaseDurationSeconds(nextPhase, state.config);
      playCuesForPhaseTransition(state.config, autoStart);
      set({
        phase: nextPhase,
        running: autoStart,
        remainingSeconds,
        workCycles: nextCycles,
        sessionTaskId: null,
        sessionStartedAt: null,
        accumulatedWorkSeconds: 0,
        activeSegmentStartedAt: null,
        phaseEndsAt: autoStart ? finishedAt + remainingSeconds * 1000 : null,
      });
      save();
      if (autoStart) startTicking();
      return;
    }

    notifyBreakComplete();
    const autoStart = shouldAutoStartPhase("work", state.config);
    const remainingSeconds = phaseDurationSeconds("work", state.config);
    playCuesForPhaseTransition(state.config, autoStart);
    set({
      phase: "work",
      running: autoStart,
      remainingSeconds,
      sessionTaskId: autoStart ? state.boundTaskId : null,
      sessionStartedAt: autoStart ? finishedAt : null,
      accumulatedWorkSeconds: 0,
      activeSegmentStartedAt: autoStart ? finishedAt : null,
      phaseEndsAt: autoStart ? finishedAt + remainingSeconds * 1000 : null,
    });
    save();
    if (autoStart) startTicking();
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

    hydrateConfig: async () => {
      if (hydrated) return;
      hydrated = true;
      const settings = await getSettings();
      const config = normalizePomodoroConfig(settings.pomodoroConfig);
      const state = get();
      const remainingSeconds = remainingSecondsAt(state, now());

      if (state.running && remainingSeconds <= 0) {
        set({ config, remainingSeconds: 0 });
        await finishPhase();
        return;
      }

      set({
        config,
        remainingSeconds:
          state.phase === "idle"
            ? phaseDurationSeconds("work", config)
            : remainingSeconds,
      });
      save();
      if (state.running) startTicking();
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
      if (isFocusBindingLocked(state.phase, state.sessionStartedAt)) return;
      set({ boundTaskId: taskId });
      save();
    },

    startWork: () => {
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
      if (!state.running) return;
      const pausedAt = now();
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

    skip: async () => {
      clearTick();
      unlockPomodoroAudio();
      const state = get();
      const skippedAt = now();
      const recorded =
        state.phase === "work" && (await persistWorkSession(state, skippedAt));

      if (state.phase === "work") {
        const nextCycles = state.workCycles + (recorded ? 1 : 0);
        const longBreak =
          nextCycles > 0 &&
          nextCycles % state.config.cyclesBeforeLongBreak === 0;
        const nextPhase: PomodoroPhase = longBreak ? "longBreak" : "shortBreak";
        const autoStart = shouldAutoStartPhase(nextPhase, state.config);
        const remainingSeconds = phaseDurationSeconds(nextPhase, state.config);
        playCuesForPhaseTransition(state.config, autoStart);
        set({
          phase: nextPhase,
          running: autoStart,
          remainingSeconds,
          workCycles: nextCycles,
          sessionTaskId: null,
          sessionStartedAt: null,
          accumulatedWorkSeconds: 0,
          activeSegmentStartedAt: null,
          phaseEndsAt: autoStart ? skippedAt + remainingSeconds * 1000 : null,
        });
        save();
        if (autoStart) startTicking();
        return;
      }

      const autoStart = shouldAutoStartPhase("work", state.config);
      const remainingSeconds = phaseDurationSeconds("work", state.config);
      playCuesForPhaseTransition(state.config, autoStart);
      set({
        phase: "work",
        running: autoStart,
        remainingSeconds,
        sessionTaskId: autoStart ? state.boundTaskId : null,
        sessionStartedAt: autoStart ? skippedAt : null,
        accumulatedWorkSeconds: 0,
        activeSegmentStartedAt: autoStart ? skippedAt : null,
        phaseEndsAt: autoStart ? skippedAt + remainingSeconds * 1000 : null,
      });
      save();
      if (autoStart) startTicking();
    },
  };
});
