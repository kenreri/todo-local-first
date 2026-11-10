import { Download, Upload } from "lucide-react";
import { useState } from "react";
import { ui } from "../i18n/messages";
import {
  buildBackup,
  downloadCsv,
  downloadJson,
  importBackupJson,
  readJsonFile,
  tasksToCsv,
} from "../lib/backup";
import { useTodoStore } from "../store/todoStore";
import { db } from "../db";

export function BackupPanel() {
  const locale = useTodoStore((s) => s.locale);
  const t = ui(locale);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [busy, setBusy] = useState(false);
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
    if (!file) return;
    const confirmed = window.confirm(t.importConfirm);
    if (!confirmed) return;
    setStatus("idle");
    try {
      const payload = await readJsonFile(file);
      await importBackupJson(payload);
      setStatus("success");
    } catch (error) {
      console.error(error);
      setStatus("error");
    }
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
          {status === "success" ? t.importDone : t.importFailed}
        </span>
      ) : null}
      {busy ? <span role="status" className="text-xs text-[var(--muted)]">{locale === "zh" ? "正在打包备份…" : "Preparing backup…"}</span> : null}
      {exportError ? <span role="alert" className="text-xs text-[var(--danger)]">{locale === "zh" ? "导出失败，请检查文件完整性或可用空间后重试。" : "Export failed. Check files and available memory, then retry."}</span> : null}
    </div>
  );
}
