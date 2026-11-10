import { createId, db, now } from './db'
import {
  normalizePomodoroConfig,
  pomodoroConfigEquals,
} from './lib/pomodoroConfig'
import {
  MASCOT_SCALE_DEFAULT,
  normalizeMascotCoord,
  normalizeMascotEnabled,
  normalizeMascotScale,
} from './lib/mascot'
import { coerceAppView, coerceLocale, coerceTheme } from './lib/appView'
import type { ListRecord, Locale, SettingsRecord } from './types'
import { DEFAULT_POMODORO_CONFIG } from './types'

const DEFAULT_SETTINGS: SettingsRecord = {
  id: 'app',
  theme: 'system',
  defaultView: 'list',
  locale: 'zh',
  sakuraEnabled: true,
  wallpaperEnabled: true,
  wallpaperUrl: '',
  wallpaperDim: 40,
  mascotEnabled: false,
  mascotScale: MASCOT_SCALE_DEFAULT,
  mascotLeft: null,
  mascotTop: null,
  seededAt: null,
  pomodoroConfig: { ...DEFAULT_POMODORO_CONFIG },
  updatedAt: 0,
}

/** 壁纸遮光强度 0-100；40 为基准档，越高文字底越稳 */
export function normalizeWallpaperDim(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 40
  return Math.min(100, Math.max(0, Math.round(n)))
}

/** Yurikoto 随机二次元壁纸（PC 横版；移动端自动换竖版） */
export const DEFAULT_WALLPAPER_URL = 'https://img.yurikoto.com/wallpaper'
export const DEFAULT_WALLPAPER_URL_MOBILE =
  'https://img.yurikoto.com/wallpaper/mobile'

export async function ensureSeedData() {
  const settings = (await db.settings.get('app')) ?? { ...DEFAULT_SETTINGS }

  if (!settings.seededAt) {
    const stamp = now()
    const listId = createId()
    const taskId = createId()

    await db.transaction('rw', db.lists, db.tasks, db.settings, async () => {
      await db.lists.put({
        id: listId,
        name: '\u6536\u4ef6\u7bb1',
        color: '#0f6e56',
        sortOrder: 0,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      })

      await db.tasks.put({
        id: taskId,
        listId,
        title: '\u5b8c\u6210\u5468\u62a5',
        note: '\u8fd9\u662f\u4e00\u6761\u793a\u4f8b\u4efb\u52a1\uff0c\u53ef\u7f16\u8f91\u3001\u5b8c\u6210\u6216\u5220\u9664\u3002',
        priority: 'high',
        dueDate: null,
        scheduledDate: null,
        completedAt: null,
        tags: ['\u793a\u4f8b'],
        parentId: null,
        sortOrder: 0,
        repeatRule: null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      })

      await db.settings.put({
        ...DEFAULT_SETTINGS,
        ...settings,
        pomodoroConfig: normalizePomodoroConfig(settings.pomodoroConfig),
        defaultView: settings.defaultView ?? 'list',
        inboxListId: listId,
        seededAt: stamp,
        updatedAt: stamp,
      })
    })
  } else if (!(await db.settings.get('app'))) {
    await db.settings.put({ ...settings, updatedAt: now() })
  } else {
    const current = await db.settings.get('app')
    if (current) {
      const pomodoroConfig = normalizePomodoroConfig(current.pomodoroConfig)
      if (pomodoroConfigEquals(current.pomodoroConfig, pomodoroConfig)) return
      await db.settings.put({
        ...current,
        pomodoroConfig,
        updatedAt: now(),
      })
    }
  }
}

export async function getSettings(): Promise<SettingsRecord> {
  const settings = await db.settings.get('app')
  if (settings) {
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      theme: coerceTheme(settings.theme),
      locale: coerceLocale(settings.locale),
      defaultView: coerceAppView(settings.defaultView),
      wallpaperUrl: normalizeWallpaperUrl(settings.wallpaperUrl),
      wallpaperDim: normalizeWallpaperDim(settings.wallpaperDim),
      mascotEnabled: normalizeMascotEnabled(settings.mascotEnabled),
      mascotScale: normalizeMascotScale(settings.mascotScale),
      mascotLeft: normalizeMascotCoord(settings.mascotLeft),
      mascotTop: normalizeMascotCoord(settings.mascotTop),
      pomodoroConfig: normalizePomodoroConfig(settings.pomodoroConfig),
    }
  }
  const stamp = now()
  const next = { ...DEFAULT_SETTINGS, updatedAt: stamp }
  await db.settings.put(next)
  return next
}

/** 仅接受 http(s) 绝对直链；其余一律回退为空串（用默认源） */
export function normalizeWallpaperUrl(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  return /^https?:\/\/\S+$/i.test(trimmed) ? trimmed : ''
}

export async function setLocale(locale: Locale) {
  const settings = await getSettings()
  await db.settings.put({ ...settings, locale, updatedAt: now() })
}

export async function updatePomodoroConfig(
  patch: Partial<SettingsRecord['pomodoroConfig']>,
) {
  const settings = await getSettings()
  await db.settings.put({
    ...settings,
    pomodoroConfig: normalizePomodoroConfig({
      ...settings.pomodoroConfig,
      ...patch,
    }),
    updatedAt: now(),
  })
}

/** Transaction prevents concurrent captures from creating duplicate inboxes. */
export async function ensureInbox(): Promise<string> {
  await getSettings();
  return db.transaction('rw', db.lists, db.settings, async () => {
    const settings = (await db.settings.get('app'))!;
    const alive = (await db.lists.toArray()).filter(list => list.deletedAt == null);
    const existing = alive.find(list => list.id === settings.inboxListId)
      ?? alive.find(list => list.name === '\u6536\u4ef6\u7bb1' || list.name === 'Inbox');
    const stamp = now();
    const inbox: ListRecord = existing ?? {
      id: createId(), name: '\u6536\u4ef6\u7bb1', color: '#0f6e56',
      sortOrder: Math.min(0, ...alive.map(list => list.sortOrder)) - 1,
      createdAt: stamp, updatedAt: stamp, deletedAt: null,
    };
    if (!existing) await db.lists.put(inbox);
    if (settings.inboxListId !== inbox.id) {
      await db.settings.put({ ...settings, inboxListId: inbox.id, updatedAt: stamp });
    }
    return inbox.id;
  });
}
