import { createId, db, now } from "../db";
import { ensureInbox } from "../seed";
import type {
  AttachmentRecord,
  TaskRecord,
  WorkspaceItem,
  WorkspaceKind,
} from "../types";

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_BYTES = 100 * 1024 * 1024;

export interface CaptureInput {
  title?: string;
  body: string;
  kind?: WorkspaceKind;
  files?: File[];
  action?: boolean;
  intention?: "want" | "need";
  dueDate?: string | null;
  scheduledDate?: string | null;
}

export function validateFiles(files: File[]) {
  if (files.some((file) => file.size > MAX_FILE_BYTES))
    throw new Error("file-too-large");
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_BATCH_BYTES)
    throw new Error("batch-too-large");
}

function checkDate(date: string | null | undefined) {
  if (
    date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
  ) {
    throw new Error("invalid-date");
  }
}

async function writeAttachments(itemId: string, files: File[], stamp: number) {
  for (const file of files) {
    const attachment: AttachmentRecord = {
      id: createId(),
      itemId,
      name: file.name || "file",
      mime: file.type,
      size: file.size,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    await db.attachments.add(attachment);
    await db.attachmentBlobs.add({
      id: attachment.id,
      data: file.slice(0, file.size, file.type),
    });
  }
}

async function writeTask(
  item: WorkspaceItem,
  listId: string,
  input: Pick<CaptureInput, "dueDate" | "scheduledDate">,
) {
  const list = await db.lists.get(listId);
  if (!list || list.deletedAt != null) throw new Error("list-missing");
  const stamp = now();
  const siblings = await db.tasks.where("listId").equals(listId).toArray();
  const task: TaskRecord = {
    id: createId(),
    listId,
    title: item.title,
    note: item.body,
    priority: "none",
    scheduledDate: input.scheduledDate || null,
    scheduledTime: null,
    dueDate: input.dueDate || null,
    completedAt: null,
    tags: [],
    parentId: null,
    sortOrder:
      siblings.reduce((max, task) => Math.max(max, task.sortOrder), 0) + 1,
    repeatRule: null,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  await db.tasks.add(task);
  return task.id;
}

export async function captureWorkspaceItem(input: CaptureInput) {
  const files = input.files ?? [];
  validateFiles(files);
  checkDate(input.dueDate);
  checkDate(input.scheduledDate);
  const body = input.body.trim();
  const title =
    input.title?.trim() || body.split("\n")[0].slice(0, 160) || files[0]?.name;
  if (!title) throw new Error("empty-item");
  const listId = input.action ? await ensureInbox() : null;
  const stamp = now();
  const item: WorkspaceItem = {
    id: createId(),
    title,
    body,
    kind: input.kind ?? "inbox",
    taskId: null,
    intention: input.intention ?? "want",
    archivedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    deletedAt: null,
  };
  await db.transaction(
    "rw",
    [db.workspaceItems, db.attachments, db.attachmentBlobs, db.tasks, db.lists],
    async () => {
      if (listId) item.taskId = await writeTask(item, listId, input);
      await db.workspaceItems.add(item);
      await writeAttachments(item.id, files, stamp);
    },
  );
  return item.id;
}

export async function updateWorkspaceItem(
  id: string,
  patch: Partial<
    Pick<WorkspaceItem, "title" | "body" | "kind" | "intention" | "archivedAt">
  >,
) {
  await db.transaction("rw", db.workspaceItems, async () => {
    const item = await db.workspaceItems.get(id);
    if (!item || item.deletedAt != null) throw new Error("item-missing");
    const title = patch.title?.trim() ?? item.title;
    if (!title) throw new Error("empty-item");
    await db.workspaceItems.put({ ...item, ...patch, title, updatedAt: now() });
  });
}

export async function addAttachments(itemId: string, files: File[]) {
  validateFiles(files);
  await db.transaction(
    "rw",
    [db.workspaceItems, db.attachments, db.attachmentBlobs],
    async () => {
      const item = await db.workspaceItems.get(itemId);
      if (!item || item.deletedAt != null) throw new Error("item-missing");
      const stamp = now();
      await writeAttachments(itemId, files, stamp);
      await db.workspaceItems.update(itemId, { updatedAt: stamp });
    },
  );
}

export async function removeAttachment(id: string) {
  await db.transaction("rw", db.attachments, async () => {
    const attachment = await db.attachments.get(id);
    if (!attachment || attachment.deletedAt != null) return;
    const stamp = now();
    await db.attachments.update(id, { deletedAt: stamp, updatedAt: stamp });
  });
}

export async function deleteWorkspaceItem(id: string) {
  await db.transaction("rw", db.workspaceItems, db.attachments, async () => {
    const item = await db.workspaceItems.get(id);
    if (!item || item.deletedAt != null) return;
    const stamp = now();
    await db.workspaceItems.update(id, { deletedAt: stamp, updatedAt: stamp });
    await db.attachments
      .where("itemId")
      .equals(id)
      .modify({ deletedAt: stamp, updatedAt: stamp });
    // A linked task is independent: deleting its material must not delete the action.
  });
}

export async function turnIntoTask(
  id: string,
  intention: "want" | "need",
  dates: Pick<CaptureInput, "dueDate" | "scheduledDate"> = {},
) {
  checkDate(dates.dueDate);
  checkDate(dates.scheduledDate);
  const listId = await ensureInbox();
  return db.transaction(
    "rw",
    db.workspaceItems,
    db.tasks,
    db.lists,
    async () => {
      const item = await db.workspaceItems.get(id);
      if (!item || item.deletedAt != null) throw new Error("item-missing");
      const existing = item.taskId ? await db.tasks.get(item.taskId) : null;
      if (existing && existing.deletedAt == null) return existing.id;
      const taskId = await writeTask(item, listId, dates);
      await db.workspaceItems.update(id, {
        taskId,
        intention,
        updatedAt: now(),
      });
      return taskId;
    },
  );
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function workspaceError(error: unknown, zh: boolean) {
  if (error instanceof Error && error.message === "item-missing")
    return zh
      ? "这条记录已被删除，请关闭后重新选择。"
      : "This capture was deleted. Close it and choose another.";
  if (error instanceof Error && error.message === "invalid-date")
    return zh ? "日期无效，请检查后重试。" : "Please enter a valid date.";
  if (error instanceof Error && error.message === "file-too-large")
    return zh
      ? "单个文件不能超过 50 MB，内容尚未保存。"
      : "Each file must be 50 MB or smaller. Nothing was saved.";
  if (error instanceof Error && error.message === "batch-too-large")
    return zh
      ? "一次最多添加 100 MB 文件，请分批添加。"
      : "Add up to 100 MB at a time.";
  return zh
    ? "保存失败，请检查本地存储空间后重试。输入内容仍保留。"
    : "Could not save. Check local storage and retry. Your input is preserved.";
}
