import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_POMODORO_CONFIG } from "../types";

const RUNTIME_KEY = "todo-pomodoro-runtime-v1";
const START = new Date(2026, 10, 11, 12).getTime();
let db: typeof import("../db").db;
let storage: Map<string, string>;
let setItem: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
  vi.setSystemTime(START);
  storage = new Map();
  setItem = vi.fn((key: string, value: string) => storage.set(key, value));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem,
  });
  vi.stubGlobal("window", {});
  vi.stubGlobal("document", { documentElement: { lang: "zh-CN" } });
  db = (await import("../db")).db;
  await db.delete();
  await db.open();
  await db.settings.put({
    id: "app",
    theme: "light",
    defaultView: "pomodoro",
    locale: "zh",
    seededAt: START,
    updatedAt: START,
    pomodoroConfig: {
      ...DEFAULT_POMODORO_CONFIG,
      workMinutes: 1,
      soundEnabled: false,
    },
  });
});

afterEach(async () => {
  vi.clearAllTimers();
  vi.restoreAllMocks();
  await db.delete();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function load(runtime?: Record<string, unknown>, hydrate = true) {
  if (runtime) storage.set(RUNTIME_KEY, JSON.stringify(runtime));
  const store = (await import("./pomodoroStore")).usePomodoroStore;
  if (hydrate) await store.getState().hydrateConfig();
  return store;
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function delayWrite() {
  const gate = deferred();
  const put = db.pomodoroRecords.put.bind(db.pomodoroRecords);
  const write = vi
    .spyOn(db.pomodoroRecords, "put")
    .mockImplementationOnce((record, key) =>
      Dexie.Promise.resolve(Dexie.waitFor(gate.promise).then(() => put(record, key))),
    );
  return { ...gate, write };
}

describe("pomodoro phase transitions", () => {
  it("records a focus session only once when finish is clicked twice", async () => {
    const store = await load();
    store.getState().startWork();
    vi.setSystemTime(START + 10_000);
    const pending = delayWrite();
    const first = store.getState().skip();
    const second = store.getState().skip();
    pending.resolve();
    await Promise.all([first, second]);
    expect(await db.pomodoroRecords.count()).toBe(1);
    expect(store.getState()).toMatchObject({
      phase: "shortBreak",
      workCycles: 1,
    });
  });

  it("does not record twice when natural completion overlaps a manual finish", async () => {
    const store = await load();
    store.getState().startWork();
    const pending = delayWrite();
    vi.setSystemTime(START + 60_000);
    await vi.advanceTimersByTimeAsync(1000);
    const skipped = store.getState().skip();
    pending.resolve();
    await skipped;
    await vi.waitFor(() => expect(store.getState().phase).toBe("shortBreak"));
    expect(await db.pomodoroRecords.count()).toBe(1);
  });

  it("does not replace a new session when a previous save finishes after reset", async () => {
    const store = await load();
    store.getState().startWork();
    vi.setSystemTime(START + 10_000);
    const pending = delayWrite();
    const finishing = store.getState().skip();
    await vi.waitFor(() => expect(pending.write).toHaveBeenCalled());
    store.getState().reset();
    vi.setSystemTime(START + 20_000);
    store.getState().startWork();
    pending.resolve();
    await finishing;
    expect(store.getState()).toMatchObject({
      phase: "work",
      running: true,
      sessionStartedAt: START + 20_000,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().remainingSeconds).toBe(59);
  });

  it("does not restart an active segment on duplicate start or resume", async () => {
    const store = await load();
    store.getState().startWork();
    const deadline = store.getState().phaseEndsAt;
    vi.setSystemTime(START + 10_000);
    store.getState().startWork();
    store.getState().resume();
    expect(store.getState().phaseEndsAt).toBe(deadline);
    expect(store.getState().activeSegmentStartedAt).toBe(START);
    await store.getState().skip();
    expect((await db.pomodoroRecords.toArray())[0]?.duration).toBe(10);
  });

  it("ignores skip while idle or before a focus session has started", async () => {
    const store = await load();
    await store.getState().skip();
    expect(store.getState().phase).toBe("idle");
    store.setState({ phase: "work", sessionStartedAt: null, running: false });
    await store.getState().skip();
    expect(store.getState().phase).toBe("work");
    expect(await db.pomodoroRecords.count()).toBe(0);
  });

  it("excludes paused time and keeps the original task binding", async () => {
    const store = await load();
    store.getState().bindTask("original-task");
    store.getState().startWork();
    vi.setSystemTime(START + 10_000);
    store.getState().pause();
    store.getState().bindTask("different-task");
    vi.setSystemTime(START + 70_000);
    store.getState().resume();
    vi.setSystemTime(START + 80_000);
    await store.getState().skip();
    expect((await db.pomodoroRecords.toArray())[0]).toMatchObject({
      duration: 20,
      taskId: "original-task",
    });
  });

  it("keeps long-break cycles and automatically starts the next focus session", async () => {
    const store = await load();
    await store
      .getState()
      .updateConfig({
        cyclesBeforeLongBreak: 2,
        autoStartBreaks: true,
        autoStartFocus: true,
        longBreakMinutes: 2,
      });
    store.setState({ workCycles: 1 });
    store.getState().bindTask("task");
    store.getState().startWork();
    vi.setSystemTime(START + 60_000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(store.getState().phase).toBe("longBreak"));
    expect(store.getState()).toMatchObject({
      running: true,
      workCycles: 2,
      remainingSeconds: 120,
      sessionTaskId: null,
    });
    await store.getState().skip();
    expect(store.getState()).toMatchObject({
      phase: "work",
      running: true,
      sessionTaskId: "task",
      workCycles: 2,
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().remainingSeconds).toBe(59);
    expect(await db.pomodoroRecords.count()).toBe(1);
  });

  it("starts the full next phase after a slow record write", async () => {
    const store = await load();
    await store.getState().updateConfig({ autoStartBreaks: true });
    store.getState().startWork();
    vi.setSystemTime(START + 10_000);
    const pending = delayWrite();
    const finishing = store.getState().skip();
    await vi.waitFor(() => expect(pending.write).toHaveBeenCalled());
    vi.setSystemTime(START + 40_000);
    pending.resolve();
    await finishing;
    expect(store.getState()).toMatchObject({
      phase: "shortBreak",
      running: true,
      remainingSeconds: 300,
      phaseEndsAt: START + 340_000,
    });
    expect((await db.pomodoroRecords.toArray())[0]).toMatchObject({
      duration: 10,
      endAt: START + 10_000,
    });
  });

  it("cancels a queued finish when reset happens before saving starts", async () => {
    const store = await load();
    store.getState().startWork();
    vi.setSystemTime(START + 10_000);
    const finishing = store.getState().skip();
    store.getState().reset();
    await finishing;
    expect(store.getState()).toMatchObject({ phase: "idle", running: false });
    expect(await db.pomodoroRecords.count()).toBe(0);
  });

  it("completes an expired phase if pause beats the next timer tick", async () => {
    const store = await load();
    store.getState().startWork();
    vi.setSystemTime(START + 61_000);
    store.getState().pause();
    await vi.waitFor(() => expect(store.getState().phase).toBe("shortBreak"));
    expect((await db.pomodoroRecords.toArray())[0]).toMatchObject({
      duration: 60,
      endAt: START + 60_000,
    });
  });
});

describe("pomodoro recovery", () => {
  it("keeps ticking when localStorage cannot be written", async () => {
    const store = await load();
    setItem.mockImplementation(() => {
      throw new DOMException("Storage full", "QuotaExceededError");
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => store.getState().startWork()).not.toThrow();
    await vi.advanceTimersByTimeAsync(1000);
    expect(store.getState().remainingSeconds).toBe(59);
  });

  it("does not let optional notification lookup prevent phase completion", async () => {
    vi.setSystemTime(START + 60_000);
    const store = await load(
      {
        phase: "work",
        running: true,
        remainingSeconds: 60,
        boundTaskId: "missing-task",
        sessionTaskId: "missing-task",
        sessionStartedAt: START,
        activeSegmentStartedAt: START,
        accumulatedWorkSeconds: 0,
        phaseEndsAt: START + 60_000,
        workCycles: 0,
      },
      false,
    );
    vi.spyOn(db.tasks, "get").mockRejectedValueOnce(new Error("Lookup failed"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(store.getState().hydrateConfig()).resolves.toBeUndefined();
    expect(store.getState().phase).toBe("shortBreak");
  });

  it("retains the session for retry when saving the record fails", async () => {
    const store = await load();
    store.getState().startWork();
    vi.setSystemTime(START + 10_000);
    vi.spyOn(db.pomodoroRecords, "put").mockRejectedValueOnce(
      new Error("Write failed"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    await store
      .getState()
      .skip()
      .catch(() => {});
    expect(store.getState()).toMatchObject({
      phase: "work",
      running: false,
      accumulatedWorkSeconds: 10,
      activeSegmentStartedAt: null,
    });
    await store.getState().skip();
    expect(await db.pomodoroRecords.count()).toBe(1);
    expect(store.getState().phase).toBe("shortBreak");
  });

  it("retries configuration loading after an initial failure", async () => {
    const store = await load(undefined, false);
    const seed = await import("../seed");
    const read = vi
      .spyOn(seed, "getSettings")
      .mockRejectedValueOnce(new Error("Database unavailable"));
    await expect(store.getState().hydrateConfig()).rejects.toThrow(
      "Database unavailable",
    );
    await store.getState().hydrateConfig();
    expect(read).toHaveBeenCalledTimes(2);
    expect(store.getState().config.workMinutes).toBe(1);
  });

  it("makes concurrent hydration callers await the same configuration load", async () => {
    const store = await load(undefined, false);
    const seed = await import("../seed");
    const settings = (await db.settings.get("app"))!;
    const gate = deferred();
    const read = vi
      .spyOn(seed, "getSettings")
      .mockImplementationOnce(async () => {
        await gate.promise;
        return settings;
      });
    const first = store.getState().hydrateConfig();
    let secondDone = false;
    const second = store
      .getState()
      .hydrateConfig()
      .then(() => {
        secondDone = true;
      });
    await Promise.resolve();
    const resolvedEarly = secondDone;
    gate.resolve();
    await Promise.all([first, second]);
    expect(resolvedEarly).toBe(false);
    expect(read).toHaveBeenCalledTimes(1);
    expect(store.getState().remainingSeconds).toBe(60);
  });

  it("records an expired restored session at its deadline, not the next day's reopening", async () => {
    vi.setSystemTime(START + 86_400_000);
    const store = await load({
      phase: "work",
      running: true,
      remainingSeconds: 60,
      boundTaskId: null,
      sessionTaskId: null,
      sessionStartedAt: START,
      activeSegmentStartedAt: START,
      accumulatedWorkSeconds: 0,
      phaseEndsAt: START + 60_000,
      workCycles: 0,
    });
    expect((await db.pomodoroRecords.toArray())[0]).toMatchObject({
      duration: 60,
      endAt: START + 60_000,
    });
    expect(store.getState()).toMatchObject({
      phase: "shortBreak",
      running: false,
    });
  });

  it("rejects malformed restored clock values instead of rendering NaN", async () => {
    const store = await load({
      phase: "work",
      running: true,
      remainingSeconds: "Infinity",
      sessionStartedAt: "bad",
      activeSegmentStartedAt: START,
      phaseEndsAt: "bad",
    });
    expect(store.getState()).toMatchObject({
      phase: "idle",
      running: false,
      remainingSeconds: 60,
    });
    expect(await db.pomodoroRecords.count()).toBe(0);
  });

  it("restores a valid paused session without counting time spent away", async () => {
    vi.setSystemTime(START + 86_400_000);
    const store = await load({
      phase: "work",
      running: false,
      remainingSeconds: 40,
      boundTaskId: "task",
      sessionTaskId: "task",
      sessionStartedAt: START,
      activeSegmentStartedAt: null,
      accumulatedWorkSeconds: 20,
      phaseEndsAt: null,
      workCycles: 0,
    });
    expect(store.getState()).toMatchObject({
      running: false,
      remainingSeconds: 40,
    });
    expect(await db.pomodoroRecords.count()).toBe(0);
    store.getState().resume();
    vi.setSystemTime(START + 86_410_000);
    await store.getState().skip();
    expect((await db.pomodoroRecords.toArray())[0]).toMatchObject({
      duration: 30,
      taskId: "task",
    });
  });

  it("leaves automatic completion retryable without an unhandled rejection", async () => {
    const store = await load();
    store.getState().startWork();
    vi.spyOn(db.pomodoroRecords, "put").mockRejectedValueOnce(
      new Error("Write failed"),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.setSystemTime(START + 60_000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(error).toHaveBeenCalled());
    expect(store.getState()).toMatchObject({
      phase: "work",
      running: false,
      remainingSeconds: 0,
      accumulatedWorkSeconds: 60,
    });
    expect(await db.pomodoroRecords.count()).toBe(0);
    await store.getState().skip();
    expect(await db.pomodoroRecords.count()).toBe(1);
    expect(store.getState().phase).toBe("shortBreak");
  });
});

it("deduplicates a restored session when independent page stores finish together", async () => {
  const first = await load();
  first.getState().startWork();
  vi.resetModules();
  const second = (await import("./pomodoroStore")).usePomodoroStore;
  const otherDb = (await import("../db")).db;
  await second.getState().hydrateConfig();
  vi.setSystemTime(START + 10_000);
  try {
    await Promise.all([first.getState().skip(), second.getState().skip()]);
    expect(await db.pomodoroRecords.count()).toBe(1);
  } finally { otherDb.close(); }
});

it("hands a shared running session to the waiting page when its controller disconnects", async () => {
  const events = new EventTarget();
  vi.stubGlobal("window", {
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  });
  const first = await load();
  const disconnectFirst = (await import("../lib/pomodoroCoordinator")).connectPomodoroRuntime();
  await vi.waitFor(() => expect(first.getState().isController).toBe(true));
  first.getState().startWork();
  vi.resetModules();
  const second = (await import("./pomodoroStore")).usePomodoroStore;
  const otherDb = (await import("../db")).db;
  const disconnectSecond = (await import("../lib/pomodoroCoordinator")).connectPomodoroRuntime();
  try {
    await second.getState().hydrateConfig();
    expect(second.getState().isController).toBe(false);
    expect(second.getState().sessionId).toBe(first.getState().sessionId);
    await vi.advanceTimersByTimeAsync(5000);
    expect(second.getState().remainingSeconds).toBe(55);
    await second.getState().skip();
    expect(await db.pomodoroRecords.count()).toBe(0);
    disconnectFirst();
    await vi.waitFor(() => expect(second.getState().isController).toBe(true));
    await second.getState().skip();
    expect(await db.pomodoroRecords.count()).toBe(1);
    expect((await db.pomodoroRecords.toArray())[0]?.duration).toBe(5);
  } finally {
    disconnectFirst(); disconnectSecond(); otherDb.close();
  }
});
