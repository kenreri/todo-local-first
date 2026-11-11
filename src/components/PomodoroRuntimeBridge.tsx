import { useEffect, useMemo, useRef } from "react";
import { connectPomodoroRuntime } from "../lib/pomodoroCoordinator";
import { ui } from "../i18n/messages";
import { usePomodoroStore } from "../store/pomodoroStore";
import { useTodoStore } from "../store/todoStore";
import { formatPomodoroTime } from "../lib/pomodoro";

export function PomodoroRuntimeBridge() {
  useEffect(() => connectPomodoroRuntime(), []);
  const saveError = usePomodoroStore((state) => state.saveError);
  const skip = usePomodoroStore((state) => state.skip);
  const locale = useTodoStore((state) => state.locale);
  const tasks = useTodoStore((state) => state.tasks);
  const phase = usePomodoroStore((state) => state.phase);
  const remainingSeconds = usePomodoroStore((state) => state.remainingSeconds);
  const sessionTaskId = usePomodoroStore((state) => state.sessionTaskId);
  const boundTaskId = usePomodoroStore((state) => state.boundTaskId);
  const hydrateConfig = usePomodoroStore((state) => state.hydrateConfig);
  const originalTitle = useRef(document.title);
  const t = ui(locale);

  const taskTitle = useMemo(() => {
    const taskId = sessionTaskId ?? boundTaskId;
    return taskId ? tasks.find((task) => task.id === taskId)?.title : null;
  }, [boundTaskId, sessionTaskId, tasks]);

  const phaseLabel =
    phase === "work"
      ? t.phaseWork
      : phase === "shortBreak"
        ? t.phaseShortBreak
        : phase === "longBreak"
          ? t.phaseLongBreak
          : t.phaseIdle;

  useEffect(() => {
    void hydrateConfig().catch((error) => {
      console.error("Could not load focus settings", error);
    });
  }, [hydrateConfig]);

  useEffect(() => {
    if (phase === "idle") {
      document.title = originalTitle.current;
      return;
    }
    document.title = `${formatPomodoroTime(remainingSeconds)} · ${taskTitle ?? phaseLabel}`;
  }, [phase, phaseLabel, remainingSeconds, taskTitle]);

  useEffect(
    () => () => {
      document.title = originalTitle.current;
    },
    [],
  );

  return saveError ? (
    <div role="alert" className="fixed bottom-24 left-4 right-4 z-50 mx-auto max-w-xl rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--bg-elevated)] p-4 text-[var(--ink)]">
      <p>{locale === "zh" ? "专注记录保存失败，计时已暂停，记录仍可重试。" : "Could not save the focus session. The timer is paused; retry to save it."}</p>
      <button type="button" className="ui-button-primary mt-2 px-3 py-2" onClick={() => void skip()}>{locale === "zh" ? "重试保存" : "Retry save"}</button>
    </div>
  ) : null;
}
