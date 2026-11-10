import {
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Maximize2,
  Minimize2,
  Paperclip,
  Plus,
  X,
} from "lucide-react";
import {
  addAttachments,
  removeAttachment,
  turnIntoTask,
  updateWorkspaceItem,
  workspaceError,
} from "../lib/workspace";
import { useTodoStore } from "../store/todoStore";
import {
  draftPatch,
  editorValues,
  setWorkspaceDraft,
  useWorkspaceUiStore,
  type EditorValues,
} from "../store/workspaceUiStore";
import { useMediaQuery } from "../hooks/useMediaQuery";
import type { AttachmentRecord, TaskRecord, WorkspaceItem } from "../types";
import { WorkspaceAttachments } from "./WorkspaceAttachments";
import { MaterialLinks } from "./MaterialLinks";
import { ObsidianExport } from "./ObsidianExport";

export interface WorkspaceEditorHandle {
  requestLeave: (action: () => void) => void;
}

export function WorkspaceItemEditor({
  item,
  files,
  task,
  onClose,
  onOpenTask,
  ref,
}: {
  item: WorkspaceItem;
  files: AttachmentRecord[];
  task?: TaskRecord;
  onClose: () => void;
  onOpenTask: (id: string) => void;
  ref?: Ref<WorkspaceEditorHandle>;
}) {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const stored = useWorkspaceUiStore((state) => state.drafts[item.id]);
  const draft =
    stored && Object.keys(draftPatch(stored)).length
      ? stored
      : { original: editorValues(item), values: editorValues(item) };
  const { title, body, kind, intention } = draft.values;
  const patch = draftPatch(draft);
  const dirty = Object.keys(patch).length > 0;
  const wide = useMediaQuery("(min-width: 1280px)");
  const [expanded, setExpanded] = useState(false);
  const modal = !wide || expanded;
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [addingTask, setAddingTask] = useState(false);
  const [taskIntention, setTaskIntention] = useState<"want" | "need">("want");
  const [planned, setPlanned] = useState("");
  const [deadline, setDeadline] = useState("");
  const [dragging, setDragging] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const side = useRef<HTMLElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLDivElement>(null);
  const update = (changes: Partial<EditorValues>) =>
    setWorkspaceDraft(item.id, {
      original: draft.original,
      values: { ...draft.values, ...changes },
    });
  const requestLeave = (action: () => void) => {
    if (lock.current) return;
    if (dirty) setPending(() => action);
    else {
      setWorkspaceDraft(item.id, null);
      action();
    }
  };
  useImperativeHandle(ref, () => ({ requestLeave }));
  useLayoutEffect(() => {
    if (modal) return;
    const node = side.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      const container = node.parentElement?.getBoundingClientRect();
      const top = Math.max(16, container?.top ?? 16);
      const parentBottom = container?.bottom ?? window.innerHeight;
      // Sticky elements also stop at their parent's bottom edge.
      const available = Math.min(window.innerHeight - top - 48, parentBottom - 16);
      node.style.height = `${Math.max(240, available)}px`;
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(schedule);
    if (node.parentElement) observer.observe(node.parentElement);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [modal]);
  useEffect(() => {
    if (!modal) {
      panel.current?.focus({ preventScroll: true });
      return;
    }
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    const previousPadding = document.body.style.paddingRight;
    const previousComp =
      document.documentElement.style.getPropertyValue("--scrollbar-comp");
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (gap > 0) {
      document.body.style.paddingRight = `${gap}px`;
      document.documentElement.style.setProperty(
        "--scrollbar-comp",
        `${gap}px`,
      );
    }
    node?.showModal();
    return () => {
      node?.close();
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      if (previousComp)
        document.documentElement.style.setProperty(
          "--scrollbar-comp",
          previousComp,
        );
      else document.documentElement.style.removeProperty("--scrollbar-comp");
    };
  }, [modal]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    if (pending) confirmation.current?.focus({ preventScroll: true });
  }, [pending]);
  const perform = async (operation: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (err) {
      setError(workspaceError(err, zh));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const saveText = async () => {
    if (dirty) await updateWorkspaceItem(item.id, patch);
    setWorkspaceDraft(item.id, {
      original: { ...draft.values, title: title.trim() },
      values: { ...draft.values, title: title.trim() },
    });
  };
  const append = (incoming: File[]) => {
    if (incoming.length) void perform(() => addAttachments(item.id, incoming));
  };
  const content = (
    <div
      ref={panel}
      tabIndex={-1}
      className="flex h-full min-h-0 flex-col outline-none"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !modal) {
          event.stopPropagation();
          requestLeave(onClose);
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key === "Enter" &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault();
          void perform(saveText);
        }
      }}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.stopPropagation();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        event.stopPropagation();
        if (event.dataTransfer.files.length) {
          event.preventDefault();
          append(Array.from(event.dataTransfer.files));
        }
        setDragging(false);
      }}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--line)] px-4 py-3">
        <h2
          id="workspace-editor-title"
          className="min-w-0 flex-1 text-sm font-semibold"
        >
          {zh ? "整理记录" : "Edit capture"}
        </h2>
        {wide ? (
          <button
            type="button"
            aria-label={
              expanded
                ? zh
                  ? "收回侧栏"
                  : "Return to sidebar"
                : zh
                  ? "展开阅读"
                  : "Expand editor"
            }
            onClick={() => setExpanded(!expanded)}
            className="grid size-10 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--hover)]"
          >
            {expanded ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => requestLeave(onClose)}
          aria-label={zh ? "关闭记录" : "Close capture"}
          className="grid size-10 place-items-center rounded-[var(--radius-control)] hover:bg-[var(--hover)]"
        >
          {wide ? <X className="size-5" /> : <ArrowLeft className="size-5" />}
        </button>
      </header>
      {dragging ? (
        <p
          role="status"
          className="shrink-0 bg-[var(--accent-soft)] px-4 py-3 text-sm text-[var(--accent)]"
        >
          {zh ? `添加附件到「${title}」` : `Attach to “${title}”`}
        </p>
      ) : null}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-5">
        <label className="block space-y-1 text-sm">
          <span className="sr-only">{zh ? "标题" : "Title"}</span>
          <input
            className="ui-input w-full px-3 py-2 text-lg font-semibold"
            value={title}
            disabled={busy}
            onChange={(event) => update({ title: event.target.value })}
          />
        </label>
        <label className="flex items-center gap-3 text-xs text-[var(--muted)]">
          <span>{zh ? "分类" : "Type"}</span>
          <select
            value={kind}
            disabled={busy}
            className="ui-input min-w-0 px-3 py-2 text-xs"
            onChange={(event) =>
              update({ kind: event.target.value as typeof kind })
            }
          >
            <option value="inbox">{zh ? "待整理" : "Inbox"}</option>
            <option value="idea">{zh ? "想法" : "Idea"}</option>
            <option value="note">{zh ? "笔记" : "Note"}</option>
            <option value="resource">{zh ? "资料" : "Resource"}</option>
          </select>
        </label>
        <label className="block space-y-2 text-sm">
          <span className="text-xs text-[var(--muted)]">
            {zh ? "内容" : "Content"}
          </span>
          <textarea
            rows={expanded ? 16 : 8}
            className="ui-input w-full resize-y px-3 py-2 text-sm leading-6"
            value={body}
            disabled={busy}
            onChange={(event) => update({ body: event.target.value })}
            onPaste={(event) => {
              if (event.clipboardData.files.length) {
                event.preventDefault();
                append(Array.from(event.clipboardData.files));
              }
            }}
          />
        </label>
        <MaterialLinks text={`${title}\n${body}`} compact={!expanded} />
        <section
          className="space-y-3 border-t border-[var(--line)] pt-3"
          aria-label={zh ? "附件" : "Files"}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[var(--muted)]">
              {zh ? "附件" : "Files"} {files.length || ""}
            </h3>
            <button
              type="button"
              disabled={busy}
              className="inline-flex min-h-10 items-center gap-1 text-xs text-[var(--accent)]"
              onClick={() => input.current?.click()}
            >
              <Paperclip className="size-4" />
              {zh ? "添加附件" : "Attach files"}
            </button>
          </div>
          <WorkspaceAttachments
            files={files}
            compact={!expanded}
            onRemove={(id) => {
              void perform(() => removeAttachment(id));
            }}
          />
          <p className="text-xs text-[var(--muted)]">
            {zh
              ? "附件添加和移除会立即保存。"
              : "File additions and removals save immediately."}
          </p>
          <input
            ref={input}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              append(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
          />
        </section>
        <section
          className="space-y-3 border-t border-[var(--line)] pt-4"
          aria-label={zh ? "关联任务" : "Linked task"}
        >
          <h3 className="text-xs font-semibold text-[var(--muted)]">
            {zh ? "关联任务" : "Linked task"}
          </h3>
          {task ? (
            <>
              <p className="break-words text-sm font-medium">{task.title}</p>
              <p className="text-xs text-[var(--muted)]">
                {task.completedAt
                  ? zh
                    ? "已完成"
                    : "Completed"
                  : task.dueDate
                    ? `DDL ${task.dueDate}`
                    : zh
                      ? "尚未设置截止日"
                      : "No deadline"}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  aria-label={zh ? "这件事" : "Intention"}
                  value={intention}
                  disabled={busy}
                  onChange={(event) =>
                    update({
                      intention: event.target.value as typeof intention,
                    })
                  }
                  className="ui-input px-3 py-2 text-xs"
                >
                  <option value="want">{zh ? "想做" : "Want to do"}</option>
                  <option value="need">{zh ? "需要做" : "Need to do"}</option>
                </select>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => requestLeave(() => onOpenTask(task.id))}
                  className="inline-flex min-h-10 items-center gap-1 text-sm text-[var(--accent)]"
                >
                  {zh ? "查看任务" : "View task"}
                  <ArrowUpRight className="size-4" />
                </button>
              </div>
            </>
          ) : addingTask ? (
            <div className="space-y-3">
              <select
                aria-label={zh ? "任务意向" : "Task intention"}
                value={taskIntention}
                onChange={(event) =>
                  setTaskIntention(event.target.value as typeof taskIntention)
                }
                disabled={busy}
                className="ui-input px-3 py-2 text-sm"
              >
                <option value="want">{zh ? "想做" : "Want to do"}</option>
                <option value="need">{zh ? "需要做" : "Need to do"}</option>
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="min-w-0 space-y-1 text-xs text-[var(--muted)]">
                  <span>
                    {zh ? "计划日（可选）" : "Planned day (optional)"}
                  </span>
                  <input
                    type="date"
                    value={planned}
                    disabled={busy}
                    onChange={(event) => setPlanned(event.target.value)}
                    className="ui-input block w-full min-w-0 px-2 py-2"
                  />
                </label>
                <label className="min-w-0 space-y-1 text-xs text-[var(--muted)]">
                  <span>{zh ? "DDL（可选）" : "Deadline (optional)"}</span>
                  <input
                    type="date"
                    value={deadline}
                    disabled={busy}
                    onChange={(event) => setDeadline(event.target.value)}
                    className="ui-input block w-full min-w-0 px-2 py-2"
                  />
                </label>
              </div>
              <p className="text-xs text-[var(--muted)]">
                {zh
                  ? "创建时会先保存当前文字，之后任务与原记录各自编辑。"
                  : "Creating saves this text first. The task and source can then be edited independently."}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={busy || !title.trim()}
                  className="ui-button-secondary min-h-10 px-3 text-sm"
                  onClick={() =>
                    void perform(async () => {
                      await saveText();
                      await turnIntoTask(item.id, taskIntention, {
                        dueDate: deadline,
                        scheduledDate: planned,
                      });
                      setAddingTask(false);
                    })
                  }
                >
                  {zh ? "创建关联任务" : "Create linked task"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-10 text-xs text-[var(--muted)]"
                  onClick={() => setAddingTask(false)}
                >
                  {zh ? "取消" : "Cancel"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingTask(true)}
              className="ui-button-secondary inline-flex min-h-10 items-center gap-2 px-3 text-sm"
            >
              <Plus className="size-4" />
              {zh ? "加入任务" : "Add a task"}
            </button>
          )}
        </section>
        <ObsidianExport title={title} body={body} />
      </div>
      {error ? (
        <p
          role="alert"
          className="shrink-0 px-4 py-2 text-sm text-[var(--danger)]"
        >
          {error}
        </p>
      ) : null}
      {pending ? (
        <div
          ref={confirmation}
          tabIndex={-1}
          role="alert"
          className="shrink-0 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-xs outline-none"
        >
          <p>
            {zh
              ? "有未保存的文字，先处理这次修改。已保存的附件会保留。"
              : "There are unsaved edits. Already saved files will stay."}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4">
            <button
              type="button"
              disabled={busy || !title.trim()}
              className="min-h-10 font-semibold text-[var(--accent)]"
              onClick={() =>
                void perform(async () => {
                  await saveText();
                  const action = pending;
                  setPending(null);
                  setWorkspaceDraft(item.id, null);
                  action();
                })
              }
            >
              {zh ? "保存并继续" : "Save and continue"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-10 text-[var(--danger)]"
              onClick={() => {
                const action = pending;
                setPending(null);
                setWorkspaceDraft(item.id, null);
                action();
              }}
            >
              {zh ? "放弃修改" : "Discard edits"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-10"
              onClick={() => setPending(null)}
            >
              {zh ? "继续编辑" : "Keep editing"}
            </button>
          </div>
        </div>
      ) : null}
      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
        <span role="status" className="text-xs text-[var(--muted)]">
          {busy
            ? zh
              ? "保存中…"
              : "Saving…"
            : dirty
              ? zh
                ? "文字尚未保存"
                : "Unsaved text"
              : zh
                ? "已保存"
                : "Saved"}
        </span>
        <button
          type="button"
          className="ui-button-primary inline-flex min-h-10 items-center gap-2 px-4 text-sm disabled:opacity-50"
          disabled={busy || !title.trim()}
          onClick={() => void perform(saveText)}
        >
          <Check className="size-4" />
          {zh ? "保存" : "Save"}
        </button>
      </footer>
    </div>
  );
  return modal ? (
    createPortal(
      <dialog
        ref={dialog}
        aria-labelledby="workspace-editor-title"
        onCancel={(event) => {
          event.preventDefault();
          requestLeave(onClose);
        }}
        className="m-0 h-dvh max-h-dvh w-screen max-w-none overflow-hidden border-0 bg-[var(--popup-bg,var(--bg-elevated))] p-0 text-[var(--ink)] shadow-[var(--shadow-floating)] backdrop:bg-[var(--overlay)] sm:m-auto sm:h-[90dvh] sm:max-h-[90dvh] sm:w-[min(960px,calc(100%-3rem))] sm:rounded-[var(--radius-panel)] sm:border sm:border-[var(--line)]"
      >
        {content}
      </dialog>,
      document.body,
    )
  ) : (
    <aside
      ref={side}
      aria-labelledby="workspace-editor-title"
      className="sticky top-4 h-[calc(100dvh-16rem)] max-h-[calc(100dvh-2rem)] min-w-0 overflow-hidden rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--popup-bg,var(--bg-elevated))]"
    >
      {content}
    </aside>
  );
}
