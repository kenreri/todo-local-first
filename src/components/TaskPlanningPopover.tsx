import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, X } from "lucide-react";
import { ui } from "../i18n/messages";
import { popoverPosition } from "../lib/popoverPosition";
import { useTodoStore } from "../store/todoStore";
import type { TaskRecord } from "../types";
import { TaskScheduleControl } from "./TaskScheduleControl";

export function TaskPlanningPopover({task, open, onOpen, onClose}: {
  task: TaskRecord; open: boolean; onOpen: () => void; onClose: () => void;
}) {
  const locale = useTodoStore(s=>s.locale);
  const lists = useTodoStore(s=>s.lists);
  const updateTask = useTodoStore(s=>s.updateTask);
  const t = ui(locale);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const generation = useRef(0);
  useEffect(() => {
    const attempt = ++generation.current;
    setSaving(false); setError(false); setTargetList(null);
    return () => { generation.current = attempt + 1; };
  }, [open, task.id]);
  const [position, setPosition] = useState({left:12, top:12, maxHeight:400});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [targetList, setTargetList] = useState<string | null>(null);
  useLayoutEffect(()=>{
    if (!open || !trigger.current || !panel.current) return;
    const place = () => {
      if (!trigger.current || !panel.current) return;
      const rect = trigger.current.getBoundingClientRect();
      setPosition(popoverPosition(rect, {width:panel.current.offsetWidth,height:panel.current.scrollHeight}, {width:window.innerWidth,height:window.innerHeight}));
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel.current);
    window.addEventListener("resize",place);
    return ()=>{observer.disconnect();window.removeEventListener("resize",place)};
  },[open]);
  useEffect(()=>{
    if (!open) return;
    panel.current?.querySelector<HTMLSelectElement>("select")?.focus();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault();event.stopPropagation();onClose();trigger.current?.focus(); }
    };
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown",outside);
    window.addEventListener("keydown",escape,true);
    window.addEventListener("scroll",scroll,true);
    return ()=>{document.removeEventListener("pointerdown",outside);window.removeEventListener("keydown",escape,true);window.removeEventListener("scroll",scroll,true)};
  },[open,onClose]);
  const move = async (listId: string) => {
    const attempt = generation.current;
    setTargetList(listId);
    setSaving(true);setError(false);
    try {
      await updateTask(task.id,{listId});
      if (generation.current === attempt) { onClose();trigger.current?.focus(); }
    }
    catch { if (generation.current === attempt) setError(true); }
    finally { if (generation.current === attempt) setSaving(false); }
  };
  return <>
    <button ref={trigger} type="button" aria-label={t.planTask+" "+task.title} title={t.planTask} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined}
      onClick={()=>open?onClose():onOpen()}
      className={"grid size-10 shrink-0 place-items-center rounded-[var(--radius-control)] border transition " + (open ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--accent)]")}>
      <CalendarClock className="size-[18px]" aria-hidden="true" />
    </button>
    {open ? createPortal(<div ref={panel} id={id} role="dialog" aria-label={t.planTask+" "+task.title}
      style={position} className="fixed z-50 w-[300px] max-w-[calc(100vw-24px)] overflow-y-auto rounded-[var(--radius-panel)] border border-[var(--line)] bg-[var(--nav-bg)] p-4 text-[var(--ink)] shadow-[var(--shadow-floating)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0"><p className="text-sm font-semibold">{t.planTask}</p><p className="truncate text-xs text-[var(--muted)]">{task.title}</p></div>
        <button type="button" aria-label={t.cancel} onClick={()=>{onClose();trigger.current?.focus()}} className="ui-button-secondary grid size-10 shrink-0 place-items-center"><X className="size-4" /></button>
      </div>
      <label className="mb-4 grid gap-1.5 text-xs text-[var(--muted)]">{t.lists}
        <select aria-label={t.lists+" "+task.title} disabled={saving} value={targetList ?? task.listId}
          className="ui-input min-h-10 w-full px-3 py-2 text-sm" onChange={event=>void move(event.target.value)}>
          {lists.map(list=><option key={list.id} value={list.id}>{list.name}</option>)}
        </select>
      </label>
      <TaskScheduleControl task={task} onChange={()=>{onClose();trigger.current?.focus()}} />
      {error?<div role="alert" className="mt-2 space-y-2 text-xs text-[var(--danger)]">
        <p>{t.taskSaveFailed}</p>
        <button type="button" className="ui-button-secondary min-h-10 px-3 py-2" disabled={saving} onClick={() => { if (targetList) void move(targetList); }}>{locale === "zh" ? "重试保存" : "Retry save"}</button>
      </div>:null}
    </div>,document.body):null}
  </>;
}
