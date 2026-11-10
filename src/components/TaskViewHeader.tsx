import { ui } from "../i18n/messages";
import { useTodoStore } from "../store/todoStore";
import { TaskViewSwitch } from "./TaskViewSwitch";
import { PageHeader } from "./PageHeader";

export function TaskViewHeader() {
  const locale = useTodoStore((state) => state.locale);
  const lists = useTodoStore((state) => state.lists);
  const tasks = useTodoStore((state) => state.tasks);
  const selectedListId = useTodoStore((state) => state.selectedListId);
  const t = ui(locale);
  const selectedList = lists.find((item) => item.id === selectedListId);
  const activeCount = tasks.filter(
    (task) =>
      task.parentId == null &&
      task.completedAt == null &&
      (selectedListId == null || task.listId === selectedListId),
  ).length;
  const title = selectedList?.name ?? t.allTasks;

  return (
    <PageHeader
      title={title}
      description={t.taskViewSummary.replace("{n}", String(activeCount))}
      actions={<TaskViewSwitch />}
    />
  );
}
