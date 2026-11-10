import { useEffect, useMemo, useState } from "react";
import { LockKeyhole, Search } from "lucide-react";
import { ui } from "../i18n/messages";
import { cn } from "../lib/cn";
import { isFocusBindingLocked } from "../lib/pomodoro";
import {
  ALL_FOCUS_LISTS,
  buildFocusTaskGroups,
  countFocusableTasksByList,
  selectFocusableTasks,
} from "../lib/pomodoroTasks";
import { normalizePriority, priorityVar } from "../lib/priority";
import { usePomodoroStore } from "../store/pomodoroStore";
import { useTodoStore } from "../store/todoStore";
import { PriorityBadge } from "./PriorityBadge";

export function PomodoroTaskPicker() {
  const locale = useTodoStore((state) => state.locale);
  const lists = useTodoStore((state) => state.lists);
  const tasks = useTodoStore((state) => state.tasks);
  const t = ui(locale);
  const phase = usePomodoroStore((state) => state.phase);
  const sessionStartedAt = usePomodoroStore((state) => state.sessionStartedAt);
  const sessionTaskId = usePomodoroStore((state) => state.sessionTaskId);
  const boundTaskId = usePomodoroStore((state) => state.boundTaskId);
  const bindTask = usePomodoroStore((state) => state.bindTask);
  const [listFilter, setListFilter] = useState(ALL_FOCUS_LISTS);
  const [query, setQuery] = useState("");

  const bindingLocked = isFocusBindingLocked(phase, sessionStartedAt);
  const activeTaskId = sessionTaskId ?? boundTaskId;
  const focusableTasks = useMemo(() => selectFocusableTasks(tasks), [tasks]);
  const taskCounts = useMemo(() => countFocusableTasksByList(tasks), [tasks]);
  const groups = useMemo(
    () =>
      buildFocusTaskGroups({
        tasks,
        lists,
        listId: listFilter,
        query,
      }),
    [listFilter, lists, query, tasks],
  );

  useEffect(() => {
    if (
      listFilter !== ALL_FOCUS_LISTS &&
      !lists.some((list) => list.id === listFilter)
    ) {
      setListFilter(ALL_FOCUS_LISTS);
    }
  }, [listFilter, lists]);

  useEffect(() => {
    if (bindingLocked || !boundTaskId) return;
    if (!focusableTasks.some((task) => task.id === boundTaskId)) bindTask(null);
  }, [bindTask, bindingLocked, boundTaskId, focusableTasks]);

  const pick = (taskId: string | null) => {
    if (!bindingLocked) bindTask(taskId);
  };

  return (
    <aside className="ui-card flex min-w-0 max-w-full flex-col p-4 md:p-5 2xl:sticky 2xl:top-8 2xl:max-h-[calc(100vh-4rem)]">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">{t.bindTask}</h2>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {bindingLocked ? t.focusBindingLocked : t.focusTaskPickerHint}
        </p>
      </div>

      {bindingLocked ? (
        <div className="mb-3 flex items-start gap-2 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2.5 text-sm">
          <LockKeyhole className="mt-0.5 size-4 shrink-0 text-[var(--accent)]" />
          <span>{t.focusBindingLocked}</span>
        </div>
      ) : null}

      <div className="mb-3 grid gap-2">
        <label className="relative block">
          <span className="sr-only">{t.focusTaskSearchPlaceholder}</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.focusTaskSearchPlaceholder}
            className="ui-input w-full py-2.5 pr-3 pl-9 text-sm"
          />
        </label>

        <label className="block">
          <span className="sr-only">{t.focusListFilter}</span>
          <select
            value={listFilter}
            onChange={(event) => setListFilter(event.target.value)}
            className="ui-input w-full px-3 py-2.5 text-sm"
          >
            <option value={ALL_FOCUS_LISTS}>
              {t.allFocusTasks.replace("{n}", String(focusableTasks.length))}
            </option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {t.focusListOption
                  .replace("{name}", list.name)
                  .replace("{n}", String(taskCounts.get(list.id) ?? 0))}
              </option>
            ))}
          </select>
        </label>
      </div>

      <button
        type="button"
        disabled={bindingLocked}
        onClick={() => pick(null)}
        className={cn(
          "mb-3 w-full rounded-[12px] border px-3 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-60",
          activeTaskId == null
            ? "border-[var(--accent)] bg-[var(--accent-soft)] font-medium"
            : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]",
        )}
      >
        {t.noBoundTask}
      </button>

      {groups.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          {query.trim() ? t.emptySearch : t.emptyFocusTasks}
        </p>
      ) : (
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {groups.map((group) => (
            <section key={group.list.id} aria-label={group.list.name}>
              <div className="mb-2 flex items-center gap-2 px-1 text-xs font-medium text-[var(--muted)]">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: group.list.color }}
                />
                <span className="min-w-0 flex-1 truncate">
                  {group.list.name}
                </span>
                <span>{group.tasks.length}</span>
              </div>
              <ul className="space-y-2">
                {group.tasks.map((item) => {
                  const active = activeTaskId === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        disabled={bindingLocked}
                        aria-pressed={active}
                        onClick={() => pick(item.id)}
                        style={{
                          borderLeftColor: priorityVar(
                            normalizePriority(item.priority),
                          ),
                        }}
                        className={cn(
                          "w-full rounded-[12px] border border-l-4 px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                          active
                            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                            : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]",
                        )}
                      >
                        <div className="font-medium">{item.title}</div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[var(--muted)]">
                          <PriorityBadge
                            priority={item.priority}
                            locale={locale}
                          />
                          {item.dueDate ? <span>{item.dueDate}</span> : null}
                          {item.repeatRule ? <span>{t.repeat}</span> : null}
                          {item.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-[var(--chip)] px-2 py-0.5"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </aside>
  );
}
