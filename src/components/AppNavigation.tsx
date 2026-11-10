import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Cat,
  CheckSquare2,
  Flower2,
  Home,
  Image as ImageIcon,
  Languages,
  ListChecks,
  ListTodo,
  type LucideIcon,
  Menu,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Settings,
  Sun,
  Timer,
  X,
} from "lucide-react";
import { ui } from "../i18n/messages";
import { cn } from "../lib/cn";
import { MASCOT_SCALE_MAX, MASCOT_SCALE_MIN } from "../lib/mascot";
import { useTodoStore } from "../store/todoStore";
import type { AppView, ThemeMode } from "../types";
import { BackupPanel } from "./BackupPanel";
import { FocusStatusIndicator } from "./FocusStatusIndicator";
import { ViewTabs } from "./ViewTabs";
import { formatPomodoroTime } from "../lib/pomodoro";
import { usePomodoroStore } from "../store/pomodoroStore";

export function AppNavigation() {
  const [mobileOpen, setMobileOpen] = useState(false);
  // 窄条态点设置 → 展开侧栏并自动打开设置弹层；用一次性标记传过去
  const [autoOpenSettings, setAutoOpenSettings] = useState(false);
  const locale = useTodoStore((state) => state.locale);
  const sidebarCollapsed = useTodoStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useTodoStore(
    (state) => state.setSidebarCollapsed,
  );
  const t = ui(locale);
  const openInbox = useTodoStore((state) => state.openInbox);

  // Global capture always opens the inbox.
  const openQuickCapture = async () => {
    await openInbox();
    setMobileOpen(false);
    window.setTimeout(() => {
      document
        .querySelector<HTMLInputElement>('input[data-shortcut="create"]')
        ?.focus();
    }, 0);
  };

  return (
    <>
      <aside
        className={cn(
          "nav-desktop sticky top-0 hidden h-screen min-h-0 flex-col border-r border-[var(--line)] bg-[var(--nav-glass)] backdrop-blur-xl lg:flex",
          sidebarCollapsed ? "nav-desktop-collapsed" : "p-5",
        )}
      >
        {sidebarCollapsed ? (
          <CollapsedRail
            onExpand={() => void setSidebarCollapsed(false)}
            onOpenSettings={() => {
              setAutoOpenSettings(true);
              void setSidebarCollapsed(false);
            }}
          />
        ) : (
          <NavigationContent
            onQuickCapture={openQuickCapture}
            onCollapse={() => void setSidebarCollapsed(true)}
            autoOpenSettings={autoOpenSettings}
            onSettingsAutoOpened={() => setAutoOpenSettings(false)}
          />
        )}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--line)] bg-[var(--nav-glass)] px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand compact />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void openQuickCapture()}
            className="ui-button-primary grid size-10 place-items-center"
            aria-label={t.quickCapture}
          >
            <Plus className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="ui-button-secondary grid size-10 place-items-center"
            aria-label={t.openNavigation}
          >
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      {mobileOpen ? (
        <button
          type="button"
          aria-label={t.closeNavigation}
          className="fixed inset-0 z-40 bg-[color-mix(in_srgb,var(--bg)_64%,transparent)] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      {mobileOpen ? (
        <aside className="fixed inset-y-0 left-0 z-50 flex min-h-0 w-[286px] flex-col border-r border-[var(--line)] bg-[var(--nav-bg)] p-5 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-floating)] lg:hidden">
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="grid size-9 place-items-center rounded-xl text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
              aria-label={t.closeNavigation}
            >
              <X className="size-5" />
            </button>
          </div>
          <NavigationContent
            onQuickCapture={openQuickCapture}
            onNavigate={() => setMobileOpen(false)}
            settingsId="mobile"
          />
        </aside>
      ) : null}

      <MobileBar onMore={() => setMobileOpen(true)} />
    </>
  );
}

function NavigationContent({
  onQuickCapture,
  onNavigate,
  onCollapse,
  autoOpenSettings,
  onSettingsAutoOpened,
  settingsId = "desktop",
}: {
  onQuickCapture: () => Promise<void>;
  onNavigate?: () => void;
  onCollapse?: () => void;
  autoOpenSettings?: boolean;
  onSettingsAutoOpened?: () => void;
  settingsId?: string;
}) {
  const locale = useTodoStore((state) => state.locale);
  const t = ui(locale);

  return (
    <>
      <div className="flex items-center justify-between">
        <Brand />
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            className="grid size-8 place-items-center rounded-[var(--radius-control)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
            aria-label={t.collapseSidebar}
            title={t.collapseSidebar}
          >
            <PanelLeftClose className="size-4" />
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void onQuickCapture()}
        className="ui-button-primary mt-6 inline-flex w-full items-center justify-center gap-2 px-3 py-2.5"
      >
        <Plus className="size-4" />
        {t.quickCapture}
        <kbd className="ml-auto rounded-md bg-[var(--surface)] px-1.5 py-0.5 text-[10px] text-[var(--on-accent)] opacity-80">
          N
        </kbd>
      </button>
      <div className="mt-7 min-h-0 flex-1 overflow-y-auto pr-1">
        <ViewTabs onNavigate={onNavigate} />
      </div>
      <FocusStatusIndicator />
      <SettingsPanel
        idSuffix={settingsId}
        autoOpen={autoOpenSettings}
        onAutoOpened={onSettingsAutoOpened}
      />
    </>
  );
}

function CollapsedRail({
  onExpand,
  onOpenSettings,
}: {
  onExpand: () => void;
  onOpenSettings: () => void;
}) {
  const locale = useTodoStore((state) => state.locale);
  const view = useTodoStore((state) => state.view);
  const setView = useTodoStore((state) => state.setView);
  const t = ui(locale);

  // 窄条态：Logo 当「展开并跳到今天页」按钮；下面是一列主导航图标，
  // 点图标 = 展开 + 跳到对应页面。没有浮层。
  const items: { view: AppView; label: string; icon: LucideIcon }[] = [
    { view: "today", label: t.viewToday, icon: Home },
    { view: "lists", label: t.tasks, icon: ListTodo },
    { view: "habits", label: t.navLife, icon: CheckSquare2 },
    { view: "pomodoro", label: t.navFocus, icon: Timer },
    { view: "stats", label: t.navReview, icon: BarChart3 },
  ];

  return (
    <div className="flex h-full w-full flex-col items-center">
      <button
        type="button"
        onClick={onExpand}
        className="mt-1 grid size-10 place-items-center rounded-[12px] hover:bg-[var(--hover)]"
        aria-label={t.expandSidebar}
        title={t.expandSidebar}
      >
        <span className="brand-mark grid size-10 place-items-center rounded-[12px]">
          <ListChecks className="size-5" />
        </span>
      </button>
      <div className="mt-4 flex flex-1 flex-col items-center gap-1">
        {items.map((item) => {
          const active =
            item.view === "lists"
              ? ["lists", "list", "calendar"].includes(view)
              : item.view === "habits" ? ["habits", "anime"].includes(view) : view === item.view;
          const Icon = item.icon;
          return (
            <button
              key={item.view}
              type="button"
              onClick={() => {
                void setView(item.view === "lists" ? "list" : item.view);
              }}
              aria-label={item.label}
              title={item.label}
              className={cn(
                "grid size-9 place-items-center rounded-[var(--radius-control)] transition",
                active
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>
      <FocusStatusIndicator compact />
      {/* 底部设置入口：展开并自动打开设置弹层 */}
      <button
        type="button"
        onClick={onOpenSettings}
        className="mt-2 grid size-9 place-items-center rounded-[var(--radius-control)] text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
        aria-label={t.settings}
        title={t.settings}
      >
        <Settings className="size-4" />
      </button>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  const locale = useTodoStore((state) => state.locale);
  const t = ui(locale);

  return (
    <div className="flex items-center gap-3">
      <span className="brand-mark grid size-10 place-items-center rounded-[12px]">
        <ListChecks className="size-5" />
      </span>
      <div className="nav-brand-text">
        <div className="font-bold tracking-[-0.02em] text-[var(--ink)]">
          {t.appName}
        </div>
        {!compact ? (
          <div className="text-xs text-[var(--muted)]">Local-first</div>
        ) : null}
      </div>
    </div>
  );
}

function SettingsPanel({
  idSuffix,
  autoOpen,
  onAutoOpened,
}: {
  idSuffix: string;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const locale = useTodoStore((state) => state.locale);
  const setLocale = useTodoStore((state) => state.setLocale);
  const theme = useTodoStore((state) => state.theme);
  const setTheme = useTodoStore((state) => state.setTheme);
  const sakuraEnabled = useTodoStore((state) => state.sakuraEnabled);
  const setSakuraEnabled = useTodoStore((state) => state.setSakuraEnabled);
  const wallpaperEnabled = useTodoStore((state) => state.wallpaperEnabled);
  const setWallpaperEnabled = useTodoStore(
    (state) => state.setWallpaperEnabled,
  );
  const wallpaperUrl = useTodoStore((state) => state.wallpaperUrl);
  const setWallpaperUrl = useTodoStore((state) => state.setWallpaperUrl);
  const wallpaperDim = useTodoStore((state) => state.wallpaperDim);
  const setWallpaperDim = useTodoStore((state) => state.setWallpaperDim);
  const mascotEnabled = useTodoStore((state) => state.mascotEnabled);
  const setMascotEnabled = useTodoStore((state) => state.setMascotEnabled);
  const mascotScale = useTodoStore((state) => state.mascotScale);
  const setMascotScale = useTodoStore((state) => state.setMascotScale);
  const [dimDraft, setDimDraft] = useState(wallpaperDim);
  const t = ui(locale);

  // 打开面板时同步草稿值；拖动只改草稿，松手/离开才落库
  useEffect(() => {
    if (open) setDimDraft(wallpaperDim);
  }, [open, wallpaperDim]);

  // 一次性 autoOpen 触发：父级（窄条态点设置按钮）要求自动打开
  useEffect(() => {
    if (autoOpen && !open) {
      setOpen(true);
      onAutoOpened?.();
    }
  }, [autoOpen, open, onAutoOpened]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={panelRef}
      className="relative mt-4 border-t border-[var(--line)] pt-3"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`settings-panel-${idSuffix}`}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
      >
        <Settings className="size-4" />
        {t.settings}
      </button>
      {open ? (
        <div
          id={`settings-panel-${idSuffix}`}
          role="dialog"
          aria-label={t.settings}
          className="absolute right-0 bottom-full left-0 z-20 mb-2 max-h-[min(70vh,520px)] space-y-3 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-floating)]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-[var(--ink)]">
              {t.settings}
            </div>
            <button
              type="button"
              aria-label={t.closeSettings}
              onClick={() => setOpen(false)}
              className="grid size-7 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            {theme === "dark" ? (
              <Moon className="size-4" />
            ) : (
              <Sun className="size-4" />
            )}
            <span className="w-12">{t.theme}</span>
            <select
              id={`theme-${idSuffix}`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm outline-none"
              value={theme}
              onChange={(event) =>
                void setTheme(event.target.value as ThemeMode)
              }
            >
              <option value="light">{t.themeLight}</option>
              <option value="dark">{t.themeDark}</option>
              <option value="system">{t.themeSystem}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Flower2 className="size-4" />
            <span className="w-12">{t.sakuraEffect}</span>
            <select
              id={`sakura-${idSuffix}`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm outline-none"
              value={sakuraEnabled ? "on" : "off"}
              onChange={(event) =>
                void setSakuraEnabled(event.target.value === "on")
              }
            >
              <option value="on">{t.effectOn}</option>
              <option value="off">{t.effectOff}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <ImageIcon className="size-4" />
            <span className="w-12">{t.wallpaper}</span>
            <select
              id={`wallpaper-${idSuffix}`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm outline-none"
              value={wallpaperEnabled ? "on" : "off"}
              onChange={(event) =>
                void setWallpaperEnabled(event.target.value === "on")
              }
            >
              <option value="on">{t.effectOn}</option>
              <option value="off">{t.effectOff}</option>
            </select>
          </label>
          {wallpaperEnabled ? (
            <>
              <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                {t.wallpaperSource}
                <input
                  type="url"
                  defaultValue={wallpaperUrl}
                  placeholder={t.wallpaperSourcePlaceholder}
                  className="w-full rounded-lg border border-[var(--line)] bg-[var(--surface-input)] px-2 py-1.5 text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                  onBlur={(event) =>
                    void setWallpaperUrl(event.target.value.trim())
                  }
                />
              </label>
              <label className="grid gap-1.5 text-xs text-[var(--muted)]">
                <span className="flex items-center justify-between">
                  <span>{t.wallpaperDim}</span>
                  <span className="tabular-nums opacity-80">{dimDraft}</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="ui-range"
                  value={dimDraft}
                  onChange={(event) => setDimDraft(Number(event.target.value))}
                  onPointerUp={() => {
                    if (dimDraft !== wallpaperDim)
                      void setWallpaperDim(dimDraft);
                  }}
                  onKeyUp={() => {
                    if (dimDraft !== wallpaperDim)
                      void setWallpaperDim(dimDraft);
                  }}
                  onBlur={() => {
                    if (dimDraft !== wallpaperDim)
                      void setWallpaperDim(dimDraft);
                  }}
                />
              </label>
            </>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Cat className="size-4" />
            <span className="w-12">{t.mascot}</span>
            <select
              id={`mascot-${idSuffix}`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm outline-none"
              value={mascotEnabled ? "on" : "off"}
              onChange={(event) =>
                void setMascotEnabled(event.target.value === "on")
              }
            >
              <option value="on">{t.effectOn}</option>
              <option value="off">{t.effectOff}</option>
            </select>
          </label>
          {mascotEnabled ? (
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">
              <span className="flex items-center justify-between">
                <span>{t.mascotSize}</span>
                <span className="tabular-nums opacity-80">
                  {mascotScale.toFixed(1)}
                </span>
              </span>
              <input
                type="range"
                min={MASCOT_SCALE_MIN}
                max={MASCOT_SCALE_MAX}
                step={0.1}
                className="ui-range"
                value={mascotScale}
                onChange={(event) =>
                  void setMascotScale(Number(event.target.value))
                }
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Languages className="size-4" />
            <span className="w-12">{t.language}</span>
            <select
              id={`locale-${idSuffix}`}
              className="min-w-0 flex-1 rounded-lg border border-[var(--line)] px-2 py-1.5 text-sm outline-none"
              value={locale}
              onChange={(event) =>
                void setLocale(event.target.value as "zh" | "en")
              }
            >
              <option value="zh">{t.chinese}</option>
              <option value="en">{t.english}</option>
            </select>
          </label>
          <div className="border-t border-[var(--line)] pt-3">
            <div className="mb-2 text-xs font-medium text-[var(--muted)]">
              {t.backup}
            </div>
            <BackupPanel />
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            {t.shortcutsHint}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function MobileBar({ onMore }: { onMore: () => void }) {
  const locale = useTodoStore((state) => state.locale);
  const view = useTodoStore((state) => state.view);
  const setView = useTodoStore((state) => state.setView);
  const t = ui(locale);
  const focusPhase = usePomodoroStore((state) => state.phase);
  const focusRunning = usePomodoroStore((state) => state.running);
  const focusRemainingSeconds = usePomodoroStore(
    (state) => state.remainingSeconds,
  );
  const items: { view: AppView; label: string; icon: LucideIcon }[] = [
    { view: "today", label: t.viewToday, icon: Home },
    { view: "lists", label: t.tasks, icon: ListTodo },
    { view: "habits", label: t.navLife, icon: CheckSquare2 },
    { view: "pomodoro", label: t.navFocus, icon: Timer },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--line)] bg-[var(--nav-glass)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_color-mix(in_srgb,var(--ink)_5%,transparent)] backdrop-blur-xl lg:hidden">
      {items.map((item) => {
        const active =
          item.view === "lists"
            ? ["lists", "list", "calendar"].includes(view)
            : item.view === "habits" ? ["habits", "anime"].includes(view) : view === item.view;
        const Icon = item.icon;
        const showFocusStatus =
          item.view === "pomodoro" && focusPhase !== "idle";
        const focusLabel = showFocusStatus
          ? formatPomodoroTime(focusRemainingSeconds)
          : item.label;
        return (
          <button
            key={item.view}
            type="button"
            onClick={() => void setView(item.view === "lists" ? "list" : item.view)}
            className={cn(
              "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[10px]",
              active
                ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                : "text-[var(--muted)]",
              showFocusStatus ? "focus-status" : "",
            )}
            data-phase={showFocusStatus ? focusPhase : undefined}
            data-running={showFocusStatus ? focusRunning : undefined}
            aria-label={
              showFocusStatus
                ? `${item.label} ${focusLabel} ${focusRunning ? t.focusRunning : t.focusPaused}`
                : item.label
            }
          >
            <span className="relative">
              <Icon className="size-4" />
              {showFocusStatus ? (
                <span className="focus-status-dot" aria-hidden="true" />
              ) : null}
            </span>
            <span className={showFocusStatus ? "font-semibold tabular-nums" : ""}>
              {focusLabel}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-1 text-[10px] text-[var(--muted)]"
      >
        <MoreHorizontal className="size-4" />
        {t.more}
      </button>
    </nav>
  );
}
