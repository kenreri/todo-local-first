import { prepareBackup, replacePreparedBackup } from "./backup";
import { withExclusiveRestore } from "./restoreGuard";
import { usePomodoroStore, invalidateStoredPomodoroRuntime, restorePausedPomodoroRuntime } from "../store/pomodoroStore";

/** Validation never changes runtime. Replacement freezes writes, then reloads all drafts. */
export async function restoreBackupJson(payload: unknown) {
  return restorePreparedBackup(prepareBackup(payload));
}

export async function restorePreparedBackup(prepared: ReturnType<typeof prepareBackup>) {
  await withExclusiveRestore(async () => {
    await usePomodoroStore.getState().suspendForRestore();
    try {
      invalidateStoredPomodoroRuntime();
      await replacePreparedBackup(prepared);
    } catch (error) {
      restorePausedPomodoroRuntime();
      throw error;
    }
    usePomodoroStore.getState().discardForRestore();
  });
  // The write barrier stays sealed even if navigation is delayed or prevented.
  window.location.reload();
}
