import { useEffect, useRef, useState } from "react";
import {
  Archive,
  FileText,
  Inbox,
  Lightbulb,
  MoreHorizontal,
  Paperclip,
  Trash2,
  CheckCheck,
  FolderOpen,
} from "lucide-react";
import type { AttachmentRecord, TaskRecord, WorkspaceItem } from "../types";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { useTodoStore } from "../store/todoStore";
import {
  workspaceDisplayTitle,
  workspaceExcerpt,
} from "../lib/workspacePresentation";
import { MaterialLinks } from "./MaterialLinks";
import { cn } from "../lib/cn";

function Thumbnail({ file }: { file: AttachmentRecord }) {
  const { url } = useAttachmentUrl(file.id);
  return url ? (
    <img
      src={url}
      alt={file.name}
      loading="lazy"
      className="size-14 rounded-[var(--radius-small)] object-cover"
    />
  ) : (
    <FileText className="size-5" />
  );
}

export function WorkspaceItemRow({
  item,
  files,
  task,
  selected,
  draft,
  busy,
  onOpen,
  onTask,
  onArchive,
  onDelete,
}: {
  item: WorkspaceItem;
  files: AttachmentRecord[];
  task?: TaskRecord;
  selected: boolean;
  draft: boolean;
  busy: boolean;
  onOpen: () => void;
  onTask: (id: string) => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const [confirm, setConfirm] = useState(false);
  const menu = useRef<HTMLDetailsElement>(null);
  const menuButton = useRef<HTMLElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const cover = files.find((file) =>
    /^image\/(png|jpeg|gif|webp|avif)$/.test(file.mime),
  );
  const Icon =
    item.kind === "idea"
      ? Lightbulb
      : item.kind === "note"
        ? FileText
        : item.kind === "resource"
          ? FolderOpen
          : Inbox;
  const kinds = {
    inbox: task ? (zh ? "未分类" : "Uncategorized") : zh ? "待整理" : "Inbox",
    idea: zh ? "想法" : "Idea",
    note: zh ? "笔记" : "Note",
    resource: zh ? "资料" : "Resource",
  };
  const excerpt = workspaceExcerpt(item.title, item.body);
  const displayTitle = workspaceDisplayTitle(item.title);
  const action = (callback: () => void) => {
    if (menu.current) menu.current.open = false;
    callback();
  };
  return (
    <article
      data-workspace-item={item.id}
      className={cn(
        "relative min-w-0 p-4 transition-colors first:rounded-t-[var(--radius-card)] last:rounded-b-[var(--radius-card)]",
        selected ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--hover)]",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <button
          type="button"
          onClick={onOpen}
          tabIndex={-1}
          aria-hidden="true"
          className="mt-1 grid size-14 shrink-0 place-items-center rounded-[var(--radius-small)] bg-[var(--surface)] text-[var(--muted)]"
        >
          {cover ? <Thumbnail file={cover} /> : <Icon className="size-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            aria-label={`${zh ? "整理" : "Edit"} ${displayTitle}`}
            aria-current={selected ? "true" : undefined}
            className="block w-full min-w-0 text-left"
          >
            <h3 className="break-words text-sm font-semibold leading-6">
              {displayTitle}
            </h3>
            {excerpt ? (
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--muted)]">
                {excerpt}
              </p>
            ) : null}
          </button>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
            <span>{kinds[item.kind]}</span>
            {draft ? (
              <span className="text-[var(--accent)]">
                {zh ? "未保存" : "Unsaved"}
              </span>
            ) : null}
            {files.length ? (
              <span className="inline-flex min-w-0 max-w-48 items-center gap-1">
                <Paperclip className="size-3 shrink-0" />
                <span className="truncate">{files[0].name}</span>
                {files.length > 1 ? `+${files.length - 1}` : ""}
              </span>
            ) : null}
            <time dateTime={new Date(item.updatedAt).toISOString()}>
              {new Date(item.updatedAt).toLocaleDateString(
                zh ? "zh-CN" : "en-US",
                { month: "short", day: "numeric" },
              )}
            </time>
          </div>
          <MaterialLinks text={`${item.title}\n${item.body}`} compact />
          {task ? (
            <button
              type="button"
              onClick={() => onTask(task.id)}
              className="mt-1 inline-flex min-h-10 max-w-full flex-wrap items-center gap-2 text-xs text-[var(--accent)]"
            >
              <CheckCheck className="size-4" />
              <span>
                {task.completedAt != null
                  ? zh
                    ? "任务已完成"
                    : "Task completed"
                  : item.intention === "need"
                    ? zh
                      ? "需要做"
                      : "Need to do"
                    : zh
                      ? "想做"
                      : "Want to do"}
              </span>
              <span>
                {task.dueDate
                  ? `DDL ${task.dueDate}`
                  : zh
                    ? "查看任务"
                    : "View task"}
              </span>
            </button>
          ) : null}
        </div>
        <details
          ref={menu}
          className="relative shrink-0"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              if (menu.current) menu.current.open = false;
              menuButton.current?.focus();
            }
          }}
        >
          <summary
            role="button"
            ref={menuButton}
            aria-label={`${zh ? "更多操作" : "More actions"} ${displayTitle}`}
            className="grid size-10 cursor-pointer list-none place-items-center rounded-[var(--radius-control)] text-[var(--muted)] hover:bg-[var(--chip)] [&::-webkit-details-marker]:hidden"
          >
            <MoreHorizontal className="size-5" />
          </summary>
          <div className="absolute right-0 top-full z-20 w-40 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--popup-bg,var(--bg-elevated))] p-1 text-sm shadow-[var(--shadow-floating)]">
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-[var(--hover)]"
              onClick={() => action(onOpen)}
            >
              <FileText className="size-4" />
              {zh ? "打开 / 整理" : "Open / edit"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left hover:bg-[var(--hover)]"
              onClick={() => action(onArchive)}
            >
              <Archive className="size-4" />
              {item.archivedAt != null
                ? zh
                  ? "取消归档"
                  : "Unarchive"
                : zh
                  ? "归档"
                  : "Archive"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[var(--danger)] hover:bg-[var(--danger-soft)]"
              onClick={() => action(() => setConfirm(true))}
            >
              <Trash2 className="size-4" />
              {zh ? "删除" : "Delete"}
            </button>
          </div>
        </details>
      </div>
      {confirm ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-3 text-xs">
          <p>
            {task
              ? zh
                ? "删除记录与附件？关联任务会保留。"
                : "Delete this capture and files? The task will remain."
              : zh
                ? "删除这条记录与附件？"
                : "Delete this capture and files?"}
          </p>
          <button
            type="button"
            disabled={busy}
            className="min-h-10 text-[var(--danger)]"
            onClick={onDelete}
          >
            {zh ? "确认删除" : "Confirm delete"}
          </button>
          <button
            type="button"
            className="min-h-10"
            onClick={() => setConfirm(false)}
          >
            {zh ? "取消" : "Cancel"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
