import { useState } from "react";
import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { useAttachmentUrl } from "../hooks/useAttachmentUrl";
import { fileSize } from "../lib/workspace";
import { useTodoStore } from "../store/todoStore";
import type { AttachmentRecord } from "../types";

const rasterTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);

function FileRow({
  file,
  onRemove,
}: {
  file: AttachmentRecord;
  onRemove?: (id: string) => void;
}) {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const { url, failed } = useAttachmentUrl(file.id);
  const [confirm, setConfirm] = useState(false);
  const raster = rasterTypes.has(file.mime);
  return (
    <li className="min-w-0 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-3">
      {raster && url ? (
        <a
          href={url}
          download={file.name}
          aria-label={`${zh ? "下载" : "Download"} ${file.name}`}
        >
          <img
            src={url}
            alt={file.name}
            loading="lazy"
            className="mb-3 max-h-52 w-full rounded-[var(--radius-small)] object-contain"
          />
        </a>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <FileText className="size-4 shrink-0 text-[var(--muted)]" />
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm">{file.name}</p>
          <p className="text-xs text-[var(--muted)]">{fileSize(file.size)}</p>
        </div>
        {url ? (
          <a
            href={url}
            download={file.name}
            className="ui-button-secondary grid size-10 shrink-0 place-items-center"
            aria-label={`${zh ? "下载" : "Download"} ${file.name}`}
          >
            <Download className="size-4" />
          </a>
        ) : null}
        {onRemove ? (
          <button
            type="button"
            onClick={() => setConfirm(!confirm)}
            className="grid size-10 shrink-0 place-items-center text-[var(--danger)]"
            aria-label={`${zh ? "移除" : "Remove"} ${file.name}`}
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
      {failed ? (
        <p role="alert" className="mt-2 text-xs text-[var(--danger)]">
          {zh
            ? "文件读取失败，请重新打开重试。"
            : "Could not read the file. Reopen to retry."}
        </p>
      ) : null}
      {confirm ? (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
          <span>{zh ? "移除这个附件？" : "Remove this attachment?"}</span>
          <button
            type="button"
            onClick={() => onRemove?.(file.id)}
            className="min-h-10 text-[var(--danger)]"
          >
            {zh ? "移除" : "Remove"}
          </button>
          <button
            type="button"
            onClick={() => setConfirm(false)}
            className="min-h-10"
          >
            {zh ? "取消" : "Cancel"}
          </button>
        </div>
      ) : null}
    </li>
  );
}

export function WorkspaceAttachments({
  files,
  onRemove,
  compact = false,
}: {
  files: AttachmentRecord[];
  onRemove?: (id: string) => void;
  compact?: boolean;
}) {
  if (!files.length) return null;
  return (
    <ul className={`grid min-w-0 gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
      {files.map((file) => (
        <FileRow key={file.id} file={file} onRemove={onRemove} />
      ))}
    </ul>
  );
}

export function AttachmentCount({ count }: { count: number }) {
  return count ? (
    <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
      <Paperclip className="size-3" />
      {count}
    </span>
  ) : null;
}
