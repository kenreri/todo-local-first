import { dailyPlan } from "./taskPlanning";
import { materialLinks } from "./materialLinks";
import type { TaskRecord } from "../types";

export function workspaceAgenda(tasks: TaskRecord[], today: string) {
  const active = tasks.filter(
    (task) =>
      task.deletedAt == null &&
      task.completedAt == null &&
      task.parentId == null,
  );
  const deadlines = active
    .filter((task) => task.dueDate)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  return {
    today: dailyPlan(
      active.filter((task) => task.scheduledDate || task.repeatRule),
      today,
    ).current,
    overdue: deadlines.filter((task) => task.dueDate! < today),
    upcoming: deadlines.filter((task) => task.dueDate! >= today),
  };
}

export function workspaceExcerpt(title: string, body: string) {
  return body
    .split("\n")
    .filter((line, index) => index !== 0 || line.trim() !== title.trim())
    .join("\n")
    .replace(/\[([^\]]*)\]\((?:https?|obsidian|zotero):\/\/[^\s]+\)/gi, "$1")
    .replace(/\b(?:https?|obsidian|zotero):\/\/[^\s]+/gi, "")
    .trim();
}

export function workspaceDisplayTitle(title: string) {
  if (!/^(?:https?|obsidian|zotero):\/\/\S+$/i.test(title.trim())) return title;
  const link = materialLinks(title)[0];
  if (!link) return title;
  if (link.kind === "web") return new URL(link.href).hostname;
  return `${link.kind === "obsidian" ? "Obsidian" : "Zotero"} · ${link.detail}`;
}
