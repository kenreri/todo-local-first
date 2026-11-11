import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { db } from "../db";
import { persistPomodoroSession } from "./pomodoroPersistence";

beforeEach(async () => { await db.delete(); await db.open(); });
afterEach(() => db.close());

it("atomically appends only one record for two finishes of the same session", async () => {
  const record = { id: crypto.randomUUID(), taskId: null, startAt: 1000, endAt: 11000, duration: 10, createdAt: 11000 };
  expect((await Promise.all([persistPomodoroSession(record), persistPomodoroSession({ ...record, duration: 11 })])).sort()).toEqual([false, true]);
  expect(await db.pomodoroRecords.toArray()).toEqual([record]);
});
