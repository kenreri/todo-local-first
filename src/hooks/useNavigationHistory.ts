import { useEffect } from "react";
import { startNavigationHistory, type NavigationSnapshot } from "../lib/navigationHistory";
import { useTodoStore } from "../store/todoStore";

export function useNavigationHistory(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    return startNavigationHistory({
      history: window.history,
      events: window,
      getSnapshot: () => {
        const {view, selectedListId, selectedTaskId, search, filter} = useTodoStore.getState();
        return {view, selectedListId, selectedTaskId, search, filter};
      },
      subscribe: (listener) => useTodoStore.subscribe(listener),
      apply: (snapshot: NavigationSnapshot) => {
        const {lists, tasks} = useTodoStore.getState();
        useTodoStore.setState({
          ...snapshot,
          selectedListId: lists.some(list => list.id === snapshot.selectedListId) ? snapshot.selectedListId : null,
          selectedTaskId: tasks.some(task => task.id === snapshot.selectedTaskId) ? snapshot.selectedTaskId : null,
          checkedIds: [],
        });
      },
    });
  }, [ready]);
}
