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

export function CalendarView() {
  const locale = useTodoStore((s) => s.locale);
  const tasks = useTodoStore((s) => s.tasks);
  const anime = useTodoStore((s) => s.anime);
  const selectTask = useTodoStore((s) => s.selectTask);
  const setView = useTodoStore((s) => s.setView);
  const setTaskScheduledDate = useTodoStore((s) => s.setTaskScheduledDate);
  const t = ui(locale);
  const calendarRef = useRef<FullCalendar | null>(null);

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
          datesSet={updateVisibleRange}
          events={events}
          eventClick={(info) => {
            const animeId = info.event.extendedProps.animeId as
              string | undefined;
            if (animeId) {
              void setView("anime");
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
            void setTaskScheduledDate(taskId, date);
          }}
        />
      </div>
    </section>
  );
}
