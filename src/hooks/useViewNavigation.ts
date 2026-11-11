import { useRef } from "react";
import type { AppView } from "../types";
import { useTodoStore } from "../store/todoStore";
import { usePendingPatch } from "./usePendingPatch";

/** Preserve the intended destination and its scope change when navigation needs retry. */
export function useViewNavigation() {
  const intent = useRef<{ afterNavigate?: () => void } | null>(null);
  const pending = usePendingPatch<{ view: AppView }>(async ({ view }) => {
    if (view === undefined) return;
    const submitted = intent.current;
    await useTodoStore.getState().setView(view);
    if (submitted === intent.current) submitted?.afterNavigate?.();
  });

  const navigate = (view: AppView, afterNavigate?: () => void) => {
    intent.current = { afterNavigate };
    return pending.submit({ view });
  };

  return { navigate, saving: pending.saving, failed: pending.failed, retry: pending.retry };
}
