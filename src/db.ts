import Dexie, { type EntityTable } from "dexie";
import { installRestoreGuard } from "./lib/restoreGuard";
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
  AttachmentBlob,
} from "./types";
import { DEFAULT_POMODORO_CONFIG } from "./types";

export class TodoDatabase extends Dexie {
  lists!: EntityTable<ListRecord, "id">;
  tasks!: EntityTable<TaskRecord, "id">;
  settings!: EntityTable<SettingsRecord, "id">;
  pomodoroRecords!: EntityTable<PomodoroRecord, "id">;
  habits!: EntityTable<HabitRecord, "id">;
  habitCheckIns!: EntityTable<HabitCheckInRecord, "id">;
  anime!: EntityTable<AnimeRecord, "id">;
  workspaceItems!: EntityTable<WorkspaceItem, "id">;
  attachments!: EntityTable<AttachmentRecord, "id">;
  attachmentBlobs!: EntityTable<AttachmentBlob, "id">;

  constructor() {
    super("todo-local-first");

    this.version(1).stores({
      lists: "id, sortOrder, updatedAt, deletedAt",
      tasks: "id, listId, parentId, dueDate, completedAt, updatedAt, deletedAt",
      settings: "id",
    });

    this.version(2)
      .stores({
        lists: "id, sortOrder, updatedAt, deletedAt",
        tasks:
          "id, listId, parentId, dueDate, completedAt, updatedAt, deletedAt, sortOrder",
        settings: "id",
      })
      .upgrade(async (tx) => {
        await tx
          .table("tasks")
          .toCollection()
          .modify((task: TaskRecord) => {
            if (typeof task.sortOrder !== "number")
              task.sortOrder = task.createdAt;
            if (task.repeatRule === undefined) task.repeatRule = null;
          });
        await tx
          .table("settings")
          .toCollection()
          .modify((settings: SettingsRecord) => {
            if (!settings.defaultView) settings.defaultView = "list";
          });
      });

    this.version(3)
      .stores({
        lists: "id, sortOrder, updatedAt, deletedAt",
        tasks:
          "id, listId, parentId, dueDate, completedAt, updatedAt, deletedAt, sortOrder",
        settings: "id",
        pomodoroRecords: "id, taskId, startAt, createdAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("settings")
          .toCollection()
          .modify((settings: SettingsRecord) => {
            if (!settings.pomodoroConfig) {
              settings.pomodoroConfig = { ...DEFAULT_POMODORO_CONFIG };
            }
          });
      });

    this.version(4).stores({
      lists: "id, sortOrder, updatedAt, deletedAt",
      tasks:
        "id, listId, parentId, dueDate, completedAt, updatedAt, deletedAt, sortOrder",
      settings: "id",
      pomodoroRecords: "id, taskId, startAt, createdAt",
      habits: "id, type, updatedAt, deletedAt",
      habitCheckIns:
        "id, habitId, date, status, updatedAt, deletedAt, [habitId+date]",
    });

    this.version(5)
      .stores({
        lists: "id, sortOrder, updatedAt, deletedAt",
        tasks:
          "id, listId, parentId, dueDate, completedAt, updatedAt, deletedAt, sortOrder",
        settings: "id",
        pomodoroRecords: "id, taskId, startAt, createdAt",
        habits: "id, updatedAt, deletedAt",
        habitCheckIns:
          "id, habitId, date, status, updatedAt, deletedAt, [habitId+date]",
        anime: "id, status, watchWeekday, updatedAt, deletedAt",
      })
      .upgrade(async (tx) => {
        const stamp = Date.now();
        const habits = (await tx.table("habits").toArray()) as HabitRecord[];
        const legacyAnime = habits.filter(
          (habit) => habit.type === "anime" && habit.deletedAt == null,
        );

        await Promise.all(
          legacyAnime.map(async (habit) => {
            await tx.table("anime").put({
              id: habit.id,
              title: habit.title,
              emoji: habit.emoji || "📺",
              status: "watching",
              currentEpisode: Math.max(0, habit.currentEpisode || 0),
              totalEpisodes: null,
              watchWeekday:
                habit.frequency === "weekly" &&
                Array.isArray(habit.weekdays) &&
                habit.weekdays.length > 0
                  ? habit.weekdays[0]
                  : new Date(habit.createdAt).getDay(),
              reminderTime: habit.reminderTime,
              note: "",
              lastWatchedAt: null,
              createdAt: habit.createdAt,
              updatedAt: stamp,
              deletedAt: null,
            });
            await tx.table("habits").put({
              ...habit,
              deletedAt: stamp,
              updatedAt: stamp,
            });
          }),
        );
      });

    this.version(6)
      .stores({
        lists: "id, sortOrder, updatedAt, deletedAt",
        tasks:
          "id, listId, parentId, dueDate, scheduledDate, completedAt, updatedAt, deletedAt, sortOrder",
        settings: "id",
        pomodoroRecords: "id, taskId, startAt, createdAt",
        habits: "id, updatedAt, deletedAt",
        habitCheckIns:
          "id, habitId, date, status, updatedAt, deletedAt, [habitId+date]",
        anime: "id, status, watchWeekday, updatedAt, deletedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("tasks")
          .toCollection()
          .modify((task: TaskRecord) => {
            if (task.scheduledDate === undefined) task.scheduledDate = null;
          });
      });

    this.version(7)
      .stores({
        lists: "id, sortOrder, updatedAt, deletedAt",
        tasks:
          "id, listId, parentId, dueDate, scheduledDate, completedAt, updatedAt, deletedAt, sortOrder",
        settings: "id",
        pomodoroRecords: "id, taskId, startAt, createdAt",
        habits: "id, updatedAt, deletedAt",
        habitCheckIns:
          "id, habitId, date, status, updatedAt, deletedAt, [habitId+date]",
        anime: "id, status, watchWeekday, updatedAt, deletedAt",
      })
      .upgrade(async (tx) => {
        await tx
          .table("anime")
          .toCollection()
          .modify((item: AnimeRecord) => {
            if (item.airKind === undefined) item.airKind = "ongoing";
            if (item.scheduleMode === undefined) {
              item.scheduleMode =
                item.watchWeekday != null ? "weekly" : "none";
            }
            if (item.bgmSubjectId === undefined) item.bgmSubjectId = null;
            if (item.bgmCoverUrl === undefined) item.bgmCoverUrl = null;
          });
      });

    this.version(8)
      .stores({
        lists: "id, sortOrder, updatedAt, deletedAt",
        tasks: "id, listId, parentId, dueDate, scheduledDate, completedAt, updatedAt, deletedAt, sortOrder",
        settings: "id",
        pomodoroRecords: "id, taskId, startAt, createdAt",
        habits: "id, updatedAt, deletedAt",
        habitCheckIns: "id, habitId, date, status, updatedAt, deletedAt, [habitId+date]",
        anime: "id, status, watchWeekday, updatedAt, deletedAt",
      })
      .upgrade(async tx => {
        await tx.table("tasks").toCollection().modify((task: TaskRecord) => {
          if (task.scheduledTime === undefined) task.scheduledTime = null;
        });
      });
    this.version(9).stores({
      workspaceItems: "id, kind, taskId, archivedAt, updatedAt, deletedAt",
      attachments: "id, itemId, updatedAt, deletedAt",
      attachmentBlobs: "id",
    }).upgrade(async tx => {
      await tx.table("settings").update("app", { defaultView: "workspace" });
    });
  }
}

export const db = new TodoDatabase();
installRestoreGuard(db);

db.on("blocked", () => {
  console.warn("IndexedDB upgrade is blocked by another tab");
});

export function now() {
  return Date.now();
}

export function createId() {
  return crypto.randomUUID();
}
