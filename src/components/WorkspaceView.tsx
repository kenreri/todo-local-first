import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Archive, Inbox, Search, SlidersHorizontal, X } from "lucide-react";
import { useWorkspace } from "../hooks/useWorkspace";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { cn } from "../lib/cn";
import { toDateKey } from "../lib/dates";
import {
  deleteWorkspaceItem,
  updateWorkspaceItem,
  workspaceError,
} from "../lib/workspace";
import { useTodoStore } from "../store/todoStore";
import {
  draftPatch,
  setWorkspaceDraft,
  useWorkspaceUiStore,
  type WorkspaceScope,
} from "../store/workspaceUiStore";
import type { AttachmentRecord, WorkspaceItem } from "../types";
import {
  WorkspaceCapture,
  type WorkspaceCaptureHandle,
} from "./WorkspaceCapture";
import {
  WorkspaceItemEditor,
  type WorkspaceEditorHandle,
} from "./WorkspaceItemEditor";
import { WorkspaceItemRow } from "./WorkspaceItemRow";
import { WorkspaceAgenda } from "./WorkspaceAgenda";

export function WorkspaceView() {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const tasks = useTodoStore((state) => state.tasks);
  const selectTask = useTodoStore((state) => state.selectTask);
  const { items, attachments, loading, failed } = useWorkspace();
  const { scope, kind, intention, search, limit, editingId, drafts } =
    useWorkspaceUiStore();
  const setUi = useWorkspaceUiStore.setState;
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const captureRef = useRef<WorkspaceCaptureHandle>(null);
  const editorRef = useRef<WorkspaceEditorHandle>(null);
  const wide = useMediaQuery("(min-width: 1280px)");
  const restoreTop = useRef(useWorkspaceUiStore.getState().scrollTop);
  const restored = useRef(false);
  const openButton = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!loading && !restored.current) {
      window.scrollTo(0, restoreTop.current);
      restored.current = true;
    }
  }, [loading]);
  useEffect(
    () => () => {
      useWorkspaceUiStore.setState({ scrollTop: window.scrollY });
    },
    [],
  );
  useEffect(() => {
    const clear = () => setDragging(false);
    window.addEventListener("drop", clear, true);
    window.addEventListener("dragend", clear);
    return () => {
      window.removeEventListener("drop", clear, true);
      window.removeEventListener("dragend", clear);
    };
  }, []);
  const taskMap = useMemo(
    () =>
      new Map(
        tasks
          .filter((task) => task.deletedAt == null)
          .map((task) => [task.id, task]),
      ),
    [tasks],
  );
  const fileMap = useMemo(() => {
    const result = new Map<string, AttachmentRecord[]>();
    for (const file of attachments)
      result.set(file.itemId, [...(result.get(file.itemId) ?? []), file]);
    return result;
  }, [attachments]);
  const editing = items.find((item) => item.id === editingId);
  const today = toDateKey(new Date());
  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const inboxCount = items.filter(
    (item) =>
      item.archivedAt == null &&
      item.kind === "inbox" &&
      !taskMap.has(item.taskId ?? ""),
  ).length;
  const filtered = items.filter((item) => {
    if (
      scope === "archived" ? item.archivedAt == null : item.archivedAt != null
    )
      return false;
    const task = item.taskId ? taskMap.get(item.taskId) : undefined;
    if (scope === "recent" && !search.trim() && item.updatedAt < recentCutoff)
      return false;
    if (scope === "inbox" && (item.kind !== "inbox" || task)) return false;
    if (kind !== "all" && item.kind !== kind) return false;
    if (intention !== "all" && (!task || item.intention !== intention))
      return false;
    return [
      item.title,
      item.body,
      task?.title,
      ...(fileMap.get(item.id) ?? []).map((file) => file.name),
    ]
      .join("\n")
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase());
  });
  const guard = (action: () => void) => {
    if (editorRef.current) editorRef.current.requestLeave(action);
    else action();
  };
  const closeEditor = () => {
    if (editingId) setWorkspaceDraft(editingId, null);
    setUi({ editingId: null });
    requestAnimationFrame(() => {
      if (openButton.current?.isConnected)
        openButton.current.focus({ preventScroll: true });
    });
  };
  const openTaskDirect = (id: string) => {
    closeEditor();
    // Let the native material dialog release focus and scroll before the task modal opens.
    requestAnimationFrame(() => selectTask(id));
  };
  const openTask = (id: string) => guard(() => openTaskDirect(id));
  const openItem = (id: string) => {
    if (id === editingId) return;
    const button =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    guard(() => {
      openButton.current = button;
      setUi({ editingId: id });
    });
  };
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
  const mutate = (item: WorkspaceItem, operation: () => Promise<void>) => {
    const action = () => {
      if (item.id === editingId) closeEditor();
      void perform(operation);
    };
    if (item.id === editingId) guard(action);
    else action();
  };
  const scopes: [WorkspaceScope, string][] = [
    ["recent", zh ? "最近" : "Recent"],
    ["inbox", zh ? `待整理 ${inboxCount || ""}` : `Inbox ${inboxCount || ""}`],
    ["all", zh ? "全部" : "All"],
  ];
  return (
    <div
      className={cn(
        "min-w-0 space-y-5",
        dragging &&
          "rounded-[var(--radius-panel)] outline-2 outline-offset-4 outline-[var(--accent)]",
      )}
      onDragOver={(event) => {
        if (
          !event.defaultPrevented &&
          event.dataTransfer.types.includes("Files")
        ) {
          event.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setDragging(false);
      }}
      onDrop={(event) => {
        if (!event.defaultPrevented && event.dataTransfer.files.length) {
          event.preventDefault();
          captureRef.current?.addFiles(Array.from(event.dataTransfer.files));
        }
        setDragging(false);
      }}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight md:text-[34px]">
            {zh ? "我的工作台" : "My workspace"}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {zh
              ? "先记下来，再慢慢推进。"
              : "Capture a thought. Take the next step."}
          </p>
        </div>
        <time dateTime={today} className="text-xs text-[var(--muted)]">
          {new Intl.DateTimeFormat(zh ? "zh-CN" : "en", {
            month: "long",
            day: "numeric",
            weekday: "short",
          }).format(new Date())}
        </time>
      </header>
      {dragging ? (
        <p role="status" className="text-sm text-[var(--accent)]">
          {zh
            ? "松手放入收集区，新建一条记录"
            : "Drop into capture to create a new record"}
        </p>
      ) : null}
      <div
        className={cn(
          "grid min-w-0 items-start gap-5 xl:grid-rows-[auto_1fr]",
          editing && wide
            ? "xl:grid-cols-[minmax(0,1fr)_420px]"
            : "xl:grid-cols-[minmax(0,1fr)_280px]",
        )}
      >
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <WorkspaceCapture
            ref={captureRef}
            onSaved={() =>
              setUi({
                scope: "recent",
                kind: "all",
                intention: "all",
                search: "",
                limit: 30,
              })
            }
          />
        </div>
        <div className="min-w-0 self-stretch xl:col-start-2 xl:row-span-2 xl:row-start-1">
          {editing ? (
            <WorkspaceItemEditor
              key={editing.id}
              ref={editorRef}
              item={editing}
              task={editing.taskId ? taskMap.get(editing.taskId) : undefined}
              files={fileMap.get(editing.id) ?? []}
              onClose={closeEditor}
              onOpenTask={openTaskDirect}
            />
          ) : (
            <WorkspaceAgenda tasks={tasks} today={today} onTask={openTask} />
          )}
        </div>
        <section
          aria-label={zh ? "收集的内容" : "Your captures"}
          className="min-w-0 space-y-3 xl:col-start-1 xl:row-start-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">
              {scope === "archived"
                ? zh
                  ? "已归档"
                  : "Archived"
                : zh
                  ? "我的收集"
                  : "My collection"}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">
                {filtered.length}
              </span>
            </h2>
            <label className="relative min-w-0 max-w-full flex-1 sm:max-w-60">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-[var(--muted)]" />
              <input
                data-shortcut="search"
                aria-label={zh ? "搜索收集" : "Search collection"}
                placeholder={zh ? "搜索文字、文件名…" : "Search text or files…"}
                value={search}
                onChange={(event) =>
                  setUi({ search: event.target.value, limit: 30 })
                }
                className="ui-input w-full py-2 pl-9 pr-9 text-sm"
              />
              {search ? (
                <button
                  type="button"
                  aria-label={zh ? "清空搜索" : "Clear search"}
                  onClick={() => setUi({ search: "" })}
                  className="absolute right-0 top-0 grid size-10 place-items-center"
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </label>
          </div>
          <div
            className="flex flex-wrap items-center gap-1 border-b border-[var(--line)] pb-2"
            aria-label={zh ? "筛选收集" : "Filter collection"}
          >
            {scopes.map(([key, label]) => (
              <button
                key={key}
                type="button"
                aria-pressed={scope === key}
                className={cn(
                  "min-h-10 rounded-[var(--radius-control)] px-3 text-sm",
                  scope === key
                    ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                    : "text-[var(--muted)] hover:bg-[var(--hover)]",
                )}
                onClick={() => setUi({ scope: key, limit: 30 })}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-label={zh ? "归档记录" : "Archived captures"}
              aria-pressed={scope === "archived"}
              onClick={() =>
                setUi({
                  scope: scope === "archived" ? "all" : "archived",
                  limit: 30,
                })
              }
              className={cn(
                "ml-auto grid size-10 place-items-center rounded-[var(--radius-control)]",
                scope === "archived"
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--hover)]",
              )}
            >
              <Archive className="size-4" />
            </button>
            <button
              type="button"
              aria-label={zh ? "筛选类型与行动" : "Filter type and intention"}
              aria-expanded={advanced}
              onClick={() => setAdvanced(!advanced)}
              className={cn(
                "grid size-10 place-items-center rounded-[var(--radius-control)]",
                advanced || kind !== "all" || intention !== "all"
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--hover)]",
              )}
            >
              <SlidersHorizontal className="size-4" />
            </button>
          </div>
          {advanced || kind !== "all" || intention !== "all" ? (
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={zh ? "筛选内容类型" : "Filter content type"}
                value={kind}
                onChange={(event) =>
                  setUi({ kind: event.target.value as typeof kind, limit: 30 })
                }
                className="ui-input max-w-full px-3 py-2 text-xs"
              >
                <option value="all">{zh ? "全部类型" : "All types"}</option>
                <option value="inbox">{zh ? "未分类" : "Uncategorized"}</option>
                <option value="idea">{zh ? "想法" : "Ideas"}</option>
                <option value="note">{zh ? "笔记" : "Notes"}</option>
                <option value="resource">{zh ? "资料" : "Resources"}</option>
              </select>
              <select
                aria-label={zh ? "筛选行动" : "Filter intention"}
                value={intention}
                onChange={(event) =>
                  setUi({
                    intention: event.target.value as typeof intention,
                    limit: 30,
                  })
                }
                className="ui-input max-w-full px-3 py-2 text-xs"
              >
                <option value="all">
                  {zh ? "全部行动" : "All intentions"}
                </option>
                <option value="want">{zh ? "想做" : "Want to do"}</option>
                <option value="need">{zh ? "需要做" : "Need to do"}</option>
              </select>
              {kind !== "all" || intention !== "all" ? (
                <button
                  type="button"
                  onClick={() => setUi({ kind: "all", intention: "all" })}
                  className="min-h-10 px-2 text-xs text-[var(--muted)]"
                >
                  {zh ? "重置筛选" : "Reset filters"}
                </button>
              ) : null}
            </div>
          ) : null}
          {scope === "recent" && !search ? (
            <p className="text-xs text-[var(--muted)]">
              {zh
                ? "近 7 天更新 · 搜索可查找更早的记录"
                : "Updated in the last 7 days · search includes older captures"}
            </p>
          ) : null}
          {error || failed ? (
            <p role="alert" className="text-sm text-[var(--danger)]">
              {error ||
                (zh
                  ? "读取收集失败，请刷新重试。"
                  : "Could not load captures. Please reload.")}
            </p>
          ) : null}
          {loading ? (
            <p className="py-10 text-center text-sm text-[var(--muted)]">
              {zh ? "正在打开收集…" : "Loading…"}
            </p>
          ) : null}
          {!loading && !failed && !filtered.length ? (
            <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--line)] px-5 py-10 text-center">
              <Inbox className="mx-auto mb-3 size-7 text-[var(--muted)]" />
              <p className="text-sm font-medium">
                {search || kind !== "all" || intention !== "all"
                  ? zh
                    ? "没有找到匹配的内容"
                    : "No matches"
                  : scope === "inbox"
                    ? zh
                      ? "待整理的内容已经清空"
                      : "Your inbox is clear"
                    : zh
                      ? "从一个想法开始"
                      : "Start with a thought"}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {zh
                  ? "写一句话，或者把文件放进来。"
                  : "Write a line, or drop a file here."}
              </p>
              {scope !== "all" ? (
                <button
                  type="button"
                  onClick={() =>
                    setUi({
                      scope: "all",
                      kind: "all",
                      intention: "all",
                      search: "",
                    })
                  }
                  className="mt-2 min-h-10 text-xs text-[var(--accent)]"
                >
                  {zh ? "查看全部收集" : "View all captures"}
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="min-w-0 divide-y divide-[var(--line)] rounded-[var(--radius-card)] bg-[var(--bg-elevated)]">
            {filtered.slice(0, limit).map((item) => (
              <WorkspaceItemRow
                key={item.id}
                item={item}
                files={fileMap.get(item.id) ?? []}
                task={item.taskId ? taskMap.get(item.taskId) : undefined}
                selected={editingId === item.id}
                draft={
                  !!drafts[item.id] &&
                  Object.keys(draftPatch(drafts[item.id])).length > 0
                }
                busy={busy}
                onOpen={() => openItem(item.id)}
                onTask={openTask}
                onArchive={() =>
                  mutate(item, () =>
                    updateWorkspaceItem(item.id, {
                      archivedAt: item.archivedAt == null ? Date.now() : null,
                    }),
                  )
                }
                onDelete={() =>
                  mutate(item, async () => {
                    await deleteWorkspaceItem(item.id);
                    setWorkspaceDraft(item.id, null);
                  })
                }
              />
            ))}
          </div>
          {filtered.length > limit ? (
            <button
              type="button"
              className="ui-button-secondary min-h-10 w-full text-sm"
              onClick={() => setUi({ limit: limit + 30 })}
            >
              {zh ? "加载更多" : "Show more"}
            </button>
          ) : null}
        </section>
      </div>
    </div>
  );
}
