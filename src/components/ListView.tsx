import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { useLocalDate } from "../hooks/useLocalDate";
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Clock3,
  Repeat2,
  Check,
  CheckSquare2,
  GripVertical,
  Search,
  X,
} from "lucide-react";
import { PriorityBadge } from "./PriorityBadge";
import { ui } from "../i18n/messages";
import { cn } from "../lib/cn";
import { normalizePriority, priorityVar } from "../lib/priority";
import { isTaskCompleted } from "../lib/taskTree";
import { selectVisibleRootTasks, useTodoStore } from "../store/todoStore";
import type { TaskRecord } from "../types";
import { QuickCapture } from "./QuickCapture";
import { TaskPlanningPopover } from "./TaskPlanningPopover";
import { planningLabel } from "../lib/taskPlanning";
import { TaskViewHeader } from "./TaskViewHeader";

export function ListView() {
  const locale = useTodoStore((s) => s.locale);
  const allTasks = useTodoStore((s) => s.tasks);
  const selectedListId = useTodoStore((s) => s.selectedListId);
  const lists = useTodoStore((s) => s.lists);
  const selectList = useTodoStore((s) => s.selectList);
  const search = useTodoStore((s) => s.search);
  const filter = useTodoStore((s) => s.filter);
  const setSearch = useTodoStore((s) => s.setSearch);
  const setFilter = useTodoStore((s) => s.setFilter);
  const selectTask = useTodoStore((s) => s.selectTask);
  const toggleTask = useTodoStore((s) => s.toggleTask);
  const reorderTasks = useTodoStore((s) => s.reorderTasks);
  const selectedTaskId = useTodoStore((s) => s.selectedTaskId);
  const checkedIds = useTodoStore((s) => s.checkedIds);
  const toggleChecked = useTodoStore((s) => s.toggleChecked);
  const setCheckedIds = useTodoStore((s) => s.setCheckedIds);
  const clearChecked = useTodoStore((s) => s.clearChecked);
  const t = ui(locale);
  const { run, failed } = useSaveFeedback();
  const [bulkMode, setBulkMode] = useState(false);
  const [planningTaskId, setPlanningTaskId] = useState<string | null>(null);
  const canReorder = selectedListId != null && !bulkMode && filter === "all" && search.trim() === "";

  const tasks = useMemo(
    () =>
      selectVisibleRootTasks({
        tasks: allTasks,
        selectedListId,
        search,
        filter,
      }),
    [allTasks, selectedListId, search, filter],
  );
  const activeTasks = useMemo(
    () => tasks.filter((task) => !isTaskCompleted(task)),
    [tasks],
  );
  const completedTasks = useMemo(
    () => tasks.filter((task) => isTaskCompleted(task)),
    [tasks],
  );

  const scopeKey = JSON.stringify([selectedListId, search, filter]);
  const [page, setPage] = useState({ scopeKey, limit: 100 });
  const limit = page.scopeKey === scopeKey ? page.limit : 100;
  const visibleTasks = tasks.slice(0, limit);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    if (!canReorder) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = activeTasks.findIndex((task) => task.id === active.id);
    const newIndex = activeTasks.findIndex((task) => task.id === over.id);
    // Keep completed below incomplete; do not interleave zones via drag.
    if (oldIndex < 0 || newIndex < 0) return;
    const nextActive = arrayMove(activeTasks, oldIndex, newIndex);
    void run(() => reorderTasks(
      [...nextActive, ...completedTasks].map((task) => task.id),
    ));
  };

  const toggleBulkMode = () => {
    setPlanningTaskId(null);
    if (bulkMode) clearChecked();
    setBulkMode((active) => !active);
  };

  return (
    <section className="min-w-0 space-y-6">
      <TaskViewHeader />
      {failed ? <p role="alert" className="text-sm text-[var(--danger)]">{t.taskSaveFailed}</p> : null}
      <div className="ui-card min-w-0 p-4 md:p-6">
        <div className="mb-5"><QuickCapture /></div>

        <div className="mb-4 flex min-w-0 flex-wrap items-center gap-3">
          <div className="relative min-w-0 basis-full md:min-w-[220px] md:flex-1 md:basis-auto">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.searchPlaceholder}
              data-shortcut="search"
              className="ui-input w-full py-2.5 pr-3 pl-10"
            />
          </div>
          <select aria-label={t.filterByList} value={selectedListId ?? ""}
            onChange={(event) => selectList(event.target.value || null)}
            className="ui-input min-h-10 max-w-full px-3 py-2 text-sm">
            <option value="">{t.allTasks}</option>
            {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
          </select>
          <div
            role="tablist"
            className="inline-flex max-w-full overflow-x-auto rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-1"
          >
            {(
              [
                ["all", t.filterAll],
                ["active", t.filterActive],
                ["completed", t.filterCompleted],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "shrink-0 rounded-[var(--radius-small)] px-3 py-1.5 text-sm font-medium transition",
                  filter === value
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={bulkMode}
            onClick={toggleBulkMode}
            className={cn(
              "inline-flex items-center gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm font-medium transition",
              bulkMode
                ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                : "ui-button-secondary",
            )}
          >
            {bulkMode ? (
              <X className="size-4" />
            ) : (
              <CheckSquare2 className="size-4" />
            )}
            {bulkMode ? t.exitBatchMode : t.batchMode}
          </button>
        </div>

        {tasks.length === 0 ? (
          <p className="py-16 text-center text-[var(--muted)]">
            {search.trim() ? t.emptySearch : t.emptyTasks}
          </p>
        ) : (
          <>
            {bulkMode ? (
              <div className="mb-2 flex items-center gap-2 text-sm text-[var(--muted)]">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={
                      tasks.length > 0 &&
                      tasks.every((task) => checkedIds.includes(task.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked)
                        setCheckedIds(tasks.map((task) => task.id));
                      else setCheckedIds([]);
                    }}
                  />
                  {t.selectAll}
                </label>
              </div>
            ) : null}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={visibleTasks.map((task) => task.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-3">
                  {visibleTasks.map((task) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
                      showList={selectedListId == null}
                      planningOpen={planningTaskId === task.id}
                      onPlanOpen={() => setPlanningTaskId(task.id)}
                      onPlanClose={() => setPlanningTaskId(current => current === task.id ? null : current)}
                      active={selectedTaskId === task.id}
                      checked={checkedIds.includes(task.id)}
                      bulkMode={bulkMode}
                      draggable={canReorder && !isTaskCompleted(task)}
                      onCheck={() => toggleChecked(task.id)}
                      onSelect={() => selectTask(task.id)}
                      onToggle={() => void run(() => toggleTask(task.id))}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            {tasks.length > visibleTasks.length ? (
              <button type="button" className="ui-button-secondary mt-4 min-h-10 w-full px-4 py-2"
                onClick={() => setPage({ scopeKey, limit: limit + 100 })}>
                {locale === "zh" ? `显示更多（${visibleTasks.length} / ${tasks.length}）` : `Show more (${visibleTasks.length} / ${tasks.length})`}
              </button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function SortableTaskRow({
  task,
  showList,
  planningOpen,
  onPlanOpen,
  onPlanClose,
  active,
  checked,
  bulkMode,
  draggable,
  onCheck,
  onSelect,
  onToggle,
}: {
  task: TaskRecord;
  showList: boolean;
  planningOpen: boolean;
  onPlanOpen: () => void;
  onPlanClose: () => void;
  active: boolean;
  checked: boolean;
  bulkMode: boolean;
  draggable: boolean;
  onCheck: () => void;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const locale = useTodoStore((s) => s.locale);
  const lists = useTodoStore((s) => s.lists);
  const list = lists.find((item) => item.id === task.listId);
  const t = ui(locale);
  const today = useLocalDate();
  const followsRepeat = Boolean(task.repeatRule && !task.scheduledDate);
  const plannedToday = task.scheduledDate === today;
  const metadataClass = "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--line)] bg-[var(--nav-bg)] px-2 py-0.5 text-[11px] leading-4";
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: !draggable,
  });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderLeftColor: priorityVar(normalizePriority(task.priority)),
      }}
      className={cn(
        "flex flex-wrap items-start gap-2 rounded-[var(--radius-small)] border border-l-4 px-4 py-3 transition",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)]"
          : "border-[var(--line)] bg-[var(--surface)] hover:border-[var(--accent)]",
        task.completedAt ? "opacity-70" : "",
        isDragging ? "z-10 shadow-lg" : "",
      )}
    >
      {bulkMode ? (
        <input
          type="checkbox"
          className="mt-1"
          checked={checked}
          onChange={onCheck}
          aria-label={ui(locale).selectTask}
        />
      ) : (
        <button
          type="button"
          disabled={!draggable}
          className="mt-0.5 touch-none rounded-md p-1 text-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={ui(locale).dragTask}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <button
        type="button"
        aria-label={(task.completedAt ? ui(locale).markTaskOpen : ui(locale).markTaskComplete).replace("{title}", task.title)}
        aria-pressed={task.completedAt != null}
        onClick={onToggle}
        className={cn(
          "mt-0.5 grid size-5 place-items-center rounded-md border",
          task.completedAt
            ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
            : "border-[var(--line)] bg-[var(--bg-elevated)]",
        )}
      >
        {task.completedAt ? <Check className="size-3.5" /> : null}
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={onSelect}
      >
        <div
          className={cn(
            "font-medium",
            task.completedAt ? "text-[var(--muted)] line-through" : "",
          )}
        >
          {task.title}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[var(--muted)]">
          <PriorityBadge priority={task.priority} locale={locale} />
          {showList && list ? <span className={metadataClass} title={t.lists+" · "+list.name}>
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{backgroundColor:list.color}} />
            <span className="truncate">{list.name}</span>
          </span> : null}
          <span className={cn(metadataClass, plannedToday ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "")}>
            {followsRepeat ? <Repeat2 aria-hidden="true" className="size-3 shrink-0" /> : task.scheduledDate ? <CalendarDays aria-hidden="true" className="size-3 shrink-0" /> : <Clock3 aria-hidden="true" className="size-3 shrink-0" />}
            <span>{followsRepeat ? t.recurringPlan : planningLabel(task.scheduledDate, locale)}{task.scheduledDate && task.scheduledTime ? ` · ${task.scheduledTime}` : ""}</span>
          </span>
          {task.dueDate && task.dueDate <= today ? <span className={cn(metadataClass, task.dueDate < today ? "border-[var(--danger)] bg-[var(--danger-soft)] text-[var(--danger)]" : "")}>
            <CalendarDays aria-hidden="true" className="size-3 shrink-0" />{t.dueDate} {task.dueDate}
          </span> : null}
          {task.repeatRule && task.scheduledDate ? <span className={metadataClass}><Repeat2 aria-hidden="true" className="size-3" />{t.repeat}</span> : null}
        </div>
      </button>
      {!bulkMode && !task.completedAt ? <TaskPlanningPopover task={task} open={planningOpen} onOpen={onPlanOpen} onClose={onPlanClose} /> : null}
    </li>
  );
}
