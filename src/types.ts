export type Priority = "none" | "low" | "medium" | "high";
export type Locale = "zh" | "en";
export type ThemeMode = "light" | "dark" | "system";
export type AppView =
  | "workspace"
  | "lists"
  | "list"
  | "calendar"
  | "today"
  | "habits"
  | "anime"
  | "pomodoro"
  | "stats";
export type TaskFilter = "all" | "active" | "completed";
export type RepeatFrequency = "daily" | "weekly" | "monthly" | "custom";
export type PomodoroPhase = "idle" | "work" | "shortBreak" | "longBreak";
export type HabitType = "general" | "anime";
export type HabitFrequency = "daily" | "weekly";
export type HabitCheckInStatus = "completed" | "skipped";
export type AnimeStatus = "planned" | "watching" | "completed" | "paused";
/** 连载中 / 已完结：决定「看番」的默认设定倾向。 */
export type AnimeAirKind = "ongoing" | "finished";
/**
 * 观看计划模式：
 * - none：纯进度记录，不出现在今天/日历/提醒
 * - weekly：每周固定某天提醒（适合仍在更新的番）
 * - daily：每天提醒（适合补老番的弹性节奏）
 */
export type AnimeScheduleMode = "none" | "weekly" | "daily";

export interface RepeatRule {
  frequency: RepeatFrequency;
  interval: number;
  weekdays?: number[];
  monthDay?: number;
  endDate?: string | null;
}

export interface PomodoroConfig {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  /** 0-100; scales Web Audio peak gain when sound is on. */
  soundVolume: number;
  dailyGoalMinutes: number;
}

export interface ListRecord {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface TaskRecord {
  id: string;
  listId: string;
  title: string;
  note: string;
  priority: Priority;
  /** Planned work day; calendar placement and Today prefer this */
  scheduledDate: string | null;
  /** Optional local HH:mm, only meaningful with a planned day. */
  scheduledTime?: string | null;
  /** Hard deadline; overdue reminders still use this only */
  dueDate: string | null;
  completedAt: number | null;
  tags: string[];
  parentId: string | null;
  sortOrder: number;
  repeatRule: RepeatRule | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export type WorkspaceKind = "inbox" | "idea" | "note" | "resource";

/** Free-form material; an optional task supplies scheduling and completion. */
export interface WorkspaceItem {
  id: string;
  title: string;
  body: string;
  kind: WorkspaceKind;
  taskId: string | null;
  intention: "want" | "need";
  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface AttachmentRecord {
  id: string;
  itemId: string;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

/** Read file bytes on demand rather than on every workspace refresh. */
export interface AttachmentBlob {
  id: string;
  data: Blob;
}

/** Append-only focus sessions */
export interface PomodoroRecord {
  id: string;
  taskId: string | null;
  startAt: number;
  endAt: number;
  duration: number;
  createdAt: number;
}

export interface HabitRecord {
  id: string;
  title: string;
  emoji: string;
  type: HabitType;
  frequency: HabitFrequency;
  weekdays: number[];
  reminderTime: string | null;
  currentEpisode: number;
  incrementEpisode: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface HabitCheckInRecord {
  id: string;
  habitId: string;
  date: string;
  status: HabitCheckInStatus;
  episode: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface AnimeRecord {
  id: string;
  title: string;
  emoji: string;
  status: AnimeStatus;
  /** 连载中 / 已完结 */
  airKind: AnimeAirKind;
  /** 观看计划模式 */
  scheduleMode: AnimeScheduleMode;
  currentEpisode: number;
  totalEpisodes: number | null;
  /** 仅在 scheduleMode === "weekly" 时使用（0-6）。 */
  watchWeekday: number | null;
  reminderTime: string | null;
  note: string;
  lastWatchedAt: number | null;
  /** Bangumi 条目 id（未绑定时为 null）。 */
  bgmSubjectId: number | null;
  /** Bangumi 封面来源 URL；图片二进制另存于本机 Cache Storage。 */
  bgmCoverUrl: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SettingsRecord {
  id: "app";
  theme: ThemeMode;
  defaultView: AppView;
  locale: Locale;
  /** Sakura petal effect toggle; absent in old rows/backups means on. */
  sakuraEnabled?: boolean;
  /** Remote wallpaper (frosted-glass mode); absent/invalid means off. */
  wallpaperEnabled?: boolean;
  /** Image URL; must be http(s) absolute. Empty falls back to default source. */
  wallpaperUrl?: string;
  /** Wallpaper scrim strength 0-100 (heavier = dimmer wallpaper). Default 40. */
  wallpaperDim?: number;
  /** Desktop sidebar collapsed (true = 56px icon rail). Absent/false = full 248px. */
  sidebarCollapsed?: boolean;
  /** Task nav group's list sub-items collapsed. Absent/false = expanded. */
  listsGroupCollapsed?: boolean;
  /** Corner mascot easter egg. Absent/invalid means off. */
  mascotEnabled?: boolean;
  /** Mascot size 0.6-2.5. Absent means 1.5. */
  mascotScale?: number;
  /** Last drag position (css px). Absent means default bottom-right. */
  mascotLeft?: number | null;
  mascotTop?: number | null;
  /** Stable capture destination, repaired when deleted or absent. */
  inboxListId?: string | null;
  seededAt: number | null;
  pomodoroConfig: PomodoroConfig;
  updatedAt: number;
}

export interface TaskOccurrence {
  task: TaskRecord;
  date: string;
  virtualId: string;
  isVirtual: boolean;
}

export const DEFAULT_POMODORO_CONFIG: PomodoroConfig = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  soundVolume: 70,
  dailyGoalMinutes: 100,
};
