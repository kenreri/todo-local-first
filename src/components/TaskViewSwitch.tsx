import { useViewNavigation } from "../hooks/useViewNavigation";
import { SaveStatus } from "./SaveStatus";
import { ui } from "../i18n/messages";
import { useTodoStore } from "../store/todoStore";

export function TaskViewSwitch() {
  const locale = useTodoStore((state) => state.locale);
  const view = useTodoStore((state) => state.view);
  const navigation = useViewNavigation();
  const selectList = useTodoStore((state) => state.selectList);
  const setSearch = useTodoStore((state) => state.setSearch);
  const setFilter = useTodoStore((state) => state.setFilter);
  const switchView = (target: "lists" | "list" | "calendar") => {
    if (target === view) return;
    void navigation.navigate(target, () => {
      if (target === "list") {
        selectList(null);
        setSearch("");
        setFilter("all");
      }
    });
  };
  const t = ui(locale);
  return <div className="min-w-0 space-y-2">
    <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-1" aria-label={t.tasks}>
    {([ ["lists", t.lists], ["list", t.viewList], ["calendar", t.viewCalendar] ] as const).map(([target, label]) =>
      <button key={target} type="button" disabled={navigation.saving} aria-pressed={view === target} onClick={() => switchView(target)}
        className={`min-h-10 rounded-[var(--radius-small)] px-3 py-2 text-sm ${view === target ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)]"}`}>{label}</button>
    )}
    </div>
    <SaveStatus locale={locale} {...navigation} onRetry={() => void navigation.retry()} />
  </div>;
}
