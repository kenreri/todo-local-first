import { db, now } from "../db";
import { normalizePomodoroConfig } from "./pomodoroConfig";
import {
  MASCOT_SCALE_DEFAULT,
  normalizeMascotCoord,
  normalizeMascotEnabled,
  normalizeMascotScale,
} from "./mascot";
import { coerceAppView, coerceLocale, coerceTheme } from "./appView";
import type { Locale, SettingsRecord } from "../types";
import { DEFAULT_POMODORO_CONFIG } from "../types";

export const DEFAULT_SETTINGS: SettingsRecord = {
  id: "app",
  theme: "system",
  defaultView: "workspace",
  locale: "zh",
  sakuraEnabled: true,
  wallpaperEnabled: true,
  wallpaperUrl: "",
  wallpaperDim: 40,
  mascotEnabled: false,
  mascotScale: MASCOT_SCALE_DEFAULT,
  mascotLeft: null,
  mascotTop: null,
  seededAt: null,
  pomodoroConfig: { ...DEFAULT_POMODORO_CONFIG },
  updatedAt: 0,
};

/** 壁纸遮光强度 0-100；40 为基准档，越高文字底越稳 */
export function normalizeWallpaperDim(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 40;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/** Yurikoto 随机二次元壁纸（PC 横版；移动端自动换竖版） */
export const DEFAULT_WALLPAPER_URL = "https://img.yurikoto.com/wallpaper";
export const DEFAULT_WALLPAPER_URL_MOBILE =
  "https://img.yurikoto.com/wallpaper/mobile";

/** Normalize at the storage boundary, including rows from older releases. */
export function normalizeSettings(
  settings: Omit<Partial<SettingsRecord>, "pomodoroConfig"> & {
    pomodoroConfig?: Partial<SettingsRecord["pomodoroConfig"]>;
  } = {},
): SettingsRecord {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    id: "app",
    theme: coerceTheme(settings.theme),
    locale: coerceLocale(settings.locale),
    defaultView: coerceAppView(
      settings.defaultView,
      DEFAULT_SETTINGS.defaultView,
    ),
    sakuraEnabled: settings.sakuraEnabled !== false,
    wallpaperEnabled: settings.wallpaperEnabled !== false,
    sidebarCollapsed: settings.sidebarCollapsed === true,
    listsGroupCollapsed: settings.listsGroupCollapsed === true,
    wallpaperUrl: normalizeWallpaperUrl(settings.wallpaperUrl),
    wallpaperDim: normalizeWallpaperDim(settings.wallpaperDim),
    mascotEnabled: normalizeMascotEnabled(settings.mascotEnabled),
    mascotScale: normalizeMascotScale(settings.mascotScale),
    mascotLeft: normalizeMascotCoord(settings.mascotLeft),
    mascotTop: normalizeMascotCoord(settings.mascotTop),
    pomodoroConfig: normalizePomodoroConfig(settings.pomodoroConfig),
  };
}

export async function getSettings(): Promise<SettingsRecord> {
  return db.transaction("rw", db.settings, async () => {
    const stored = await db.settings.get("app");
    const settings = normalizeSettings(stored);
    if (!stored) {
      settings.updatedAt = now();
      await db.settings.put(settings);
    }
    return settings;
  });
}

type SettingsPatch = Partial<
  Omit<SettingsRecord, "id" | "updatedAt" | "pomodoroConfig">
> & {
  pomodoroConfig?: Partial<SettingsRecord["pomodoroConfig"]>;
};

/** The transaction owns the entire read / merge / normalize / write sequence. */
export async function updateSettings(
  patch: SettingsPatch,
): Promise<SettingsRecord> {
  return db.transaction("rw", db.settings, async () => {
    const current = await db.settings.get("app");
    const next = normalizeSettings({
      ...current,
      ...Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined),
      ),
      pomodoroConfig: {
        ...current?.pomodoroConfig,
        ...Object.fromEntries(
          Object.entries(patch.pomodoroConfig ?? {}).filter(
            ([, value]) => value !== undefined,
          ),
        ),
      },
      updatedAt: now(),
    });
    await db.settings.put(next);
    return next;
  });
}

/** 仅接受 http(s) 绝对直链；其余一律回退为空串（用默认源） */
export function normalizeWallpaperUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : "";
}

export async function setLocale(locale: Locale) {
  await updateSettings({ locale });
}

export async function updatePomodoroConfig(
  patch: Partial<SettingsRecord["pomodoroConfig"]>,
) {
  await updateSettings({ pomodoroConfig: patch });
}
