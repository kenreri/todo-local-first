import { createId, db, now } from "../db";
import { lifeActions, type LifeActions } from "../lib/lifePersistence";
import {
  ensureSeedData,
  ensureInbox,
  updateSettings,
  normalizeWallpaperDim,
  normalizeWallpaperUrl,
  setLocale as persistLocale,
} from "../seed";
import {
  MASCOT_SCALE_DEFAULT,
  normalizeMascotCoord,
  normalizeMascotEnabled,
  normalizeMascotScale,
} from "../lib/mascot";
import { nextOccurrenceAfter } from "../lib/repeat";
import {
  collectTaskTreeIds,
  sortRootTasksForDisplay,
  sortTasksByManualOrder,
} from "../lib/taskTree";
import type {
  AnimeRecord,
  AppView,
  HabitCheckInRecord,
  HabitRecord,
  ListRecord,
  Locale,
  PomodoroRecord,
  Priority,
  RepeatRule,
  TaskFilter,
  TaskRecord,
  ThemeMode,
  SettingsRecord,
} from "../types";
import { create } from "zustand";
import { liveQuery } from "dexie";
import { coerceAppView, coerceLocale, coerceTheme } from "../lib/appView";
import { normalizeAnimeEmoji, normalizeAnimeRecord } from "../lib/anime";
import { applyTheme } from "../lib/theme";
import { reconcileRecords } from "../lib/reconcileRecords";

let bootstrapPromise: Promise<void> | null = null;
let bootstrapGeneration = 0;
let disposeBootstrapRun = () => {};
let hasLoadedOnce = false;

function definedTaskFields<T extends object>(patch: T): Partial<T> {
  const defined = { ...patch };
  for (const key in defined) {
    if (defined[key] === undefined) delete defined[key];
  }
  return defined;
}

async function changeTaskTag(id: string, value: string, operation: "add" | "remove") {
  const tag = operation === "add" ? value.trim() : value;
  if (operation === "add" && !tag) return;
  await db.transaction("rw", db.tasks, async () => {
    const task = await db.tasks.get(id);
    if (!task || task.deletedAt != null) return;
    const tags = operation === "remove"
      ? task.tags.filter(item => item !== tag)
      : task.tags.includes(tag) ? task.tags : [...task.tags, tag];
    await db.tasks.put({ ...task, tags, updatedAt: now() });
  });
}

interface TodoState extends LifeActions {
  ready: boolean;
  startupStatus: "idle" | "loading" | "blocked" | "ready" | "error";
  startupError: string | null;
  locale: Locale;
  lists: ListRecord[];
  tasks: TaskRecord[];
  pomodoroRecords: PomodoroRecord[];
  habits: HabitRecord[];
  habitCheckIns: HabitCheckInRecord[];
  anime: AnimeRecord[];
  selectedListId: string | null;
  selectedTaskId: string | null;
  search: string;
  filter: TaskFilter;
  view: AppView;
  theme: ThemeMode;
  sakuraEnabled: boolean;
  wallpaperEnabled: boolean;
  wallpaperUrl: string;
  wallpaperDim: number;
  sidebarCollapsed: boolean;
  listsGroupCollapsed: boolean;
  mascotEnabled: boolean;
  mascotScale: number;
  mascotLeft: number | null;
  mascotTop: number | null;
  checkedIds: string[];
  bootstrap: () => Promise<void>;
  disposeBootstrap: () => void;
  setLocale: (locale: Locale) => Promise<void>;
  setView: (view: AppView) => Promise<void>;
  setTheme: (theme: ThemeMode) => Promise<void>;
  setSakuraEnabled: (enabled: boolean) => Promise<void>;
  setWallpaperEnabled: (enabled: boolean) => Promise<void>;
  setWallpaperUrl: (url: string) => Promise<void>;
  setWallpaperDim: (dim: number) => Promise<void>;
  setSidebarCollapsed: (collapsed: boolean) => Promise<void>;
  setListsGroupCollapsed: (collapsed: boolean) => Promise<void>;
  setMascotEnabled: (enabled: boolean) => Promise<void>;
  setMascotScale: (scale: number) => Promise<void>;
  setMascotPosition: (left: number, top: number) => Promise<void>;
  selectList: (id: string | null) => void;
  selectTask: (id: string | null) => void;
  setSearch: (value: string) => void;
  setFilter: (filter: TaskFilter) => void;
  toggleChecked: (id: string) => void;
  setCheckedIds: (ids: string[]) => void;
  clearChecked: () => void;
  batchComplete: (ids: string[], completed?: boolean) => Promise<void>;
  batchDelete: (ids: string[]) => Promise<void>;
  batchMove: (ids: string[], listId: string) => Promise<void>;
  batchSchedule: (ids: string[], date: string | null) => Promise<void>;
  captureTask: (title: string) => Promise<void>;
  openInbox: () => Promise<void>;
  createList: (name: string) => Promise<void>;
  renameList: (id: string, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  createTask: (input: {
    title: string;
    parentId?: string | null;
    dueDate?: string | null;
    scheduledDate?: string | null;
    listId?: string;
    selectAfterCreate?: boolean;
  }) => Promise<void>;
  updateTask: (
    id: string,
    patch: Partial<
      Pick<
        TaskRecord,
        | "title"
        | "note"
        | "priority"
        | "dueDate"
        | "scheduledDate"
        | "scheduledTime"
        | "tags"
        | "listId"
        | "sortOrder"
        | "repeatRule"
      >
    >,
  ) => Promise<void>;
  toggleTask: (id: string, occurrenceDate?: string) => Promise<void>;
  addTaskTag: (id: string, tag: string) => Promise<void>;
  removeTaskTag: (id: string, tag: string) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  reorderTasks: (orderedIds: string[]) => Promise<void>;
  moveTaskToList: (
    taskId: string,
    listId: string,
    sortOrder?: number,
  ) => Promise<void>;
  setTaskDueDate: (taskId: string, dueDate: string | null) => Promise<void>;
  setTaskScheduledDate: (
    taskId: string,
    scheduledDate: string | null,
  ) => Promise<void>;

}

interface TodoSnapshot {
  lists: ListRecord[];
  tasks: TaskRecord[];
  pomodoroRecords: PomodoroRecord[];
  habits: HabitRecord[];
  habitCheckIns: HabitCheckInRecord[];
  anime: AnimeRecord[];
  settings: SettingsRecord | undefined;
}

function aliveLists(lists: ListRecord[]) {
  return lists
    .filter((item) => item.deletedAt == null)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt);
}

function aliveTasks(tasks: TaskRecord[]) {
  return tasks
    .filter((item) => item.deletedAt == null)
    .map((task) => ({
      ...task,
      title: task.title ?? "",
      note: task.note ?? "",
      tags: Array.isArray(task.tags) ? task.tags : [],
      scheduledDate: task.scheduledDate ?? null,
      scheduledTime: task.scheduledTime ?? null,
      dueDate: task.dueDate ?? null,
      sortOrder:
        typeof task.sortOrder === "number" ? task.sortOrder : task.createdAt,
      repeatRule: task.repeatRule ?? null,
      parentId: task.parentId ?? null,
    }));
}

function aliveHabits(habits: HabitRecord[]) {
  return habits
    .filter((item) => item.deletedAt == null && item.type !== "anime")
    .map((habit) => ({
      ...habit,
      title: habit.title ?? "",
      emoji: habit.emoji || "✨",
      weekdays: Array.isArray(habit.weekdays) ? habit.weekdays : [],
    }))
    .sort((a, b) => a.createdAt - b.createdAt);
}

function aliveAnime(items: AnimeRecord[]) {
  return items
    .filter((item) => item.deletedAt == null)
    .map((item) => normalizeAnimeRecord({
      ...item,
      emoji: normalizeAnimeEmoji(item.emoji),
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt || a.createdAt - b.createdAt);
}

function aliveHabitCheckIns(checkIns: HabitCheckInRecord[]) {
  return checkIns.filter((item) => item.deletedAt == null);
}

export const useTodoStore = create<TodoState>((set, get) => ({
  ready: false,
  startupStatus: "idle",
  startupError: null,
  locale: "zh",
  lists: [],
  tasks: [],
  pomodoroRecords: [],
  habits: [],
  habitCheckIns: [],
  anime: [],
  selectedListId: null,
  selectedTaskId: null,
  search: "",
  filter: "all",
  view: "list",
  theme: "system",
  sakuraEnabled: true,
  wallpaperEnabled: true,
  wallpaperUrl: "",
  wallpaperDim: 40,
  sidebarCollapsed: false,
  listsGroupCollapsed: false,
  mascotEnabled: false,
  mascotScale: MASCOT_SCALE_DEFAULT,
  mascotLeft: null,
  mascotTop: null,
  checkedIds: [],

  disposeBootstrap: () => {
    bootstrapGeneration += 1;
    disposeBootstrapRun();
    bootstrapPromise = null;
    set({ ready: false, startupStatus: "idle", startupError: null });
  },

  bootstrap: () => {
    if (bootstrapPromise) return bootstrapPromise;
    if (get().startupStatus === "ready") return Promise.resolve();
    const generation = ++bootstrapGeneration;
    set({ ready: false, startupStatus: "loading", startupError: null });

    const applySnapshot = (tables: Partial<TodoSnapshot>) => {
      const current = get();
      const nextLists = tables.lists
        ? reconcileRecords(current.lists, aliveLists(tables.lists))
        : current.lists;
      const nextTasks = tables.tasks
        ? reconcileRecords(current.tasks, aliveTasks(tables.tasks))
        : current.tasks;
      const nextPomodoros = tables.pomodoroRecords
        ? reconcileRecords(
            current.pomodoroRecords,
            [...tables.pomodoroRecords].sort((a, b) => b.endAt - a.endAt),
          )
        : current.pomodoroRecords;
      const nextHabits = tables.habits
        ? reconcileRecords(current.habits, aliveHabits(tables.habits))
        : current.habits;
      const nextHabitCheckIns = tables.habitCheckIns
        ? reconcileRecords(
            current.habitCheckIns,
            aliveHabitCheckIns(tables.habitCheckIns),
          )
        : current.habitCheckIns;
      const nextAnime = tables.anime
        ? reconcileRecords(current.anime, aliveAnime(tables.anime))
        : current.anime;
      const selectedListId =
        current.selectedListId == null ||
        nextLists.some((list) => list.id === current.selectedListId)
          ? current.selectedListId
          : null;
      const selectedTaskId =
        current.selectedTaskId &&
        nextTasks.some((task) => task.id === current.selectedTaskId)
          ? current.selectedTaskId
          : null;
      const locale = coerceLocale(tables.settings?.locale ?? current.locale);
      const view = coerceAppView(
        hasLoadedOnce ? current.view : tables.settings?.defaultView ?? current.view,
        current.view,
      );
      const theme = coerceTheme(tables.settings?.theme ?? current.theme);
      const sakuraEnabled = tables.settings?.sakuraEnabled ?? current.sakuraEnabled;
      const wallpaperEnabled =
        tables.settings?.wallpaperEnabled ?? current.wallpaperEnabled;
      const wallpaperUrl = normalizeWallpaperUrl(
        tables.settings?.wallpaperUrl ?? current.wallpaperUrl,
      );
      const wallpaperDim = normalizeWallpaperDim(
        tables.settings?.wallpaperDim ?? current.wallpaperDim,
      );
      const sidebarCollapsed =
        tables.settings?.sidebarCollapsed ?? current.sidebarCollapsed;
      const listsGroupCollapsed =
        tables.settings?.listsGroupCollapsed ?? current.listsGroupCollapsed;
      const mascotEnabled = normalizeMascotEnabled(
        tables.settings?.mascotEnabled ?? current.mascotEnabled,
      );
      const mascotScale = normalizeMascotScale(
        tables.settings?.mascotScale ?? current.mascotScale,
      );
      const mascotLeft = normalizeMascotCoord(
        tables.settings ? tables.settings.mascotLeft : current.mascotLeft,
      );
      const mascotTop = normalizeMascotCoord(
        tables.settings ? tables.settings.mascotTop : current.mascotTop,
      );

      if (
        current.ready &&
        current.locale === locale &&
        current.view === view &&
        current.theme === theme &&
        current.sakuraEnabled === sakuraEnabled &&
        current.wallpaperEnabled === wallpaperEnabled &&
        current.wallpaperUrl === wallpaperUrl &&
        current.wallpaperDim === wallpaperDim &&
        current.sidebarCollapsed === sidebarCollapsed &&
        current.listsGroupCollapsed === listsGroupCollapsed &&
        current.mascotEnabled === mascotEnabled &&
        current.mascotScale === mascotScale &&
        current.mascotLeft === mascotLeft &&
        current.mascotTop === mascotTop &&
        current.selectedListId === selectedListId &&
        current.selectedTaskId === selectedTaskId &&
        current.lists === nextLists &&
        current.tasks === nextTasks &&
        current.pomodoroRecords === nextPomodoros &&
        current.habits === nextHabits &&
        current.habitCheckIns === nextHabitCheckIns &&
        current.anime === nextAnime
      ) {
        return;
      }

      if (!current.ready || current.theme !== theme) applyTheme(theme);
      if (!current.ready || current.locale !== locale)
        document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
      set({
        locale,
        view,
        theme,
        sakuraEnabled,
        wallpaperEnabled,
        wallpaperUrl,
        wallpaperDim,
        sidebarCollapsed,
        listsGroupCollapsed,
        mascotEnabled,
        mascotScale,
        mascotLeft,
        mascotTop,
        lists: nextLists,
        tasks: nextTasks,
        pomodoroRecords: nextPomodoros,
        habits: nextHabits,
        habitCheckIns: nextHabitCheckIns,
        anime: nextAnime,
        selectedListId,
        selectedTaskId,
      });
    };

    let settle: () => void = () => {};
    const pending = new Promise<void>(resolve => { settle = resolve; });
    bootstrapPromise = pending;
    const subscriptions: { unsubscribe: () => void }[] = [];
    let active = true;
    const isCurrent = () => active && generation === bootstrapGeneration;
    const onBlocked = () => {
      if (isCurrent()) set({ startupStatus: "blocked" });
    };
    db.on("blocked", onBlocked);
    const cleanup = () => {
      active = false;
      subscriptions.forEach(subscription => subscription.unsubscribe());
      db.on("blocked").unsubscribe(onBlocked);
      settle();
    };
    disposeBootstrapRun = cleanup;
    const fail = (error: unknown) => {
      if (!isCurrent()) return;
      cleanup();
      bootstrapPromise = null;
      set({
        ready: false,
        startupStatus: "error",
        startupError: error instanceof Error ? error.message : String(error),
      });
    };
    void (async () => {
      try {
        await ensureSeedData();
        if (!isCurrent()) return;
        await ensureInbox();
        if (!isCurrent()) return;
        const initial: Partial<TodoSnapshot> = {};
        const received = new Set<keyof TodoSnapshot>();
        let initialized = false;
        // A table is read once for initial delivery, then only after its mutations.
        // No normal page is shown until every initial subscription has succeeded.
        const watch = <K extends keyof TodoSnapshot>(
          key: K,
          query: () => Promise<TodoSnapshot[K]>,
        ) => {
          if (!isCurrent()) return;
          const subscription = liveQuery(query).subscribe({
            next: value => {
              if (!isCurrent()) return;
              if (initialized) {
                applySnapshot({ [key]: value });
                return;
              }
              Object.assign(initial, { [key]: value });
              received.add(key);
              if (received.size === 7) {
                applySnapshot(initial);
                initialized = true;
                hasLoadedOnce = true;
                set({ ready: true, startupStatus: "ready", startupError: null });
                bootstrapPromise = null;
                settle();
              }
            },
            error: fail,
          });
          if (isCurrent()) subscriptions.push(subscription);
          else subscription.unsubscribe();
        };
        watch("lists", () => db.lists.toArray());
        watch("tasks", () => db.tasks.toArray());
        watch("pomodoroRecords", () => db.pomodoroRecords.toArray());
        watch("habits", () => db.habits.toArray());
        watch("habitCheckIns", () => db.habitCheckIns.toArray());
        watch("anime", () => db.anime.toArray());
        watch("settings", () => db.settings.get("app"));
      } catch (error) {
        fail(error);
      }
    })();
    return pending;
  },

  setLocale: async (locale) => {
    await persistLocale(locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    set({ locale });
  },

  setView: async (view) => {
    const nextView = coerceAppView(view);
    await updateSettings({ defaultView: nextView });
    set({
      view: nextView,
      checkedIds: [],
      selectedTaskId:
        nextView === "stats" || nextView === "habits" || nextView === "anime"
          ? null
          : get().selectedTaskId,
    });
  },

  setTheme: async (theme) => {
    await updateSettings({ theme });
    applyTheme(theme);
    set({ theme });
  },

  setSakuraEnabled: async (enabled) => {
    await updateSettings({ sakuraEnabled: enabled });
    set({ sakuraEnabled: enabled });
  },

  setWallpaperEnabled: async (enabled) => {
    await updateSettings({ wallpaperEnabled: enabled });
    set({ wallpaperEnabled: enabled });
  },

  setWallpaperUrl: async (url) => {
    const wallpaperUrl = normalizeWallpaperUrl(url);
    await updateSettings({ wallpaperUrl });
    set({ wallpaperUrl });
  },

  setWallpaperDim: async (dim) => {
    const wallpaperDim = normalizeWallpaperDim(dim);
    await updateSettings({ wallpaperDim });
    set({ wallpaperDim });
  },

  setSidebarCollapsed: async (collapsed) => {
    await updateSettings({ sidebarCollapsed: collapsed });
    set({ sidebarCollapsed: collapsed });
  },

  setListsGroupCollapsed: async (collapsed) => {
    await updateSettings({ listsGroupCollapsed: collapsed });
    set({ listsGroupCollapsed: collapsed });
  },

  setMascotEnabled: async (enabled) => {
    await updateSettings({ mascotEnabled: enabled });
    set({ mascotEnabled: enabled });
  },

  setMascotScale: async (scale) => {
    const mascotScale = normalizeMascotScale(scale);
    await updateSettings({ mascotScale });
    set({ mascotScale });
  },

  setMascotPosition: async (left, top) => {
    const mascotLeft = normalizeMascotCoord(left);
    const mascotTop = normalizeMascotCoord(top);
    await updateSettings({ mascotLeft, mascotTop });
    set({ mascotLeft, mascotTop });
  },

  selectList: (id) =>
    set({ selectedListId: id, selectedTaskId: null, checkedIds: [] }),
  selectTask: (id) => {
    if (!id) {
      set({ selectedTaskId: null });
      return;
    }
    const task = get().tasks.find((item) => item.id === id);
    set({
      selectedTaskId: id,
      selectedListId: get().view === "list" ? get().selectedListId : task?.listId ?? get().selectedListId,
    });
  },
  setSearch: (value) => set({ search: value, checkedIds: [] }),
  setFilter: (filter) => set({ filter, checkedIds: [] }),
  toggleChecked: (id) =>
    set((state) => ({
      checkedIds: state.checkedIds.includes(id)
        ? state.checkedIds.filter((item) => item !== id)
        : [...state.checkedIds, id],
    })),
  setCheckedIds: (ids) => set({ checkedIds: ids }),
  clearChecked: () => set({ checkedIds: [] }),

  batchComplete: async (ids, completed = true) => {
    const stamp = now();
    await db.transaction("rw", db.tasks, async () => {
      await Promise.all(
        ids.map(async (id) => {
          const task = await db.tasks.get(id);
          if (!task || task.deletedAt) return;
          if (completed && task.repeatRule && !task.completedAt) {
            const currentDue = task.dueDate ?? toDateFallback(task);
            const nextDue = nextOccurrenceAfter(task, currentDue);
            if (nextDue) {
              await db.tasks.put({
                ...task,
                dueDate: nextDue,
                scheduledDate: null,
                completedAt: null,
                updatedAt: stamp,
              });
              return;
            }
          }
          await db.tasks.put({
            ...task,
            completedAt: completed ? stamp : null,
            updatedAt: stamp,
          });
        }),
      );
    });
    set({ checkedIds: [] });
  },

  batchDelete: async (ids) => {
    const stamp = now();
    await db.transaction("rw", db.tasks, async () => {
      const allTasks = await db.tasks.toArray();
      const treeIds = collectTaskTreeIds(allTasks, ids);
      await Promise.all(
        allTasks
          .filter((task) => treeIds.has(task.id) && task.deletedAt == null)
          .map((task) =>
            db.tasks.put({ ...task, deletedAt: stamp, updatedAt: stamp }),
          ),
      );
    });
    const selected = get().selectedTaskId;
    set({
      checkedIds: [],
      selectedTaskId: selected && ids.includes(selected) ? null : selected,
    });
  },

  batchSchedule: async (ids, date) => {
    const stamp = now();
    await db.transaction("rw", db.tasks, async () => {
      for (const id of ids) {
        const task = await db.tasks.get(id);
        if (!task || task.deletedAt != null) continue;
        await db.tasks.put({ ...task, scheduledDate: date, ...(!date ? { scheduledTime: null } : {}), updatedAt: stamp });
      }
    });
    set({ checkedIds: [] });
  },

  batchMove: async (ids, listId) => {
    await db.transaction("rw", db.tasks, async () => {
      for (const id of ids) await get().moveTaskToList(id, listId);
    });
    set({ checkedIds: [] });
  },

  captureTask: async (title) => {
    if (!title.trim()) return;
    const listId = await ensureInbox();
    await get().createTask({ title, listId });
  },

  openInbox: async () => {
    const listId = await ensureInbox();
    get().selectList(listId);
    set({ search: "", filter: "all" });
    await get().setView("list");
  },

  createList: async (name) => {
    const stamp = now();
    const lists = get().lists;
    const record: ListRecord = {
      id: createId(),
      name:
        name.trim() ||
        (get().locale === "zh"
          ? "\u672a\u547d\u540d\u6e05\u5355"
          : "Untitled list"),
      color: "#0f6e56",
      sortOrder: lists.length,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    await db.lists.put(record);
    set({ selectedListId: record.id, selectedTaskId: null });
  },

  renameList: async (id, name) => {
    await db.transaction("rw", db.lists, async () => {
      const list = await db.lists.get(id);
      if (!list || list.deletedAt != null) return;
      await db.lists.put({ ...list, name: name.trim(), updatedAt: now() });
    });
  },

  deleteList: async (id) => {
    const stamp = now();
    await db.transaction("rw", db.lists, db.tasks, async () => {
      const list = await db.lists.get(id);
      if (list && !list.deletedAt) {
        await db.lists.put({ ...list, deletedAt: stamp, updatedAt: stamp });
      }
      const related = await db.tasks.where("listId").equals(id).toArray();
      await Promise.all(
        related
          .filter((task) => task.deletedAt == null)
          .map((task) =>
            db.tasks.put({ ...task, deletedAt: stamp, updatedAt: stamp }),
          ),
      );
    });
  },

  createTask: async ({
    title,
    parentId = null,
    dueDate = null,
    scheduledDate = null,
    listId: listIdInput,
    selectAfterCreate = false,
  }) => {
    const parent = parentId
      ? (get().tasks.find((task) => task.id === parentId) ??
        (await db.tasks.get(parentId)))
      : null;
    if (parentId && (!parent || parent.deletedAt != null)) return;
    const listId = parent?.listId ?? listIdInput ?? get().selectedListId;
    if (!listId || !title.trim()) return;
    const stamp = now();
    const siblings = get().tasks.filter(
      (task) =>
        task.listId === listId &&
        task.parentId === parentId &&
        task.deletedAt == null,
    );
    const maxSort = siblings.reduce(
      (max, task) => Math.max(max, task.sortOrder),
      0,
    );
    const record: TaskRecord = {
      id: createId(),
      listId,
      title: title.trim(),
      note: "",
      priority: "none",
      scheduledDate,
      dueDate,
      completedAt: null,
      tags: [],
      parentId,
      sortOrder: maxSort + 1,
      repeatRule: null,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    await db.tasks.put(record);
    if (!parentId && selectAfterCreate) set({ selectedTaskId: record.id });
  },

  updateTask: async (id, patch) => {
    // Keep the read, optional tree move and write in one serialized transaction.
    await db.transaction("rw", db.tasks, async () => {
      let task = await db.tasks.get(id);
      if (!task || task.deletedAt != null) return;
      if (patch.listId && patch.listId !== task.listId) {
        await get().moveTaskToList(id, patch.listId);
        task = await db.tasks.get(id);
        if (!task || task.deletedAt != null) return;
      }
      await db.tasks.put({
        ...task,
        ...definedTaskFields(patch),
        title: patch.title?.trim() ?? task.title,
        updatedAt: now(),
      });
    });
  },

  addTaskTag: (id, tag) => changeTaskTag(id, tag, "add"),
  removeTaskTag: (id, tag) => changeTaskTag(id, tag, "remove"),

  toggleTask: async (id, occurrenceDate) => {
    await db.transaction("rw", db.tasks, async () => {
      const task = await db.tasks.get(id);
      if (!task || task.deletedAt != null) return;
      const stamp = now();

      if (task.repeatRule && task.completedAt == null) {
        const currentDue = occurrenceDate ?? task.dueDate ?? toDateFallback(task);
        const nextDue = nextOccurrenceAfter(task, currentDue);
        if (nextDue) {
          await db.tasks.put({
            ...task,
            dueDate: nextDue,
            scheduledDate: null,
            completedAt: null,
            updatedAt: stamp,
          });
          return;
        }
      }

      await db.tasks.put({
        ...task,
        completedAt: task.completedAt != null ? null : stamp,
        updatedAt: stamp,
      });
    });
  },

  deleteTask: async (id) => {
    const stamp = now();
    await db.transaction("rw", db.tasks, async () => {
      const allTasks = await db.tasks.toArray();
      const treeIds = collectTaskTreeIds(allTasks, [id]);
      await Promise.all(
        allTasks
          .filter((task) => treeIds.has(task.id) && task.deletedAt == null)
          .map((task) =>
            db.tasks.put({ ...task, deletedAt: stamp, updatedAt: stamp }),
          ),
      );
    });
    if (get().selectedTaskId === id) set({ selectedTaskId: null });
  },

  reorderTasks: async (orderedIds) => {
    const stamp = now();
    await db.transaction("rw", db.tasks, async () => {
      await Promise.all(
        orderedIds.map(async (id, index) => {
          const task = await db.tasks.get(id);
          if (!task || task.deletedAt) return;
          if (task.sortOrder === index) return;
          await db.tasks.put({ ...task, sortOrder: index, updatedAt: stamp });
        }),
      );
    });
  },

  moveTaskToList: async (taskId, listId, sortOrder) => {
    const stamp = now();
    await db.transaction("rw", db.tasks, async () => {
      const allTasks = await db.tasks.toArray();
      const task = allTasks.find((item) => item.id === taskId);
      if (!task || task.deletedAt) return;

      const treeIds = collectTaskTreeIds(allTasks, [taskId]);
      const targetRoots = sortTasksByManualOrder(
        allTasks.filter(
          (item) =>
            item.parentId == null &&
            item.deletedAt == null &&
            item.listId === listId &&
            item.id !== taskId,
        ),
      );
      const insertAt =
        typeof sortOrder === "number"
          ? Math.max(0, Math.min(sortOrder, targetRoots.length))
          : targetRoots.length;
      targetRoots.splice(insertAt, 0, task);

      const sourceRoots = sortTasksByManualOrder(
        allTasks.filter(
          (item) =>
            item.parentId == null &&
            item.deletedAt == null &&
            item.listId === task.listId &&
            item.id !== taskId,
        ),
      );

      const writes = allTasks
        .filter(
          (item) =>
            treeIds.has(item.id) &&
            item.id !== taskId &&
            item.deletedAt == null,
        )
        .map((item) => db.tasks.put({ ...item, listId, updatedAt: stamp }));
      writes.push(
        ...targetRoots.map((item, index) =>
          db.tasks.put({
            ...item,
            listId: item.id === taskId ? listId : item.listId,
            sortOrder: index,
            updatedAt: stamp,
          }),
        ),
      );
      if (task.listId !== listId) {
        writes.push(
          ...sourceRoots.map((item, index) =>
            db.tasks.put({ ...item, sortOrder: index, updatedAt: stamp }),
          ),
        );
      }
      await Promise.all(writes);
    });
    // Moving data preserves navigation and never opens the task editor.
  },

  setTaskDueDate: async (taskId, dueDate) => {
    await get().updateTask(taskId, { dueDate });
  },

  setTaskScheduledDate: async (taskId, scheduledDate) => {
    await get().updateTask(taskId, {
      scheduledDate,
      ...(!scheduledDate ? { scheduledTime: null } : {}),
    });
  },

  ...lifeActions,

}));

function toDateFallback(task: TaskRecord) {
  return new Date(task.createdAt).toISOString().slice(0, 10);
}

export function selectVisibleRootTasks(state: {
  tasks: TaskRecord[];
  selectedListId: string | null;
  search: string;
  filter: TaskFilter;
}) {
  const { tasks, selectedListId, search, filter } = state;

  const keyword = search.trim().toLowerCase();
  return sortRootTasksForDisplay(
    tasks
      .filter((task) => task.deletedAt == null && task.parentId == null && (selectedListId == null || task.listId === selectedListId))
      .filter((task) => {
        if (filter === "active") return task.completedAt == null;
        if (filter === "completed") return task.completedAt != null;
        return true;
      })
      .filter((task) => {
        if (!keyword) return true;
        const haystack = [task.title, task.note, ...(task.tags ?? [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(keyword);
      }),
  );
}

export function selectSubtasks(
  state: { tasks: TaskRecord[] },
  parentId: string,
) {
  return state.tasks
    .filter((task) => task.parentId === parentId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export type { Priority, RepeatRule, AppView, ThemeMode };
