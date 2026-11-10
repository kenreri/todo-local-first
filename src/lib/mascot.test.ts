import { describe, expect, it } from "vitest";
import type { TaskRecord } from "../types";
import {
  clampMascotBox,
  defaultMascotCorner,
  mascotDayStats,
  mascotInsets,
  normalizeMascotCoord,
  normalizeMascotEnabled,
  normalizeMascotScale,
  pickMascotIdleIndex,
  scaleMascotFromAnchor,
  snapMascotBox,
} from "./mascot";

const insets = { left: 12, right: 12, top: 12, bottom: 16 };

function task(patch: Partial<TaskRecord>): TaskRecord {
  return {
    id: patch.id ?? "t1",
    listId: "l1",
    title: "x",
    note: "",
    priority: "none",
    dueDate: null,
    scheduledDate: null,
    completedAt: null,
    tags: [],
    parentId: null,
    sortOrder: 0,
    repeatRule: null,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: null,
    ...patch,
  };
}

describe("mascot normalize", () => {
  it("treats only true as enabled", () => {
    expect(normalizeMascotEnabled(true)).toBe(true);
    expect(normalizeMascotEnabled(undefined)).toBe(false);
    expect(normalizeMascotEnabled(false)).toBe(false);
    expect(normalizeMascotEnabled("on")).toBe(false);
  });

  it("clamps scale to 0.6-2.5", () => {
    expect(normalizeMascotScale(undefined)).toBe(1.5);
    expect(normalizeMascotScale(0.2)).toBe(0.6);
    expect(normalizeMascotScale(9)).toBe(2.5);
    expect(normalizeMascotScale(1.26)).toBe(1.3);
  });

  it("drops invalid coords", () => {
    expect(normalizeMascotCoord(12)).toBe(12);
    expect(normalizeMascotCoord(Number.NaN)).toBeNull();
    expect(normalizeMascotCoord("8")).toBeNull();
  });
});

describe("mascot snap", () => {
  it("docks to the bottom-right by default", () => {
    const box = defaultMascotCorner(160, 140, 1280, 800, insets);
    expect(box.h).toBe("right");
    expect(box.v).toBe("bottom");
    expect(box.flip).toBe(false);
    expect(box.left).toBe(1280 - 160 - 12);
    expect(box.top).toBe(800 - 140 - 16);
  });

  it("flips when the center is in the left quarter", () => {
    const box = snapMascotBox(10, 300, 160, 140, 1000, 800, insets);
    expect(box.h).toBe("left");
    expect(box.flip).toBe(true);
    expect(box.left).toBe(12);
  });

  it("keeps a free drop in the middle", () => {
    const box = snapMascotBox(400, 300, 160, 140, 1000, 800, insets);
    expect(box.h).toBe("none");
    expect(box.v).toBe("none");
    expect(box.left).toBe(400);
    expect(box.top).toBe(300);
  });

  it("clamps into the viewport", () => {
    const boxed = clampMascotBox(-40, 900, 160, 140, 1000, 800, insets);
    expect(boxed.left).toBe(12);
    expect(boxed.top).toBe(800 - 140 - 16);
  });

  it("raises the bottom inset on narrow viewports", () => {
    expect(mascotInsets(390).bottom).toBe(88);
    expect(mascotInsets(1280).bottom).toBe(16);
  });

  it("keeps the right-bottom corner when scaling up", () => {
    const prev = defaultMascotCorner(160, 140, 1000, 800, insets);
    const next = scaleMascotFromAnchor(
      prev,
      160,
      140,
      200,
      175,
      1000,
      800,
      insets,
    );
    expect(next.h).toBe("right");
    expect(next.v).toBe("bottom");
    expect(next.left + 200).toBeCloseTo(prev.left + 160);
    expect(next.top + 175).toBeCloseTo(prev.top + 140);
  });
});

describe("mascot day stats", () => {
  const now = new Date("2026-09-08T12:00:00");

  it("counts today's remaining and overdue open tasks", () => {
    const stats = mascotDayStats(
      [
        task({ id: "a", scheduledDate: "2026-09-08" }),
        task({ id: "b", scheduledDate: "2026-09-08", completedAt: 1 }),
        task({ id: "c", dueDate: "2026-09-01" }),
        task({ id: "d", parentId: "a", scheduledDate: "2026-09-08" }),
      ],
      now,
    );
    expect(stats.remaining).toBe(1);
    expect(stats.overdue).toBe(1);
  });
});

describe("idle line picker", () => {
  it("stays in range", () => {
    expect(pickMascotIdleIndex(1, 5)).toBeGreaterThanOrEqual(0);
    expect(pickMascotIdleIndex(1, 5)).toBeLessThan(5);
    expect(pickMascotIdleIndex(99, 0)).toBe(0);
  });
});
