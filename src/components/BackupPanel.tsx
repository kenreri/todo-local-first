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

export function BackupPanel() {
  const locale = useTodoStore((s) => s.locale);
  const t = ui(locale);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const exportJson = async () => {
    const backup = await buildBackup();
    downloadJson(`todo-backup-${Date.now()}.json`, backup);
  };

  const exportCsv = async () => {
    const backup = await buildBackup();
    const csv = tasksToCsv(backup.tasks, backup.lists);
    downloadCsv(`todo-tasks-${Date.now()}.csv`, csv);
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
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm"
        title={t.exportJson}
      >
        <Download className="size-3.5" />
        JSON
      </button>
      <button
        type="button"
        onClick={() => void exportCsv()}
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
    </div>
  );
}
