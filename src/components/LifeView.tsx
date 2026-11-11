import { useViewNavigation } from "../hooks/useViewNavigation";
import { SaveStatus } from "./SaveStatus";
import { lazy, Suspense } from "react";
import { ui } from "../i18n/messages";
import { useTodoStore } from "../store/todoStore";

const HabitView = lazy(() => import("./HabitView").then((module) => ({ default: module.HabitView })));
const AnimeView = lazy(() => import("./AnimeView").then((module) => ({ default: module.AnimeView })));

/** Keep legacy habits/anime view values for settings and backup compatibility. */
export function LifeView() {
  const locale = useTodoStore((state) => state.locale);
  const view = useTodoStore((state) => state.view);
  const navigation = useViewNavigation();
  const t = ui(locale);
  return <section className="min-w-0 space-y-5">
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold text-[var(--muted)]">{t.navLife}</span>
      <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-1">
        {([ ["habits", t.viewHabits], ["anime", t.viewAnime] ] as const).map(([target, label]) =>
          <button key={target} type="button" aria-pressed={view === target} disabled={navigation.saving} onClick={() => void navigation.navigate(target)}
            className={`min-h-10 rounded-[var(--radius-small)] px-4 py-2 text-sm ${view === target ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)]"}`}>{label}</button>
        )}
      </div>
    </div>
    <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
    <Suspense fallback={<p className="text-[var(--muted)]">Loading…</p>}>
      {view === "anime" ? <AnimeView /> : <HabitView />}
    </Suspense>
  </section>;
}
