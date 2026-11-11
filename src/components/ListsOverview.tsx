import { useViewNavigation } from "../hooks/useViewNavigation";
import { SaveStatus } from "./SaveStatus";
import { useMemo } from "react";
import { CalendarDays, PanelsTopLeft, Plus, Sparkles } from "lucide-react";
import { ui } from "../i18n/messages";
import { addDays } from "../lib/dates";
import { useLocalDate } from "../hooks/useLocalDate";
import { comparePriorityDesc, normalizePriority } from "../lib/priority";
import { useTodoStore } from "../store/todoStore";
import { QuickCapture } from "./QuickCapture";
import { TaskViewSwitch } from "./TaskViewSwitch";
import { PageHeader } from "./PageHeader";

export function ListsOverview() {
  const locale = useTodoStore((state) => state.locale);
  const lists = useTodoStore((state) => state.lists);
  const tasks = useTodoStore((state) => state.tasks);
  const selectList = useTodoStore((state) => state.selectList);
  const navigation = useViewNavigation();
  const t = ui(locale);
  const today = useLocalDate();

  // 一次性按清单分组任务
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { active: number; completed: number; total: number }
    >();
    for (const task of tasks) {
      if (task.deletedAt != null) continue;
      if (task.parentId != null) continue; // 只算根任务
      const slot = map.get(task.listId) ?? { active: 0, completed: 0, total: 0 };
      slot.total += 1;
      if (task.completedAt == null) slot.active += 1;
      else slot.completed += 1;
      map.set(task.listId, slot);
    }
    return map;
  }, [tasks]);

  // 过期 / 本周到期（按 dueDate）按清单分组
  const dueStats = useMemo(() => {
    const weekEnd = addDays(today, 7);
    const result = new Map<
      string,
      { overdue: number; dueThisWeek: number }
    >();
    for (const task of tasks) {
      if (task.deletedAt != null) continue;
      if (task.parentId != null) continue;
      if (task.completedAt != null) continue;
      if (!task.dueDate) continue;
      const slot = result.get(task.listId) ?? { overdue: 0, dueThisWeek: 0 };
      if (task.dueDate < today) slot.overdue += 1;
      else if (task.dueDate <= weekEnd) slot.dueThisWeek += 1;
      result.set(task.listId, slot);
    }
    return result;
  }, [tasks, today]);

  // 每个清单最近 3 个未完成任务（按优先级降序 + 创建时间）
  const recentByList = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    const active = tasks.filter(
      (task) => task.deletedAt == null && task.completedAt == null,
    );
    for (const list of lists) {
      map.set(
        list.id,
        active
          .filter((task) => task.listId === list.id && task.parentId == null)
          .sort((a, b) => {
            const rank = comparePriorityDesc(a, b);
            return rank !== 0 ? rank : b.createdAt - a.createdAt;
          })
          .slice(0, 3),
      );
    }
    return map;
  }, [tasks, lists]);

  const openList = (id: string) => navigation.navigate("list", () => selectList(id));

  return (
    <section className="min-w-0 space-y-6">
      <PageHeader
        title={t.listsOverview}
        description={t.listsOverviewSubtitle}
        actions={<TaskViewSwitch />}
      />
      <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
      <div className="ui-card p-4"><QuickCapture /></div>
      {lists.length === 0 ? (
        <div className="ui-card flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-12 place-items-center rounded-[var(--radius-control)] bg-[var(--surface)] text-[var(--muted)]">
            <Sparkles className="size-6" />
          </span>
          <p className="text-sm text-[var(--muted)]">{t.listsEmpty}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lists.map((list) => {
            const counts = grouped.get(list.id) ?? {
              active: 0,
              completed: 0,
              total: 0,
            };
            const due = dueStats.get(list.id) ?? {
              overdue: 0,
              dueThisWeek: 0,
            };
            const recent = recentByList.get(list.id) ?? [];
            const rate =
              counts.total > 0
                ? Math.round((counts.completed / counts.total) * 100)
                : 0;
            return (
              <article
                key={list.id}
                className="ui-card flex min-w-0 flex-col gap-4 p-5"
              >
                <header className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: list.color }}
                    />
                    <h3 className="truncate text-base font-semibold text-[var(--ink)]">
                      {list.name}
                    </h3>
                  </div>
                  <CompletionRing percent={rate} />
                </header>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <Stat
                    label={t.listsDueThisWeek}
                    value={due.dueThisWeek}
                    tone={due.dueThisWeek > 0 ? "warn" : "muted"}
                  />
                  <Stat
                    label={t.listsOverdue}
                    value={due.overdue}
                    tone={due.overdue > 0 ? "danger" : "muted"}
                  />
                  <Stat
                    label={t.listsCompletionRate}
                    value={`${rate}%`}
                    tone="ink"
                  />
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-1.5 text-sm">
                  <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                    <span>{t.listsRecentTasks}</span>
                    <span className="tabular-nums">
                      {counts.active}/{counts.total}
                    </span>
                  </div>
                  {recent.length === 0 ? (
                    <p className="rounded-[var(--radius-control)] bg-[var(--surface)] px-2.5 py-2 text-xs text-[var(--muted)]">
                      {t.listsNoActive}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {recent.map((task) => {
                        const priority = normalizePriority(task.priority);
                        return (
                          <li
                            key={task.id}
                            className="flex items-center gap-2 truncate rounded-[var(--radius-control)] bg-[var(--surface)] px-2.5 py-1.5"
                          >
                            <span
                              className="size-1.5 shrink-0 rounded-full"
                              style={{
                                background: `var(--priority-${priority})`,
                              }}
                              aria-hidden="true"
                            />
                            <span className="truncate text-[var(--ink)]">
                              {task.title}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="mt-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={navigation.saving}
                    onClick={() => void openList(list.id)}
                    className="ui-button-primary inline-flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm"
                  >
                    <PanelsTopLeft className="size-4" />
                    {t.listsOpenTasks}
                  </button>
                  <button
                    type="button"
                    disabled={navigation.saving}
                    onClick={() => {
                      void navigation.navigate("calendar", () => selectList(list.id));
                    }}
                    className="ui-button-secondary inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm"
                    title={t.viewCalendar}
                  >
                    <CalendarDays className="size-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {lists.length > 0 ? (
        <p className="text-xs text-[var(--muted)]">
          <Plus className="mr-1 inline size-3" />
          {t.listsOverviewSubtitle}
        </p>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "muted" | "warn" | "danger" | "ink";
}) {
  const color =
    tone === "danger"
      ? "text-[var(--danger)]"
      : tone === "warn"
        ? "text-[var(--warn)]"
        : tone === "ink"
          ? "text-[var(--ink)]"
          : "text-[var(--muted)]";
  return (
    <div className="rounded-[var(--radius-control)] bg-[var(--surface)] p-2">
      <dt className="text-[10px] leading-4 font-medium tracking-wide text-[var(--muted)] uppercase">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-lg leading-6 font-semibold tabular-nums ${color}`}
      >
        {value}
      </dd>
    </div>
  );
}

function CompletionRing({ percent }: { percent: number }) {
  const size = 40;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);
  return (
    <div className="relative grid place-items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--line)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span className="absolute text-[11px] font-semibold tabular-nums text-[var(--ink)]">
        {percent}%
      </span>
    </div>
  );
}
