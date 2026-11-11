import { useViewNavigation } from "../hooks/useViewNavigation";
import { SaveStatus } from "./SaveStatus";
import { createPortal } from "react-dom";
import { Pause, Play, Timer } from "lucide-react";
import { ui } from "../i18n/messages";
import { cn } from "../lib/cn";
import { usePomodoroStore } from "../store/pomodoroStore";
import { useTodoStore } from "../store/todoStore";
import { formatPomodoroTime } from "../lib/pomodoro";

export function FocusStatusIndicator({
  compact = false,
}: {
  compact?: boolean;
}) {
  const locale = useTodoStore((state) => state.locale);
  const navigation = useViewNavigation();
  const tasks = useTodoStore((state) => state.tasks);
  const phase = usePomodoroStore((state) => state.phase);
  const running = usePomodoroStore((state) => state.running);
  const remainingSeconds = usePomodoroStore((state) => state.remainingSeconds);
  const sessionTaskId = usePomodoroStore((state) => state.sessionTaskId);
  const boundTaskId = usePomodoroStore((state) => state.boundTaskId);
  const t = ui(locale);

  if (phase === "idle") return null;

  const phaseLabel =
    phase === "work"
      ? t.phaseWork
      : phase === "shortBreak"
        ? t.phaseShortBreak
        : t.phaseLongBreak;
  const taskId = sessionTaskId ?? boundTaskId;
  const taskTitle = taskId
    ? tasks.find((task) => task.id === taskId)?.title
    : null;
  const time = formatPomodoroTime(remainingSeconds);
  const ariaLabel = t.focusStatusAria
    .replace("{phase}", phaseLabel)
    .replace("{time}", time)
    .replace("{state}", running ? t.focusRunning : t.focusPaused);

  return (
    <div className={compact ? "relative" : undefined}>
    <button
      type="button"
      data-phase={phase}
      data-running={running}
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={navigation.saving} onClick={() => void navigation.navigate("pomodoro")}
      className={cn(
        "focus-status group text-left",
        compact
          ? "relative grid size-9 place-items-center rounded-[var(--radius-control)]"
          : "mt-3 flex w-full items-center gap-3 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5 hover:border-[var(--focus-phase-color)]",
      )}
    >
      <span
        className={cn(
          "focus-status-icon relative grid shrink-0 place-items-center rounded-full",
          compact ? "size-7" : "size-9",
        )}
      >
        <Timer className={compact ? "size-4" : "size-4.5"} />
        <span className="focus-status-dot" aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[var(--focus-phase-color)]">
              {phaseLabel} · {running ? t.focusRunning : t.focusPaused}
            </span>
            <span className="font-semibold tabular-nums text-[var(--ink)]">
              {time}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
            {taskTitle ?? t.returnToFocus}
          </span>
        </span>
      ) : running ? (
        <Play className="sr-only" />
      ) : (
        <Pause className="sr-only" />
      )}
    </button>
    {navigation.saving || navigation.failed ? compact ? createPortal(
      <div className="fixed bottom-4 left-16 z-50 w-64 max-w-[calc(100vw-5rem)] rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-floating)]">
        <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
      </div>, document.body,
    ) : <div className="mt-2">
      <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
    </div> : null}
    </div>
  );
}
