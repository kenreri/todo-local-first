import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { db } from "../db";
import { DEFAULT_SETTINGS, updateSettings } from "./settings";
import { createPendingPatch } from "./pendingPatch";
import type { SettingsRecord } from "../types";

function deferred() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.settings.put({ ...DEFAULT_SETTINGS });
});
afterEach(async () => { await db.delete(); });

it("keeps the latest value and other fields while an earlier transaction is pending", async () => {
  const hold = deferred();
  let writes = 0;
  const queue = createPendingPatch<SettingsRecord>(async (patch) => {
    if (++writes === 1) await hold.promise;
    await updateSettings(patch);
  });
  const first = queue.submit({ wallpaperDim: 15 });
  const second = queue.submit({ wallpaperDim: 80, sakuraEnabled: false });
  expect(queue.getSnapshot().patch).toEqual({ wallpaperDim: 80, sakuraEnabled: false });
  hold.release();
  expect(await first).toBe(true);
  expect(await second).toBe(true);
  expect(await db.settings.get("app")).toMatchObject({ wallpaperDim: 80, sakuraEnabled: false });
  expect(queue.getSnapshot()).toMatchObject({ pending: false, saving: false, failed: false });
  expect(writes).toBe(2);
});

it("retains a failed IndexedDB write and retries the intended values", async () => {
  const rejectWrite = () => { throw new Error("test storage failure"); };
  db.settings.hook("updating", rejectWrite);
  const queue = createPendingPatch<SettingsRecord>(updateSettings);
  try {
    expect(await queue.submit({ wallpaperDim: 90, theme: "dark" })).toBe(false);
    expect(await db.settings.get("app")).toMatchObject({ wallpaperDim: 40, theme: "system" });
    expect(queue.getSnapshot()).toMatchObject({
      patch: { wallpaperDim: 90, theme: "dark" }, pending: true, failed: true, saving: false,
    });
  } finally {
    db.settings.hook("updating").unsubscribe(rejectWrite);
  }
  expect(await queue.retry()).toBe(true);
  expect(await db.settings.get("app")).toMatchObject({ wallpaperDim: 90, theme: "dark" });
  expect(queue.getSnapshot().patch).toEqual({});
});

it("does not discard input submitted while the preceding save fails", async () => {
  const hold = deferred();
  let fail = true;
  const queue = createPendingPatch<SettingsRecord>(async (patch) => {
    await hold.promise;
    if (fail) throw new Error("unavailable");
    await updateSettings(patch);
  });
  const first = queue.submit({ wallpaperDim: 20 });
  void queue.submit({ wallpaperDim: 75, locale: "en" });
  hold.release();
  expect(await first).toBe(false);
  expect(queue.getSnapshot().patch).toEqual({ wallpaperDim: 75, locale: "en" });
  fail = false;
  expect(await queue.flush()).toBe(true);
  expect(await db.settings.get("app")).toMatchObject({ wallpaperDim: 75, locale: "en" });
});

it("ignores undefined while retaining an explicit null", async () => {
  const queue = createPendingPatch<SettingsRecord>(updateSettings);
  await db.settings.update("app", { mascotLeft: 20, wallpaperDim: 70 });
  expect(await queue.submit({ mascotLeft: null, wallpaperDim: undefined })).toBe(true);
  expect(await db.settings.get("app")).toMatchObject({ mascotLeft: null, wallpaperDim: 70 });
  expect(queue.getSnapshot().pending).toBe(false);
});

it("coalesces duplicate pointer/blur submissions during the same write", async () => {
  const hold = deferred();
  let calls = 0;
  const queue = createPendingPatch<{ dim: number }>(async () => {
    calls++;
    await hold.promise;
  });
  const first = queue.submit({ dim: 50 });
  const second = queue.submit({ dim: 50 });
  hold.release();
  await Promise.all([first, second]);
  expect(calls).toBe(1);
});

it("does not run queued writes or notify a disposed editor after an old request resolves", async () => {
  const hold = deferred();
  const written: number[] = [];
  let notifications = 0;
  const queue = createPendingPatch<{ value: number }>(async (patch) => {
    if (patch.value !== undefined) written.push(patch.value);
    await hold.promise;
  });
  queue.subscribe(() => { notifications++; });
  const old = queue.submit({ value: 1 });
  void queue.submit({ value: 2 });
  queue.dispose();
  const before = notifications;
  hold.release();
  expect(await old).toBe(false);
  expect(written).toEqual([1]);
  expect(notifications).toBe(before);
  expect(await queue.submit({ value: 3 })).toBe(false);
});

it("supports React effect remount without an old completion changing the new state", async () => {
  const oldHold = deferred();
  const newHold = deferred();
  const queue = createPendingPatch<{ value: number }>(async (patch) => {
    await (patch.value === 1 ? oldHold.promise : newHold.promise);
  });
  const old = queue.submit({ value: 1 });
  queue.dispose();
  queue.activate();
  const next = queue.submit({ value: 2 });
  oldHold.release();
  expect(await old).toBe(false);
  expect(queue.getSnapshot()).toMatchObject({ patch: { value: 2 }, saving: true });
  newHold.release();
  expect(await next).toBe(true);
  expect(queue.getSnapshot().pending).toBe(false);
});

it("does not write an empty patch or report a failed flush as success", async () => {
  let writes = 0;
  const queue = createPendingPatch<{ value: number }>(async () => {
    writes++;
    throw new Error("failure");
  });
  expect(await queue.flush()).toBe(true);
  expect(await queue.submit({ value: undefined })).toBe(true);
  expect(writes).toBe(0);
  expect(await queue.submit({ value: 1 })).toBe(false);
  expect(await queue.flush()).toBe(false);
  expect(writes).toBe(2);
});
