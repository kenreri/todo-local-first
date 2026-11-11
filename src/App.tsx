import { SaveStatus } from "./components/SaveStatus";
import { lazy, Suspense, useCallback, useEffect, useRef } from "react";
import { AnimeReminder } from "./components/AnimeReminder";
import { AppNavigation } from "./components/AppNavigation";
import { BatchBar } from "./components/BatchBar";
import { DetailPanel } from "./components/DetailPanel";
import { DueReminder } from "./components/DueReminder";
import { HabitReminder } from "./components/HabitReminder";
import { ListView } from "./components/ListView";
import { PomodoroRuntimeBridge } from "./components/PomodoroRuntimeBridge";
import { SakuraFall } from "./components/SakuraFall";
import { TodayView } from "./components/TodayView";
import { LifeView } from "./components/LifeView";
import { ListsOverview } from "./components/ListsOverview";
import { WallpaperLayer } from "./components/WallpaperLayer";
import { useNavigationHistory } from "./hooks/useNavigationHistory";
import { useShortcuts } from "./hooks/useShortcuts";
import { applyTheme } from "./lib/theme";
import { coerceAppView } from "./lib/appView";
import { cn } from "./lib/cn";
import { DEFAULT_WALLPAPER_URL } from "./seed";
import { useTodoStore } from "./store/todoStore";
import { FocusAmbience } from "./components/FocusAmbience";
import { awaitApplicationTab, connectApplicationTab, retryApplicationTab } from "./lib/restoreGuard";

const WorkspaceView = lazy(() => import("./components/WorkspaceView").then(module => ({ default: module.WorkspaceView })));

const CalendarView = lazy(() =>
  import("./components/CalendarView").then((module) => ({
    default: module.CalendarView,
  })),
);
const StatsView = lazy(() =>
  import("./components/StatsView").then((module) => ({
    default: module.StatsView,
  })),
);
const PomodoroView = lazy(() =>
  import("./components/PomodoroView").then((module) => ({
    default: module.PomodoroView,
  })),
);
const MascotWidget = lazy(() =>
  import("./components/MascotWidget").then((module) => ({
    default: module.MascotWidget,
  })),
);

export default function App() {
  const ready = useTodoStore((state) => state.ready);
  const startupStatus = useTodoStore((state) => state.startupStatus);
  const startupError = useTodoStore((state) => state.startupError);
  const locale = useTodoStore((state) => state.locale);
  const bootstrap = useTodoStore((state) => state.bootstrap);
  const disposeBootstrap = useTodoStore((state) => state.disposeBootstrap);
  const view = coerceAppView(useTodoStore((state) => state.view));
  const theme = useTodoStore((state) => state.theme);
  const sakuraEnabled = useTodoStore((state) => state.sakuraEnabled);
  const wallpaperEnabled = useTodoStore((state) => state.wallpaperEnabled);
  const wallpaperUrl = useTodoStore((state) => state.wallpaperUrl);
  const wallpaperDim = useTodoStore((state) => state.wallpaperDim);
  const sidebarCollapsed = useTodoStore((state) => state.sidebarCollapsed);
  const mascotEnabled = useTodoStore((state) => state.mascotEnabled);
  const startupActive = useRef(false);
  const startupAttempt = useRef(0);
  const openApp = useCallback(async (retryLease = false) => {
    const attempt = ++startupAttempt.current;
    useTodoStore.setState({ ready: false, startupStatus: "loading", startupError: null });
    try {
      await (retryLease ? retryApplicationTab() : awaitApplicationTab());
      if (startupActive.current && attempt === startupAttempt.current) await bootstrap();
    } catch (error) {
      if (startupActive.current && attempt === startupAttempt.current) {
        useTodoStore.setState({
          ready: false,
          startupStatus: "error",
          startupError: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }, [bootstrap]);

  useEffect(() => {
    startupActive.current = true;
    const disconnect = connectApplicationTab();
    void openApp();
    return () => {
      startupActive.current = false;
      startupAttempt.current += 1;
      disconnect();
      disposeBootstrap();
    };
  }, [openApp, disposeBootstrap]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  // 壁纸模式标记：CSS 据此把底材类 token 整体切换为半透明（见 index.css）
  useEffect(() => {
    document.documentElement.dataset.wallpaper = wallpaperEnabled
      ? "on"
      : "off";
  }, [wallpaperEnabled]);

  // 壁纸遮光：CSS 侧换算压暗纱不透明度（calc(0.2 + dim/50)，40≈1.0 基准档）
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--wallpaper-dim",
      String(wallpaperDim),
    );
  }, [wallpaperDim]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [view]);

  const shortcutSave = useShortcuts();
  useNavigationHistory(ready);

  if (!ready) {
    const zh = locale === "zh";
    const failed = startupStatus === "error";
    const blocked = startupStatus === "blocked";
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-[var(--ink)]">
        <div className="max-w-lg text-center" role={failed ? "alert" : "status"}>
          <h1 className="text-lg font-medium">
            {failed
              ? zh ? "未能打开本地数据" : "Could not open local data"
              : blocked
                ? zh ? "等待其他标签页关闭" : "Waiting for other tabs to close"
                : zh ? "正在打开本地数据…" : "Opening local data…"}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {blocked
              ? zh ? "请关闭其他工作台标签页或窗口，数据库升级会自动继续。" : "Close other workspace tabs or windows. The database upgrade will continue automatically."
              : failed
                ? zh ? "数据读取未完成。请重试；如果仍然失败，关闭其他工作台窗口后重新加载。无需清空浏览器数据。" : "Data could not be loaded. Retry, or close other workspace windows and reload. You do not need to clear browser data."
                : zh ? "数据较多时可能需要更长时间，请稍候。" : "Larger collections may take longer. Please wait."}
          </p>
          {failed ? <>
            <p className="mt-3 break-words text-xs text-[var(--muted)]">{startupError}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" className="ui-button-primary min-h-11 px-4 text-sm" onClick={() => void openApp(true)}>{zh ? "重试读取" : "Retry loading"}</button>
              <button type="button" className="ui-button-secondary min-h-11 px-4 text-sm" onClick={() => window.location.reload()}>{zh ? "重新加载页面" : "Reload page"}</button>
            </div>
          </> : null}
        </div>
      </div>
    );
  }

  const showsTaskDrawer = ["workspace", "today", "list", "calendar"].includes(view);
  // 留空 = 默认 Yurikoto 随机源；仅默认源做窄屏竖版自适应
  const wallpaperSource = wallpaperUrl || DEFAULT_WALLPAPER_URL;
  const wallpaperActive = wallpaperEnabled;
  const isDefaultYurikoto =
    /^https:\/\/img\.yurikoto\.com\/wallpaper\/?$/i.test(wallpaperSource);
  const wallpaperSrc =
    window.matchMedia("(max-width: 768px)").matches && isDefaultYurikoto
      ? `${wallpaperSource.replace(/\/$/, "")}/mobile`
      : wallpaperSource;

  return (
    <div
      className={cn(
        "min-h-screen min-w-0 overflow-x-clip lg:grid",
        sidebarCollapsed
          ? "lg:grid-cols-[56px_minmax(0,1fr)]"
          : "lg:grid-cols-[248px_minmax(0,1fr)]",
      )}
    >
      {wallpaperActive ? <WallpaperLayer url={wallpaperSrc} /> : null}
      <PomodoroRuntimeBridge />
      <SakuraFall enabled={sakuraEnabled} />
      {mascotEnabled ? (
        <Suspense fallback={null}>
          <MascotWidget />
        </Suspense>
      ) : null}
      <AppNavigation />
      <div className="relative z-[1] min-w-0 overflow-x-clip pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <main
          className={`mx-auto min-h-screen w-full min-w-0 max-w-[1360px] space-y-5 p-4 md:p-7 xl:p-10 ${
            wallpaperActive
              ? "glass-sheet mb-6 mt-4 rounded-[var(--radius-panel)] border border-[var(--line)] md:mt-6 xl:mt-8"
              : ""
          }`}
        >
          <SaveStatus locale={locale} saving={shortcutSave.saving} failed={shortcutSave.failed} onRetry={shortcutSave.retry} />
          <DueReminder />
          <HabitReminder />
          <AnimeReminder />
          <BatchBar />
          <Suspense
            fallback={
              <div className="ui-card grid min-h-64 place-items-center text-[var(--muted)]">
                Loading{`\u2026`}
              </div>
            }
          >
            {view === "workspace" ? <WorkspaceView /> : null}
            {view === "lists" ? <ListsOverview /> : null}
            {view === "list" ? <ListView /> : null}
            {view === "calendar" ? <CalendarView /> : null}
            {view === "today" ? <TodayView /> : null}
            {view === "habits" || view === "anime" ? <LifeView /> : null}
            {view === "pomodoro" ? (
              <div className="grid min-w-0 items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0">
                  <PomodoroView />
                </div>
                <div className="min-w-0">
                  <DetailPanel />
                </div>
              </div>
            ) : null}
            {view === "stats" ? <StatsView /> : null}
          </Suspense>
          <FocusAmbience visible={view === "pomodoro"} />
          {showsTaskDrawer ? <DetailPanel /> : null}
        </main>
      </div>
    </div>
  );
}
