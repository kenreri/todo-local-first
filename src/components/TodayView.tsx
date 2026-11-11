import { useViewNavigation } from "../hooks/useViewNavigation";
import { SaveStatus } from "./SaveStatus";
import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { useLocalDate } from "../hooks/useLocalDate";
import { useMemo } from "react";
import {
  AlarmClock,
  CheckCircle2,
  Check,
  ChevronRight,
  Flame,
  ListTodo,
  Timer,
} from "lucide-react";
import { PriorityBadge } from "./PriorityBadge";
import { ui } from "../i18n/messages";
import { cn } from "../lib/cn";
import {
  comparePriorityDesc,
  normalizePriority,
  priorityVar,
} from "../lib/priority";
import { dailyPlan, planningLabel } from "../lib/taskPlanning";
import { TaskScheduleControl } from "./TaskScheduleControl";
import { QuickCapture } from "./QuickCapture";
import { getHabitCheckIn, isHabitScheduled } from "../lib/habits";
import { isAnimeScheduled } from "../lib/anime";
import { todayKey } from "../lib/dates";
import { useTodoStore } from "../store/todoStore";
import type { TaskOccurrence } from "../types";
import { PageHeader } from "./PageHeader";
import { SakuraEmpty } from "./SakuraEmpty";

export function TodayView() {
  const locale = useTodoStore((state) => state.locale);
  const tasks = useTodoStore((state) => state.tasks);
  const habits = useTodoStore((state) => state.habits);
  const checkIns = useTodoStore((state) => state.habitCheckIns);
  const anime = useTodoStore((state) => state.anime);
  const selectTask = useTodoStore((state) => state.selectTask);
  const persistToggleTask = useTodoStore((state) => state.toggleTask);
  const persistSetHabitCheckIn = useTodoStore((state) => state.setHabitCheckIn);
  const persistIncrementAnimeEpisode = useTodoStore(
    (state) => state.incrementAnimeEpisode,
  );
  const navigation = useViewNavigation();
  const selectedTaskId = useTodoStore((state) => state.selectedTaskId);
  const t = ui(locale);
  const { run, failed } = useSaveFeedback();
  const toggleTask = (...args: Parameters<typeof persistToggleTask>) => run(() => persistToggleTask(...args));
  const setHabitCheckIn = (...args: Parameters<typeof persistSetHabitCheckIn>) => run(() => persistSetHabitCheckIn(...args));
  const incrementAnimeEpisode = (...args: Parameters<typeof persistIncrementAnimeEpisode>) => run(() => persistIncrementAnimeEpisode(...args));

  const today = useLocalDate();

  const buckets = useMemo(() => {
    const roots = tasks.filter((task) => task.parentId == null);
    const next = dailyPlan(roots, today);
    const byDisplay = (a: TaskOccurrence, b: TaskOccurrence) => {
      const aDone = a.task.completedAt != null ? 1 : 0;
      const bDone = b.task.completedAt != null ? 1 : 0;
      return (
        aDone - bDone ||
        comparePriorityDesc(a.task, b.task) ||
        a.date.localeCompare(b.date)
      );
    };
    next.previous.sort(byDisplay);
    next.current.sort(byDisplay);
    next.upcoming.sort(byDisplay);
    return next;
  }, [tasks, today]);

  const scheduledHabits = useMemo(
    () => habits.filter((habit) => isHabitScheduled(habit, today)),
    [habits, today],
  );
  const scheduledAnime = useMemo(
    () => anime.filter((item) => isAnimeScheduled(item, today)),
    [anime, today],
  );
  const dateLabel = new Intl.DateTimeFormat(
    locale === "zh" ? "zh-CN" : "en",
    { month: "long", day: "numeric", weekday: "long" },
  ).format(new Date(`${today}T12:00:00`));
  const primarySections = [
    { key: "today", title: t.dueToday, items: buckets.current },
  ];
  const hasPrimaryTasks = primarySections.some(
    (section) => section.items.length > 0,
  );

  const dueTodayDone = tasks.filter(task => task.parentId == null && task.completedAt != null && todayKey(new Date(task.completedAt)) === today).length;
  const dueTodayOpen = buckets.current.length;
  const habitDone = scheduledHabits.filter(
    (habit) => getHabitCheckIn(checkIns, habit.id, today)?.status === "completed",
  ).length;

  const statCards = [
    {
      key: "overdue",
      icon: AlarmClock,
      label: t.previousUnfinished,
      value: String(buckets.previous.length),
      valueClass:
        buckets.previous.length > 0
          ? "text-[var(--danger)]"
          : "text-[var(--ink)]",
      chipClass: "bg-[var(--danger-soft)] text-[var(--danger)]",
    },
    {
      key: "open",
      icon: ListTodo,
      label: t.dueToday,
      value: String(dueTodayOpen),
      valueClass: "text-[var(--ink)]",
      chipClass: "bg-[var(--accent-soft)] text-[var(--accent)]",
    },
    {
      key: "done",
      icon: CheckCircle2,
      label: t.completedToday,
      value: String(dueTodayDone),
      valueClass: "text-[var(--success)]",
      chipClass: "bg-[var(--support-mint)] text-[var(--success)]",
    },
    {
      key: "habits",
      icon: Flame,
      label: t.habitToday,
      value: `${habitDone}/${scheduledHabits.length}`,
      valueClass: "text-[var(--ink)]",
      chipClass: "bg-[var(--support-lilac)] text-[var(--accent)]",
    },
  ];

  return (
    <section className="min-w-0 space-y-6">
      <PageHeader title={t.viewToday} description={dateLabel} />
      <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
      {failed ? <p role="alert" className="text-sm text-[var(--danger)]">{t.taskSaveFailed}</p> : null}

      <div className="ui-card p-3"><QuickCapture /></div>

      <div className="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.key}
              className="ui-card flex min-w-0 items-center gap-3 p-4"
            >
              <span
                className={`grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] ${card.chipClass}`}
                aria-hidden="true"
              >
                <Icon className="size-5" />
              </span>
              <div className="min-w-0">
                <div
                  className={`text-2xl leading-8 font-bold tracking-[-0.02em] tabular-nums ${card.valueClass}`}
                >
                  {card.value}
                </div>
                <div className="truncate text-xs text-[var(--muted)]">
                  {card.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,340px)]">
        <div className="ui-card min-w-0 p-4 md:p-6">
          {!hasPrimaryTasks ? (
            <SakuraEmpty title={t.todayClear} description={t.emptyToday} />
          ) : (
            <div className="space-y-6">
              {primarySections.map((section) =>
                section.items.length === 0 ? null : (
                  <div key={section.key}>
                    <div className="mb-3 flex items-center justify-between">
                      <h2 className="text-sm font-semibold tracking-wide text-[var(--muted)] uppercase">
                        {section.title}
                      </h2>
                      <span className="rounded-full bg-[var(--chip)] px-2 py-0.5 text-xs text-[var(--muted)]">
                        {section.items.length}
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {section.items.map((item) => (
                        <TodayTaskRow
                          key={item.virtualId}
                          item={item}
                          active={selectedTaskId === item.task.id}
                          onSelect={() => selectTask(item.task.id)}
                          onToggle={() => void toggleTask(item.task.id, item.task.repeatRule ? item.date : undefined)}
                        />
                      ))}
                    </ul>
                  </div>
                ),
              )}
            </div>
          )}

          {buckets.previous.length > 0 ? (
            <details className="mt-5 border-t border-[var(--line)] pt-4">
              <summary className="min-h-10 cursor-pointer py-2 text-sm font-medium text-[var(--muted)]">{t.previousUnfinished} · {buckets.previous.length}</summary>
              <ul className="mt-3 space-y-3">
                {buckets.previous.map(item => (
                  <li key={item.virtualId} className="space-y-2">
                    <TodayTaskRow item={item} active={selectedTaskId === item.task.id}
                      as="div" onSelect={() => selectTask(item.task.id)} onToggle={() => void toggleTask(item.task.id, item.task.repeatRule ? item.date : undefined)} />
                    <TaskScheduleControl task={item.task} compact />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {buckets.upcoming.length > 0 ? (
            <details className="mt-5 border-t border-[var(--line)] pt-4">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-[var(--muted)] [&::-webkit-details-marker]:hidden">
                <span>
                  {t.upcoming} · {buckets.upcoming.length}
                </span>
                <ChevronRight className="size-4" />
              </summary>
              <ul className="mt-3 space-y-2">
                {buckets.upcoming.map((item) => (
                  <TodayTaskRow
                    key={item.virtualId}
                    item={item}
                    active={selectedTaskId === item.task.id}
                    onSelect={() => selectTask(item.task.id)}
                    onToggle={() => void toggleTask(item.task.id, item.task.repeatRule ? item.date : undefined)}
                  />
                ))}
              </ul>
            </details>
          ) : null}
        </div>

        <aside className="min-w-0 space-y-5">
          <div className="ui-card p-5">
            <DashboardCardHeader
              title={t.habitToday}
              action={t.viewAll}
              disabled={navigation.saving} onClick={() => void navigation.navigate("habits")}
            />
            {scheduledHabits.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                {t.habitEmptyDate}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {scheduledHabits.map((habit) => {
                  const checkIn = getHabitCheckIn(checkIns, habit.id, today);
                  const completed = checkIn?.status === "completed";
                  return (
                    <li
                      key={habit.id}
                      className="flex items-center gap-3 rounded-xl bg-[var(--surface)] px-3 py-2.5"
                    >
                      <span className="text-xl" aria-hidden="true">
                        {habit.emoji}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm font-medium",
                          completed ? "text-[var(--muted)] line-through" : "",
                        )}
                      >
                        {habit.title}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void setHabitCheckIn(
                            habit.id,
                            today,
                            completed ? null : "completed",
                          )
                        }
                        className={cn(
                          "grid size-8 place-items-center rounded-lg border",
                          completed
                            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                            : "border-[var(--line)] text-[var(--muted)]",
                        )}
                        aria-label={completed ? t.habitUndo : t.habitDone}
                      >
                        <Check className="size-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="ui-card p-5">
            <DashboardCardHeader
              title={t.animeToday}
              action={t.viewAll}
              disabled={navigation.saving} onClick={() => void navigation.navigate("anime")}
            />
            {scheduledAnime.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                {t.animeEmptyToday}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {scheduledAnime.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl bg-[var(--surface)] px-3 py-2.5"
                  >
                    <span className="text-xl" aria-hidden="true">
                      {item.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {item.title}
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {item.totalEpisodes != null && item.currentEpisode >= item.totalEpisodes ? t.animeCompleted : t.nextEpisode.replace("{n}", String(item.currentEpisode + 1))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void incrementAnimeEpisode(item.id)}
                      className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-medium text-[var(--on-accent)]"
                    >
                      {t.animeWatchedOne}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            type="button"
            disabled={navigation.saving} onClick={() => void navigation.navigate("pomodoro")}
            className="ui-button-secondary inline-flex w-full items-center justify-center gap-2 px-4 py-3"
          >
            <Timer className="size-4 text-[var(--accent)]" />
            {t.startFocus}
          </button>
        </aside>
      </div>
    </section>
  );
}

function TodayTaskRow({
  as: Element = "li",
  item,
  active,
  onSelect,
  onToggle,
}: {
  as?: "li" | "div";
  item: TaskOccurrence;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const locale = useTodoStore((state) => state.locale);
  const t = ui(locale);

  return (
    <Element
      style={{
        borderLeftColor: priorityVar(normalizePriority(item.task.priority)),
      }}
      className={cn(
        "flex items-start gap-3 rounded-[var(--radius-small)] border border-l-4 px-3 py-3",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--line)] bg-[var(--surface)]",
      )}
    >
      <button
        type="button"
        aria-label={(item.task.completedAt ? t.markTaskOpen : t.markTaskComplete).replace("{title}", item.task.title)}
        aria-pressed={item.task.completedAt != null}
        onClick={onToggle}
        className="mt-0.5 grid size-5 place-items-center rounded-md border border-[var(--line)] bg-[var(--bg-elevated)]"
      >
        {item.task.completedAt ? <Check className="size-3.5" /> : null}
      </button>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onSelect}>
        <div className="break-words font-medium">{item.task.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <span>{planningLabel(item.date, locale)}{item.task.scheduledTime ? " · " + item.task.scheduledTime : ""}</span>
          {item.task.dueDate && item.task.dueDate <= todayKey() && !item.task.repeatRule ? <span className="text-[var(--danger)]">{t.optionalDeadline} {item.task.dueDate}</span> : null}
          <PriorityBadge priority={item.task.priority} locale={locale} />
          {item.task.repeatRule ? <span>{t.repeat}</span> : null}
        </div>
      </button>
    </Element>
  );
}

function DashboardCardHeader({
  title,
  action,
  disabled,
  onClick,
}: {
  title: string;
  action: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="font-semibold text-[var(--ink)]">{title}</h2>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="text-xs text-[var(--accent)] hover:underline"
      >
        {action}
      </button>
    </div>
  );
}
