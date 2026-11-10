import { todayKey } from "./dates";
import { comparePriorityDesc } from "./priority";
import type { ListRecord, TaskRecord } from "../types";

export const ALL_FOCUS_LISTS = "all";

export interface FocusTaskGroup {
  list: ListRecord;
  tasks: TaskRecord[];
}

export function selectFocusableTasks(tasks: TaskRecord[]) {
  return tasks.filter(
    (task) => task.parentId == null && task.completedAt == null,
  );
}

export function countFocusableTasksByList(tasks: TaskRecord[]) {
  const counts = new Map<string, number>();
  for (const task of selectFocusableTasks(tasks)) {
    counts.set(task.listId, (counts.get(task.listId) ?? 0) + 1);
  }
  return counts;
}

function matchesQuery(task: TaskRecord, query: string) {
  if (!query) return true;
  const searchable = [task.title, task.note, ...(task.tags ?? [])]
    .join(" ")
    .toLocaleLowerCase();
  return searchable.includes(query);
}

function dueRank(task: TaskRecord, today: string) {
  if (!task.dueDate) return 2;
  return task.dueDate <= today ? 0 : 1;
}

function compareFocusTasks(a: TaskRecord, b: TaskRecord, today: string) {
  const dueDifference = dueRank(a, today) - dueRank(b, today);
  if (dueDifference !== 0) return dueDifference;
  const priorityDifference = comparePriorityDesc(a, b);
  if (priorityDifference !== 0) return priorityDifference;
  if (a.dueDate && b.dueDate) {
    const dateDifference = a.dueDate.localeCompare(b.dueDate);
    if (dateDifference !== 0) return dateDifference;
  }
  return a.sortOrder - b.sortOrder || a.createdAt - b.createdAt;
}

export function buildFocusTaskGroups({
  tasks,
  lists,
  listId = ALL_FOCUS_LISTS,
  query = "",
  today = todayKey(),
}: {
  tasks: TaskRecord[];
  lists: ListRecord[];
  listId?: string;
  query?: string;
  today?: string;
}): FocusTaskGroup[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const focusable = selectFocusableTasks(tasks).filter(
    (task) =>
      (listId === ALL_FOCUS_LISTS || task.listId === listId) &&
      matchesQuery(task, normalizedQuery),
  );
  const tasksByList = new Map<string, TaskRecord[]>();
  for (const task of focusable) {
    const listTasks = tasksByList.get(task.listId);
    if (listTasks) listTasks.push(task);
    else tasksByList.set(task.listId, [task]);
  }

  return [...lists]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt)
    .map((list) => ({
      list,
      tasks: (tasksByList.get(list.id) ?? []).sort((a, b) =>
        compareFocusTasks(a, b, today),
      ),
    }))
    .filter((group) => group.tasks.length > 0);
}
