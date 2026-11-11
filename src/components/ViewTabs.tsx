import {
  BarChart3,
  CheckSquare2,
  ChevronDown,
  ChevronRight,
  Home,
  LayoutDashboard,
  ListTodo,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/cn";
import { ui } from "../i18n/messages";
import { useTodoStore, type AppView } from "../store/todoStore";
import { Sidebar } from "./Sidebar";
import { usePendingPatch } from "../hooks/usePendingPatch";
import { SaveStatus } from "./SaveStatus";

interface NavigationItem {
  view: AppView;
  label: string;
  icon: LucideIcon;
}

export function ViewTabs({ onNavigate }: { onNavigate?: () => void }) {
  const locale = useTodoStore((state) => state.locale);
  const view = useTodoStore((state) => state.view);
  const setView = useTodoStore((state) => state.setView);
  const listsGroupCollapsed = useTodoStore(
    (state) => state.listsGroupCollapsed,
  );
  const setListsGroupCollapsed = useTodoStore(
    (state) => state.setListsGroupCollapsed,
  );
  const t = ui(locale);
  const navigation = usePendingPatch<{ view: AppView }>(async ({ view }) => {
    if (view !== undefined) await setView(view);
  });
  const folding = usePendingPatch<{ collapsed: boolean }>(async ({ collapsed }) => {
    if (collapsed !== undefined) await setListsGroupCollapsed(collapsed);
  });
  const shownCollapsed = folding.patch.collapsed ?? listsGroupCollapsed;
  const groups: { label: string; items: NavigationItem[] }[] = [
    {
      label: t.navWork,
      items: [
        { view: "workspace", label: locale === "zh" ? "工作台" : "Workspace", icon: LayoutDashboard },
        { view: "today", label: t.viewToday, icon: Home },
        { view: "lists", label: t.tasks, icon: ListTodo },
      ],
    },
    {
      label: t.navLife,
      items: [
        { view: "habits", label: t.navLife, icon: CheckSquare2 },
      ],
    },
    {
      label: t.navEfficiency,
      items: [
        { view: "pomodoro", label: t.navFocus, icon: Timer },
        { view: "stats", label: t.navReview, icon: BarChart3 },
      ],
    },
  ];

  const navigate = async (target: AppView) => {
    if (await navigation.submit({ view: target === "lists" ? "list" : target })) onNavigate?.();
  };

  return (
    <nav className="space-y-6" aria-label={t.primaryNavigation}>
      <SaveStatus locale={locale} saving={navigation.saving || folding.saving}
        failed={navigation.failed || folding.failed}
        onRetry={() => { void navigation.retry(); void folding.retry(); }} />
      {groups.map((group) => (
        <section key={group.label}>
          <h2 className="mb-2 px-3 text-[11px] leading-4 font-semibold tracking-[0.12em] text-[var(--muted)] uppercase">
            {group.label}
          </h2>
          <ul className="space-y-1">
            {group.items.map((item) => {
              const active =
                item.view === "lists"
                  ? ["lists", "list", "calendar"].includes(view)
                  : item.view === "habits" ? ["habits", "anime"].includes(view) : view === item.view;
              const Icon = item.icon;
              return (
                <li key={item.view}>
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => void navigate(item.view)}
                      className={cn(
                        "flex min-h-10 flex-1 items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm transition",
                        active
                          ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                          : "text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]",
                      )}
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                      {item.view === "lists" ? (
                        <span className="ml-auto text-xs opacity-70">
                          {view === "list" ? t.viewList : ""}
                        </span>
                      ) : null}
                    </button>
                    {item.view === "lists" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void folding.submit({ collapsed: !shownCollapsed })
                        }
                        aria-label={
                          shownCollapsed
                            ? t.expandListsGroup
                            : t.collapseListsGroup
                        }
                        title={
                          shownCollapsed
                            ? t.expandListsGroup
                            : t.collapseListsGroup
                        }
                        aria-expanded={!shownCollapsed}
                        className="ml-1 grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] text-[var(--muted)] transition hover:bg-[var(--hover)] hover:text-[var(--ink)]"
                      >
                        {shownCollapsed ? (
                          <ChevronRight className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </button>
                    ) : null}
                  </div>
                  {item.view === "lists" && !shownCollapsed ? (
                    <Sidebar onNavigate={onNavigate} />
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </nav>
  );
}
