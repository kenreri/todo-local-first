import type { TaskRecord } from "../types";
import { todayBuckets } from "./repeat";

export const MASCOT_SCALE_MIN = 0.6;
export const MASCOT_SCALE_MAX = 2.5;
export const MASCOT_SCALE_DEFAULT = 1.5;

export type MascotEdgeH = "left" | "right" | "none";
export type MascotEdgeV = "top" | "bottom" | "none";

export type MascotInsets = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type MascotBox = {
  left: number;
  top: number;
  flip: boolean;
  h: MascotEdgeH;
  v: MascotEdgeV;
};

export type MascotDayStats = {
  remaining: number;
  overdue: number;
};

/** Easter egg: absent / non-true means off. */
export function normalizeMascotEnabled(value: unknown): boolean {
  return value === true;
}

export function normalizeMascotScale(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return MASCOT_SCALE_DEFAULT;
  const rounded = Math.round(n * 10) / 10;
  return Math.min(MASCOT_SCALE_MAX, Math.max(MASCOT_SCALE_MIN, rounded));
}

export function normalizeMascotCoord(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mascotInsets(viewW: number): MascotInsets {
  const margin = 12;
  const mobile = viewW < 1024;
  return {
    left: margin,
    right: margin,
    top: margin,
    bottom: mobile ? 88 : 16,
  };
}

export function clampMascotBox(
  left: number,
  top: number,
  boxW: number,
  boxH: number,
  viewW: number,
  viewH: number,
  insets: MascotInsets,
): { left: number; top: number } {
  const minL = insets.left;
  const minT = insets.top;
  const maxL = Math.max(minL, viewW - boxW - insets.right);
  const maxT = Math.max(minT, viewH - boxH - insets.bottom);
  return {
    left: Math.min(maxL, Math.max(minL, left)),
    top: Math.min(maxT, Math.max(minT, top)),
  };
}

export function snapMascotBox(
  left: number,
  top: number,
  boxW: number,
  boxH: number,
  viewW: number,
  viewH: number,
  insets: MascotInsets,
): MascotBox {
  const cx = left + boxW / 2;
  const cy = top + boxH / 2;
  const h: MascotEdgeH =
    cx < viewW / 4 ? "left" : cx > (viewW * 3) / 4 ? "right" : "none";
  const v: MascotEdgeV =
    cy < viewH / 4 ? "top" : cy > (viewH * 3) / 4 ? "bottom" : "none";

  let nextLeft = left;
  let nextTop = top;
  if (h === "left") nextLeft = insets.left;
  if (h === "right") nextLeft = viewW - boxW - insets.right;
  if (v === "top") nextTop = insets.top;
  if (v === "bottom") nextTop = viewH - boxH - insets.bottom;

  const clamped = clampMascotBox(
    nextLeft,
    nextTop,
    boxW,
    boxH,
    viewW,
    viewH,
    insets,
  );
  return {
    ...clamped,
    flip: h === "left",
    h,
    v,
  };
}

export function defaultMascotCorner(
  boxW: number,
  boxH: number,
  viewW: number,
  viewH: number,
  insets: MascotInsets,
): MascotBox {
  return snapMascotBox(viewW, viewH, boxW, boxH, viewW, viewH, insets);
}

/** Keep the docked corner fixed while the widget is resized. */
export function scaleMascotFromAnchor(
  prev: MascotBox,
  oldW: number,
  oldH: number,
  newW: number,
  newH: number,
  viewW: number,
  viewH: number,
  insets: MascotInsets,
): MascotBox {
  const right = prev.left + oldW;
  const bottom = prev.top + oldH;
  let left = prev.left;
  let top = prev.top;
  if (prev.flip || prev.h === "left") left = prev.left;
  else left = right - newW;
  if (prev.v === "top") top = prev.top;
  else top = bottom - newH;
  return snapMascotBox(left, top, newW, newH, viewW, viewH, insets);
}

export function mascotDayStats(
  tasks: TaskRecord[],
  now = new Date(),
): MascotDayStats {
  const buckets = todayBuckets(tasks, now);
  return {
    remaining: buckets.dueToday.length,
    overdue: buckets.overdue.length,
  };
}

export function pickMascotIdleIndex(seed: number, count: number): number {
  if (count <= 0) return 0;
  const x = Math.abs(Math.sin(seed) * 10000);
  return Math.floor(x) % count;
}
