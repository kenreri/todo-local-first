import { useState } from "react";
import { Download, FileText } from "lucide-react";
import {
  markdownNote,
  noteFileName,
  obsidianNewNoteUri,
} from "../lib/materialLinks";
import { useTodoStore } from "../store/todoStore";

const VAULT_KEY = "workspace-obsidian-vault";

export function ObsidianExport({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const [vault, setVault] = useState(() => {
    try {
      return localStorage.getItem(VAULT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [requested, setRequested] = useState(false);
  const uri = obsidianNewNoteUri(vault, title, body);
  const tooLong = vault.trim() && title.trim() && !uri;
  const download = () => {
    const href = URL.createObjectURL(
      new Blob([markdownNote(title, body)], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const link = document.createElement("a");
    link.href = href;
    link.download = noteFileName(title);
    document.body.append(link);
    link.click();
    link.remove();
    // Leave time for the browser to begin reading the download.
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };
  return (
    <details className="border-t border-[var(--line)] pt-2">
      <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold">
        {zh
          ? "发送到 Obsidian / 导出 Markdown"
          : "Send to Obsidian / export Markdown"}
      </summary>
      <div className="space-y-3 py-2 text-sm">
        <p className="text-xs leading-5 text-[var(--muted)]">
          {zh
            ? "使用当前标题和文字（包含尚未保存的修改）新建一份笔记。附件不会随文字发送，两边的后续修改各自保存。"
            : "Create a note from the current title and text, including unsaved edits. Files are not included; later edits stay in each app."}
        </p>
        <label className="block space-y-1">
          <span>
            {zh ? "Obsidian 笔记库名称或 ID" : "Obsidian vault name or ID"}
          </span>
          <input
            value={vault}
            className="ui-input w-full px-3 py-2"
            placeholder={
              zh
                ? "填写 Obsidian 中显示的笔记库名称"
                : "Enter the vault name shown in Obsidian"
            }
            onChange={(event) => {
              const value = event.target.value;
              setVault(value);
              setRequested(false);
              try {
                localStorage.setItem(VAULT_KEY, value);
              } catch {
                /* Memory-only fallback. */
              }
            }}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {uri ? (
            <a
              href={uri}
              onClick={() => setRequested(true)}
              className="ui-button-secondary inline-flex min-h-10 items-center gap-2 px-3"
            >
              <FileText className="size-4" />
              {zh ? "在 Obsidian 新建笔记" : "Create note in Obsidian"}
            </a>
          ) : (
            <button
              type="button"
              disabled
              className="ui-button-secondary inline-flex min-h-10 items-center gap-2 px-3 opacity-50"
            >
              <FileText className="size-4" />
              {zh ? "在 Obsidian 新建笔记" : "Create note in Obsidian"}
            </button>
          )}
          <button
            type="button"
            disabled={!title.trim()}
            onClick={download}
            className="ui-button-secondary inline-flex min-h-10 items-center gap-2 px-3 disabled:opacity-50"
          >
            <Download className="size-4" />
            {zh ? "下载 Markdown" : "Download Markdown"}
          </button>
        </div>
        <p className="text-xs leading-5 text-[var(--muted)]">
          {tooLong
            ? zh
              ? "文字较长，请下载 Markdown 后放入笔记库，避免应用链接截断内容。"
              : "This note is too long for an app link. Download Markdown and place it in your vault."
            : zh
              ? "需要本机已安装 Obsidian，浏览器可能询问是否打开应用。也可以下载 .md 文件后放入笔记库。"
              : "Obsidian must be installed on this device. Your browser may ask to open it. You can also download the .md file into your vault."}
        </p>
        {requested ? (
          <p role="status" className="text-xs text-[var(--muted)]">
            {zh
              ? "已请求打开 Obsidian，请在应用内确认笔记是否创建。"
              : "Opening Obsidian requested. Check the app to confirm the note was created."}
          </p>
        ) : null}
      </div>
    </details>
  );
}
