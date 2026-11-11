import { useEffect, useRef, useState } from "react";
import { ui } from "../i18n/messages";
import { useLocalDate } from "../hooks/useLocalDate";
import { addDays } from "../lib/dates";
import { useTodoStore } from "../store/todoStore";
import type { TaskRecord } from "../types";

/** Reuses scheduledDate; hard deadlines and recurring anchors are untouched. */
export function TaskScheduleControl({ task, compact = false, onChange, saveDate }: {
  task: TaskRecord;
  compact?: boolean;
  onChange?: (date: string | null) => void;
  saveDate?: (date: string | null) => Promise<boolean>;
}) {
  const locale = useTodoStore((state) => state.locale);
  const updateTask = useTodoStore((state) => state.updateTask);
  const t = ui(locale);
  const [later, setLater] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const today = useLocalDate();
  const mounted = useRef(true);
  const busy = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [futureDate, setFutureDate] = useState(task.scheduledDate && task.scheduledDate > today ? task.scheduledDate : addDays(today, 1));
  const change = async (date: string | null) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(false);
    try {
      if (saveDate) {
        if (!(await saveDate(date))) return;
      } else await updateTask(task.id, { scheduledDate: date, ...(!date ? { scheduledTime: null } : {}) });
      if (!mounted.current) return;
      onChange?.(date);
      setLater(false);
    } catch {
      if (mounted.current) setError(true);
    } finally {
      busy.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap gap-1.5" aria-label={`${t.planTask} ${task.title}`}>
        {([
          [null, task.repeatRule ? t.recurringPlan : t.unscheduled],
          [today, t.addToToday],
        ] as const).map(([date, label]) => (
          <button key={label} type="button" disabled={saving} aria-pressed={task.scheduledDate === date}
            onClick={() => void change(date)}
            className={`${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"} min-h-10 rounded-[var(--radius-control)] border disabled:opacity-50 ${task.scheduledDate === date ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]"}`}>
            {label}
          </button>
        ))}
        <button type="button" disabled={saving} aria-expanded={later} onClick={() => setLater(!later)}
          className={`ui-button-secondary min-h-10 ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}>
          {t.doLater}
        </button>
      </div>
      {later ? <label className="grid gap-1 text-xs text-[var(--muted)]">
        {t.pickWorkDay}
        <input type="date" aria-label={`${t.pickWorkDay} ${task.title}`} min={addDays(today, 1)}
          value={futureDate}
          disabled={saving} className="ui-input max-w-full px-2 py-2"
          onChange={(event) => setFutureDate(event.target.value)}
          onBlur={(event) => setFutureDate(event.target.value)} />
        <button type="button" disabled={saving || !futureDate || futureDate <= today} className="ui-button-primary px-2 py-2 text-xs" onClick={() => void change(futureDate)}>{t.save}</button>
        <button type="button" disabled={saving} className="ui-button-secondary px-2 py-2 text-xs" onClick={() => void change(addDays(today, 1))}>{t.doTomorrow}</button>
      </label> : null}
      {error ? <p role="alert" className="text-xs text-[var(--danger)]">{t.taskSaveFailed}</p> : null}
    </div>
  );
}
