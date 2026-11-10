import { useEffect, useMemo, useRef } from "react";
import { ui } from "../i18n/messages";
import { usePomodoroStore } from "../store/pomodoroStore";
import { useTodoStore } from "../store/todoStore";
import { formatPomodoroTime } from "../lib/pomodoro";

export function PomodoroRuntimeBridge() {
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
    void hydrateConfig();
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

  return null;
}
