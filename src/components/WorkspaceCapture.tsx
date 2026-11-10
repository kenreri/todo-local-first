import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { Paperclip, Plus, X, SlidersHorizontal, Link2 } from "lucide-react";
import {
  captureWorkspaceItem,
  fileSize,
  validateFiles,
  workspaceError,
} from "../lib/workspace";
import { useTodoStore } from "../store/todoStore";
import type { WorkspaceKind } from "../types";
import {
  EMPTY_CAPTURE,
  useCaptureDraftStore,
} from "../store/captureDraftStore";

export interface WorkspaceCaptureHandle {
  addFiles: (files: File[]) => void;
}

export function WorkspaceCapture({
  onSaved,
  ref,
}: {
  onSaved?: (id: string) => void;
  ref?: Ref<WorkspaceCaptureHandle>;
}) {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const { body, kind, files, dueDate, scheduledDate, busy } =
    useCaptureDraftStore();
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const [options, setOptions] = useState(false);
  const [help, setHelp] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const textInput = useRef<HTMLTextAreaElement>(null);
  const action = kind === "want" || kind === "need";
  const expanded = focused || !!body || !!files.length || options || action;
  const append = (incoming: File[]) => {
    if (useCaptureDraftStore.getState().busy) return;
    try {
      const next = [...useCaptureDraftStore.getState().files, ...incoming];
      validateFiles(next);
      useCaptureDraftStore.setState({ files: next });
      setError("");
      setSaved(false);
      textInput.current?.focus();
    } catch (err) {
      setError(workspaceError(err, zh));
    }
  };
  useImperativeHandle(ref, () => ({ addFiles: append }));
  const save = async () => {
    if (useCaptureDraftStore.getState().busy || (!body.trim() && !files.length))
      return;
    useCaptureDraftStore.setState({ busy: true });
    setError("");
    setSaved(false);
    try {
      const id = await captureWorkspaceItem({
        body,
        files,
        kind: action ? "inbox" : (kind as WorkspaceKind),
        action,
        intention: kind === "need" ? "need" : "want",
        dueDate: action ? dueDate : null,
        scheduledDate: action ? scheduledDate : null,
      });
      useCaptureDraftStore.setState({ ...EMPTY_CAPTURE });
      setSaved(true);
      setOptions(false);
      onSaved?.(id);
    } catch (err) {
      setError(workspaceError(err, zh));
    } finally {
      useCaptureDraftStore.setState({ busy: false });
    }
  };
  return (
    <section
      aria-label={zh ? "随手收集" : "Quick capture"}
      className={`ui-card min-w-0 border p-4 transition-colors ${dragging ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "border-[var(--line)]"}`}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          setFocused(false);
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
        if (event.dataTransfer.files.length) {
          event.preventDefault();
          append(Array.from(event.dataTransfer.files));
        }
        setDragging(false);
      }}
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <label className="block">
          <span className="sr-only">{zh ? "先放在这里" : "Start here"}</span>
          <textarea
            ref={textInput}
            data-shortcut="create"
            value={body}
            disabled={busy}
            rows={expanded ? 3 : 2}
            className="ui-input w-full resize-y border-transparent px-2 py-2 text-sm leading-6"
            placeholder={
              zh
                ? "记点什么，或者拖入图片、PDF、文件……"
                : "Write a thought, or drop images, PDFs and files…"
            }
            onChange={(event) => {
              useCaptureDraftStore.setState({ body: event.target.value });
              setSaved(false);
            }}
            onPaste={(event) => {
              if (event.clipboardData.files.length) {
                event.preventDefault();
                append(Array.from(event.clipboardData.files));
              }
            }}
            onKeyDown={(event) => {
              if (
                (event.ctrlKey || event.metaKey) &&
                event.key === "Enter" &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                void save();
              }
            }}
          />
        </label>
        {files.length ? (
          <ul className="flex flex-wrap gap-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex max-w-full items-center gap-2 rounded-[var(--radius-small)] bg-[var(--chip)] pl-3 text-xs"
              >
                <Paperclip className="size-3 shrink-0" />
                <span className="min-w-0 truncate">
                  {file.name} · {fileSize(file.size)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className="grid size-10 shrink-0 place-items-center"
                  aria-label={`${zh ? "移除" : "Remove"} ${file.name}`}
                  onClick={() =>
                    useCaptureDraftStore.setState({
                      files: files.filter((_, index) => index !== i),
                    })
                  }
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] px-2 text-xs text-[var(--muted)] hover:bg-[var(--hover)]"
            title={
              zh
                ? "图片、PDF 或任意文件，单个 ≤ 50 MB"
                : "Images, PDFs or any file, up to 50 MB each"
            }
          >
            <Paperclip className="size-4" />
            {zh ? "附件" : "Files"}
          </button>
          <button
            type="button"
            aria-expanded={options}
            onClick={() => setOptions(!options)}
            className="inline-flex min-h-10 items-center gap-2 rounded-[var(--radius-control)] px-2 text-xs text-[var(--muted)] hover:bg-[var(--hover)]"
          >
            <SlidersHorizontal className="size-4" />
            {zh ? "整理选项" : "Options"}
          </button>
          <button
            type="button"
            aria-expanded={help}
            aria-label={
              zh ? "连接 Obsidian / Zotero" : "Connect Obsidian / Zotero"
            }
            onClick={() => setHelp(!help)}
            className="grid size-10 place-items-center rounded-[var(--radius-control)] text-[var(--muted)] hover:bg-[var(--hover)]"
          >
            <Link2 className="size-4" />
          </button>
          <span className="ml-auto hidden text-xs text-[var(--muted)] sm:inline">
            Ctrl / ⌘ ↵
          </span>
          <button
            type="submit"
            disabled={busy || (!body.trim() && !files.length)}
            className="ui-button-primary ml-auto inline-flex min-h-10 items-center gap-1 px-4 disabled:opacity-50 sm:ml-2"
          >
            <Plus className="size-4" />
            {busy ? (zh ? "保存中…" : "Saving…") : zh ? "收下" : "Capture"}
          </button>
        </div>
        {expanded || kind !== "inbox" ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
            <select
              aria-label={zh ? "记录类型" : "Capture type"}
              disabled={busy}
              value={kind}
              onChange={(event) =>
                useCaptureDraftStore.setState({
                  kind: event.target.value as typeof kind,
                })
              }
              className="ui-input max-w-full px-3 py-2 text-xs"
            >
              <option value="inbox">
                {zh ? "先收着，稍后整理" : "Inbox — organize later"}
              </option>
              <optgroup label={zh ? "作为任务" : "Create a task"}>
                <option value="want">{zh ? "想做" : "Want to do"}</option>
                <option value="need">{zh ? "需要做" : "Need to do"}</option>
              </optgroup>
              <optgroup label={zh ? "保存内容" : "Save material"}>
                <option value="idea">{zh ? "想法" : "Idea"}</option>
                <option value="note">{zh ? "笔记" : "Note"}</option>
                <option value="resource">{zh ? "资料" : "Resource"}</option>
              </optgroup>
            </select>
            <span className="text-xs text-[var(--muted)]">
              {zh ? "单个文件 ≤ 50 MB" : "Up to 50 MB per file"}
            </span>
          </div>
        ) : null}
        {action ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="min-w-0 text-xs text-[var(--muted)]">
              {zh ? "打算哪天做（可选）" : "Planned day (optional)"}
              <input
                type="date"
                disabled={busy}
                value={scheduledDate}
                onChange={(event) =>
                  useCaptureDraftStore.setState({
                    scheduledDate: event.target.value,
                  })
                }
                className="ui-input mt-1 block w-full min-w-0 px-3 py-2"
              />
            </label>
            <label className="min-w-0 text-xs text-[var(--muted)]">
              {zh ? "DDL · 最晚完成（可选）" : "Deadline (optional)"}
              <input
                type="date"
                disabled={busy}
                value={dueDate}
                onChange={(event) =>
                  useCaptureDraftStore.setState({ dueDate: event.target.value })
                }
                className="ui-input mt-1 block w-full min-w-0 px-3 py-2"
              />
            </label>
          </div>
        ) : null}
        {help ? (
          <div className="space-y-2 rounded-[var(--radius-small)] bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--muted)]">
            <p>
              {zh
                ? "Obsidian：复制当前笔记的 Obsidian URL，粘贴到上方。"
                : "Obsidian: paste the current note’s Obsidian URL above."}
            </p>
            <p>
              {zh
                ? "Zotero：导出设置中启用 Markdown 的「包含 Zotero 链接」，再复制笔记或 PDF 批注到这里。保存后可以打开原应用。"
                : "Zotero: enable Include Zotero Links for Markdown in Export settings, then paste a note or PDF annotation here to link to the original app."}
            </p>
          </div>
        ) : null}
        {dragging ? (
          <p role="status" className="text-xs text-[var(--accent)]">
            {zh ? "松手添加到这条新记录" : "Drop into this new capture"}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p role="status" className="text-xs text-[var(--success)]">
            {zh
              ? "已收下，可以继续记录。"
              : "Saved. Ready for your next thought."}
          </p>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            append(Array.from(event.target.files ?? []));
            event.currentTarget.value = "";
          }}
        />
      </form>
    </section>
  );
}
