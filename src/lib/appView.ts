import type { AppView, Locale, ThemeMode } from "../types";

export const APP_VIEWS: AppView[] = [
  "workspace",
  "lists",
  "list",
  "calendar",
  "today",
  "habits",
  "anime",
  "pomodoro",
  "stats",
];

export function coerceAppView(
  value: unknown,
  fallback: AppView = "list",
): AppView {
  return APP_VIEWS.includes(value as AppView) ? (value as AppView) : fallback;
}

export function coerceLocale(value: unknown): Locale {
  return value === "en" ? "en" : "zh";
}

export function coerceTheme(
  value: unknown,
  fallback: ThemeMode = "system",
): ThemeMode {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : fallback;
}
