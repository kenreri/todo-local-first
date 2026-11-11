import { useEffect, useState, useSyncExternalStore } from "react";
import { createPendingPatch } from "../lib/pendingPatch";

/** Keep one persist target per mounted editor; key record editors by their record ID. */
export function usePendingPatch<T extends object>(
  persist: (patch: Partial<T>) => Promise<unknown>,
) {
  const [queue] = useState(() => createPendingPatch(persist));
  const state = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getSnapshot);
  useEffect(() => {
    queue.activate();
    return queue.dispose;
  }, [queue]);
  return { ...state, submit: queue.submit, retry: queue.retry, flush: queue.flush };
}
