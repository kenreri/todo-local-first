import { APP_VIEWS } from "./appView";
import type { AppView, TaskFilter } from "../types";

export interface NavigationSnapshot {
  view: AppView;
  selectedListId: string | null;
  selectedTaskId: string | null;
  search: string;
  filter: TaskFilter;
}
interface Entry { tag: "todo-navigation-v1"; boundary: boolean; snapshot: NavigationSnapshot }
function readEntry(value: unknown): Entry | null {
  if (!value || typeof value !== "object") return null;
  const entry = value as Partial<Entry>;
  const s = entry.snapshot;
  const id = (value: unknown) => value === null || typeof value === "string";
  if (entry.tag !== "todo-navigation-v1" || typeof entry.boundary !== "boolean" || !s ||
    !APP_VIEWS.includes(s.view) || !id(s.selectedListId) || !id(s.selectedTaskId) ||
    typeof s.search !== "string" || !["all", "active", "completed"].includes(s.filter)) return null;
  return entry as Entry;
}
const entry = (snapshot: NavigationSnapshot, boundary = false): Entry => ({tag:"todo-navigation-v1", boundary, snapshot});
const samePage = (a: NavigationSnapshot, b: NavigationSnapshot) =>
  a.view === b.view && a.selectedListId === b.selectedListId && a.selectedTaskId === b.selectedTaskId;

/** Use native browser history, so mouse Back/Forward also stay inside the app. */
export function startNavigationHistory({ history, events, getSnapshot, subscribe, apply }: {
  history: Pick<History, "state" | "replaceState" | "pushState" | "go">;
  events: Pick<Window, "addEventListener" | "removeEventListener">;
  getSnapshot: () => NavigationSnapshot;
  subscribe: (listener: () => void) => () => void;
  apply: (snapshot: NavigationSnapshot) => void;
}) {
  let restoring = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = getSnapshot();
  const existing = readEntry(history.state);
  if (existing && !existing.boundary) {
    apply(existing.snapshot);
    last = getSnapshot();
    history.replaceState(entry(last), "");
  } else {
    // One boundary entry: exhausting internal history stays on the first page.
    history.replaceState(entry(last, true), "");
    history.pushState(entry(last), "");
  }
  const write = () => {
    timer = undefined;
    const next = getSnapshot();
    if (samePage(last, next)) {
      if (next.search !== last.search || next.filter !== last.filter) history.replaceState(entry(next), "");
    } else history.pushState(entry(next), "");
    last = next;
  };
  const unsubscribe = subscribe(() => {
    if (restoring) return;
    clearTimeout(timer);
    // Combine list selection + asynchronous view switching into one destination.
    timer = setTimeout(write, 60);
  });
  const onPop = (event: Event) => {
    const destination = readEntry((event as PopStateEvent).state);
    if (!destination) return;
    clearTimeout(timer);
    timer = undefined;
    if (destination.boundary) { history.go(1); return; }
    restoring = true;
    try { apply(destination.snapshot); last = getSnapshot(); }
    finally { restoring = false; }
    // Normalize references to records deleted since the history entry was made.
    history.replaceState(entry(last), "");
  };
  events.addEventListener("popstate", onPop);
  return () => {
    if (timer !== undefined) { clearTimeout(timer); write(); }
    unsubscribe();
    events.removeEventListener("popstate", onPop);
  };
}
