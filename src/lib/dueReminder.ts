import type { TaskRecord } from "../types";

export interface DueReminderSummary {
  tasks: TaskRecord[];
  overdue: number;
  dueToday: number;
  total: number;
}

export function buildDueReminderSummary(
  tasks: TaskRecord[],
  today: string,
): DueReminderSummary {
  const dueTasks = tasks
    .filter(
      (task) =>
        task.parentId == null &&
        task.completedAt == null &&
        task.dueDate != null &&
        task.dueDate <= today,
    )
    .sort(
      (a, b) =>
        a.dueDate!.localeCompare(b.dueDate!) || a.createdAt - b.createdAt,
    );
  const overdue = dueTasks.filter((task) => task.dueDate! < today).length;

  return {
    tasks: dueTasks,
    overdue,
    dueToday: dueTasks.length - overdue,
    total: dueTasks.length,
  };
}
