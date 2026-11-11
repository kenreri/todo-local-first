import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { ui } from "../i18n/messages";
import {
  buildBackup,
  downloadCsv,
  downloadJson,
  prepareBackup,
  readJsonFile,
  tasksToCsv,
} from "../lib/backup";
import { useTodoStore } from "../store/todoStore";
import { db } from "../db";
import { restorePreparedBackup } from "../lib/restoreBackup";
import { RestoreUnavailableError } from "../lib/restoreGuard";

export function BackupPanel() {
  const locale = useTodoStore((s) => s.locale);
  const t = ui(locale);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [exportError, setExportError] = useState(false);

  const exportJson = async () => {
    setBusy(true); setExportError(false);
    try {
      const backup = await buildBackup();
      downloadJson(`todo-backup-${Date.now()}.json`, backup);
    } catch { setExportError(true); }
    finally { setBusy(false); }
  };

  const exportCsv = async () => {
    setBusy(true); setExportError(false);
    try {
      const [tasks, lists] = await db.transaction("r", db.tasks, db.lists, () => Promise.all([db.tasks.toArray(), db.lists.toArray()]));
      downloadCsv(`todo-tasks-${Date.now()}.csv`, tasksToCsv(tasks, lists));
    } catch { setExportError(true); }
    finally { setBusy(false); }
  };

  const onImport = async (file: File | null) => {
    if (!file || busy) return;
    setBusy(true); setStatus("idle"); setImportError("");
    try {
      const payload = await readJsonFile(file);
      const prepared = prepareBackup(payload);
      const explanation = locale === "zh"
        ? "恢复会替换本地数据，放弃未保存的编辑并重新加载。未完成的专注将暂停并在成功后丢弃，不会记入历史。请先关闭其他应用标签页（包括旧版本）。"
        : "Restore replaces local data, discards unsaved edits, and reloads. Unfinished focus is paused and discarded on success without recording it. Close all other app tabs, including older versions.";
      if (!window.confirm(`${t.importConfirm}\n\n${explanation}`)) return;
      await restorePreparedBackup(prepared);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setImportError(error instanceof RestoreUnavailableError
        ? locale === "zh" ? "无法安全恢复：请关闭其他应用标签页并使用支持 Web Locks 的浏览器后重试。" : "Restore is unavailable. Close other app tabs and use a browser supporting Web Locks."
        : locale === "zh" ? "恢复失败，原数据已保留。请检查备份后重试；若计时已暂停，可手动继续。" : "Restore failed; existing data is preserved. Check the backup and retry. Resume the timer manually if it was paused.");
    } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={() => void exportJson()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm"
        title={t.exportJson}
      >
        <Download className="size-3.5" />
        JSON
      </button>
      <button
        type="button"
        onClick={() => void exportCsv()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm"
        title={t.exportCsv}
      >
        <Download className="size-3.5" />
        CSV
      </button>
      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm">
        <Upload className="size-3.5" />
        {t.importJson}
        <input
          disabled={busy}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            void onImport(file);
            e.currentTarget.value = "";
          }}
        />
      </label>
      {status !== "idle" ? (
        <span
          role="status"
          className={
            status === "success"
              ? "text-xs text-[var(--accent)]"
              : "text-xs text-[var(--danger)]"
          }
        >
          {status === "success" ? t.importDone : importError || t.importFailed}
        </span>
      ) : null}
      {busy ? <span role="status" className="text-xs text-[var(--muted)]">{locale === "zh" ? "正在处理备份…" : "Processing backup…"}</span> : null}
      {exportError ? <span role="alert" className="text-xs text-[var(--danger)]">{locale === "zh" ? "导出失败，请检查文件完整性或可用空间后重试。" : "Export failed. Check files and available memory, then retry."}</span> : null}
    </div>
  );
}
