import { Bell, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ui } from "../i18n/messages";
import { todayKey } from "../lib/dates";
import { getHabitCheckIn, isHabitScheduled } from "../lib/habits";
import { useTodoStore } from "../store/todoStore";

export function HabitReminder() {
  const locale = useTodoStore((state) => state.locale);
  const habits = useTodoStore((state) => state.habits);
  const checkIns = useTodoStore((state) => state.habitCheckIns);
  const setView = useTodoStore((state) => state.setView);
  const t = ui(locale);
  const [clock, setClock] = useState(() => Date.now());
  const [dismissed, setDismissed] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  const date = todayKey(new Date(clock));
  const time = new Date(clock).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dueHabits = useMemo(
    () =>
      habits.filter(
        (habit) =>
          habit.reminderTime != null &&
          habit.reminderTime <= time &&
          isHabitScheduled(habit, date) &&
          !getHabitCheckIn(checkIns, habit.id, date),
      ),
    [habits, checkIns, date, time],
  );

  useEffect(() => {
    if (permission !== "granted") return;
    for (const habit of dueHabits) {
      const key = `todo-habit-notified:${date}:${habit.id}`;
      if (sessionStorage.getItem(key)) continue;
      try {
        new Notification(`${habit.emoji} ${habit.title}`, {
          body:
            locale === "zh"
              ? `\u5230\u4e86 ${habit.reminderTime}\uff0c\u8bb0\u5f97\u5b8c\u6210\u4eca\u5929\u7684\u4e60\u60ef\u3002`
              : `It is ${habit.reminderTime}. Time for today's habit.`,
        });
        sessionStorage.setItem(key, "1");
      } catch {
        // Browser notifications can be unavailable in embedded webviews.
      }
    }
  }, [date, dueHabits, locale, permission]);

  useEffect(() => setDismissed(false), [date]);

  if (dismissed || dueHabits.length === 0) return null;

  return (
    <aside className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--accent-soft)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button
            type="button"
            className="inline-flex items-center gap-2 font-medium text-[var(--accent)] hover:underline"
            onClick={() => void setView("habits")}
          >
            <Bell className="size-4" />
            {t.habitToday}
          </button>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ink)]">
            {dueHabits.map((habit) => (
              <li key={habit.id}>
                {habit.emoji} {habit.title}
                <span className="ml-2 text-[var(--muted)]">
                  {habit.reminderTime}
                </span>
              </li>
            ))}
          </ul>
          {permission === "default" ? (
            <button
              type="button"
              className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--ink)]"
              onClick={async () => {
                const next = await Notification.requestPermission();
                setPermission(next);
              }}
            >
              {t.habitEnableNotifications}
            </button>
          ) : null}
          {permission === "denied" ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              {t.habitReminderDenied}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={t.dueReminderDismiss}
          className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--hover)]"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </button>
      </div>
    </aside>
  );
}
