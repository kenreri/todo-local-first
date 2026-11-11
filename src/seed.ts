import { createId, db, now } from "./db";
import { normalizeSettings } from "./lib/settings";
import type { ListRecord } from "./types";

// Keep existing imports stable while settings persistence has one owner.
export {
  getSettings,
  updateSettings,
  setLocale,
  updatePomodoroConfig,
  normalizeWallpaperDim,
  normalizeWallpaperUrl,
  DEFAULT_WALLPAPER_URL,
  DEFAULT_WALLPAPER_URL_MOBILE,
} from "./lib/settings";

export async function ensureSeedData() {
  return db.transaction("rw", db.lists, db.tasks, db.settings, async () => {
    const stored = await db.settings.get("app");
    const settings = normalizeSettings(stored);

    if (!settings.seededAt) {
      const stamp = now();
      const listId = createId();
      const taskId = createId();

      await db.lists.put({
        id: listId,
        name: "\u6536\u4ef6\u7bb1",
        color: "#0f6e56",
        sortOrder: 0,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      });

      await db.tasks.put({
        id: taskId,
        listId,
        title: "\u5b8c\u6210\u5468\u62a5",
        note: "\u8fd9\u662f\u4e00\u6761\u793a\u4f8b\u4efb\u52a1\uff0c\u53ef\u7f16\u8f91\u3001\u5b8c\u6210\u6216\u5220\u9664\u3002",
        priority: "high",
        dueDate: null,
        scheduledDate: null,
        completedAt: null,
        tags: ["\u793a\u4f8b"],
        parentId: null,
        sortOrder: 0,
        repeatRule: null,
        createdAt: stamp,
        updatedAt: stamp,
        deletedAt: null,
      });

      await db.settings.put({
        ...settings,
        inboxListId: listId,
        seededAt: stamp,
        updatedAt: stamp,
      });
    } else {
      if (JSON.stringify(stored) !== JSON.stringify(settings)) {
        await db.settings.put({ ...settings, updatedAt: now() });
      }
    }
  });
}

/** Transaction prevents concurrent captures from creating duplicate inboxes. */
export async function ensureInbox(): Promise<string> {
  return db.transaction("rw", db.lists, db.settings, async () => {
    const settings = normalizeSettings(await db.settings.get("app"));
    const alive = (await db.lists.toArray()).filter(
      (list) => list.deletedAt == null,
    );
    const existing =
      alive.find((list) => list.id === settings.inboxListId) ??
      alive.find(
        (list) => list.name === "\u6536\u4ef6\u7bb1" || list.name === "Inbox",
      );
    const stamp = now();
    const inbox: ListRecord = existing ?? {
      id: createId(),
      name: "\u6536\u4ef6\u7bb1",
      color: "#0f6e56",
      sortOrder: Math.min(0, ...alive.map((list) => list.sortOrder)) - 1,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    if (!existing) await db.lists.put(inbox);
    if (settings.inboxListId !== inbox.id) {
      await db.settings.put({
        ...settings,
        inboxListId: inbox.id,
        updatedAt: stamp,
      });
    }
    return inbox.id;
  });
}
