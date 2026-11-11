// One clock for date-sensitive views and minute-based reminders. Hidden tabs catch
// up on visibility/pageshow/focus instead of keeping decoration-era timers alive.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;
let minute = Math.floor(Date.now() / 60_000) * 60_000;

export function currentMinute() {
  return minute;
}

function refresh() {
  const next = Math.floor(Date.now() / 60_000) * 60_000;
  if (next !== minute) {
    minute = next;
    listeners.forEach((listener) => listener());
  }
  clearTimeout(timer);
  if (document.visibilityState !== 'hidden') {
    timer = setTimeout(refresh, 60_000 - Date.now() % 60_000);
  }
}

export function subscribeLocalClock(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refresh);
    refresh();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refresh);
    }
  };
}
