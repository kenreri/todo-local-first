import { CalendarDays, ChevronDown, Clock3, Headphones } from "lucide-react";
import { useState } from "react";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { workspaceAgenda } from "../lib/workspacePresentation";
import { useTodoStore } from "../store/todoStore";
import type { TaskRecord } from "../types";

export function WorkspaceAgenda({
  tasks,
  today,
  onTask,
}: {
  tasks: TaskRecord[];
  today: string;
  onTask: (id: string) => void;
}) {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const setView = useTodoStore((state) => state.setView);
  const agenda = workspaceAgenda(tasks, today);
  const wide = useMediaQuery("(min-width: 1280px)");
  const [expanded, setExpanded] = useState(false);
  const next = agenda.overdue[0] ?? agenda.upcoming[0];
  return (
    <div className="space-y-3 xl:sticky xl:top-4">
      {!wide ? (
        <section
          aria-label={zh ? "今日与截止摘要" : "Plan and deadline summary"}
          className="rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="flex min-h-10 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-xs"
            >
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-4 text-[var(--accent)]" />
                {zh
                  ? `今日安排 ${agenda.today.length}`
                  : `Today ${agenda.today.length}`}
              </span>
              <span
                className={
                  agenda.overdue.length
                    ? "text-[var(--danger)]"
                    : "text-[var(--muted)]"
                }
              >
                {agenda.overdue.length
                  ? zh
                    ? `${agenda.overdue.length} 项逾期`
                    : `${agenda.overdue.length} overdue`
                  : `${agenda.upcoming.length} DDL`}
              </span>
              <ChevronDown
                className={`ml-auto size-4 text-[var(--muted)] ${expanded ? "rotate-180" : ""}`}
              />
            </button>
            <button
              type="button"
              aria-label={zh ? "进入专注" : "Focus space"}
              onClick={() => void setView("pomodoro")}
              className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-small)] bg-[var(--accent-soft)] text-[var(--accent)]"
            >
              <Headphones className="size-4" />
            </button>
          </div>
          {!expanded && next ? (
            <button
              type="button"
              onClick={() => onTask(next.id)}
              className="flex min-h-10 w-full items-center gap-2 border-t border-[var(--line)] pt-1 text-left text-xs"
            >
              <span className="shrink-0 text-[var(--muted)]">
                {next.dueDate}
              </span>
              <span className="truncate">{next.title}</span>
              <span className="ml-auto text-[var(--muted)]">→</span>
            </button>
          ) : null}
        </section>
      ) : null}
      {wide || expanded ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <section
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-elevated)] p-4"
            aria-label={zh ? "今天准备做" : "Today's plan"}
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <CalendarDays className="size-4 text-[var(--accent)]" />
              {zh ? "今天准备做" : "Today's plan"}
              <span className="ml-auto text-xs font-normal text-[var(--muted)]">
                {agenda.today.length}
              </span>
            </h2>
            <div className="mt-2 space-y-1">
              {agenda.today.length ? (
                agenda.today.slice(0, 3).map(({ task }) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTask(task.id)}
                    className="flex min-h-10 w-full items-center gap-2 rounded-[var(--radius-small)] py-2 text-left text-sm hover:bg-[var(--hover)]"
                  >
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                    <span className="line-clamp-2 break-words">
                      {task.title}
                    </span>
                    {task.scheduledTime ? (
                      <span className="ml-auto text-xs text-[var(--muted)]">
                        {task.scheduledTime}
                      </span>
                    ) : null}
                  </button>
                ))
              ) : (
                <p className="py-3 text-xs leading-5 text-[var(--muted)]">
                  {zh
                    ? "今天还没有安排，先选一件想推进的事。"
                    : "Nothing planned yet. Choose one thing to work on."}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void setView("today")}
              className="mt-1 min-h-10 text-xs text-[var(--accent)]"
            >
              {zh ? "查看今日安排 →" : "Open today's plan →"}
            </button>
          </section>
          <section
            className="rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-elevated)] p-4"
            aria-label={zh ? "截止提醒" : "Deadlines"}
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="size-4 text-[var(--accent)]" />
              {zh ? "接下来的 DDL" : "Upcoming deadlines"}
            </h2>
            {agenda.overdue.length ? (
              <div className="mt-3 rounded-[var(--radius-small)] bg-[var(--danger-soft)] px-3 py-2">
                <p className="text-xs font-medium text-[var(--danger)]">
                  {zh
                    ? `${agenda.overdue.length} 项已逾期`
                    : `${agenda.overdue.length} overdue`}
                </p>
                {agenda.overdue.slice(0, 2).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTask(task.id)}
                    className="flex min-h-10 w-full flex-col justify-center gap-1 py-2 text-left text-xs"
                  >
                    <span className="line-clamp-1 break-words">
                      {task.title}
                    </span>
                    <span className="text-[var(--danger)]">{task.dueDate}</span>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-2 space-y-1">
              {agenda.upcoming.slice(0, 3).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTask(task.id)}
                  className="flex min-h-10 w-full flex-col gap-1 rounded-[var(--radius-small)] py-2 text-left hover:bg-[var(--hover)]"
                >
                  <span className="text-xs text-[var(--muted)]">
                    {task.dueDate === today
                      ? zh
                        ? "今天截止"
                        : "Due today"
                      : task.dueDate}
                  </span>
                  <span className="line-clamp-2 break-words text-sm">
                    {task.title}
                  </span>
                </button>
              ))}
            </div>
            {!agenda.upcoming.length && !agenda.overdue.length ? (
              <p className="py-3 text-xs leading-5 text-[var(--muted)]">
                {zh ? "暂时没有待完成的截止事项。" : "No pending deadlines."}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void setView("list")}
              className="mt-1 min-h-10 text-xs text-[var(--accent)]"
            >
              {zh ? "查看全部任务 →" : "View all tasks →"}
            </button>
          </section>
        </div>
      ) : null}
      {wide ? (
        <button
          type="button"
          onClick={() => void setView("pomodoro")}
          className="flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-card)] bg-[var(--accent-soft)] px-4 py-3 text-left text-[var(--accent)]"
        >
          <Headphones className="size-5 shrink-0" />
          <span>
            <span className="block text-sm font-semibold">
              {zh ? "留一段专注时间" : "Make time to focus"}
            </span>
            <span className="mt-1 block text-xs text-[var(--muted)]">
              {zh ? "计时 · 音乐 · 陪伴" : "Timer · Music · Company"}
            </span>
          </span>
          <span className="ml-auto">→</span>
        </button>
      ) : null}
    </div>
  );
}
