export interface PendingPatchState<T extends object> {
  patch: Partial<T>;
  saving: boolean;
  failed: boolean;
  pending: boolean;
}

/** Queues a mounted editor's intentions. Database transactions still own data safety. */
export function createPendingPatch<T extends object>(
  persist: (patch: Partial<T>) => Promise<unknown>,
) {
  let state: PendingPatchState<T> = { patch: {}, saving: false, failed: false, pending: false };
  let active = true;
  let generation = 0;
  let revision = 0;
  let running: Promise<boolean> | null = null;
  const revisions = new Map<keyof T, number>();
  const listeners = new Set<() => void>();

  const publish = (next: PendingPatchState<T>) => {
    state = next;
    if (active) listeners.forEach((listener) => listener());
  };

  const drain = async (startedGeneration: number): Promise<boolean> => {
    while (active && startedGeneration === generation && state.pending) {
      const patch = { ...state.patch };
      const submitted = new Map(revisions);
      publish({ ...state, saving: true, failed: false });
      try {
        await persist(patch);
      } catch {
        if (active && startedGeneration === generation) {
          publish({ ...state, saving: false, failed: true });
        }
        return false;
      }
      if (!active || startedGeneration !== generation) return false;
      const remaining = { ...state.patch };
      for (const key in patch) {
        if (revisions.get(key) === submitted.get(key)) {
          delete remaining[key];
          revisions.delete(key);
        }
      }
      publish({ patch: remaining, saving: true, failed: false, pending: revisions.size > 0 });
    }
    if (!active || startedGeneration !== generation) return false;
    publish({ ...state, saving: false });
    return !state.pending;
  };

  const flush = (): Promise<boolean> => {
    if (!active) return Promise.resolve(false);
    if (running) return running;
    if (!state.pending) return Promise.resolve(true);
    const promise = drain(generation).finally(() => {
      if (running === promise) running = null;
    });
    running = promise;
    return promise;
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    submit: (patch: Partial<T>): Promise<boolean> => {
      if (!active) return Promise.resolve(false);
      const next = { ...state.patch };
      for (const key in patch) {
        const value = patch[key];
        if (value === undefined) continue;
        if (!revisions.has(key) || !Object.is(next[key], value)) {
          next[key] = value;
          revisions.set(key, ++revision);
        }
      }
      publish({ ...state, patch: next, pending: revisions.size > 0 });
      return flush();
    },
    retry: flush,
    flush,
    activate: () => { active = true; },
    dispose: () => {
      active = false;
      generation++;
      running = null;
      revisions.clear();
      state = { patch: {}, saving: false, failed: false, pending: false };
    },
  };
}
