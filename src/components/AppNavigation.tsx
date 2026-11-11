import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  Cat,
  CheckSquare2,
  Flower2,
  Home,
  LayoutDashboard,
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
import type { AppView, SettingsRecord } from "../types";
import { coerceTheme } from "../lib/appView";
import { updateSettings } from "../lib/settings";
import { usePendingPatch } from "../hooks/usePendingPatch";
import { SaveStatus } from "./SaveStatus";
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
  const setView = useTodoStore((state) => state.setView);
  const sidebarSave = usePendingPatch<{ collapsed: boolean }>(async ({ collapsed }) => {
    if (collapsed !== undefined) await setSidebarCollapsed(collapsed);
  });
  const navigation = usePendingPatch<{ view: AppView }>(async ({ view }) => {
    if (view !== undefined) await setView(view);
  });
  const appearance = usePendingPatch<AppearanceSettings>(updateSettings);

  // Global capture always opens the inbox.
  const openQuickCapture = async () => {
    if (!(await navigation.submit({ view: "workspace" }))) return;
    setMobileOpen(false);
    window.setTimeout(() => {
      document
        .querySelector<HTMLTextAreaElement>('textarea[data-shortcut="create"]')
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
            onExpand={() => void sidebarSave.submit({ collapsed: false })}
            onOpenSettings={() => {
              void sidebarSave.submit({ collapsed: false }).then((saved) => {
                if (saved) setAutoOpenSettings(true);
              });
            }}
          />
        ) : (
          <NavigationContent
            appearance={appearance}
            onQuickCapture={openQuickCapture}
            onCollapse={() => void sidebarSave.submit({ collapsed: true })}
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
            appearance={appearance}
            onQuickCapture={openQuickCapture}
            onNavigate={() => setMobileOpen(false)}
            settingsId="mobile"
          />
        </aside>
      ) : null}

      <MobileBar onMore={() => setMobileOpen(true)} />
      {sidebarSave.failed || navigation.failed || appearance.failed ? (
        <div className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 max-w-[calc(100%-2rem)] rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-floating)] lg:bottom-4">
          <SaveStatus locale={locale} saving={sidebarSave.saving || navigation.saving || appearance.saving}
            failed={sidebarSave.failed || navigation.failed || appearance.failed}
            onRetry={() => { void sidebarSave.retry(); void navigation.retry(); void appearance.retry(); }} />
        </div>
      ) : null}
    </>
  );
}

function NavigationContent({
  appearance,
  onQuickCapture,
  onNavigate,
  onCollapse,
  autoOpenSettings,
  onSettingsAutoOpened,
  settingsId = "desktop",
}: {
  appearance: AppearanceSave;
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
        save={appearance}
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
  const navigation = usePendingPatch<{ view: AppView }>(async ({ view }) => {
    if (view !== undefined) await setView(view);
  });

  // 窄条态：Logo 当「展开并跳到今天页」按钮；下面是一列主导航图标，
  // 点图标 = 展开 + 跳到对应页面。没有浮层。
  const items: { view: AppView; label: string; icon: LucideIcon }[] = [
    { view: "workspace", label: locale === "zh" ? "工作台" : "Workspace", icon: LayoutDashboard },
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
                void navigation.submit({ view: item.view === "lists" ? "list" : item.view });
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
      {navigation.failed ? createPortal(<div className="fixed bottom-4 left-16 z-50 w-64 max-w-[calc(100vw-5rem)] rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-floating)]">
        <SaveStatus locale={locale} saving={navigation.saving} failed onRetry={() => void navigation.retry()} />
      </div>, document.body) : null}
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

type AppearanceSettings = Pick<SettingsRecord,
  "theme" | "locale" | "sakuraEnabled" | "wallpaperEnabled" | "wallpaperUrl" | "wallpaperDim" | "mascotEnabled" | "mascotScale"
>;
type AppearanceSave = ReturnType<typeof usePendingPatch<AppearanceSettings>>;

function SettingsPanel({
  save,
  idSuffix,
  autoOpen,
  onAutoOpened,
}: {
  save: AppearanceSave;
  idSuffix: string;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const locale = useTodoStore((state) => state.locale);
  const theme = useTodoStore((state) => state.theme);
  const sakuraEnabled = useTodoStore((state) => state.sakuraEnabled);
  const wallpaperEnabled = useTodoStore((state) => state.wallpaperEnabled);
  const wallpaperUrl = useTodoStore((state) => state.wallpaperUrl);
  const wallpaperDim = useTodoStore((state) => state.wallpaperDim);
  const mascotEnabled = useTodoStore((state) => state.mascotEnabled);
  const mascotScale = useTodoStore((state) => state.mascotScale);
  const [dimDraft, setDimDraft] = useState<number | null>(null);
  const [urlDraft, setUrlDraft] = useState<string | null>(null);
  const dimRef = useRef<number | null>(null);
  const urlRef = useRef<string | null>(null);
  const inputRevision = useRef(0);
  const t = ui(locale);
  const shownWallpaper = save.patch.wallpaperEnabled ?? wallpaperEnabled;
  const shownMascot = save.patch.mascotEnabled ?? mascotEnabled;
  const shownDim = dimDraft ?? save.patch.wallpaperDim ?? wallpaperDim;
  const shownScale = save.patch.mascotScale ?? mascotScale;
  const submitAppearance = save.submit;

  // Reading the refs also commits an input when an outside pointer closes the panel before blur.
  const commitInputs = useCallback(() => {
    const patch: Partial<AppearanceSettings> = {};
    if (urlRef.current !== null) patch.wallpaperUrl = urlRef.current.trim();
    if (dimRef.current !== null) patch.wallpaperDim = dimRef.current;
    urlRef.current = null;
    dimRef.current = null;
    setUrlDraft(null);
    setDimDraft(null);
    return submitAppearance(patch);
  }, [submitAppearance]);
  const close = useCallback(async () => {
    const requestedRevision = inputRevision.current;
    if (await commitInputs() && inputRevision.current === requestedRevision) setOpen(false);
  }, [commitInputs]);

  useEffect(() => {
    if (autoOpen && !open) {
      setOpen(true);
      onAutoOpened?.();
    }
  }, [autoOpen, open, onAutoOpened]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) void close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void close();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={panelRef} className="relative mt-4 border-t border-[var(--line)] pt-3">
      <button type="button" aria-expanded={open} aria-controls={`settings-panel-${idSuffix}`}
        onClick={() => { if (open) void close(); else setOpen(true); }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]">
        <Settings className="size-4" />{t.settings}
      </button>
      {open ? (
        <div id={`settings-panel-${idSuffix}`} role="dialog" aria-label={t.settings}
          className="absolute right-0 bottom-full left-0 z-20 mb-2 max-h-[min(70vh,520px)] space-y-3 overflow-y-auto rounded-[var(--radius-card)] border border-[var(--line)] bg-[var(--bg-elevated)] p-4 shadow-[var(--shadow-floating)]">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-medium text-[var(--ink)]">{t.settings}</div>
            <button type="button" aria-label={t.closeSettings} onClick={() => void close()}
              className="grid size-10 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"><X className="size-4" /></button>
          </div>
          <SaveStatus locale={locale} saving={save.saving} failed={save.failed} onRetry={() => void commitInputs()} showSaved={urlDraft === null && dimDraft === null} />
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            {(save.patch.theme ?? theme) === "dark" ? <Moon className="size-4 shrink-0" /> : <Sun className="size-4 shrink-0" />}
            <span className="min-w-12 max-w-16 shrink-0">{t.theme}</span>
            <select id={`theme-${idSuffix}`} className="ui-input min-h-10 min-w-0 flex-1 px-1 text-sm"
              value={save.patch.theme ?? theme} onChange={(event) => void save.submit({ theme: coerceTheme(event.target.value) })}>
              <option value="light">{t.themeLight}</option><option value="dark">{t.themeDark}</option><option value="system">{t.themeSystem}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Flower2 className="size-4 shrink-0" /><span className="min-w-12 max-w-16 shrink-0">{t.sakuraEffect}</span>
            <select id={`sakura-${idSuffix}`} className="ui-input min-h-10 min-w-0 flex-1 px-1 text-sm"
              value={(save.patch.sakuraEnabled ?? sakuraEnabled) ? "on" : "off"} onChange={(event) => void save.submit({ sakuraEnabled: event.target.value === "on" })}>
              <option value="on">{t.effectOn}</option><option value="off">{t.effectOff}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <ImageIcon className="size-4 shrink-0" /><span className="min-w-12 max-w-16 shrink-0">{t.wallpaper}</span>
            <select id={`wallpaper-${idSuffix}`} className="ui-input min-h-10 min-w-0 flex-1 px-1 text-sm"
              value={shownWallpaper ? "on" : "off"} onChange={(event) => void save.submit({ wallpaperEnabled: event.target.value === "on" })}>
              <option value="on">{t.effectOn}</option><option value="off">{t.effectOff}</option>
            </select>
          </label>
          {shownWallpaper ? <>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">
              {t.wallpaperSource}
              <input type="url" value={urlDraft ?? save.patch.wallpaperUrl ?? wallpaperUrl} placeholder={t.wallpaperSourcePlaceholder}
                className="ui-input min-h-10 w-full px-2 text-xs"
                onChange={(event) => { inputRevision.current++; urlRef.current = event.target.value; setUrlDraft(event.target.value); }}
                onBlur={() => { if (urlRef.current !== null) void commitInputs(); }} />
            </label>
            <label className="grid gap-1.5 text-xs text-[var(--muted)]">
              <span className="flex items-center justify-between"><span>{t.wallpaperDim}</span><span className="tabular-nums opacity-80">{shownDim}</span></span>
              <input type="range" min={0} max={100} step={5} className="ui-range" value={shownDim}
                onChange={(event) => { inputRevision.current++; dimRef.current = Number(event.target.value); setDimDraft(dimRef.current); }}
                onPointerUp={() => { if (dimRef.current !== null) void commitInputs(); }}
                onKeyUp={() => { if (dimRef.current !== null) void commitInputs(); }}
                onBlur={() => { if (dimRef.current !== null) void commitInputs(); }} />
            </label>
          </> : null}
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Cat className="size-4 shrink-0" /><span className="min-w-12 max-w-16 shrink-0">{t.mascot}</span>
            <select id={`mascot-${idSuffix}`} className="ui-input min-h-10 min-w-0 flex-1 px-1 text-sm"
              value={shownMascot ? "on" : "off"} onChange={(event) => void save.submit({ mascotEnabled: event.target.value === "on" })}>
              <option value="on">{t.effectOn}</option><option value="off">{t.effectOff}</option>
            </select>
          </label>
          {shownMascot ? <label className="grid gap-1.5 text-xs text-[var(--muted)]">
            <span className="flex items-center justify-between"><span>{t.mascotSize}</span><span className="tabular-nums opacity-80">{shownScale.toFixed(1)}</span></span>
            <input type="range" min={MASCOT_SCALE_MIN} max={MASCOT_SCALE_MAX} step={0.1} className="ui-range" value={shownScale}
              onChange={(event) => void save.submit({ mascotScale: Number(event.target.value) })} />
          </label> : null}
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <Languages className="size-4 shrink-0" /><span className="min-w-12 max-w-16 shrink-0">{t.language}</span>
            <select id={`locale-${idSuffix}`} className="ui-input min-h-10 min-w-0 flex-1 px-1 text-sm"
              value={save.patch.locale ?? locale} onChange={(event) => void save.submit({ locale: event.target.value === "en" ? "en" : "zh" })}>
              <option value="zh">{t.chinese}</option><option value="en">{t.english}</option>
            </select>
          </label>
          {save.failed ? <SaveStatus locale={locale} saving={save.saving} failed onRetry={() => void commitInputs()} /> : null}
          <div className="border-t border-[var(--line)] pt-3"><div className="mb-2 text-xs font-medium text-[var(--muted)]">{t.backup}</div><BackupPanel /></div>
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">{t.shortcutsHint}</p>
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
  const navigation = usePendingPatch<{ view: AppView }>(async ({ view }) => {
    if (view !== undefined) await setView(view);
  });
  const focusPhase = usePomodoroStore((state) => state.phase);
  const focusRunning = usePomodoroStore((state) => state.running);
  const focusRemainingSeconds = usePomodoroStore(
    (state) => state.remainingSeconds,
  );
  const items: { view: AppView; label: string; icon: LucideIcon }[] = [
    { view: "workspace", label: locale === "zh" ? "工作台" : "Workspace", icon: LayoutDashboard },
    { view: "lists", label: t.tasks, icon: ListTodo },
    { view: "today", label: t.viewToday, icon: Home },
    { view: "pomodoro", label: t.navFocus, icon: Timer },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--line)] bg-[var(--nav-glass)] px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_color-mix(in_srgb,var(--ink)_5%,transparent)] backdrop-blur-xl lg:hidden">
      {navigation.failed ? <div className="absolute inset-x-2 bottom-full mb-2 rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--bg-elevated)] p-3 shadow-[var(--shadow-floating)]">
        <SaveStatus locale={locale} saving={navigation.saving} failed onRetry={() => void navigation.retry()} />
      </div> : null}
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
            onClick={() => void navigation.submit({ view: item.view === "lists" ? "list" : item.view })}
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
