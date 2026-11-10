import { useEffect } from "react";
import type { AppView } from "../types";
import { useTodoStore } from "../store/todoStore";

const VIEW_KEYS: AppView[] = [
  "today",
  "list",
  "habits",
  "pomodoro",
  "stats",
];

function focusShortcutInput(shortcut: "create" | "search") {
  const input = document.querySelector<HTMLInputElement>(
    `input[data-shortcut="${shortcut}"]`,
  );
  if (!input || input.disabled || input.getClientRects().length === 0)
    return false;
  input.focus();
  return true;
}

function focusAfterViewChange(shortcut: "create" | "search") {
  window.requestAnimationFrame(() => {
    focusShortcutInput(shortcut);
  });
}

export function useShortcuts() {
  const setView = useTodoStore((s) => s.setView);
  const openInbox = useTodoStore((s) => s.openInbox);
  const view = useTodoStore((s) => s.view);
  const theme = useTodoStore((s) => s.theme);
  const setTheme = useTodoStore((s) => s.setTheme);
  const clearChecked = useTodoStore((s) => s.clearChecked);
  const checkedIds = useTodoStore((s) => s.checkedIds);
  const selectedTaskId = useTodoStore((s) => s.selectedTaskId);
  const selectTask = useTodoStore((s) => s.selectTask);
  const toggleTask = useTodoStore((s) => s.toggleTask);
  const batchComplete = useTodoStore((s) => s.batchComplete);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const typing =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable;

      if (event.key === "Escape") {
        clearChecked();
        selectTask(null);
        (document.activeElement as HTMLElement | null)?.blur?.();
        return;
      }

      if (typing) return;
      if (event.metaKey || event.ctrlKey || event.altKey) {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === "enter"
        ) {
          event.preventDefault();
          if (checkedIds.length > 0) void batchComplete(checkedIds, true);
          else if (selectedTaskId) void toggleTask(selectedTaskId);
        }
        return;
      }

      if (event.key >= "1" && event.key <= "5") {
        // Main shortcuts follow the five consolidated navigation entries.
        const view = VIEW_KEYS[Number(event.key) - 1];
        if (view) void setView(view);
        return;
      }

      if (event.key.toLowerCase() === "b" && ["lists", "list", "calendar"].includes(view)) {
        event.preventDefault();
        if (view === "calendar") {
          useTodoStore.getState().selectList(null);
          useTodoStore.getState().setSearch("");
          useTodoStore.getState().setFilter("all");
        }
        void setView(view === "calendar" ? "list" : "calendar");
        return;
      }

      if (event.key.toLowerCase() === "d") {
        const order = ["light", "dark", "system"] as const;
        const idx = order.indexOf(theme);
        void setTheme(order[(idx + 1) % order.length]);
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        if (focusShortcutInput("search")) return;
        void setView("list").then(() => focusAfterViewChange("search"));
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (focusShortcutInput("create")) return;
        void openInbox().then(() => focusAfterViewChange("create"));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    openInbox,
    setView,
    view,
    theme,
    setTheme,
    clearChecked,
    checkedIds,
    selectedTaskId,
    selectTask,
    toggleTask,
    batchComplete,
  ]);
}
