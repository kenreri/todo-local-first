import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
import { db } from "../db";
import { useTodoStore } from "../store/todoStore";
import type { AttachmentRecord } from "../types";
import { WorkspaceAttachments } from "./WorkspaceAttachments";
import { MaterialLinks } from "./MaterialLinks";

export function TaskMaterials({
  taskId,
  note,
}: {
  taskId: string;
  note: string;
}) {
  const zh = useTodoStore((state) => state.locale) === "zh";
  const [materials, setMaterials] = useState<{
    taskId: string;
    files: AttachmentRecord[];
    text: string;
  } | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);
  useEffect(() => {
    const subscription = liveQuery(async () => {
      const items = (
        await db.workspaceItems.where("taskId").equals(taskId).toArray()
      ).filter((item) => item.deletedAt == null);
      const files = (
        await db.attachments
          .where("itemId")
          .anyOf(items.map((item) => item.id))
          .toArray()
      ).filter((file) => file.deletedAt == null);
      return {
        taskId,
        files,
        text: items.map((item) => `${item.title}\n${item.body}`).join("\n"),
      };
    }).subscribe({
      next: (value) => {
        setMaterials(value);
        setFailedId(null);
      },
      error: () => setFailedId(taskId),
    });
    return () => subscription.unsubscribe();
  }, [taskId]);
  const current = materials?.taskId === taskId ? materials : null;
  return (
    <div className="min-w-0">
      <MaterialLinks text={`${note}\n${current?.text ?? ""}`} />
      {failedId === taskId ? (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {zh
            ? "相关资料读取失败，请重新打开任务。"
            : "Could not load related materials. Reopen the task."}
        </p>
      ) : null}
      {current?.files.length ? (
        <details open>
          <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--muted)]">
            {zh ? "相关文件" : "Related files"} · {current.files.length}
          </summary>
          <WorkspaceAttachments files={current.files} />
        </details>
      ) : null}
    </div>
  );
}
