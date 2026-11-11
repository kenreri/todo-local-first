import { usePendingPatch } from "../hooks/usePendingPatch";
import { SaveStatus } from "./SaveStatus";
import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, Timer, Trash2, X } from "lucide-react";
import { ui } from "../i18n/messages";
import { TaskScheduleControl } from "./TaskScheduleControl";
import { TaskMaterials } from "./TaskMaterials";
import { cn } from "../lib/cn";
import { parseDateKey, todayKey } from "../lib/dates";
import { isFocusBindingLocked } from "../lib/pomodoro";
import { usePomodoroStore } from "../store/pomodoroStore";
import { selectSubtasks, useTodoStore } from "../store/todoStore";
import type {
  Priority,
  RepeatFrequency,
  RepeatRule,
  TaskRecord,
} from "../types";

const EMPTY_TASKS: TaskRecord[] = [];
const EMPTY_TAGS: string[] = [];
type TaskSaveState = "saved" | "dirty" | "saving" | "error" | "invalid";

const fieldClass =
  "w-full min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface-input)] px-3 py-2 outline-none focus:border-[var(--accent)]";
const sectionTitleClass =
  "text-xs font-semibold tracking-wider text-[var(--muted)]";

export function TaskDetailPanel({ taskId }: { taskId: string }) {
  const locale = useTodoStore((s) => s.locale);
  const lists = useTodoStore((s) => s.lists);
  const allTasks = useTodoStore((s) => s.tasks);
  const task = useMemo(
    () => allTasks.find((item) => item.id === taskId) ?? null,
    [allTasks, taskId],
  );
  const subtasks = useMemo(
    () => (task ? selectSubtasks({ tasks: allTasks }, task.id) : EMPTY_TASKS),
    [allTasks, task],
  );
  const updateTask = useTodoStore((s) => s.updateTask);
  const addTaskTag = useTodoStore((s) => s.addTaskTag);
  const removeTaskTag = useTodoStore((s) => s.removeTaskTag);
  const deleteTask = useTodoStore((s) => s.deleteTask);
  const toggleTask = useTodoStore((s) => s.toggleTask);
  const createTask = useTodoStore((s) => s.createTask);
  const selectTask = useTodoStore((s) => s.selectTask);
  const setView = useTodoStore((s) => s.setView);
  const bindTask = usePomodoroStore((s) => s.bindTask);
  const pomodoroPhase = usePomodoroStore((s) => s.phase);
  const focusSessionStartedAt = usePomodoroStore((s) => s.sessionStartedAt);
  const t = ui(locale);
  const { run: saveExtra, saving: extraSaving, failed: extraFailed } = useSaveFeedback();
  const focusBindingLocked = isFocusBindingLocked(
    pomodoroPhase,
    focusSessionStartedAt,
  );

  const propertySave = usePendingPatch<Pick<TaskRecord, "priority" | "listId" | "dueDate" | "scheduledDate" | "scheduledTime" | "repeatRule">>(async patch => {
    if (patch.listId && !(await persistDraft())) throw new Error("Text draft could not be saved");
    await updateTask(taskId, patch);
  });
  const flushProperties = propertySave.flush;
  const saveProperties = propertySave.submit;
  const retryExtraRef = useRef<(() => Promise<unknown>) | null>(null);
  const runExtra = (operation: () => Promise<unknown>) => saveExtra(async () => {
    retryExtraRef.current = operation;
    await operation();
    retryExtraRef.current = null;
  });
  const properties = { ...task, ...propertySave.patch };
  const listId = properties.listId ?? "";
  const scheduledTime = properties.scheduledTime ?? "";
  const priority = properties.priority ?? "none";
  const dueDate = properties.dueDate ?? "";
  const scheduledDate = properties.scheduledDate ?? "";
  const repeatFreq = properties.repeatRule?.frequency ?? "none";
  const repeatInterval = properties.repeatRule?.interval ?? 1;
  const repeatWeekdays = properties.repeatRule?.weekdays ?? [];
  const repeatEndDate = properties.repeatRule?.endDate ?? "";
  const [title, setTitle] = useState(task?.title ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [tagDraft, setTagDraft] = useState("");
  const [subtaskDraft, setSubtaskDraft] = useState("");
  const [saveState, setSaveState] = useState<TaskSaveState>("saved");
  const [closing, setClosing] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const titleDraftRef = useRef(title);
  const noteDraftRef = useRef(note);
  const savedTextRef = useRef({ title: task?.title ?? "", note: task?.note ?? "" });
  const textRevision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    if (!task) return;
    if (titleDraftRef.current === savedTextRef.current.title) {
      titleDraftRef.current = task.title;
      savedTextRef.current.title = task.title;
      setTitle(task.title);
    }
    if (noteDraftRef.current === savedTextRef.current.note) {
      noteDraftRef.current = task.note;
      savedTextRef.current.note = task.note;
      setNote(task.note);
    }
  }, [task]);
  const saveQueueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const persistDraft = useCallback(() => {
    const save = async () => {
      if (!mounted.current) return false;
      const rawTitle = titleDraftRef.current;
      const nextTitle = rawTitle.trim();
      const nextNote = noteDraftRef.current;
      if (!nextTitle) {
        setSaveState("invalid");
        titleInputRef.current?.focus();
        return false;
      }

      const currentTask = useTodoStore
        .getState()
        .tasks.find((item) => item.id === taskId);
      if (!currentTask) return true;

      const patch: Partial<Pick<TaskRecord, "title" | "note">> = {};
      if (nextTitle !== savedTextRef.current.title) patch.title = nextTitle;
      if (nextNote !== savedTextRef.current.note) patch.note = nextNote;
      if (Object.keys(patch).length === 0) {
        setSaveState("saved");
        return true;
      }

      setSaveState("saving");
      try {
        await updateTask(taskId, patch);
        if (!mounted.current) return false;
        savedTextRef.current = { ...savedTextRef.current, ...patch };
        const unchanged =
          titleDraftRef.current === rawTitle &&
          noteDraftRef.current === nextNote;
        if (unchanged) {
          setTitle(nextTitle);
          titleDraftRef.current = nextTitle;
          setSaveState("saved");
        } else {
          setSaveState("dirty");
        }
        return unchanged;
      } catch {
        if (mounted.current) setSaveState("error");
        return false;
      }
    };

    const queued = saveQueueRef.current.then(save, save);
    saveQueueRef.current = queued;
    return queued;
  }, [taskId, updateTask]);

  const closePanel = useCallback(async () => {
    if (closing) return;
    const revision = textRevision.current;
    setClosing(true);
    const saved = await persistDraft() && await flushProperties();
    if (!mounted.current) return;
    if (saved && revision === textRevision.current && !retryExtraRef.current && useTodoStore.getState().selectedTaskId === taskId) selectTask(null);
    else setClosing(false);
  }, [closing, persistDraft, flushProperties, selectTask, taskId]);

  const moveToList = useCallback(
    async (listId: string) => {
      await saveProperties({ listId });
    },
    [saveProperties],
  );

  const startTaskFocus = useCallback(async () => {
    const revision = textRevision.current;
    if (!(await persistDraft()) || !(await flushProperties()) || !mounted.current) return;
    if (revision !== textRevision.current || useTodoStore.getState().selectedTaskId !== taskId) return;
    await setView("pomodoro");
    if (!mounted.current || revision !== textRevision.current || useTodoStore.getState().selectedTaskId !== taskId || useTodoStore.getState().view !== "pomodoro") return;
    if (!focusBindingLocked) bindTask(taskId);
    selectTask(null);
  }, [bindTask, focusBindingLocked, persistDraft, flushProperties, selectTask, setView, taskId]);

  useEffect(() => {
    previousFocusRef.current ??= document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    // 必须在锁滚动之前量：锁住后滚动条消失、clientWidth 变宽，就量不准了
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      // 锁滚动吞掉滚动条 → 视口变宽 → 居中内容与固定壁纸层都会被拉动。
      // 给 body 补等宽 padding 保住页面内容；壁纸层经 --scrollbar-comp 反向补偿。
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      document.documentElement.style.setProperty(
        "--scrollbar-comp",
        `${scrollbarWidth}px`,
      );
    }
    titleInputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.documentElement.style.removeProperty("--scrollbar-comp");
      window.requestAnimationFrame(() => {
        const previousFocus = previousFocusRef.current;
        const stillSelected = useTodoStore.getState().selectedTaskId === taskId;
        if (!stillSelected && previousFocus?.isConnected) previousFocus.focus();
      });
    };
  }, [taskId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      void closePanel();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closePanel]);

  const tags = task?.tags ?? EMPTY_TAGS;

  if (!task) return null;

  const saveLabel = propertySave.failed || extraFailed
    ? t.taskSaveFailed
    : propertySave.saving || extraSaving ? t.taskSaving :
    saveState === "saving"
      ? t.taskSaving
      : saveState === "dirty"
        ? t.taskUnsaved
        : saveState === "error"
          ? t.taskSaveFailed
          : saveState === "invalid"
            ? t.taskTitleRequired
            : t.taskSaved;

  const saveRepeat = (
    frequency: "none" | RepeatFrequency,
    interval: number,
    weekdays = repeatWeekdays,
    endDate = repeatEndDate,
    baseDate = dueDate || todayKey(),
    nextDueDate = dueDate || baseDate,
  ) => {
    if (frequency === "none") {
      void saveProperties({ repeatRule: null });
      return;
    }
    const baseDay = parseDateKey(baseDate).getDay();
    const rule: RepeatRule = {
      frequency,
      interval: Math.max(1, interval),
      weekdays:
        frequency === "weekly"
          ? [baseDay]
          : frequency === "custom"
            ? weekdays.length > 0
              ? [...weekdays].sort((a, b) => a - b)
              : [baseDay]
            : undefined,
      monthDay:
        frequency === "monthly" ? parseDateKey(baseDate).getDate() : undefined,
      endDate: endDate || null,
    };
    void saveProperties({ repeatRule: rule, dueDate: nextDueDate });
  };

  /* ---------- 共用字段片段（同一份状态，双端各渲染一份，单端可见） ---------- */

  const listField = (
    <label className="block space-y-1.5">
      <span className="text-sm text-[var(--muted)]">{t.lists}</span>
      <select
        value={listId}
        onChange={(event) => { void moveToList(event.target.value); }}
        className={fieldClass}
      >
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
    </label>
  );

  const priorityField = (
    <label className="block space-y-1.5">
      <span className="text-sm text-[var(--muted)]">{t.priority}</span>
      <select
        value={priority}
        onChange={(e) => {
          const next = e.target.value as Priority;
          void saveProperties({ priority: next });
        }}
        className={fieldClass}
      >
        <option value="none">{t.priorityNone}</option>
        <option value="low">{t.priorityLow}</option>
        <option value="medium">{t.priorityMedium}</option>
        <option value="high">{t.priorityHigh}</option>
      </select>
    </label>
  );

  const focusButton = (
    <button
      type="button"
      disabled={task.completedAt != null && !focusBindingLocked}
      title={focusBindingLocked ? t.focusBindingLocked : undefined}
      onClick={() => void runExtra(startTaskFocus)}
      className="ui-button-primary inline-flex items-center justify-center gap-2 self-end px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Timer className="size-4" />
      {focusBindingLocked ? t.returnToFocus : t.startFocus}
    </button>
  );

  const focusButtonWide = (
    <button
      type="button"
      disabled={task.completedAt != null && !focusBindingLocked}
      title={focusBindingLocked ? t.focusBindingLocked : undefined}
      onClick={() => void runExtra(startTaskFocus)}
      className="ui-button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Timer className="size-4" />
      {focusBindingLocked ? t.returnToFocus : t.startFocus}
    </button>
  );

  const noteField = (
    <details><summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--muted)]">{t.note}</summary><label className="block space-y-1.5">
      <span className="text-sm text-[var(--muted)]">{t.note}</span>
      <textarea
        value={note}
        onChange={(e) => {
          const next = e.target.value;
          setNote(next);
          textRevision.current++;
          noteDraftRef.current = next;
          setSaveState("dirty");
        }}
        onBlur={() => void persistDraft()}
        rows={5}
        placeholder={t.notePlaceholder}
        className={cn(fieldClass, "resize-y")}
      />
    </label></details>
  );

  const dueDateField = (
    <label className="block space-y-1.5">
      <span className="text-sm text-[var(--muted)]">{t.optionalDeadline}</span>
      <input
        type="date"
        value={dueDate}
        onChange={(e) => {
          const next = e.target.value;
          if (next && repeatFreq !== "none") {
            saveRepeat(
              repeatFreq,
              repeatInterval,
              repeatWeekdays,
              repeatEndDate,
              next,
              next,
            );
          } else void saveProperties({ dueDate: next || null });
        }}
        className={fieldClass}
      />
    </label>
  );

  const repeatField = (
    <label className="block space-y-1.5">
      <span className="text-sm text-[var(--muted)]">{t.repeat}</span>
      <select
        value={repeatFreq}
        onChange={(e) => {
          const next = e.target.value as "none" | RepeatFrequency;
          saveRepeat(next, repeatInterval);
        }}
        className={fieldClass}
      >
        <option value="none">{t.repeatNone}</option>
        <option value="daily">{t.repeatDaily}</option>
        <option value="weekly">{t.repeatWeekly}</option>
        <option value="monthly">{t.repeatMonthly}</option>
        <option value="custom">{t.repeatCustom}</option>
      </select>
    </label>
  );

  const repeatIntervalField = (
    <label className="block space-y-1.5">
      <span className="text-sm text-[var(--muted)]">{t.repeatInterval}</span>
      <input
        type="number"
        min={1}
        value={repeatInterval}
        disabled={repeatFreq === "none"}
        onChange={(e) => {
          const next = Math.max(1, Number(e.target.value) || 1);
          if (repeatFreq !== "none") saveRepeat(repeatFreq, next);
        }}
        className={cn(fieldClass, "disabled:opacity-50")}
      />
    </label>
  );

  const repeatWeekdaysField = repeatFreq === "custom" ? (
    <fieldset className="space-y-2">
      <legend className="text-sm text-[var(--muted)]">
        {t.repeatWeekdays}
      </legend>
      <div className="flex flex-wrap gap-1.5 sm:gap-2">
        {t.weekdayShort.map((label, weekday) => {
          const selected = repeatWeekdays.includes(weekday);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              className={cn(
                "min-w-10 rounded-xl border px-2 py-1.5 text-xs sm:px-2.5 sm:py-2 sm:text-sm",
                selected
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]",
              )}
              onClick={() => {
                const next = selected
                  ? repeatWeekdays.filter((item) => item !== weekday)
                  : [...repeatWeekdays, weekday];
                if (next.length === 0) return;
                saveRepeat(repeatFreq, repeatInterval, next, repeatEndDate);
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </fieldset>
  ) : null;

  const repeatEndDateField = repeatFreq !== "none" ? (
    <label className="block space-y-1.5">
      <span className="text-sm text-[var(--muted)]">{t.repeatEndDate}</span>
      <input
        type="date"
        min={dueDate || task.dueDate || todayKey()}
        value={repeatEndDate}
        onChange={(e) => {
          const next = e.target.value;
          saveRepeat(repeatFreq, repeatInterval, repeatWeekdays, next);
        }}
        className={fieldClass}
      />
    </label>
  ) : null;

  const planSection = (
    <section className="space-y-2">
      <h3 className={sectionTitleClass}>{t.planTask}</h3>
      <TaskScheduleControl task={task} saveDate={date => {
        return saveProperties({ scheduledDate: date, ...(!date ? { scheduledTime: null } : {}) });
      }} />
    </section>
  );
  const timeSection = (
    <details className="space-y-3">
      <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--muted)]">{t.taskMore}{dueDate ? " · " + t.optionalDeadline + " " + dueDate : ""}</summary>
      {scheduledDate ? <label className="block space-y-1.5">
        <span className="text-sm text-[var(--muted)]">{t.optionalTime}</span>
        <input type="time" value={scheduledTime} className={fieldClass}
          onChange={(event) => { void saveProperties({ scheduledTime: event.target.value || null }); }} />
      </label> : null}
      {dueDateField}
      {repeatField}
      {repeatFreq !== "none" ? repeatIntervalField : null}
      {repeatWeekdaysField}
      {repeatEndDateField}
    </details>
  );

  const tagsSection = (
    <details className="space-y-2">
      <summary className="cursor-pointer py-2 text-sm font-semibold text-[var(--muted)]">{t.tags} · {tags.length}</summary>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <button
            key={tag}
            type="button"
            className="rounded-full bg-[var(--chip)] px-3 py-1 text-sm"
            disabled={extraSaving}
            onClick={() => void runExtra(() => removeTaskTag(task.id, tag))}
            title={t.delete}
          >
            #{tag} {"\u00d7"}
          </button>
        ))}
      </div>
      <input
        disabled={extraSaving}
        value={tagDraft}
        onChange={(e) => setTagDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          const next = tagDraft.trim();
          if (!next || tags.includes(next)) return;
          const submitted = tagDraft;
          void runExtra(async () => {
            await addTaskTag(task.id, next);
            if (mounted.current) setTagDraft(current => current === submitted ? "" : current);
          });
        }}
        placeholder={t.tagsPlaceholder}
        className={fieldClass}
      />
    </details>
  );

  const subtasksSection = (
    <details className="space-y-3">
      <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--muted)]">{t.subtasks} · {subtasks.length}</summary>
      {subtasks.length === 0 ? (
        <div className="text-xs text-[var(--muted)]">
          {t.subtaskPlaceholder}
        </div>
      ) : (
        <ul className="space-y-2">
          {subtasks.map((child) => (
            <li
              key={child.id}
              className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2"
            >
              <button
                type="button"
                aria-label={(child.completedAt ? t.markTaskOpen : t.markTaskComplete).replace("{title}", child.title)}
                aria-pressed={child.completedAt != null}
                disabled={extraSaving}
                onClick={() => void runExtra(() => toggleTask(child.id))}
                className={cn(
                  "grid size-5 place-items-center rounded border",
                  child.completedAt
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                    : "border-[var(--line)]",
                )}
              >
                {child.completedAt ? <Check className="size-3" /> : null}
              </button>
              <span
                className={cn(
                  "flex-1 text-sm",
                  child.completedAt
                    ? "line-through text-[var(--muted)]"
                    : "",
                )}
              >
                {child.title}
              </span>
              <button
                type="button"
                aria-label={t.delete}
                title={t.delete}
                className="grid size-7 place-items-center rounded-lg text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                disabled={extraSaving}
                onClick={() => void runExtra(() => deleteTask(child.id))}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const submitted = subtaskDraft;
          if (!submitted.trim()) return;
          void runExtra(async () => {
            await createTask({ title: submitted, parentId: task.id });
            if (mounted.current) setSubtaskDraft(current => current === submitted ? "" : current);
          });
        }}
      >
        <input
          aria-label={t.subtaskPlaceholder}
          disabled={extraSaving}
          onKeyDown={event => { if (event.key === "Enter" && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault(); }}
          value={subtaskDraft}
          onChange={(e) => setSubtaskDraft(e.target.value)}
          placeholder={t.subtaskPlaceholder}
          className={cn(fieldClass, "flex-1")}
        />
        <button type="submit" disabled={extraSaving || !subtaskDraft.trim()} className="ui-button-primary px-4 py-2 text-sm disabled:opacity-50">
          {t.addSubtask}
        </button>
      </form>
    </details>
  );

  // portal 到 body：彻底脱离页面容器的层叠上下文/包含块，保证遮罩+霜化
  // 一定铺满视口并与壁纸同层比较，不被任何祖先的 transform/backdrop 截断
  return createPortal(
    <div
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-[var(--bg)] lg:bg-[var(--overlay,_rgba(10,8,18,0.6))] lg:backdrop-blur-[12px] lg:p-6"
      onClick={(event) => {
        // 桌面端点背板关闭；移动端全屏无背板区域，不会误触
        if (event.target === event.currentTarget) void closePanel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.tasks}
        aria-busy={saveState === "saving" || propertySave.saving || extraSaving}
        className="task-detail-sheet relative z-10 mx-auto flex min-h-full w-full max-w-2xl flex-col bg-[var(--bg)] lg:m-auto lg:h-auto lg:min-h-0 lg:w-full lg:max-w-[880px] lg:overflow-hidden lg:rounded-[var(--radius-panel)] lg:border lg:border-[var(--line)] lg:bg-[var(--bg-elevated)] lg:shadow-[var(--shadow-floating)]"
      >
        {/* 顶部固定：返回 / 标题 / 关闭 */}
        <header className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2.5 sm:px-5">
          <button
            type="button"
            aria-label={t.taskDetailBack}
            title={t.taskDetailBack}
            disabled={closing}
            onClick={() => void closePanel()}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold sm:text-lg">
              {t.tasks}
            </h2>
            <p
              aria-live="polite"
              className={cn(
                "mt-0.5 truncate text-xs",
                saveState === "error" || saveState === "invalid" || propertySave.failed || extraFailed
                  ? "text-[var(--danger)]"
                  : "text-[var(--muted)]",
              )}
            >
              {saveLabel}
            </p>
          </div>
          <button
            type="button"
            aria-label={t.taskDetailClose}
            title={t.taskDetailClose}
            disabled={closing}
            onClick={() => void closePanel()}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="space-y-1 px-4">
          <SaveStatus locale={locale} saving={propertySave.saving} failed={propertySave.failed} onRetry={() => void propertySave.retry()} />
          <SaveStatus locale={locale} saving={extraSaving} failed={extraFailed} onRetry={() => { if (retryExtraRef.current) void runExtra(retryExtraRef.current); }} />
          {saveState === "error" ? <SaveStatus locale={locale} saving={false} failed onRetry={() => void persistDraft()} /> : null}
        </div>
        {/* 主体：标题 hero + 移动单列 / 桌面双栏（同一份字段片段） */}
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl space-y-4 p-4 sm:p-6 lg:max-w-none lg:p-6">
            <label className="block">
              <span className="sr-only">{t.tasks}</span>
              <input
                ref={titleInputRef}
                value={title}
                required
                placeholder={t.taskTitlePlaceholder}
                aria-invalid={saveState === "invalid"}
                onChange={(e) => {
                  const next = e.target.value;
                  setTitle(next);
                  textRevision.current++;
                  titleDraftRef.current = next;
                  setSaveState("dirty");
                }}
                onBlur={() => void persistDraft()}
                className="w-full min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--surface-input)] px-3.5 py-2.5 text-lg font-semibold outline-none focus:border-[var(--accent)] sm:text-xl lg:text-2xl"
              />
            </label>

            {/* 移动 / 平板：单列分区流（<1024px） */}
            <div className="space-y-4 lg:hidden">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                {listField}
                {focusButton}
              </div>
              {noteField}
              <TaskMaterials taskId={taskId} note={note} />
              {priorityField}
              {planSection}
              {timeSection}
              {tagsSection}
              {subtasksSection}
            </div>

            {/* 桌面：左主栏（备注/子任务） + 右属性栏（≥1024px） */}
            <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
              <div className="space-y-4">
                {noteField}
                <TaskMaterials taskId={taskId} note={note} />
                {subtasksSection}
              </div>
              <aside className="space-y-4">
                {listField}
                {focusButtonWide}
                {priorityField}
                {planSection}
                {timeSection}
                {tagsSection}
              </aside>
            </div>
          </div>
        </main>

        {/* 底部固定：完成 / 删除（始终可见） */}
        <footer className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-2.5 sm:px-5">
          <button
            type="button"
            disabled={closing || extraSaving}
            onClick={() => void runExtra(async () => {
              if (await persistDraft() && await flushProperties() && mounted.current) await toggleTask(task.id);
            })}
            className="ui-button-primary inline-flex flex-1 items-center justify-center gap-2 px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="size-4" />
            {task.completedAt ? t.reopen : t.complete}
          </button>
          <button
            type="button"
            aria-label={deletePending ? t.confirmDeleteAction : t.delete}
            title={deletePending ? t.confirmDeleteAction : t.delete}
            disabled={closing || extraSaving || propertySave.saving}
            onClick={() => {
              if (deletePending) void runExtra(() => deleteTask(task.id));
              else setDeletePending(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--danger)] hover:bg-[var(--danger-soft)]"
          >
            <Trash2 className="size-4" />
            <span className={deletePending ? "" : "hidden sm:inline"}>{deletePending ? t.confirmDeleteAction : t.delete}</span>
          </button>
          {deletePending ? <button type="button" className="ui-button-secondary min-h-10 px-3 py-2 text-sm" onClick={() => setDeletePending(false)}>{t.cancel}</button> : null}
        </footer>
      </div>
    </div>,
    document.body,
  );
}
