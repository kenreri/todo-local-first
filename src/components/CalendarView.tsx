import { useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import zhCnLocale from "@fullcalendar/core/locales/zh-cn";
import type { DatesSetArg, EventDropArg, EventInput } from "@fullcalendar/core";
import { addDays, endOfMonth, startOfMonth, todayKey } from "../lib/dates";
import { isAnimeScheduled } from "../lib/anime";
import { occurrencesForRange } from "../lib/repeat";
import { useTodoStore } from "../store/todoStore";
import { ui } from "../i18n/messages";
import { TaskViewSwitch } from "./TaskViewSwitch";
import { PageHeader } from "./PageHeader";
import { useSaveFeedback } from "../hooks/useSaveFeedback";

export function CalendarView() {
  const locale = useTodoStore((s) => s.locale);
  const tasks = useTodoStore((s) => s.tasks);
  const anime = useTodoStore((s) => s.anime);
  const selectTask = useTodoStore((s) => s.selectTask);
  const setView = useTodoStore((s) => s.setView);
  const setTaskScheduledDate = useTodoStore((s) => s.setTaskScheduledDate);
  const t = ui(locale);
  const calendarRef = useRef<FullCalendar | null>(null);
  const savingRef = useRef(false);
  const { run, saving, failed } = useSaveFeedback();
  const [retryMove, setRetryMove] = useState<{ taskId: string; date: string } | null>(null);

  const saveMove = async (taskId: string, date: string, revert?: () => void) => {
    if (savingRef.current) {
      revert?.();
      return;
    }
    savingRef.current = true;
    const original = useTodoStore.getState().tasks.find((task) => task.id === taskId);
    setRetryMove({ taskId, date });
    const saved = await run(() => setTaskScheduledDate(taskId, date));
    if (saved) setRetryMove(null);
    else if (
      calendarRef.current && original &&
      useTodoStore.getState().tasks.find((task) => task.id === taskId) === original
    ) revert?.();
    // A newer persisted snapshot already replaced the event; do not undo it.
    // Release only after reverting, so an older failure cannot undo a newer drop.
    savingRef.current = false;
  };

  const anchor = todayKey();
  const [visibleRange, setVisibleRange] = useState(() => ({
    from: addDays(startOfMonth(anchor), -7),
    to: addDays(endOfMonth(anchor), 7),
  }));

  const events = useMemo(() => {
    const roots = tasks.filter((task) => task.parentId == null);
    const taskEvents = occurrencesForRange(
      roots,
      visibleRange.from,
      visibleRange.to,
    ).map((item) => ({
      id: item.virtualId,
      title: item.task.title,
      start: item.date,
      allDay: true,
      editable: !item.isVirtual,
      className: "fc-event-task",
      extendedProps: {
        taskId: item.task.id,
        isVirtual: item.isVirtual,
      },
    }));
    const animeEvents: EventInput[] = [];
    let date = visibleRange.from;
    while (date <= visibleRange.to) {
      for (const item of anime) {
        if (!isAnimeScheduled(item, date)) continue;
        animeEvents.push({
          id: `anime:${item.id}:${date}`,
          title: `${item.emoji} ${item.title} · ${item.currentEpisode}`,
          start: date,
          allDay: true,
          editable: false,
          className: "fc-event-anime",
          extendedProps: { animeId: item.id },
        });
      }
      date = addDays(date, 1);
    }
    return [...taskEvents, ...animeEvents];
  }, [tasks, anime, visibleRange]);

  const updateVisibleRange = (info: DatesSetArg) => {
    const from = info.startStr.slice(0, 10);
    const to = addDays(info.endStr.slice(0, 10), -1);
    setVisibleRange((current) =>
      current.from === from && current.to === to ? current : { from, to },
    );
  };

  return (
    <section className="min-w-0 space-y-6">
      <PageHeader title={t.tasks} description={t.calendarSubtitle} actions={<TaskViewSwitch />} />
      {saving ? <p role="status" className="text-sm text-[var(--muted)]">{t.taskSaving}</p> : null}
      {failed ? <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-[var(--danger)]">
        <span>{t.taskSaveFailed}</span>
        {retryMove ? <button type="button" disabled={saving} className="ui-button-secondary min-h-10 px-3 py-2" onClick={() => void saveMove(retryMove.taskId, retryMove.date)}>{locale === "zh" ? "重试改期" : "Retry reschedule"}</button> : null}
      </div> : null}
      <div className="todo-calendar ui-card min-w-0 overflow-hidden p-3 md:p-5">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={locale === "zh" ? zhCnLocale : "en"}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "",
          }}
          height="auto"
          editable
          eventAllow={() => !savingRef.current}
          datesSet={updateVisibleRange}
          events={events}
          eventClick={(info) => {
            if (savingRef.current) return;
            const animeId = info.event.extendedProps.animeId as
              string | undefined;
            if (animeId) {
              setRetryMove(null);
              void run(() => setView("anime"));
              return;
            }
            const taskId = info.event.extendedProps.taskId as string;
            selectTask(taskId);
          }}
          eventDrop={(info: EventDropArg) => {
            if (info.event.extendedProps.animeId) {
              info.revert();
              return;
            }
            const taskId = info.event.extendedProps.taskId as string;
            const isVirtual = Boolean(info.event.extendedProps.isVirtual);
            const date = info.event.startStr.slice(0, 10);
            if (isVirtual) {
              info.revert();
              return;
            }
            void saveMove(taskId, date, () => info.revert());
          }}
        />
      </div>
    </section>
  );
}
