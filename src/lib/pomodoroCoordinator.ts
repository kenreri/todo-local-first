import { usePomodoroStore } from "../store/pomodoroStore";

/** One page owns ticking and controls; other pages mirror its persisted clock. */
export function connectPomodoroRuntime() {
  const manager = navigator.locks;
  if (!manager) return () => {};
  usePomodoroStore.getState().synchronizeRuntime(false);
  const controller = new AbortController();
  let release: () => void = () => {};
  let owns = false;
  let disposed = false;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const sync = () => {
    if (!owns && !disposed) usePomodoroStore.getState().synchronizeRuntime(false);
  };
  const storage = (event: StorageEvent) => {
    if (event.key === "todo-pomodoro-runtime-v1") sync();
  };
  const request = manager.request("todo-local-first:pomodoro-v1", { signal: controller.signal }, async () => {
    if (disposed) return;
    owns = true;
    usePomodoroStore.getState().synchronizeRuntime(true);
    await held;
  });
  void request.catch((error: unknown) => {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.error("Could not coordinate the focus timer", error);
    }
  });
  window.addEventListener("storage", storage);
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
    release();
    usePomodoroStore.getState().disconnectRuntime();
    window.removeEventListener("storage", storage);
  };
  return cleanup;
}
