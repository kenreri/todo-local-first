import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let db: typeof import("../db").db;
let reload: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.resetModules();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
  });
  reload = vi.fn();
  vi.stubGlobal("window", { location: { reload } });
  db = (await import("../db")).db;
  await db.delete(); await db.open();
  await (await import("../seed")).getSettings();
});
afterEach(async () => {
  await (await import("../store/pomodoroStore")).usePomodoroStore.getState().suspendForRestore();
  db.close(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it("rejects invalid backups without changing the running timer or data", async () => {
  const { usePomodoroStore } = await import("../store/pomodoroStore");
  usePomodoroStore.getState().startWork();
  const sessionId = usePomodoroStore.getState().sessionId;
  const { restoreBackupJson } = await import("./restoreBackup");
  await expect(restoreBackupJson({ version: 4 })).rejects.toThrow();
  expect(usePomodoroStore.getState()).toMatchObject({ running: true, sessionId });
  expect(await db.settings.count()).toBe(1);
  expect(reload).not.toHaveBeenCalled();
});

it("rolls back all data on restore failure and leaves the unfinished timer paused", async () => {
  const { buildBackup } = await import("./backup");
  const backup = await buildBackup();
  const { usePomodoroStore } = await import("../store/pomodoroStore");
  usePomodoroStore.getState().startWork();
  vi.spyOn(db.settings, "put").mockRejectedValueOnce(new Error("Disk full"));
  const { restoreBackupJson } = await import("./restoreBackup");
  await expect(restoreBackupJson(backup)).rejects.toThrow("Disk full");
  expect(await buildBackup()).toMatchObject({ settings: backup.settings });
  expect(usePomodoroStore.getState()).toMatchObject({ phase: "work", running: false });
  expect(await db.pomodoroRecords.count()).toBe(0);
  expect(reload).not.toHaveBeenCalled();
  await db.settings.update("app", { locale: "en" });
  expect((await db.settings.get("app"))?.locale).toBe("en");
});

it("seals delayed writes after successful replacement without recording unfinished focus", async () => {
  const { buildBackup } = await import("./backup");
  const backup = await buildBackup();
  const { usePomodoroStore } = await import("../store/pomodoroStore");
  usePomodoroStore.getState().startWork();
  const { restoreBackupJson } = await import("./restoreBackup");
  await restoreBackupJson(backup);
  expect(reload).toHaveBeenCalledTimes(1);
  expect(await db.pomodoroRecords.count()).toBe(0);
  expect(usePomodoroStore.getState().phase).toBe("idle");
  await expect(db.settings.update("app", { locale: "en" })).rejects.toThrow("restore");
  expect((await db.settings.get("app"))?.locale).toBe("zh");
});

it("rejects replacement while another application tab holds its shared lock", async () => {
  const { buildBackup } = await import("./backup");
  const backup = await buildBackup();
  let release: () => void = () => {};
  let acquired: () => void = () => {};
  const ready = new Promise<void>((resolve) => { acquired = resolve; });
  const held = new Promise<void>((resolve) => { release = resolve; });
  const otherTab = navigator.locks.request("todo-local-first:application-v1", { mode: "shared" }, async () => { acquired(); await held; });
  await ready;
  try {
    const { restoreBackupJson } = await import("./restoreBackup");
    await expect(restoreBackupJson(backup)).rejects.toThrow("other-tabs-open");
    expect(reload).not.toHaveBeenCalled();
    await db.settings.update("app", { locale: "en" });
  } finally { release(); await otherTab; }
});

it("refuses destructive restoration when cross-tab locks are unsupported", async () => {
  const { buildBackup } = await import("./backup");
  const backup = await buildBackup();
  vi.stubGlobal("navigator", {});
  const { restoreBackupJson } = await import("./restoreBackup");
  await expect(restoreBackupJson(backup)).rejects.toThrow("locks-unavailable");
  expect(await db.settings.count()).toBe(1);
  expect(reload).not.toHaveBeenCalled();
});
