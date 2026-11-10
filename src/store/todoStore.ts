import { createId, db, now } from "../db";
import {
  ensureSeedData,
  ensureInbox,
  getSettings,
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
  AnimeAirKind,
  AnimeRecord,
  AnimeScheduleMode,
  AnimeStatus,
  AppView,
  HabitCheckInRecord,
  HabitCheckInStatus,
  HabitFrequency,
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

let bootstrapped = false;
const BOOTSTRAP_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

interface TodoState {
  ready: boolean;
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
  createHabit: (input: {
    title: string;
    emoji: string;
    frequency: HabitFrequency;
    weekdays: number[];
    reminderTime: string | null;
  }) => Promise<void>;
  updateHabit: (
    id: string,
    patch: Partial<
      Pick<
        HabitRecord,
        "title" | "emoji" | "frequency" | "weekdays" | "reminderTime"
      >
    >,
  ) => Promise<void>;
  deleteHabit: (id: string) => Promise<void>;
  setHabitCheckIn: (
    habitId: string,
    date: string,
    status: HabitCheckInStatus | null,
  ) => Promise<void>;
  createAnime: (input: {
    title: string;
    emoji: string;
    status: AnimeStatus;
    airKind: AnimeAirKind;
    scheduleMode: AnimeScheduleMode;
    currentEpisode: number;
    totalEpisodes: number | null;
    watchWeekday: number | null;
    reminderTime: string | null;
    note: string;
    bgmSubjectId?: number | null;
    bgmCoverUrl?: string | null;
  }) => Promise<void>;
  updateAnime: (
    id: string,
    patch: Partial<
      Pick<
        AnimeRecord,
        | "title"
        | "emoji"
        | "status"
        | "airKind"
        | "scheduleMode"
        | "currentEpisode"
        | "totalEpisodes"
        | "watchWeekday"
        | "reminderTime"
        | "note"
        | "bgmSubjectId"
        | "bgmCoverUrl"
      >
    >,
  ) => Promise<void>;
  incrementAnimeEpisode: (id: string) => Promise<void>;
  deleteAnime: (id: string) => Promise<void>;
  /** 绑定 Bangumi 条目：写入 id/封面，标题或总集数为空时自动回填。 */
  linkAnimeBgm: (
    id: string,
    info: {
      subjectId: number;
      title: string;
      coverUrl: string | null;
      totalEpisodes: number | null;
    },
  ) => Promise<void>;
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

  bootstrap: async () => {
    if (bootstrapped) return;
    bootstrapped = true;

    const applySnapshot = async (tables: {
      lists: ListRecord[];
      tasks: TaskRecord[];
      pomodoroRecords: PomodoroRecord[];
      habits: HabitRecord[];
      habitCheckIns: HabitCheckInRecord[];
      anime: AnimeRecord[];
      settings: SettingsRecord | undefined;
    }) => {
      const nextLists = aliveLists(tables.lists);
      const nextTasks = aliveTasks(tables.tasks);
      const nextPomodoros = [...tables.pomodoroRecords].sort(
        (a, b) => b.endAt - a.endAt,
      );
      const nextHabits = aliveHabits(tables.habits);
      const nextHabitCheckIns = aliveHabitCheckIns(tables.habitCheckIns);
      const nextAnime = aliveAnime(tables.anime);
      const current = get();
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
        current.ready ? current.view : tables.settings?.defaultView ?? current.view,
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
        tables.settings?.mascotLeft ?? current.mascotLeft,
      );
      const mascotTop = normalizeMascotCoord(
        tables.settings?.mascotTop ?? current.mascotTop,
      );

      const listsSame =
        current.lists.length === nextLists.length &&
        current.lists.every(
          (list, index) =>
            list.id === nextLists[index]?.id &&
            list.updatedAt === nextLists[index]?.updatedAt,
        );
      const tasksSame =
        current.tasks.length === nextTasks.length &&
        current.tasks.every(
          (task, index) =>
            task.id === nextTasks[index]?.id &&
            task.updatedAt === nextTasks[index]?.updatedAt &&
            task.sortOrder === nextTasks[index]?.sortOrder &&
            task.listId === nextTasks[index]?.listId &&
            task.dueDate === nextTasks[index]?.dueDate &&
            task.scheduledDate === nextTasks[index]?.scheduledDate,
        );
      const pomosSame =
        current.pomodoroRecords.length === nextPomodoros.length &&
        current.pomodoroRecords.every(
          (item, index) => item.id === nextPomodoros[index]?.id,
        );
      const habitsSame =
        current.habits.length === nextHabits.length &&
        current.habits.every(
          (item, index) =>
            item.id === nextHabits[index]?.id &&
            item.updatedAt === nextHabits[index]?.updatedAt,
        );
      const habitCheckInsSame =
        current.habitCheckIns.length === nextHabitCheckIns.length &&
        current.habitCheckIns.every(
          (item, index) =>
            item.id === nextHabitCheckIns[index]?.id &&
            item.updatedAt === nextHabitCheckIns[index]?.updatedAt,
        );
      const animeSame =
        current.anime.length === nextAnime.length &&
        current.anime.every(
          (item, index) =>
            item.id === nextAnime[index]?.id &&
            item.updatedAt === nextAnime[index]?.updatedAt,
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
        listsSame &&
        tasksSame &&
        pomosSame &&
        habitsSame &&
        habitCheckInsSame &&
        animeSame
      ) {
        return;
      }

      applyTheme(theme);
      document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
      set({
        ready: true,
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

    try {
      await withTimeout(ensureSeedData(), BOOTSTRAP_TIMEOUT_MS, "open-db");
      await ensureInbox();
      const settings = await withTimeout(
        getSettings(),
        BOOTSTRAP_TIMEOUT_MS,
        "load-settings",
      );
      document.documentElement.lang = settings.locale === "zh" ? "zh-CN" : "en";
      applyTheme(settings.theme ?? "system");

      const loadTables = async () => ({
        lists: await db.lists.toArray(),
        tasks: await db.tasks.toArray(),
        pomodoroRecords: await db.pomodoroRecords.toArray(),
        habits: await db.habits.toArray(),
        habitCheckIns: await db.habitCheckIns.toArray(),
        anime: await db.anime.toArray(),
        settings: await db.settings.get("app"),
      });

      await withTimeout(applySnapshot(await loadTables()), BOOTSTRAP_TIMEOUT_MS, "load-tables");

      liveQuery(loadTables).subscribe({
        next: (tables) => {
          void applySnapshot(tables);
        },
        error: (error) => {
          console.error(error);
          if (!get().ready) set({ ready: true });
        },
      });
    } catch (error) {
      console.error(error);
      set({ ready: true });
    }
  },

  setLocale: async (locale) => {
    await persistLocale(locale);
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
    set({ locale });
  },

  setView: async (view) => {
    const settings = await getSettings();
    const nextView = coerceAppView(view, settings.defaultView);
    await db.settings.put({
      ...settings,
      defaultView: nextView,
      updatedAt: now(),
    });
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
    const settings = await getSettings();
    await db.settings.put({ ...settings, theme, updatedAt: now() });
    applyTheme(theme);
    set({ theme });
  },

  setSakuraEnabled: async (enabled) => {
    const settings = await getSettings();
    await db.settings.put({
      ...settings,
      sakuraEnabled: enabled,
      updatedAt: now(),
    });
    set({ sakuraEnabled: enabled });
  },

  setWallpaperEnabled: async (enabled) => {
    const settings = await getSettings();
    await db.settings.put({
      ...settings,
      wallpaperEnabled: enabled,
      updatedAt: now(),
    });
    set({ wallpaperEnabled: enabled });
  },

  setWallpaperUrl: async (url) => {
    const settings = await getSettings();
    const wallpaperUrl = normalizeWallpaperUrl(url);
    await db.settings.put({
      ...settings,
      wallpaperUrl,
      updatedAt: now(),
    });
    set({ wallpaperUrl });
  },

  setWallpaperDim: async (dim) => {
    const settings = await getSettings();
    const wallpaperDim = normalizeWallpaperDim(dim);
    await db.settings.put({
      ...settings,
      wallpaperDim,
      updatedAt: now(),
    });
    set({ wallpaperDim });
  },

  setSidebarCollapsed: async (collapsed) => {
    const settings = await getSettings();
    await db.settings.put({
      ...settings,
      sidebarCollapsed: collapsed,
      updatedAt: now(),
    });
    set({ sidebarCollapsed: collapsed });
  },

  setListsGroupCollapsed: async (collapsed) => {
    const settings = await getSettings();
    await db.settings.put({
      ...settings,
      listsGroupCollapsed: collapsed,
      updatedAt: now(),
    });
    set({ listsGroupCollapsed: collapsed });
  },

  setMascotEnabled: async (enabled) => {
    const settings = await getSettings();
    await db.settings.put({
      ...settings,
      mascotEnabled: enabled,
      updatedAt: now(),
    });
    set({ mascotEnabled: enabled });
  },

  setMascotScale: async (scale) => {
    const settings = await getSettings();
    const mascotScale = normalizeMascotScale(scale);
    await db.settings.put({
      ...settings,
      mascotScale,
      updatedAt: now(),
    });
    set({ mascotScale });
  },

  setMascotPosition: async (left, top) => {
    const settings = await getSettings();
    const mascotLeft = normalizeMascotCoord(left);
    const mascotTop = normalizeMascotCoord(top);
    await db.settings.put({
      ...settings,
      mascotLeft,
      mascotTop,
      updatedAt: now(),
    });
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
    for (const id of ids) await get().moveTaskToList(id, listId);
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
    const list = await db.lists.get(id);
    if (!list || list.deletedAt) return;
    await db.lists.put({ ...list, name: name.trim(), updatedAt: now() });
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
    const task = await db.tasks.get(id);
    if (!task || task.deletedAt) return;
    if (patch.listId && patch.listId !== task.listId) {
      await get().moveTaskToList(id, patch.listId);
      const nextTask = await db.tasks.get(id);
      if (!nextTask) return;
      await db.tasks.put({
        ...nextTask,
        ...patch,
        title: patch.title?.trim() ?? nextTask.title,
        updatedAt: now(),
      });
      return;
    }
    await db.tasks.put({
      ...task,
      ...patch,
      title: patch.title?.trim() ?? task.title,
      updatedAt: now(),
    });
  },

  toggleTask: async (id, occurrenceDate) => {
    const task = await db.tasks.get(id);
    if (!task || task.deletedAt) return;
    const stamp = now();

    if (task.repeatRule && !task.completedAt) {
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
      completedAt: task.completedAt ? null : stamp,
      updatedAt: stamp,
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
    const task = await db.tasks.get(taskId);
    if (!task || task.deletedAt) return;
    await db.tasks.put({ ...task, dueDate, updatedAt: now() });
  },

  setTaskScheduledDate: async (taskId, scheduledDate) => {
    const task = await db.tasks.get(taskId);
    if (!task || task.deletedAt) return;
    await db.tasks.put({ ...task, scheduledDate, ...(!scheduledDate ? { scheduledTime: null } : {}), updatedAt: now() });
  },

  createHabit: async (input) => {
    if (!input.title.trim()) return;
    const stamp = now();
    await db.habits.put({
      id: createId(),
      title: input.title.trim(),
      emoji: input.emoji.trim() || "✨",
      type: "general",
      frequency: input.frequency,
      weekdays:
        input.frequency === "weekly"
          ? [...new Set(input.weekdays)].sort((a, b) => a - b)
          : [],
      reminderTime: input.reminderTime || null,
      currentEpisode: 0,
      incrementEpisode: false,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
  },

  updateHabit: async (id, patch) => {
    const habit = await db.habits.get(id);
    if (!habit || habit.deletedAt != null) return;
    const nextFrequency = patch.frequency ?? habit.frequency;
    await db.habits.put({
      ...habit,
      ...patch,
      title: patch.title?.trim() || habit.title,
      emoji: patch.emoji?.trim() || habit.emoji,
      weekdays:
        nextFrequency === "weekly"
          ? [...new Set(patch.weekdays ?? habit.weekdays)].sort((a, b) => a - b)
          : [],
      type: "general",
      currentEpisode: 0,
      incrementEpisode: false,
      updatedAt: now(),
    });
  },

  deleteHabit: async (id) => {
    const stamp = now();
    await db.transaction("rw", db.habits, db.habitCheckIns, async () => {
      const habit = await db.habits.get(id);
      if (!habit || habit.deletedAt != null) return;
      await db.habits.put({ ...habit, deletedAt: stamp, updatedAt: stamp });
      const related = await db.habitCheckIns
        .where("habitId")
        .equals(id)
        .toArray();
      await Promise.all(
        related
          .filter((item) => item.deletedAt == null)
          .map((item) =>
            db.habitCheckIns.put({
              ...item,
              deletedAt: stamp,
              updatedAt: stamp,
            }),
          ),
      );
    });
  },

  setHabitCheckIn: async (habitId, date, status) => {
    const stamp = now();
    await db.transaction("rw", db.habits, db.habitCheckIns, async () => {
      const habit = await db.habits.get(habitId);
      if (!habit || habit.deletedAt != null) return;
      const records = await db.habitCheckIns
        .where("[habitId+date]")
        .equals([habitId, date])
        .toArray();
      const existing = records.find((item) => item.deletedAt == null);
      if (status == null) {
        if (existing) {
          await db.habitCheckIns.put({
            ...existing,
            deletedAt: stamp,
            updatedAt: stamp,
          });
        }
      } else if (existing) {
        await db.habitCheckIns.put({
          ...existing,
          status,
          episode: null,
          updatedAt: stamp,
        });
      } else {
        await db.habitCheckIns.put({
          id: createId(),
          habitId,
          date,
          status,
          episode: null,
          createdAt: stamp,
          updatedAt: stamp,
          deletedAt: null,
        });
      }
    });
  },

  createAnime: async (input) => {
    if (!input.title.trim()) return;
    const stamp = now();
    const totalEpisodes =
      input.totalEpisodes == null
        ? null
        : Math.max(1, Math.floor(input.totalEpisodes));
    const currentEpisode = Math.max(0, Math.floor(input.currentEpisode));
    const airKind = input.airKind === "finished" ? "finished" : "ongoing";
    const scheduleMode: AnimeScheduleMode =
      input.scheduleMode === "weekly" || input.scheduleMode === "daily"
        ? input.scheduleMode
        : input.watchWeekday != null
          ? "weekly"
          : "none";
    const watchWeekday = scheduleMode === "weekly" ? input.watchWeekday : null;
    await db.anime.put({
      id: createId(),
      title: input.title.trim(),
      emoji: normalizeAnimeEmoji(input.emoji),
      status: input.status,
      airKind,
      scheduleMode,
      currentEpisode:
        totalEpisodes == null
          ? currentEpisode
          : Math.min(currentEpisode, totalEpisodes),
      totalEpisodes,
      watchWeekday,
      reminderTime: scheduleMode === "none" ? null : input.reminderTime || null,
      note: input.note.trim(),
      lastWatchedAt: null,
      bgmSubjectId: input.bgmSubjectId ?? null,
      bgmCoverUrl: input.bgmCoverUrl ?? null,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    });
  },

  updateAnime: async (id, patch) => {
    const anime = await db.anime.get(id);
    if (!anime || anime.deletedAt != null) return;
    const totalEpisodes =
      patch.totalEpisodes === undefined
        ? anime.totalEpisodes
        : patch.totalEpisodes == null
          ? null
          : Math.max(1, Math.floor(patch.totalEpisodes));
    const requestedEpisode = Math.max(
      0,
      Math.floor(patch.currentEpisode ?? anime.currentEpisode),
    );
    const currentEpisode =
      totalEpisodes == null
        ? requestedEpisode
        : Math.min(requestedEpisode, totalEpisodes);
    const airKind =
      patch.airKind === "finished"
        ? "finished"
        : patch.airKind === "ongoing"
          ? "ongoing"
          : anime.airKind;
    const scheduleMode: AnimeScheduleMode =
      patch.scheduleMode === "weekly" ||
      patch.scheduleMode === "daily" ||
      patch.scheduleMode === "none"
        ? patch.scheduleMode
        : anime.scheduleMode;
    const watchWeekday =
      scheduleMode === "weekly"
        ? patch.watchWeekday === undefined
          ? anime.watchWeekday
          : patch.watchWeekday
        : null;
    await db.anime.put({
      ...anime,
      ...patch,
      title: patch.title?.trim() || anime.title,
      emoji: normalizeAnimeEmoji(patch.emoji ?? anime.emoji),
      note: patch.note?.trim() ?? anime.note,
      currentEpisode,
      totalEpisodes,
      airKind,
      scheduleMode,
      watchWeekday,
      reminderTime:
        scheduleMode === "none"
          ? null
          : patch.reminderTime === undefined
            ? anime.reminderTime
            : patch.reminderTime || null,
      bgmSubjectId:
        patch.bgmSubjectId === undefined
          ? anime.bgmSubjectId
          : patch.bgmSubjectId,
      bgmCoverUrl:
        patch.bgmCoverUrl === undefined ? anime.bgmCoverUrl : patch.bgmCoverUrl,
      updatedAt: now(),
    });
  },

  incrementAnimeEpisode: async (id) => {
    const anime = await db.anime.get(id);
    if (!anime || anime.deletedAt != null) return;
    const stamp = now();
    const nextEpisode = anime.totalEpisodes
      ? Math.min(anime.currentEpisode + 1, anime.totalEpisodes)
      : anime.currentEpisode + 1;
    await db.anime.put({
      ...anime,
      currentEpisode: nextEpisode,
      status:
        anime.totalEpisodes != null && nextEpisode >= anime.totalEpisodes
          ? "completed"
          : "watching",
      lastWatchedAt: stamp,
      updatedAt: stamp,
    });
  },

  linkAnimeBgm: async (id, info) => {
    const item = await db.anime.get(id);
    if (!item || item.deletedAt != null) return;
    await db.anime.put({
      ...item,
      bgmSubjectId: info.subjectId,
      bgmCoverUrl: info.coverUrl,
      title: info.title.trim() || item.title,
      totalEpisodes: item.totalEpisodes ?? info.totalEpisodes,
      updatedAt: now(),
    });
  },

  deleteAnime: async (id) => {
    const anime = await db.anime.get(id);
    if (!anime || anime.deletedAt != null) return;
    const stamp = now();
    await db.anime.put({ ...anime, deletedAt: stamp, updatedAt: stamp });
  },
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
