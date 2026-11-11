import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ui } from "../i18n/messages";
import { cn } from "../lib/cn";
import {
  clampMascotBox,
  defaultMascotCorner,
  mascotDayStats,
  mascotInsets,
  MASCOT_SCALE_MAX,
  MASCOT_SCALE_MIN,
  type MascotBox,
  pickMascotIdleIndex,
  scaleMascotFromAnchor,
  snapMascotBox,
} from "../lib/mascot";
import { useTodoStore } from "../store/todoStore";
import { usePendingPatch } from "../hooks/usePendingPatch";
import { updateSettings } from "../lib/settings";
import { SaveStatus } from "./SaveStatus";
import type { SettingsRecord } from "../types";

const WHALE_SRC = "/mascot/DSniang1.png";
const GIF_SRC = "/mascot/rua.gif";
const PRESS_SRC = "/mascot/Ya1.mp3";
const RELEASE_SRC = "/mascot/Ya2.mp3";
const HIT_SIZE = 610;
const BUBBLE_MS = 5000;
const IDLE_KEYS = [
  "mascotIdle1",
  "mascotIdle2",
  "mascotIdle3",
  "mascotIdle4",
  "mascotIdle5",
] as const;

type BubbleMode = "status" | "idle" | "gif";

export function MascotWidget() {
  const locale = useTodoStore((state) => state.locale);
  const tasks = useTodoStore((state) => state.tasks);
  const scale = useTodoStore((state) => state.mascotScale);
  const storedLeft = useTodoStore((state) => state.mascotLeft);
  const storedTop = useTodoStore((state) => state.mascotTop);
  const save = usePendingPatch<Pick<SettingsRecord, "mascotScale" | "mascotEnabled" | "mascotLeft" | "mascotTop">>(updateSettings);
  const saveMascot = save.submit;
  const shownScale = save.patch.mascotScale ?? scale;
  const t = ui(locale);

  const rootRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const hitRef = useRef<HTMLCanvasElement | null>(null);
  const hitReady = useRef(false);
  const boxRef = useRef<MascotBox | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
    moved: boolean;
  } | null>(null);
  const closeTimer = useRef(0);
  const prevSize = useRef<{ w: number; h: number } | null>(null);
  const pressAudio = useRef<HTMLAudioElement | null>(null);
  const releaseAudio = useRef<HTMLAudioElement | null>(null);

  const [box, setBox] = useState<MascotBox | null>(null);
  const [pressed, setPressed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hoverWhale, setHoverWhale] = useState(false);
  const [bubbleOpen, setBubbleOpen] = useState(false);
  const [bubbleMode, setBubbleMode] = useState<BubbleMode>("status");
  const [idleIndex, setIdleIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, right: 0 });
  const [vol, setVol] = useState(0.9);
  const [reduceMotion, setReduceMotion] = useState(false);

  const stats = useMemo(() => mascotDayStats(tasks), [tasks]);

  const applyBox = useCallback((next: MascotBox) => {
    boxRef.current = next;
    setBox(next);
  }, []);

  const measure = useCallback(() => {
    const el = rootRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { w: rect.width, h: rect.height };
  }, []);

  const settleAt = useCallback(
    (left: number, top: number) => {
      const size = measure();
      if (!size) return;
      const insets = mascotInsets(window.innerWidth);
      applyBox(
        snapMascotBox(
          left,
          top,
          size.w,
          size.h,
          window.innerWidth,
          window.innerHeight,
          insets,
        ),
      );
    },
    [applyBox, measure],
  );

  const isWhaleHit = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    const canvas = hitRef.current;
    if (!img || !canvas || !hitReady.current) return true;
    const r = img.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    let lx = ((clientX - r.left) / r.width) * HIT_SIZE;
    let ly = ((clientY - r.top) / r.height) * HIT_SIZE;
    if (lx < 0 || ly < 0 || lx >= HIT_SIZE || ly >= HIT_SIZE) return false;
    if (boxRef.current?.flip) lx = HIT_SIZE - lx;
    try {
      const data = canvas
        .getContext("2d")
        ?.getImageData(Math.floor(lx), Math.floor(ly), 1, 1).data;
      return !!data && data[3] > 10;
    } catch {
      return true;
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const press = new Audio(PRESS_SRC);
    const release = new Audio(RELEASE_SRC);
    press.preload = "auto";
    release.preload = "auto";
    pressAudio.current = press;
    releaseAudio.current = release;
    return () => {
      press.pause();
      release.pause();
    };
  }, []);

  useEffect(() => {
    const press = pressAudio.current;
    const release = releaseAudio.current;
    if (press) press.volume = vol;
    if (release) release.volume = vol;
  }, [vol]);

  useLayoutEffect(() => {
    const size = measure();
    if (!size) return;
    const insets = mascotInsets(window.innerWidth);
    const next =
      storedLeft == null || storedTop == null
        ? defaultMascotCorner(
            size.w,
            size.h,
            window.innerWidth,
            window.innerHeight,
            insets,
          )
        : snapMascotBox(
            storedLeft,
            storedTop,
            size.w,
            size.h,
            window.innerWidth,
            window.innerHeight,
            insets,
          );
    applyBox(next);
    prevSize.current = size;
  }, [applyBox, measure, storedLeft, storedTop]);

  useLayoutEffect(() => {
    const size = measure();
    const prev = prevSize.current;
    const current = boxRef.current;
    if (!size || !prev || !current) return;
    if (prev.w === size.w && prev.h === size.h) return;
    const insets = mascotInsets(window.innerWidth);
    applyBox(
      scaleMascotFromAnchor(
        current,
        prev.w,
        prev.h,
        size.w,
        size.h,
        window.innerWidth,
        window.innerHeight,
        insets,
      ),
    );
    prevSize.current = size;
  }, [applyBox, measure, scale]);

  useEffect(() => {
    const onResize = () => {
      const current = boxRef.current;
      if (!current) return;
      settleAt(current.left, current.top);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [settleAt]);

  const play = useCallback((kind: "press" | "release") => {
    if (vol <= 0) return;
    const node = kind === "press" ? pressAudio.current : releaseAudio.current;
    if (!node) return;
    try {
      node.currentTime = 0;
      void node.play().catch(() => undefined);
    } catch {
      /* autoplay / missing file */
    }
  }, [vol]);

  const openStatusBubble = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    setBubbleMode("status");
    setBubbleOpen(true);
    closeTimer.current = window.setTimeout(() => setBubbleOpen(false), BUBBLE_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const beginDrag = useCallback(
    (event: PointerEvent) => {
      const current = boxRef.current;
      if (!current) return;
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        origLeft: current.left,
        origTop: current.top,
        moved: false,
      };
      setPressed(true);
      setMenuOpen(false);
      play("press");
    },
    [play],
  );

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      setHoverWhale(isWhaleHit(event.clientX, event.clientY));
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && dx * dx + dy * dy < 9) return;
      drag.moved = true;
      setDragging(true);
      const size = measure();
      if (!size) return;
      const insets = mascotInsets(window.innerWidth);
      const follow = clampMascotBox(
        drag.origLeft + dx,
        drag.origTop + dy,
        size.w,
        size.h,
        window.innerWidth,
        window.innerHeight,
        insets,
      );
      const preview = snapMascotBox(
        follow.left,
        follow.top,
        size.w,
        size.h,
        window.innerWidth,
        window.innerHeight,
        insets,
      );
      applyBox({
        ...follow,
        flip: preview.flip,
        h: "none",
        v: "none",
      });
    };

    const onUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setPressed(false);
      setDragging(false);
      play("release");
      if (drag.moved) {
        const current = boxRef.current;
        if (!current) return;
        settleAt(current.left, current.top);
        const settled = boxRef.current;
        if (settled) void saveMascot({ mascotLeft: settled.left, mascotTop: settled.top });
        return;
      }
      openStatusBubble();
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest(".dshwv-menu, .dshwv-menu-btn, .dshwv-bubble-open")) {
        return;
      }
      if (!isWhaleHit(event.clientX, event.clientY)) return;
      event.preventDefault();
      event.stopPropagation();
      beginDrag(event);
    };

    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onUp, true);
    };
  }, [
    applyBox,
    beginDrag,
    isWhaleHit,
    measure,
    openStatusBubble,
    play,
    saveMascot,
    settleAt,
  ]);

  const onBubbleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (bubbleMode === "status") {
      const roll = pickMascotIdleIndex(Date.now(), IDLE_KEYS.length + 1);
      if (roll === IDLE_KEYS.length) {
        setBubbleMode("gif");
      } else {
        setIdleIndex(roll);
        setBubbleMode("idle");
      }
      return;
    }
    window.clearTimeout(closeTimer.current);
    setBubbleOpen(false);
  };

  const openMenu = () => {
    const btn = menuBtnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setMenuPos({
      bottom: window.innerHeight - r.top,
      right: window.innerWidth - r.right,
    });
    setMenuOpen((open) => !open);
  };

  const overdueHint =
    stats.overdue > 0
      ? t.mascotOverdueHint.replace("{n}", String(stats.overdue))
      : stats.remaining === 0
        ? t.mascotAllClear
        : t.mascotClearHint;

  return (
    <>
      <div
        ref={rootRef}
        className={cn(
          "dshwv-root",
          box?.flip && "dshwv-left",
          dragging && "dshwv-dragging",
        )}
        style={{
          ["--dshw-scale" as string]: String(scale),
          left: box?.left ?? -9999,
          top: box?.top ?? -9999,
        }}
      >
        <div
          className={cn("dshwv-body", pressed && !reduceMotion && "dshwv-pressed")}
        >
          <img
            ref={imgRef}
            className="dshwv-img"
            src={WHALE_SRC}
            alt=""
            draggable={false}
            onLoad={(event) => {
              const canvas = document.createElement("canvas");
              canvas.width = HIT_SIZE;
              canvas.height = HIT_SIZE;
              try {
                canvas
                  .getContext("2d")
                  ?.drawImage(event.currentTarget, 0, 0, HIT_SIZE, HIT_SIZE);
                hitRef.current = canvas;
                hitReady.current = true;
              } catch {
                hitReady.current = false;
              }
            }}
          />
          <div
            className={cn("dshwv-bubble", bubbleOpen && "dshwv-bubble-open")}
            onClick={onBubbleClick}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <svg
              viewBox="0 0 1026 700"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden="true"
            >
              <path
                className="dshwv-bshape"
                fill="#FFFFFF"
                stroke="#203170"
                strokeWidth="18"
                strokeLinejoin="round"
                strokeLinecap="round"
                d="M 827 248 A 373 232 0 1 0 81 246 A 373 232 0 0 0 301 465 A 57 32 10 0 0 413 484 A 373 232 0 0 0 827 248 Z"
              />
              <ellipse
                className="dshwv-b1"
                cx="352"
                cy="561"
                rx="37.5"
                ry="26"
                fill="#FFFFFF"
                stroke="#203170"
                strokeWidth="18"
              />
              <ellipse
                className="dshwv-b2"
                cx="442"
                cy="646"
                rx="24.5"
                ry="18"
                fill="#FFFFFF"
                stroke="#203170"
                strokeWidth="18"
              />
            </svg>
            <img
              className={cn("dshwv-gif", bubbleMode === "gif" && "is-on")}
              src={GIF_SRC}
              alt=""
              draggable={false}
            />
            <div className="dshwv-text" aria-live="polite">
              {bubbleMode === "gif" ? null : bubbleMode === "status" ? (
                <>
                  <div className="dshwv-label">{t.mascotTodayLeft}</div>
                  <div className="dshwv-amount">{stats.remaining}</div>
                  <div
                    className={cn(
                      "dshwv-hint",
                      stats.overdue > 0 && "is-overdue",
                    )}
                  >
                    {overdueHint}
                  </div>
                </>
              ) : (
                <div className="dshwv-label dshwv-wrap">
                  {t[IDLE_KEYS[idleIndex] ?? "mascotIdle1"]}
                </div>
              )}
            </div>
          </div>
        </div>
        <button
          ref={menuBtnRef}
          type="button"
          className={cn(
            "dshwv-menu-btn",
            (hoverWhale || menuOpen) && "dshwv-menu-btn-visible",
          )}
          aria-label={t.mascotMenu}
          aria-expanded={menuOpen}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            openMenu();
          }}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      {menuOpen
        ? createPortal(
            <div
              role="menu"
              className="dshwv-menu"
              style={{ bottom: menuPos.bottom, right: menuPos.right }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <label className="dshwv-menu-row">
                <span>{t.mascotSize}</span>
                <input
                  type="range"
                  min={MASCOT_SCALE_MIN}
                  max={MASCOT_SCALE_MAX}
                  step={0.1}
                  className="dshwv-range"
                  value={shownScale}
                  onPointerDown={() => {
                    const el = rootRef.current;
                    if (el) el.style.transition = "none";
                  }}
                  onPointerUp={() => {
                    const el = rootRef.current;
                    if (el) el.style.transition = "";
                  }}
                  onChange={(event) =>
                    void saveMascot({ mascotScale: Number(event.target.value) })
                  }
                />
                <span>{shownScale.toFixed(1)}</span>
              </label>
              <label className="dshwv-menu-row">
                <span>{t.mascotVolume}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  className="dshwv-range"
                  value={vol}
                  onChange={(event) => setVol(Number(event.target.value))}
                />
                <span>{Math.round(vol * 100)}%</span>
              </label>
              <div className="dshwv-menu-row">
                <button
                  type="button"
                  className="dshwv-hide"
                  onClick={() => void saveMascot({ mascotEnabled: false })}
                >
                  {t.mascotHide}
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
      {save.failed ? createPortal(
        <div className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 max-w-[calc(100%-2rem)] rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-floating)] lg:bottom-4"
          onPointerDown={(event) => event.stopPropagation()}>
          <SaveStatus locale={locale} saving={save.saving} failed onRetry={() => void save.retry()} />
        </div>, document.body,
      ) : null}
    </>
  );
}
