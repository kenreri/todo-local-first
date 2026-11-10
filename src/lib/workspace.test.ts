import "fake-indexeddb/auto";
import Dexie from "dexie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../db";
import { getSettings } from "../seed";
import { buildBackup, importBackupJson, validateBackupPayload } from "./backup";
import {
  addAttachments,
  captureWorkspaceItem,
  deleteWorkspaceItem,
  MAX_FILE_BYTES,
  removeAttachment,
  turnIntoTask,
  updateWorkspaceItem,
} from "./workspace";

beforeEach(async () => {
  await db.delete();
  await db.open();
});
afterEach(() => {
  vi.restoreAllMocks();
  db.close();
});

describe("workspace capture and files", () => {
  it("captures text without creating a task or requiring classification", async () => {
    const id = await captureWorkspaceItem({
      body: "  A thought\nMore detail  ",
    });
    expect(await db.workspaceItems.get(id)).toMatchObject({
      title: "A thought",
      body: "A thought\nMore detail",
      kind: "inbox",
      taskId: null,
    });
    expect(await db.tasks.count()).toBe(0);
  });

  it("retains arbitrary file bytes after closing and reopening the database", async () => {
    const input = new Uint8Array([0, 255, 31, 12, 128]);
    const id = await captureWorkspaceItem({
      body: "",
      files: [
        new File([input], "材料.pdf", { type: "application/pdf" }),
        new File(["text"], "code.ts"),
      ],
    });
    db.close();
    await db.open();
    expect((await db.workspaceItems.get(id))?.title).toBe("材料.pdf");
    const files = await db.attachments.where("itemId").equals(id).toArray();
    const pdf = files.find((file) => file.name === "材料.pdf")!;
    expect(
      new Uint8Array(
        await (await db.attachmentBlobs.get(pdf.id))!.data.arrayBuffer(),
      ),
    ).toEqual(input);
    expect(files).toHaveLength(2);
  });

  it("rolls back the capture, task and all files if storing bytes fails", async () => {
    vi.spyOn(db.attachmentBlobs, "add").mockRejectedValue(
      new Error("quota exceeded"),
    );
    await expect(
      captureWorkspaceItem({
        body: "Write report",
        action: true,
        files: [new File(["paper"], "paper.pdf")],
      }),
    ).rejects.toThrow("quota");
    expect(await db.workspaceItems.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
    expect(await db.tasks.count()).toBe(0);
  });

  it("preserves separate planned and deadline dates with one linked task", async () => {
    const id = await captureWorkspaceItem({
      body: "Read paper\nCheck methods",
      action: true,
      intention: "need",
      scheduledDate: "2026-11-12",
      dueDate: "2026-11-20",
    });
    const item = (await db.workspaceItems.get(id))!;
    expect(item.intention).toBe("need");
    expect(await db.tasks.get(item.taskId!)).toMatchObject({
      title: "Read paper",
      note: "Read paper\nCheck methods",
      scheduledDate: "2026-11-12",
      dueDate: "2026-11-20",
    });
  });

  it("concurrent conversions create a single task and preserve its material", async () => {
    const id = await captureWorkspaceItem({
      body: "An idea",
      kind: "idea",
      files: [new File(["draft"], "draft.txt")],
    });
    const [first, second] = await Promise.all([
      turnIntoTask(id, "want"),
      turnIntoTask(id, "want"),
    ]);
    expect(first).toBe(second);
    expect(await db.tasks.count()).toBe(1);
    expect(await db.attachments.count()).toBe(1);
    expect((await db.workspaceItems.get(id))?.kind).toBe("idea");
  });

  it("concurrent edits preserve fields, and deleted captures cannot be revived", async () => {
    const id = await captureWorkspaceItem({ body: "Draft" });
    await Promise.all([
      updateWorkspaceItem(id, { title: "New title" }),
      updateWorkspaceItem(id, { body: "New body" }),
    ]);
    expect(await db.workspaceItems.get(id)).toMatchObject({
      title: "New title",
      body: "New body",
    });
    await deleteWorkspaceItem(id);
    await expect(
      updateWorkspaceItem(id, { title: "Resurrect" }),
    ).rejects.toThrow("item-missing");
    await expect(
      addAttachments(id, [new File(["x"], "x.txt")]),
    ).rejects.toThrow("item-missing");
  });

  it("soft-deletes attachments with a capture while retaining the independent task", async () => {
    const id = await captureWorkspaceItem({
      body: "Read",
      action: true,
      files: [new File(["x"], "x.txt")],
    });
    await deleteWorkspaceItem(id);
    expect((await db.workspaceItems.get(id))?.deletedAt).not.toBeNull();
    expect((await db.attachments.toArray())[0].deletedAt).not.toBeNull();
    expect((await db.tasks.toArray())[0].deletedAt).toBeNull();
  });

  it("rejects an oversized batch before any capture is created", async () => {
    const file = new File(["x"], "too-big.bin");
    Object.defineProperty(file, "size", { value: MAX_FILE_BYTES + 1 });
    await expect(
      captureWorkspaceItem({ body: "", files: [file] }),
    ).rejects.toThrow("file-too-large");
    expect(await db.workspaceItems.count()).toBe(0);
  });
});

describe("complete workspace backups", () => {
  it("round-trips Unicode notes, task links, arbitrary bytes and soft deletions through JSON", async () => {
    const id = await captureWorkspaceItem({
      body: "研究方向\nhttps://example.com",
      action: true,
      files: [new File([new Uint8Array([0, 3, 255, 128])], "实验.dat")],
    });
    const file = (await db.attachments.toArray())[0];
    await removeAttachment(file.id);
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    await db.delete();
    await db.open();
    await importBackupJson(backup);
    expect((await db.workspaceItems.get(id))?.body).toContain("研究方向");
    expect((await db.attachments.get(file.id))?.deletedAt).not.toBeNull();
    expect(
      new Uint8Array(
        await (await db.attachmentBlobs.get(file.id))!.data.arrayBuffer(),
      ),
    ).toEqual(new Uint8Array([0, 3, 255, 128]));
    expect(await db.tasks.count()).toBe(1);
  });

  it("rejects malformed base64, missing parents and mismatched bytes without clearing existing data", async () => {
    const id = await captureWorkspaceItem({
      body: "Keep me",
      files: [new File(["abc"], "data.bin")],
    });
    const good = await buildBackup();
    for (const patch of [
      { base64: "%%%=" },
      { size: 4 },
      { itemId: "missing" },
    ]) {
      const bad = {
        ...good,
        attachments: good.attachments.map((file) => ({ ...file, ...patch })),
      };
      await expect(importBackupJson(bad)).rejects.toThrow();
      expect((await db.workspaceItems.get(id))?.body).toBe("Keep me");
      expect(await db.attachmentBlobs.count()).toBe(1);
    }
  });

  it("rolls back an import that fails while writing file bytes", async () => {
    const id = await captureWorkspaceItem({
      body: "Original",
      files: [new File(["abc"], "original.txt")],
    });
    const backup = await buildBackup();
    backup.workspaceItems[0].body = "Replacement";
    vi.spyOn(db.attachmentBlobs, "bulkPut").mockRejectedValue(
      new Error("quota"),
    );
    await expect(importBackupJson(backup)).rejects.toThrow("quota");
    expect((await db.workspaceItems.get(id))?.body).toBe("Original");
    expect(await db.attachmentBlobs.count()).toBe(1);
  });

  it("accepts v3 backups and replaces new collections as part of full restore", async () => {
    await captureWorkspaceItem({
      body: "Existing",
      files: [new File(["x"], "x.txt")],
    });
    const old = {
      version: 3,
      exportedAt: 1,
      lists: [],
      tasks: [],
      habits: [],
      habitCheckIns: [],
      anime: [],
      pomodoroRecords: [],
      settings: null,
    };
    expect(validateBackupPayload(old).workspaceItems).toEqual([]);
    await importBackupJson(old);
    expect(await db.workspaceItems.count()).toBe(0);
    expect(await db.attachmentBlobs.count()).toBe(0);
  });

  it("migrates a version 8 database without changing its tasks", async () => {
    const id = await captureWorkspaceItem({ body: "Old task", action: true });
    const item = (await db.workspaceItems.get(id))!;
    const task = (await db.tasks.get(item.taskId!))!;
    const list = (await db.lists.get(task.listId))!;
    const settings = await getSettings();
    await db.delete();
    const legacy = new Dexie(db.name);
    legacy.version(8).stores({
      lists: "id, sortOrder, updatedAt, deletedAt",
      tasks:
        "id, listId, parentId, dueDate, scheduledDate, completedAt, updatedAt, deletedAt, sortOrder",
      settings: "id",
      pomodoroRecords: "id, taskId, startAt, createdAt",
      habits: "id, updatedAt, deletedAt",
      habitCheckIns:
        "id, habitId, date, status, updatedAt, deletedAt, [habitId+date]",
      anime: "id, status, watchWeekday, updatedAt, deletedAt",
    });
    await legacy.open();
    await legacy.table("tasks").put(task);
    await legacy.table("lists").put(list);
    await legacy.table("settings").put({ ...settings, defaultView: "list" });
    legacy.close();
    await db.open();
    expect(await db.tasks.get(task.id)).toEqual(task);
    expect((await db.settings.get("app"))?.defaultView).toBe("workspace");
    expect(await db.workspaceItems.count()).toBe(0);
  });
});
