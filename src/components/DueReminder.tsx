import { useViewNavigation } from "../hooks/useViewNavigation";
import { SaveStatus } from "./SaveStatus";
import { useLocalDate } from "../hooks/useLocalDate";
import { useEffect, useMemo, useState } from "react";
import { Bell, ChevronRight, X } from "lucide-react";
import { ui } from "../i18n/messages";
import { buildDueReminderSummary } from "../lib/dueReminder";
import { useTodoStore } from "../store/todoStore";

const DISMISS_KEY = "todo-due-reminder-dismissed-date";
const DETAIL_LIMIT = 3;

export function DueReminder() {
  const locale = useTodoStore((s) => s.locale);
  const tasks = useTodoStore((s) => s.tasks);
  const view = useTodoStore((s) => s.view);
  const selectTask = useTodoStore((s) => s.selectTask);
  const navigation = useViewNavigation();
  const t = ui(locale);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  const today = useLocalDate();
  const summary = useMemo(
    () => buildDueReminderSummary(tasks, today),
    [tasks, today],
  );
  const summaryLabel = t.dueReminderSummary
    .replace("{total}", String(summary.total))
    .replace("{overdue}", String(summary.overdue))
    .replace("{today}", String(summary.dueToday));
  const compact = view !== "today" || !expanded;

  useEffect(() => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(DISMISS_KEY);
    setDismissed(saved === today);
  }, [today]);

  useEffect(() => {
    if (summary.total === 0) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const notifiedKey = `todo-due-notified:${today}`;
    if (sessionStorage.getItem(notifiedKey)) return;

    const body =
      locale === "zh"
        ? `\u4eca\u65e5 ${summary.dueToday} \u9879\u5230\u671f\uff0c${summary.overdue} \u9879\u5df2\u8fc7\u671f`
        : `${summary.dueToday} due today, ${summary.overdue} overdue`;

    try {
      new Notification(t.dueReminderTitle, { body });
      sessionStorage.setItem(notifiedKey, "1");
    } catch {
      // ignore
    }
  }, [locale, summary.dueToday, summary.overdue, summary.total, t.dueReminderTitle, today]);

  if (dismissed || summary.total === 0) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, today);
    setDismissed(true);
  };

  if (compact) {
    return (
      <div className="min-w-0 space-y-2">
      <div
        role="status"
        className="flex min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-[var(--banner-due-border)] bg-[var(--banner-due)] px-3 py-2"
      >
        <Bell
          aria-hidden="true"
          className="size-4 shrink-0 text-[var(--danger)]"
        />
        <p className="min-w-0 flex-1 truncate text-sm text-[var(--ink)]">
          <span className="font-medium text-[var(--danger)]">
            {t.dueReminderTitle}
          </span>
          <span className="mx-2 text-[var(--muted)]">·</span>
          <span>{summaryLabel}</span>
        </p>
        <button
          type="button"
          disabled={navigation.saving}
          aria-expanded={view === "today" ? expanded : undefined}
          onClick={() => {
            if (view === "today") setExpanded(true);
            else void navigation.navigate("today");
          }}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-[var(--accent)] hover:bg-[var(--hover)]"
        >
          {view === "today" ? t.reminderExpand : t.dueReminderView}
          <ChevronRight aria-hidden="true" className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label={t.dueReminderDismiss}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--danger-soft)]"
          onClick={dismiss}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-[var(--radius-card)] border border-[var(--banner-due-border)] bg-[var(--banner-due)] px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium text-[var(--danger)]">
            <Bell aria-hidden="true" className="size-4" />
            {t.dueReminderTitle}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">{summaryLabel}</p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ink)]">
            {summary.tasks.slice(0, DETAIL_LIMIT).map((task) => (
              <li key={task.id}>
                <button
                  type="button"
                  className="max-w-full text-left hover:underline"
                  onClick={() => {
                    selectTask(task.id);
                    setExpanded(false);
                  }}
                >
                  {task.title}
                  <span className="ml-2 text-[var(--muted)]">{task.dueDate}</span>
                </button>
              </li>
            ))}
          </ul>
          {summary.total > DETAIL_LIMIT ? (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {t.dueReminderMore.replace(
                "{n}",
                String(summary.total - DETAIL_LIMIT),
              )}
            </p>
          ) : null}
          {permission === "default" ? (
            <button
              type="button"
              className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm text-[var(--ink)]"
              onClick={async () => {
                const next = await Notification.requestPermission();
                setPermission(next);
              }}
            >
              {t.dueReminderEnable}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="ui-button-secondary shrink-0 px-3 py-2 text-sm"
        >
          {t.reminderCollapse}
        </button>
        <button
          type="button"
          aria-label={t.dueReminderDismiss}
          className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--danger-soft)]"
          onClick={dismiss}
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
