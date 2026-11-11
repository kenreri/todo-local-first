import { useSaveFeedback } from "../hooks/useSaveFeedback";
import { useLocalDate } from "../hooks/useLocalDate";
import {
  Check,
  Edit3,
  Flame,
  Plus,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { ui } from "../i18n/messages";
import {
  calculateHabitStats,
  habitEditPatch,
  getHabitCheckIn,
  isHabitScheduled,
} from "../lib/habits";
import { useTodoStore } from "../store/todoStore";
import type { HabitFrequency, HabitRecord } from "../types";
import { PageHeader } from "./PageHeader";

interface HabitFormState {
  title: string;
  emoji: string;
  frequency: HabitFrequency;
  weekdays: number[];
  reminderTime: string;
}

const emptyForm: HabitFormState = {
  title: "",
  emoji: "\u{1F3C3}",
  frequency: "daily",
  weekdays: [],
  reminderTime: "",
};

export function HabitView() {
  const locale = useTodoStore((state) => state.locale);
  const habits = useTodoStore((state) => state.habits);
  const checkIns = useTodoStore((state) => state.habitCheckIns);
  const persistCreateHabit = useTodoStore((state) => state.createHabit);
  const persistUpdateHabit = useTodoStore((state) => state.updateHabit);
  const persistDeleteHabit = useTodoStore((state) => state.deleteHabit);
  const persistSetHabitCheckIn = useTodoStore((state) => state.setHabitCheckIn);
  const t = ui(locale);
  const { run, saving, failed } = useSaveFeedback();
  const createHabit = (...args: Parameters<typeof persistCreateHabit>) => run(() => persistCreateHabit(...args));
  const updateHabit = (...args: Parameters<typeof persistUpdateHabit>) => run(() => persistUpdateHabit(...args));
  const deleteHabit = (...args: Parameters<typeof persistDeleteHabit>) => run(() => persistDeleteHabit(...args));
  const setHabitCheckIn = (...args: Parameters<typeof persistSetHabitCheckIn>) => run(() => persistSetHabitCheckIn(...args));

  const today = useLocalDate();
  const [dateOverride, setSelectedDate] = useState<string | null>(null);
  const selectedDate = dateOverride ?? today;
  const [formOpen, setFormOpen] = useState(false);
  const [deletePendingId, setDeletePendingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<HabitFormState>(emptyForm);
  const [baseline, setBaseline] = useState<HabitFormState>(emptyForm);
  const [notificationPermission, setNotificationPermission] = useState<
    NotificationPermission | "unsupported"
  >(() => ("Notification" in window ? Notification.permission : "unsupported"));

  const scheduledHabits = useMemo(
    () => habits.filter((habit) => isHabitScheduled(habit, selectedDate)),
    [habits, selectedDate],
  );

  const openCreate = () => {
    if (saving) return;
    setEditingId(null);
    setBaseline(emptyForm);
    setForm({ ...emptyForm });
    setFormOpen(true);
  };

  const openEdit = (habit: HabitRecord) => {
    if (saving) return;
    setEditingId(habit.id);
    const next = {
      title: habit.title,
      emoji: habit.emoji,
      frequency: habit.frequency,
      weekdays: [...habit.weekdays],
      reminderTime: habit.reminderTime ?? "",
    };
    setBaseline(next);
    setForm(next);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setBaseline(emptyForm);
    setForm({ ...emptyForm });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.title.trim()) return;
    if (form.frequency === "weekly" && form.weekdays.length === 0) return;
    const payload = {
      ...form,
      reminderTime: form.reminderTime || null,
    };
    const saved = editingId
      ? await updateHabit(editingId, habitEditPatch({ ...baseline, reminderTime: baseline.reminderTime || null }, payload))
      : await createHabit(payload);
    if (saved) closeForm();
  };

  return (
    <section className="space-y-6" aria-busy={saving}>
      {failed ? <p role="alert" className="ui-card-flat p-3 text-sm text-[var(--danger)]">{locale === "zh" ? "操作未保存，请重试。编辑内容已保留。" : "Could not save. Your edits are kept; please retry."}</p> : null}
      <PageHeader
        title={t.habitTitle}
        description={t.habitSubtitle}
        actions={
          <>
          {notificationPermission === "default" ? (
            <button
              type="button"
              className="ui-button-secondary px-4 py-2 text-sm"
              onClick={async () => {
                const next = await Notification.requestPermission();
                setNotificationPermission(next);
              }}
            >
              {t.habitEnableNotifications}
            </button>
          ) : null}
          <button
            type="button"
            className="ui-button-primary inline-flex items-center gap-2 px-4 py-2"
            onClick={openCreate}
          >
            <Plus className="size-4" />
            {t.newHabit}
          </button>
          </>
        }
      />

      {notificationPermission === "denied" ? (
        <p className="ui-card-flat px-4 py-3 text-sm text-[var(--muted)]">
          {t.habitReminderDenied}
        </p>
      ) : null}

      {formOpen ? (
        <HabitForm
          form={form}
          editing={editingId != null}
          locale={locale}
          onChange={setForm}
          onCancel={() => { if (!saving) closeForm(); }}
          saving={saving}
          onSubmit={submit}
        />
      ) : null}

      <div className="ui-card p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ink)]">
              {t.habitToday}
            </h3>
            <p className="text-xs text-[var(--muted)]">
              {selectedDate === today ? today : selectedDate}
            </p>
          </div>
          <details><summary className="min-h-10 cursor-pointer py-2 text-sm text-[var(--muted)]">{t.habitDetails}</summary>
          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            {t.habitCheckInDate}
            <input
              type="date"
              className="ui-input px-3 py-2"
              value={selectedDate}
              max={today}
              onChange={(event) => setSelectedDate(event.target.value === today ? null : event.target.value || null)}
            />
          </label>
          </details>
        </div>

        {scheduledHabits.length === 0 ? (
          <p className="ui-card-flat mt-4 p-4 text-sm text-[var(--muted)]">
            {habits.length === 0 ? t.habitEmpty : t.habitEmptyDate}
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {scheduledHabits.map((habit) => {
              const checkIn = getHabitCheckIn(checkIns, habit.id, selectedDate);
              return (
                <article
                  key={habit.id}
                  className="ui-card-flat p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="text-2xl" aria-hidden="true">
                        {habit.emoji}
                      </span>
                      <div className="min-w-0">
                        <h4 className="truncate font-medium text-[var(--ink)]">
                          {habit.title}
                        </h4>
                        <p className="text-xs text-[var(--muted)]">
                          {habit.reminderTime ?? t.habitNoReminder}
                        </p>
                      </div>
                    </div>
                    {checkIn ? (
                      <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs text-[var(--accent)]">
                        {checkIn.status === "completed"
                          ? t.habitDone
                          : t.habitSkip}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={checkIn?.status === "completed"}
                      className="ui-button-primary inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50"
                      onClick={() =>
                        void setHabitCheckIn(
                          habit.id,
                          selectedDate,
                          "completed",
                        )
                      }
                    >
                      <Check className="size-4" /> {selectedDate === today ? t.todayDone : t.habitDone}
                    </button>
                    <details><summary className="min-h-10 cursor-pointer px-3 py-2 text-sm text-[var(--muted)]">{t.habitDetails}</summary><div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="ui-button-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm"
                      onClick={() =>
                        void setHabitCheckIn(habit.id, selectedDate, "skipped")
                      }
                    >
                      <SkipForward className="size-4" /> {t.habitSkip}
                    </button>
                    {checkIn ? (
                      <button
                        type="button"
                        className="rounded-[var(--radius-control)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-[var(--hover)]"
                        onClick={() =>
                          void setHabitCheckIn(habit.id, selectedDate, null)
                        }
                      >
                        {t.habitUndo}
                      </button>
                    ) : null}
                    </div></details>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <details>
        <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-[var(--muted)]">{t.habitManage} · {habits.length}</summary>
        {habits.length === 0 ? (
          <p className="ui-card p-5 text-[var(--muted)]">
            {t.habitEmpty}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {habits.map((habit) => {
              const stats = calculateHabitStats(habit, checkIns, today);
              return (
                <article
                  key={habit.id}
                  className="ui-card p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="text-3xl" aria-hidden="true">
                        {habit.emoji}
                      </span>
                      <div className="min-w-0">
                        <h4 className="truncate font-semibold text-[var(--ink)]">
                          {habit.title}
                        </h4>
                        <p className="text-xs text-[var(--muted)]">
                          {habit.frequency === "daily"
                            ? t.habitDaily
                            : t.habitWeekly}
                          {habit.reminderTime ? ` · ${habit.reminderTime}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label={t.editHabit}
                        className="rounded-[var(--radius-control)] p-2 text-[var(--muted)] hover:bg-[var(--hover)]"
                        onClick={() => openEdit(habit)}
                      >
                        <Edit3 className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={deletePendingId === habit.id ? t.confirmDeleteAction : t.deleteHabit}
                        className="rounded-[var(--radius-control)] p-2 text-[var(--danger)] hover:bg-[var(--danger-soft)]"
                        onClick={() => {
                          if (deletePendingId === habit.id) { void deleteHabit(habit.id).then(saved => { if (saved) setDeletePendingId(null); }); }
                          else setDeletePendingId(habit.id);
                        }}
                      >
                        {deletePendingId === habit.id ? t.confirmDeleteAction : <Trash2 className="size-4" />}
                      </button>
                      {deletePendingId === habit.id ? <button type="button" className="ui-button-secondary px-2 py-2 text-xs" onClick={() => setDeletePendingId(null)}>{t.cancel}</button> : null}
                    </div>
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Stat
                      label={t.habitCurrentStreak}
                      value={`${stats.currentStreak}`}
                      icon
                    />
                    <Stat
                      label={t.habitLongestStreak}
                      value={`${stats.longestStreak}`}
                    />
                    <Stat
                      label={t.habitCompletionRate}
                      value={`${stats.completionRate}%`}
                    />
                  </dl>
                </article>
              );
            })}
          </div>
        )}
      </details>
    </section>
  );
}

function HabitForm({
  form,
  editing,
  locale,
  onChange,
  onCancel,
  onSubmit,
  saving,
}: {
  form: HabitFormState;
  editing: boolean;
  locale: "zh" | "en";
  onChange: (next: HabitFormState) => void;
  onCancel: () => void;
  saving: boolean;
  onSubmit: (event: FormEvent) => void;
}) {
  const t = ui(locale);
  return (
    <form
      className="ui-card p-5 md:p-6"
      onSubmit={onSubmit}
    >
      <fieldset disabled={saving}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--ink)]">
          {editing ? t.editHabit : t.newHabit}
        </h3>
        <button
          type="button"
          aria-label={t.cancel}
          className="rounded-[var(--radius-control)] p-2 text-[var(--muted)] hover:bg-[var(--hover)]"
          onClick={onCancel}
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-1.5 text-sm text-[var(--muted)] lg:col-span-2">
          {t.habitName}
          <input
            required
            autoFocus
            className="ui-input px-3 py-2"
            placeholder={t.habitNamePlaceholder}
            value={form.title}
            onChange={(event) =>
              onChange({ ...form, title: event.target.value })
            }
          />
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.habitEmoji}
          <input
            className="ui-input px-3 py-2"
            value={form.emoji}
            onChange={(event) =>
              onChange({ ...form, emoji: event.target.value })
            }
          />
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.habitFrequency}
          <select
            className="ui-input px-3 py-2"
            value={form.frequency}
            onChange={(event) =>
              onChange({
                ...form,
                frequency: event.target.value as HabitFrequency,
              })
            }
          >
            <option value="daily">{t.habitDaily}</option>
            <option value="weekly">{t.habitWeekly}</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm text-[var(--muted)]">
          {t.habitReminderTime}
          <input
            type="time"
            className="ui-input px-3 py-2"
            value={form.reminderTime}
            onChange={(event) =>
              onChange({ ...form, reminderTime: event.target.value })
            }
          />
        </label>
      </div>

      {form.frequency === "weekly" ? (
        <fieldset className="mt-4">
          <legend className="text-sm text-[var(--muted)]">
            {t.repeatWeekdays}
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {t.weekdayShort.map((label, day) => {
              const selected = form.weekdays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={selected}
                  className={
                    selected
                      ? "size-9 rounded-full bg-[var(--accent-soft)] text-sm font-medium text-[var(--accent)]"
                      : "ui-button-secondary size-9 rounded-full text-sm"
                  }
                  onClick={() =>
                    onChange({
                      ...form,
                      weekdays: selected
                        ? form.weekdays.filter((item) => item !== day)
                        : [...form.weekdays, day],
                    })
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="ui-button-secondary px-4 py-2"
          onClick={onCancel}
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          className="ui-button-primary px-4 py-2 disabled:opacity-50"
          disabled={
            !form.title.trim() ||
            (form.frequency === "weekly" && form.weekdays.length === 0)
          }
        >
          {t.saveHabit}
        </button>
      </div>
      </fieldset>
    </form>
  );
}

function Stat({
  label,
  value,
  icon = false,
}: {
  label: string;
  value: string;
  icon?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-control)] bg-[var(--surface)] p-2">
      <dt className="flex items-center justify-center gap-1 text-xs text-[var(--muted)]">
        {icon ? <Flame className="size-3" /> : null}
        {label}
      </dt>
      <dd className="mt-1 font-semibold tabular-nums text-[var(--ink)]">
        {value}
      </dd>
    </div>
  );
}
