import { ui } from "../i18n/messages";
import { useTodoStore } from "../store/todoStore";

export function TaskViewSwitch() {
  const locale = useTodoStore((state) => state.locale);
  const view = useTodoStore((state) => state.view);
  const setView = useTodoStore((state) => state.setView);
  const selectList = useTodoStore((state) => state.selectList);
  const setSearch = useTodoStore((state) => state.setSearch);
  const setFilter = useTodoStore((state) => state.setFilter);
  const switchView = (target: "lists" | "list" | "calendar") => {
    if (target === view) return;
    if (target === "list") {
      selectList(null);
      setSearch("");
      setFilter("all");
    }
    void setView(target);
  };
  const t = ui(locale);
  return <div className="inline-flex rounded-[var(--radius-control)] border border-[var(--line)] bg-[var(--surface)] p-1" aria-label={t.tasks}>
    {([ ["lists", t.lists], ["list", t.viewList], ["calendar", t.viewCalendar] ] as const).map(([target, label]) =>
      <button key={target} type="button" aria-pressed={view === target} onClick={() => switchView(target)}
        className={`min-h-10 rounded-[var(--radius-small)] px-3 py-2 text-sm ${view === target ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)] hover:bg-[var(--hover)]"}`}>{label}</button>
    )}
  </div>;
}
