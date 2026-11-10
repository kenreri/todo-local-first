import { useEffect, useMemo } from "react";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { ui } from "../i18n/messages";
import { todayKey } from "../lib/dates";
import {
  isFocusBindingLocked,
  phaseDurationSeconds,
  summarizeFocusDay,
  timerProgress,
} from "../lib/pomodoro";
import {
  matchesPomodoroPreset,
  POMODORO_PRESETS,
} from "../lib/pomodoroConfig";
import { playPomodoroCue } from "../lib/pomodoroSound";
import { usePomodoroStore } from "../store/pomodoroStore";
import { useTodoStore } from "../store/todoStore";
import type { Locale, PomodoroRecord } from "../types";
import { PageHeader } from "./PageHeader";
import { formatPomodoroTime } from "../lib/pomodoro";

const TIMER_RADIUS = 96;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

export function PomodoroView() {
  const locale = useTodoStore((state) => state.locale);
  const tasks = useTodoStore((state) => state.tasks);
  const pomodoroRecords = useTodoStore((state) => state.pomodoroRecords);
  const t = ui(locale);

  const phase = usePomodoroStore((state) => state.phase);
  const running = usePomodoroStore((state) => state.running);
  const remainingSeconds = usePomodoroStore((state) => state.remainingSeconds);
  const boundTaskId = usePomodoroStore((state) => state.boundTaskId);
  const sessionTaskId = usePomodoroStore((state) => state.sessionTaskId);
  const sessionStartedAt = usePomodoroStore((state) => state.sessionStartedAt);
  const workCycles = usePomodoroStore((state) => state.workCycles);
  const config = usePomodoroStore((state) => state.config);
  const hydrateConfig = usePomodoroStore((state) => state.hydrateConfig);
  const updateConfig = usePomodoroStore((state) => state.updateConfig);
  const startWork = usePomodoroStore((state) => state.startWork);
  const pause = usePomodoroStore((state) => state.pause);
  const resume = usePomodoroStore((state) => state.resume);
  const reset = usePomodoroStore((state) => state.reset);
  const skip = usePomodoroStore((state) => state.skip);

  useEffect(() => {
    void hydrateConfig();
  }, [hydrateConfig]);

  const taskById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const displayTaskId = sessionTaskId ?? boundTaskId;
  const boundTask = (displayTaskId ? taskById.get(displayTaskId) : null) ?? null;
  const phaseLabel =
    phase === "work"
      ? t.phaseWork
      : phase === "shortBreak"
        ? t.phaseShortBreak
        : phase === "longBreak"
          ? t.phaseLongBreak
          : t.phaseIdle;
  const totalSeconds = phaseDurationSeconds(phase, config);
  const progress =
    phase === "idle" ? 0 : timerProgress(remainingSeconds, totalSeconds);
  const cycleTotal = Math.max(1, config.cyclesBeforeLongBreak);
  const completedInCycle = workCycles % cycleTotal;
  const cycleDisplayCompleted =
    phase === "longBreak" ? cycleTotal : completedInCycle;
  const currentRound =
    phase === "longBreak"
      ? cycleTotal
      : phase === "shortBreak"
        ? Math.max(1, completedInCycle)
        : completedInCycle + 1;
  const nextBreakIsLong = (workCycles + 1) % cycleTotal === 0;
  const nextPhaseLabel =
    phase === "idle" || phase === "work"
      ? nextBreakIsLong
        ? t.phaseLongBreak
        : t.phaseShortBreak
      : t.phaseWork;
  const nextPhaseMinutes =
    phase === "idle" || phase === "work"
      ? nextBreakIsLong
        ? config.longBreakMinutes
        : config.shortBreakMinutes
      : config.workMinutes;
  const todaySummary = useMemo(
    () => summarizeFocusDay(pomodoroRecords, todayKey()),
    [pomodoroRecords],
  );
  const recentRecords = useMemo(
    () => pomodoroRecords.slice(0, 3),
    [pomodoroRecords],
  );
  const dailyGoalProgress = Math.min(
    1,
    todaySummary.minutes / Math.max(1, config.dailyGoalMinutes),
  );
  const hasStartedWork = isFocusBindingLocked(phase, sessionStartedAt);
  const canSkip =
    phase === "shortBreak" || phase === "longBreak" || hasStartedWork;
  const settingsLocked = phase !== "idle";

  return (
    <section className="min-w-0 space-y-6">
      <PageHeader title={t.navFocus} description={t.focusSubtitle} />

      <div
        className="focus-card ui-card min-w-0 p-5 md:p-6 2xl:p-7"
        data-phase={phase}
        data-running={running}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[var(--focus-phase-color)]">
            {phaseLabel}
            {phase !== "idle" ? ` · ${running ? t.focusRunning : t.focusPaused}` : ""}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {t.focusRound
              .replace("{current}", String(currentRound))
              .replace("{total}", String(cycleTotal))}
          </p>
        </div>

        <div className="mt-5 flex flex-col items-center gap-4 2xl:mt-7 2xl:gap-6">
          <div
            role="timer"
            aria-label={`${phaseLabel} ${formatPomodoroTime(remainingSeconds)}`}
            className="focus-timer relative grid size-48 place-items-center sm:size-52 2xl:size-56"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 224 224"
              className="absolute inset-0 size-full -rotate-90"
            >
              <circle
                cx="112"
                cy="112"
                r={TIMER_RADIUS}
                fill="none"
                stroke="var(--line)"
                strokeWidth="10"
              />
              <circle
                cx="112"
                cy="112"
                r={TIMER_RADIUS}
                fill="none"
                stroke="var(--focus-phase-color)"
                strokeLinecap="round"
                strokeWidth="10"
                strokeDasharray={TIMER_CIRCUMFERENCE}
                strokeDashoffset={TIMER_CIRCUMFERENCE * (1 - progress)}
                className="focus-timer-progress transition-[stroke-dashoffset] duration-500"
              />
            </svg>
            <div className="text-center">
              <div className="text-4xl font-bold tracking-[-0.04em] text-[var(--ink)] sm:text-5xl">
                {formatPomodoroTime(remainingSeconds)}
              </div>
              <div className="mt-2 text-xs text-[var(--muted)]">
                {t.nextPhase}：{nextPhaseLabel} · {nextPhaseMinutes} {t.minutes}
              </div>
            </div>
          </div>

          <div className="w-full max-w-xl rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-center">
            <div className="text-xs text-[var(--muted)]">{t.bindTask}</div>
            <div className="mt-1 font-medium text-[var(--ink)]">
              {boundTask
                ? boundTask.title
                : displayTaskId
                  ? t.taskUnavailable
                  : t.noBoundTask}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {!running ? (
              <button
                type="button"
                onClick={() => (phase === "idle" ? startWork() : resume())}
                className="ui-button-primary inline-flex items-center gap-2 px-4 py-2.5"
              >
                <Play className="size-4" />
                {phase === "idle" ||
                (phase === "work" && sessionStartedAt == null)
                  ? t.start
                  : t.resume}
              </button>
            ) : (
              <button
                type="button"
                onClick={pause}
                className="ui-button-secondary inline-flex items-center gap-2 px-4 py-2.5"
              >
                <Pause className="size-4" />
                {t.pause}
              </button>
            )}
            <button
              type="button"
              disabled={!canSkip}
              onClick={() => {
                if (
                  phase === "work" &&
                  !window.confirm(t.pomodoroFinishEarlyConfirm)
                )
                  return;
                void skip();
              }}
              className="ui-button-secondary inline-flex items-center gap-2 px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <SkipForward className="size-4" />
              {phase === "work"
                ? t.finishFocusEarly
                : phase === "idle"
                  ? t.skip
                  : t.skipBreak}
            </button>
            <button
              type="button"
              disabled={phase === "idle"}
              onClick={() => {
                if (hasStartedWork && !window.confirm(t.pomodoroResetConfirm))
                  return;
                reset();
              }}
              className="ui-button-secondary inline-flex items-center gap-2 px-4 py-2.5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RotateCcw className="size-4" />
              {hasStartedWork ? t.discardFocus : t.reset}
            </button>
          </div>
        </div>

        <details className="mt-6 border-t border-[var(--line)] pt-4">
          <summary className="cursor-pointer list-none text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)] [&::-webkit-details-marker]:hidden">
            {t.pomodoroSettings}
          </summary>
          <div className="mt-4">
            <p className="text-sm font-medium text-[var(--ink)]">
              {t.pomodoroQuickPresets}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {POMODORO_PRESETS.map((preset) => {
                const selected = matchesPomodoroPreset(config, preset);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={settingsLocked}
                    aria-pressed={selected}
                    onClick={() => void updateConfig(preset)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--hover)]"
                    }`}
                  >
                    {preset.id === "classic"
                      ? t.pomodoroPresetClassic
                      : t.pomodoroPresetDeep}
                  </button>
                );
              })}
            </div>
          </div>

          <fieldset className="mt-4" disabled={settingsLocked}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ConfigInput
                label={t.workMinutes}
                value={config.workMinutes}
                onChange={(value) => void updateConfig({ workMinutes: value })}
              />
              <ConfigInput
                label={t.shortBreakMinutes}
                value={config.shortBreakMinutes}
                onChange={(value) =>
                  void updateConfig({ shortBreakMinutes: value })
                }
              />
              <ConfigInput
                label={t.longBreakMinutes}
                value={config.longBreakMinutes}
                onChange={(value) =>
                  void updateConfig({ longBreakMinutes: value })
                }
              />
              <ConfigInput
                label={t.cyclesBeforeLongBreak}
                value={config.cyclesBeforeLongBreak}
                onChange={(value) =>
                  void updateConfig({ cyclesBeforeLongBreak: value })
                }
              />
            </div>
            {settingsLocked ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {t.settingsLocked}
              </p>
            ) : null}
          </fieldset>

          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="text-sm font-medium text-[var(--ink)]">
              {t.pomodoroAutomation}
            </p>
            <div className="mt-2 space-y-2">
              <PreferenceToggle
                label={t.autoStartBreaks}
                description={t.autoStartBreaksHint}
                enabled={config.autoStartBreaks}
                onChange={(enabled) =>
                  void updateConfig({ autoStartBreaks: enabled })
                }
              />
              <PreferenceToggle
                label={t.autoStartFocus}
                description={t.autoStartFocusHint}
                enabled={config.autoStartFocus}
                onChange={(enabled) =>
                  void updateConfig({ autoStartFocus: enabled })
                }
              />
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="text-sm font-medium text-[var(--ink)]">
              {t.pomodoroSoundSection}
            </p>
            <div className="mt-2 space-y-3">
              <PreferenceToggle
                label={t.pomodoroSound}
                description={t.pomodoroSoundHint}
                enabled={config.soundEnabled}
                onChange={(enabled) =>
                  void updateConfig({ soundEnabled: enabled })
                }
              />
              <div
                className={`rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 ${
                  config.soundEnabled ? "" : "opacity-55"
                }`}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-[var(--ink)]">
                    {t.pomodoroSoundVolume}
                  </span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {config.soundVolume}%
                  </span>
                </div>
                <input
                  type="range"
                  className="ui-range mt-3"
                  min={0}
                  max={100}
                  step={5}
                  value={config.soundVolume}
                  disabled={!config.soundEnabled}
                  aria-label={t.pomodoroSoundVolume}
                  onChange={(event) =>
                    void updateConfig({
                      soundVolume: Number(event.target.value),
                    })
                  }
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!config.soundEnabled || config.soundVolume === 0}
                    className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() =>
                      playPomodoroCue("start", config.soundVolume)
                    }
                  >
                    {t.pomodoroSoundPreviewStart}
                  </button>
                  <button
                    type="button"
                    disabled={!config.soundEnabled || config.soundVolume === 0}
                    className="rounded-lg border border-[var(--line)] bg-[var(--bg-elevated)] px-2.5 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => playPomodoroCue("end", config.soundVolume)}
                  >
                    {t.pomodoroSoundPreviewEnd}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--line)] pt-4">
            <p className="text-sm font-medium text-[var(--ink)]">
              {t.pomodoroDailyGoalSection}
            </p>
            <div className="mt-3 max-w-xs">
              <ConfigInput
                label={t.dailyFocusGoal}
                value={config.dailyGoalMinutes}
                max={1440}
                onChange={(value) =>
                  void updateConfig({ dailyGoalMinutes: value })
                }
              />
            </div>
          </div>
        </details>
      </div>

      <div className="ui-card p-5 md:p-6">
        <h2 className="text-base font-semibold">{t.todayFocus}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SummaryItem
            label={t.todayFocusMinutes}
            value={todaySummary.minutes}
          />
          <SummaryItem
            label={t.todayFocusSessions}
            value={todaySummary.sessions}
          />
          <SummaryItem
            label={t.currentCycle}
            value={`${cycleDisplayCompleted}/${cycleTotal}`}
          />
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--surface)] px-3 py-3">
          <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
            <span>
              {t.dailyGoalProgress
                .replace("{current}", String(todaySummary.minutes))
                .replace("{goal}", String(config.dailyGoalMinutes))}
            </span>
            {dailyGoalProgress >= 1 ? (
              <span className="font-medium text-[var(--accent)]">
                {t.dailyGoalReached}
              </span>
            ) : null}
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={config.dailyGoalMinutes}
            aria-valuenow={Math.min(
              todaySummary.minutes,
              config.dailyGoalMinutes,
            )}
            className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--line)]"
          >
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-[width]"
              style={{ width: `${dailyGoalProgress * 100}%` }}
            />
          </div>
        </div>

        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <h3 className="text-sm font-medium">{t.recentFocus}</h3>
          {recentRecords.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted)]">
              {t.emptyFocusRecords}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {recentRecords.map((record) => (
                <RecentFocusItem
                  key={record.id}
                  record={record}
                  taskTitle={
                    (record.taskId ? taskById.get(record.taskId)?.title : null) ??
                    (record.taskId ? t.taskUnavailable : t.noBoundTask)
                  }
                  locale={locale}
                  minutesLabel={t.minutes}
                  lessThanMinuteLabel={t.lessThanMinute}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-[var(--surface)] px-3 py-3 text-center">
      <div className="text-xl font-semibold text-[var(--ink)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--muted)]">{label}</div>
    </div>
  );
}

function RecentFocusItem({
  record,
  taskTitle,
  locale,
  minutesLabel,
  lessThanMinuteLabel,
}: {
  record: PomodoroRecord;
  taskTitle: string;
  locale: Locale;
  minutesLabel: string;
  lessThanMinuteLabel: string;
}) {
  const minutes = Math.round(record.duration / 60);
  const timestamp = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(record.endAt));

  return (
    <li className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium text-[var(--ink)]">
          {taskTitle}
        </div>
        <div className="mt-0.5 text-xs text-[var(--muted)]">{timestamp}</div>
      </div>
      <div className="shrink-0 text-[var(--muted)]">
        {record.duration < 60
          ? lessThanMinuteLabel
          : `${minutes} ${minutesLabel}`}
      </div>
    </li>
  );
}

function ConfigInput({
  label,
  value,
  max = 180,
  onChange,
}: {
  label: string;
  value: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1.5 text-sm text-[var(--muted)]">
      <span>{label}</span>
      <input
        type="number"
        min={1}
        max={max}
        value={value}
        onChange={(event) =>
          onChange(Math.max(1, Number(event.target.value) || 1))
        }
        className="ui-input w-full px-3 py-2 disabled:opacity-50"
      />
    </label>
  );
}

function PreferenceToggle({
  label,
  description,
  enabled,
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3">
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left hover:opacity-90"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--ink)]">
            {label}
          </span>
          <span className="mt-0.5 block text-xs leading-5 text-[var(--muted)]">
            {description}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled ? "bg-[var(--accent)]" : "bg-[var(--chip)]"
          }`}
        >
          <span
            className={`absolute top-1 size-4 rounded-full transition-transform ${
              enabled
                ? "translate-x-6 bg-[var(--on-accent)]"
                : "translate-x-1 bg-[var(--bg-elevated)]"
            }`}
          />
        </span>
      </button>
    </div>
  );
}
