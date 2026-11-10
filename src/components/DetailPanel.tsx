import { lazy, Suspense } from "react";
import { useTodoStore } from "../store/todoStore";

const PomodoroTaskPicker = lazy(() =>
  import("./PomodoroTaskPicker").then((module) => ({
    default: module.PomodoroTaskPicker,
  })),
);

const TaskDetailPanel = lazy(() =>
  import("./TaskDetailPanel").then((module) => ({
    default: module.TaskDetailPanel,
  })),
);

export function DetailPanel() {
  const view = useTodoStore((state) => state.view);
  const selectedTaskId = useTodoStore((state) => state.selectedTaskId);

  if (view === "pomodoro") {
    return (
      <Suspense fallback={<PanelPlaceholder />}>
        <PomodoroTaskPicker />
      </Suspense>
    );
  }

  if (view === "stats" || !selectedTaskId) return null;

  return (
    <Suspense fallback={null}>
      <TaskDetailPanel key={selectedTaskId} taskId={selectedTaskId} />
    </Suspense>
  );
}

function PanelPlaceholder() {
  return (
    <aside
      aria-hidden="true"
      className="ui-card min-h-48"
    />
  );
}
