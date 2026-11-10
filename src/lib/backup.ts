import { db, now } from "../db";
import { validScheduledTime } from "./taskPlanning";
import { normalizeAnimeRecord } from "./anime";
import { normalizePomodoroConfig } from "./pomodoroConfig";
import type {
  AnimeRecord,
  HabitCheckInRecord,
  HabitRecord,
  ListRecord,
  PomodoroRecord,
  SettingsRecord,
  TaskRecord,
  WorkspaceItem,
  AttachmentRecord,
} from "../types";

export interface BackupAttachment extends AttachmentRecord { base64: string }

export interface BackupPayload {
  version: 4;
  exportedAt: number;
  lists: ListRecord[];
  tasks: TaskRecord[];
  pomodoroRecords: PomodoroRecord[];
  habits: HabitRecord[];
  habitCheckIns: HabitCheckInRecord[];
  anime: AnimeRecord[];
  settings: SettingsRecord | null;
  workspaceItems: WorkspaceItem[];
  attachments: BackupAttachment[];
}

export async function buildBackup(): Promise<BackupPayload> {
  const [
    lists,
    tasks,
    pomodoroRecords,
    habits,
    habitCheckIns,
    anime,
    settings,
    workspaceItems,
    attachments,
    blobs,
  ] = await db.transaction("r", db.tables, () => Promise.all([
    db.lists.toArray(),
    db.tasks.toArray(),
    db.pomodoroRecords.toArray(),
    db.habits.toArray(),
    db.habitCheckIns.toArray(),
    db.anime.toArray(),
    db.settings.get("app"),
    db.workspaceItems.toArray(),
    db.attachments.toArray(),
    db.attachmentBlobs.toArray(),
  ]));
  const byId = new Map(blobs.map(blob => [blob.id, blob.data]));
  const encoded: BackupAttachment[] = [];
  for (const attachment of attachments) {
    const data = byId.get(attachment.id);
    if (!data || data.size !== attachment.size) throw new Error("Attachment bytes missing");
    const bytes = new Uint8Array(await data.arrayBuffer());
    const chunks: string[] = [];
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
    }
    encoded.push({ ...attachment, base64: btoa(chunks.join("")) });
  }
  return {
    version: 4,
    exportedAt: now(),
    lists,
    tasks,
    pomodoroRecords,
    habits,
    habitCheckIns,
    anime,
    settings: settings ?? null,
    workspaceItems,
    attachments: encoded,
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  triggerDownload(filename, blob);
}

export function tasksToCsv(tasks: TaskRecord[], lists: ListRecord[]) {
  const listName = new Map(lists.map((list) => [list.id, list.name]));
  const header = [
    "id",
    "title",
    "list",
    "priority",
    "scheduledDate",
    "scheduledTime",
    "dueDate",
    "completed",
    "tags",
    "note",
    "parentId",
  ];
  const rows = tasks
    .filter((task) => task.deletedAt == null)
    .map((task) =>
      [
        task.id,
        task.title,
        listName.get(task.listId) ?? task.listId,
        task.priority,
        task.scheduledDate ?? "",
        task.scheduledTime ?? "",
        task.dueDate ?? "",
        task.completedAt ? "1" : "0",
        task.tags.join("|"),
        task.note.replace(/\r?\n/g, " "),
        task.parentId ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  return [header.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  triggerDownload(filename, blob);
}

export async function importBackupJson(payload: unknown) {
  const validated = validateBackupPayload(payload);
  // Decode before starting the write transaction; invalid bytes never clear data.
  const attachmentBlobs = validated.attachments.map(attachment => ({
    id: attachment.id,
    data: new Blob([Uint8Array.from(atob(attachment.base64), char => char.charCodeAt(0))], { type: attachment.mime }),
  }));
  await db.transaction(
    "rw",
    [
      db.lists,
      db.tasks,
      db.pomodoroRecords,
      db.habits,
      db.habitCheckIns,
      db.anime,
      db.settings,
      db.workspaceItems,
      db.attachments,
      db.attachmentBlobs,
    ],
    async () => {
      await db.lists.clear();
      await db.tasks.clear();
      await db.pomodoroRecords.clear();
      await db.habits.clear();
      await db.habitCheckIns.clear();
      await db.anime.clear();
      await db.workspaceItems.clear();
      await db.attachments.clear();
      await db.attachmentBlobs.clear();
      await db.workspaceItems.bulkPut(validated.workspaceItems);
      await db.attachments.bulkPut(validated.attachments.map(({ base64: _bytes, ...meta }) => meta));
      await db.attachmentBlobs.bulkPut(attachmentBlobs);
      if (validated.lists.length) await db.lists.bulkPut(validated.lists);
      if (validated.tasks.length) await db.tasks.bulkPut(validated.tasks);
      if (validated.pomodoroRecords.length) {
        await db.pomodoroRecords.bulkPut(validated.pomodoroRecords);
      }
      if (validated.habits.length) await db.habits.bulkPut(validated.habits);
      if (validated.habitCheckIns.length) {
        await db.habitCheckIns.bulkPut(validated.habitCheckIns);
      }
      if (validated.anime.length) await db.anime.bulkPut(validated.anime);
      if (validated.settings) {
        await db.settings.put({
          ...validated.settings,
          pomodoroConfig: normalizePomodoroConfig(
            validated.settings.pomodoroConfig,
          ),
          updatedAt: now(),
        });
      }
    },
  );
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file: File): Promise<BackupPayload> {
  const text = await file.text();
  return validateBackupPayload(JSON.parse(text));
}

export function validateBackupPayload(value: unknown): BackupPayload {
  if (
    !isRecord(value) ||
    typeof value.version !== "number" ||
    ![1, 2, 3, 4].includes(value.version) ||
    !isFiniteNumber(value.exportedAt)
  ) {
    throw new Error("Unsupported or invalid backup");
  }
  if (
    !Array.isArray(value.lists) ||
    !value.lists.every(isListRecord) ||
    !Array.isArray(value.tasks) ||
    !value.tasks.every(isTaskRecord) ||
    !Array.isArray(value.pomodoroRecords) ||
    !value.pomodoroRecords.every(isPomodoroRecord) ||
    !(value.settings == null || isSettingsRecord(value.settings))
  ) {
    throw new Error("Invalid backup structure");
  }

  assertUniqueIds(value.lists, "lists");
  assertUniqueIds(value.tasks, "tasks");
  assertUniqueIds(value.pomodoroRecords, "pomodoroRecords");

  const habits = value.version === 1 ? [] : value.habits;
  const habitCheckIns = value.version === 1 ? [] : value.habitCheckIns;
  if (
    !Array.isArray(habits) ||
    !habits.every(isHabitRecord) ||
    !Array.isArray(habitCheckIns) ||
    !habitCheckIns.every(isHabitCheckInRecord)
  ) {
    throw new Error("Invalid habit backup structure");
  }
  assertUniqueIds(habits, "habits");
  assertUniqueIds(habitCheckIns, "habitCheckIns");

  const anime =
    Number(value.version) >= 3
      ? value.anime
      : legacyAnimeFromHabits(habits, value.exportedAt);
  if (!Array.isArray(anime) || !anime.every(isAnimeRecord)) {
    throw new Error("Invalid anime backup structure");
  }
  assertUniqueIds(anime, "anime");

  const listIds = new Set(value.lists.map((list) => list.id));
  const taskIds = new Set(value.tasks.map((task) => task.id));
  const workspaceItems = value.version === 4 ? value.workspaceItems : [];
  const attachments = value.version === 4 ? value.attachments : [];
  if (!Array.isArray(workspaceItems) || !workspaceItems.every(isWorkspaceItem) ||
      !Array.isArray(attachments) || !attachments.every(isBackupAttachment)) {
    throw new Error("Invalid workspace backup structure");
  }
  assertUniqueIds(workspaceItems, "workspaceItems");
  assertUniqueIds(attachments, "attachments");
  const itemIds = new Set(workspaceItems.map(item => item.id));
  if (attachments.some(file => !itemIds.has(file.itemId))) throw new Error("Attachment without its item");
  if (workspaceItems.some(item => item.taskId != null && !taskIds.has(item.taskId))) throw new Error("Workspace item without its task");
  if (value.tasks.some((task) => !listIds.has(task.listId))) {
    throw new Error("Backup contains a task without its list");
  }
  if (
    value.tasks.some(
      (task) => task.parentId != null && !taskIds.has(task.parentId),
    )
  ) {
    throw new Error("Backup contains a subtask without its parent");
  }

  const habitIds = new Set(habits.map((habit) => habit.id));
  if (habitCheckIns.some((item) => !habitIds.has(item.habitId))) {
    throw new Error("Backup contains a check-in without its habit");
  }

  const normalizedHabits = habits.map((habit) =>
    habit.type === "anime" && habit.deletedAt == null
      ? {
          ...habit,
          updatedAt: value.exportedAt,
          deletedAt: value.exportedAt,
        }
      : habit,
  );

  return {
    version: 4,
    exportedAt: value.exportedAt,
    lists: value.lists,
    tasks: value.tasks.map((task) => ({
      ...task,
      scheduledDate: task.scheduledDate ?? null,
      scheduledTime: task.scheduledTime ?? null,
      dueDate: task.dueDate ?? null,
    })),
    pomodoroRecords: value.pomodoroRecords,
    habits: normalizedHabits,
    habitCheckIns,
    anime: anime.map(normalizeAnimeRecord),
    workspaceItems,
    attachments,
    settings: value.settings
      ? {
          ...value.settings,
          pomodoroConfig: normalizePomodoroConfig(
            value.settings.pomodoroConfig,
          ),
        }
      : null,
  } as BackupPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWorkspaceItem(value: unknown): value is WorkspaceItem {
  return isRecord(value) && typeof value.id === "string" && value.id.length > 0 &&
    typeof value.title === "string" && value.title.trim().length > 0 && typeof value.body === "string" &&
    ["inbox", "idea", "note", "resource"].includes(String(value.kind)) &&
    ["want", "need"].includes(String(value.intention)) && isNullableString(value.taskId) &&
    isNullableNumber(value.archivedAt) && hasSyncTimestamps(value);
}

function isBackupAttachment(value: unknown): value is BackupAttachment {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id || typeof value.itemId !== "string" ||
      typeof value.name !== "string" || typeof value.mime !== "string" ||
      !Number.isSafeInteger(value.size) || Number(value.size) < 0 || !hasSyncTimestamps(value) ||
      typeof value.base64 !== "string") return false;
  const encoded = value.base64;
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  if (encoded.length % 4 !== 0 || /[^A-Za-z0-9+/]/.test(encoded.slice(0, encoded.length - padding))) return false;
  return encoded.length / 4 * 3 - padding === value.size;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown) {
  return value == null || isFiniteNumber(value);
}

function isNullableString(value: unknown) {
  return value == null || typeof value === "string";
}

function hasSyncTimestamps(value: Record<string, unknown>) {
  return (
    isFiniteNumber(value.createdAt) &&
    isFiniteNumber(value.updatedAt) &&
    isNullableNumber(value.deletedAt)
  );
}

function isListRecord(value: unknown): value is ListRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.color === "string" &&
    isFiniteNumber(value.sortOrder) &&
    hasSyncTimestamps(value)
  );
}

function isRepeatRule(value: unknown) {
  if (value == null) return true;
  if (!isRecord(value)) return false;
  if (
    !["daily", "weekly", "monthly", "custom"].includes(String(value.frequency))
  )
    return false;
  if (!isFiniteNumber(value.interval) || value.interval < 1) return false;
  if (
    value.weekdays !== undefined &&
    (!Array.isArray(value.weekdays) ||
      !value.weekdays.every(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6,
      ))
  ) {
    return false;
  }
  return (
    (value.monthDay === undefined ||
      (Number.isInteger(value.monthDay) &&
        Number(value.monthDay) >= 1 &&
        Number(value.monthDay) <= 31)) &&
    (value.endDate === undefined || isNullableString(value.endDate))
  );
}

function isTaskRecord(value: unknown): value is TaskRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.listId === "string" &&
    typeof value.title === "string" &&
    typeof value.note === "string" &&
    ["none", "low", "medium", "high"].includes(String(value.priority)) &&
    (value.scheduledDate === undefined || isNullableString(value.scheduledDate)) &&
    validScheduledTime(value.scheduledTime) &&
    isNullableString(value.dueDate) &&
    isNullableNumber(value.completedAt) &&
    Array.isArray(value.tags) &&
    value.tags.every((tag) => typeof tag === "string") &&
    isNullableString(value.parentId) &&
    isFiniteNumber(value.sortOrder) &&
    isRepeatRule(value.repeatRule) &&
    hasSyncTimestamps(value)
  );
}

function isPomodoroRecord(value: unknown): value is PomodoroRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    isNullableString(value.taskId) &&
    isFiniteNumber(value.startAt) &&
    isFiniteNumber(value.endAt) &&
    isFiniteNumber(value.duration) &&
    isFiniteNumber(value.createdAt)
  );
}

function isHabitRecord(value: unknown): value is HabitRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.emoji === "string" &&
    ["general", "anime"].includes(String(value.type)) &&
    ["daily", "weekly"].includes(String(value.frequency)) &&
    Array.isArray(value.weekdays) &&
    value.weekdays.every(
      (day) => Number.isInteger(day) && Number(day) >= 0 && Number(day) <= 6,
    ) &&
    isNullableString(value.reminderTime) &&
    isFiniteNumber(value.currentEpisode) &&
    typeof value.incrementEpisode === "boolean" &&
    hasSyncTimestamps(value)
  );
}

function isHabitCheckInRecord(value: unknown): value is HabitCheckInRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.habitId === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.date)) &&
    ["completed", "skipped"].includes(String(value.status)) &&
    isNullableNumber(value.episode) &&
    hasSyncTimestamps(value)
  );
}

function isAnimeRecord(value: unknown): value is AnimeRecord {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.emoji === "string" &&
    ["planned", "watching", "completed", "paused"].includes(
      String(value.status),
    ) &&
    isFiniteNumber(value.currentEpisode) &&
    isNullableNumber(value.totalEpisodes) &&
    (value.watchWeekday == null ||
      (Number.isInteger(value.watchWeekday) &&
        Number(value.watchWeekday) >= 0 &&
        Number(value.watchWeekday) <= 6)) &&
    isNullableString(value.reminderTime) &&
    typeof value.note === "string" &&
    isNullableNumber(value.lastWatchedAt) &&
    hasSyncTimestamps(value) &&
    // 新字段：旧备份可能缺失，仅在出现时校验
    (value.airKind === undefined ||
      value.airKind === "ongoing" ||
      value.airKind === "finished") &&
    (value.scheduleMode === undefined ||
      value.scheduleMode === "none" ||
      value.scheduleMode === "weekly" ||
      value.scheduleMode === "daily") &&
    isNullableNumber(value.bgmSubjectId) &&
    isNullableString(value.bgmCoverUrl)
  );
}

function legacyAnimeFromHabits(
  habits: HabitRecord[],
  migratedAt: number,
): AnimeRecord[] {
  return habits
    .filter((habit) => habit.type === "anime" && habit.deletedAt == null)
    .map((habit) => ({
      id: habit.id,
      title: habit.title,
      emoji: habit.emoji || "📺",
      status: "watching",
      airKind: "ongoing",
      scheduleMode:
        habit.frequency === "weekly" && habit.weekdays.length > 0
          ? "weekly"
          : "none",
      currentEpisode: Math.max(0, habit.currentEpisode),
      totalEpisodes: null,
      watchWeekday:
        habit.frequency === "weekly" && habit.weekdays.length > 0
          ? habit.weekdays[0]
          : new Date(habit.createdAt).getDay(),
      reminderTime: habit.reminderTime,
      note: "",
      lastWatchedAt: null,
      bgmSubjectId: null,
      bgmCoverUrl: null,
      createdAt: habit.createdAt,
      updatedAt: migratedAt,
      deletedAt: null,
    }));
}

function isSettingsRecord(value: unknown): value is SettingsRecord {
  if (!isRecord(value) || !isRecord(value.pomodoroConfig)) return false;
  return (
    value.id === "app" &&
    ["light", "dark", "system"].includes(String(value.theme)) &&
    [
      "workspace",
      "list",
      "lists",
      "board",
      "calendar",
      "today",
      "habits",
      "anime",
      "pomodoro",
      "stats",
    ].includes(String(value.defaultView)) &&
    ["zh", "en"].includes(String(value.locale)) &&
    (value.sakuraEnabled === undefined ||
      typeof value.sakuraEnabled === "boolean") &&
    (value.wallpaperEnabled === undefined ||
      typeof value.wallpaperEnabled === "boolean") &&
    (value.wallpaperUrl === undefined ||
      typeof value.wallpaperUrl === "string") &&
    (value.wallpaperDim === undefined ||
      (isFiniteNumber(value.wallpaperDim) &&
        value.wallpaperDim >= 0 &&
        value.wallpaperDim <= 100)) &&
    (value.mascotEnabled === undefined ||
      typeof value.mascotEnabled === "boolean") &&
    (value.mascotScale === undefined ||
      (isFiniteNumber(value.mascotScale) &&
        value.mascotScale >= 0.6 &&
        value.mascotScale <= 2.5)) &&
    (value.mascotLeft === undefined ||
      value.mascotLeft === null ||
      isFiniteNumber(value.mascotLeft)) &&
    (value.mascotTop === undefined ||
      value.mascotTop === null ||
      isFiniteNumber(value.mascotTop)) &&
    (value.inboxListId === undefined || isNullableString(value.inboxListId)) &&
    isNullableNumber(value.seededAt) &&
    isFiniteNumber(value.updatedAt) &&
    isFiniteNumber(value.pomodoroConfig.workMinutes) &&
    isFiniteNumber(value.pomodoroConfig.shortBreakMinutes) &&
    isFiniteNumber(value.pomodoroConfig.longBreakMinutes) &&
    isFiniteNumber(value.pomodoroConfig.cyclesBeforeLongBreak) &&
    (value.pomodoroConfig.autoStartBreaks === undefined ||
      typeof value.pomodoroConfig.autoStartBreaks === "boolean") &&
    (value.pomodoroConfig.autoStartFocus === undefined ||
      typeof value.pomodoroConfig.autoStartFocus === "boolean") &&
    (value.pomodoroConfig.soundEnabled === undefined ||
      typeof value.pomodoroConfig.soundEnabled === "boolean") &&
    (value.pomodoroConfig.soundVolume === undefined ||
      isFiniteNumber(value.pomodoroConfig.soundVolume)) &&
    (value.pomodoroConfig.dailyGoalMinutes === undefined ||
      isFiniteNumber(value.pomodoroConfig.dailyGoalMinutes))
  );
}

function assertUniqueIds(items: Array<{ id: string }>, table: string) {
  if (new Set(items.map((item) => item.id)).size !== items.length) {
    throw new Error(`Backup contains duplicate IDs in ${table}`);
  }
}
