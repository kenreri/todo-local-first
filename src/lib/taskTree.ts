import { comparePriorityDesc } from "./priority";
import type { TaskRecord } from "../types";

export function collectTaskTreeIds(
  tasks: TaskRecord[],
  rootIds: Iterable<string>,
) {
  const childrenByParent = new Map<string, string[]>();

  for (const task of tasks) {
    if (!task.parentId || task.deletedAt != null) continue;
    const children = childrenByParent.get(task.parentId) ?? [];
    children.push(task.id);
    childrenByParent.set(task.parentId, children);
  }

  const result = new Set<string>();
  const queue = [...rootIds];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || result.has(id)) continue;
    result.add(id);
    queue.push(...(childrenByParent.get(id) ?? []));
  }

  return result;
}

export function sortTasksByManualOrder(tasks: TaskRecord[]) {
  return [...tasks].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.createdAt - b.createdAt ||
      a.id.localeCompare(b.id),
  );
}

/** Incomplete first, completed last; within each zone priority rules over manual order. */
export function compareRootTasksForDisplay(a: TaskRecord, b: TaskRecord) {
  const aDone = a.completedAt != null ? 1 : 0;
  const bDone = b.completedAt != null ? 1 : 0;
  return (
    aDone - bDone ||
    comparePriorityDesc(a, b) ||
    a.sortOrder - b.sortOrder ||
    a.createdAt - b.createdAt
  );
}

export function sortRootTasksForDisplay(tasks: TaskRecord[]) {
  return [...tasks].sort(compareRootTasksForDisplay);
}

export function isTaskCompleted(task: Pick<TaskRecord, "completedAt">) {
  return task.completedAt != null;
}
