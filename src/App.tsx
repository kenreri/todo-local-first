import { lazy, Suspense, useEffect } from "react";
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
  const bootstrap = useTodoStore((state) => state.bootstrap);
  const view = coerceAppView(useTodoStore((state) => state.view));
  const theme = useTodoStore((state) => state.theme);
  const sakuraEnabled = useTodoStore((state) => state.sakuraEnabled);
  const wallpaperEnabled = useTodoStore((state) => state.wallpaperEnabled);
  const wallpaperUrl = useTodoStore((state) => state.wallpaperUrl);
  const wallpaperDim = useTodoStore((state) => state.wallpaperDim);
  const sidebarCollapsed = useTodoStore((state) => state.sidebarCollapsed);
  const mascotEnabled = useTodoStore((state) => state.mascotEnabled);

  useEffect(() => {
    void bootstrap();
    const timer = window.setTimeout(() => {
      if (!useTodoStore.getState().ready) {
        useTodoStore.setState({ ready: true });
      }
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [bootstrap]);

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

  useShortcuts();
  useNavigationHistory(ready);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] p-6 text-[var(--ink)]">
        <div className="text-center">
          <p className="text-lg font-medium">{"\u6b63\u5728\u6253\u5f00\u672c\u5730\u6570\u636e\u2026"}</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {"\u82e5\u8d85\u8fc7\u51e0\u79d2\u4ecd\u505c\u5728\u8fd9\u91cc\uff0c\u8bf7\u5173\u95ed\u5176\u4ed6\u6807\u7b7e\u9875\u540e\u5237\u65b0"}
          </p>
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
