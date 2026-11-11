import { CheckCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { todayKey, addDays } from '../lib/dates'
import { ui } from '../i18n/messages'
import { useTodoStore } from '../store/todoStore'
import { useSaveFeedback } from '../hooks/useSaveFeedback'
import { useLocalDate } from '../hooks/useLocalDate'

export function BatchBar() {
  const locale = useTodoStore((s) => s.locale)
  const lists = useTodoStore((s) => s.lists)
  const checkedIds = useTodoStore((s) => s.checkedIds)
  const clearChecked = useTodoStore((s) => s.clearChecked)
  const batchComplete = useTodoStore((s) => s.batchComplete)
  const batchDelete = useTodoStore((s) => s.batchDelete)
  const batchMove = useTodoStore((s) => s.batchMove)
  const batchSchedule = useTodoStore((s) => s.batchSchedule)
  const today = useLocalDate()
  const [later, setLater] = useState(false)
  const [date, setDate] = useState(addDays(todayKey(), 1))
  const [moveTarget, setMoveTarget] = useState('')
  const { run, saving, failed } = useSaveFeedback()
  const schedule = async (value: string | null) => {
    if (await run(() => batchSchedule(checkedIds, value))) setLater(false)
  }
  const move = async (listId: string) => {
    setMoveTarget(listId)
    if (await run(() => batchMove(checkedIds, listId))) setMoveTarget('')
  }
  const t = ui(locale)

  if (checkedIds.length === 0) return null

  return (
    <div aria-busy={saving} className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2">
      <span className="text-sm font-medium">
        {t.selectedCount.replace('{n}', String(checkedIds.length))}
      </span>
      <button
        type="button"
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--on-accent)]"
        onClick={() => void run(() => batchComplete(checkedIds, true))}
      >
        <CheckCheck className="size-3.5" />
        {t.batchComplete}
      </button>
      <button
        type="button"
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm"
        onClick={() => void run(() => batchComplete(checkedIds, false))}
      >
        {t.batchReopen}
      </button>
      <select
        className="rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm outline-none"
        aria-label={t.batchMove}
        disabled={saving}
        value={moveTarget}
        onChange={(e) => {
          const listId = e.target.value
          if (!listId) return
          void move(listId)
        }}
      >
        <option value="" disabled>
          {t.batchMove}
        </option>
        {lists.map((list) => (
          <option key={list.id} value={list.id}>
            {list.name}
          </option>
        ))}
      </select>
      {failed && moveTarget ? <button type="button" disabled={saving} className="ui-button-secondary min-h-10 px-3 py-2 text-sm" onClick={() => void move(moveTarget)}>{locale === 'zh' ? '重试移动' : 'Retry move'}</button> : null}
      <button
        type="button"
        disabled={saving}
        className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-[var(--danger)]"
        onClick={() => {
          if (window.confirm(t.batchDeleteConfirm)) void run(() => batchDelete(checkedIds))
        }}
      >
        <Trash2 className="size-3.5" />
        {t.delete}
      </button>
      <button type="button" disabled={saving} className="ui-button-secondary min-h-10 px-3 py-2 text-sm" onClick={() => void schedule(today)}>{t.addToToday}</button>
      <button type="button" disabled={saving} className="ui-button-secondary min-h-10 px-3 py-2 text-sm" onClick={() => void schedule(null)}>{t.unscheduled}</button>
      <button type="button" disabled={saving} aria-expanded={later} className="ui-button-secondary min-h-10 px-3 py-2 text-sm" onClick={() => setLater(!later)}>{t.doLater}</button>
      {later ? <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm">{t.pickWorkDay}<input type="date" disabled={saving} min={addDays(today, 1)} value={date} onChange={e => setDate(e.target.value)} onBlur={e => setDate(e.target.value)} className="ui-input min-w-0 px-2 py-2" /><button type="button" disabled={saving || !date || date <= today} className="ui-button-secondary px-3 py-2" onClick={() => void schedule(date)}>{t.save}</button></label> : null}
      {saving ? <p role="status" className="text-sm text-[var(--muted)]">{t.taskSaving}</p> : null}
      {failed ? <p role="alert" className="text-sm text-[var(--danger)]">{t.taskSaveFailed}</p> : null}
      <button
        type="button"
        disabled={saving}
        className="ml-auto rounded-xl px-3 py-1.5 text-sm text-[var(--muted)]"
        onClick={() => clearChecked()}
      >
        {t.clearSelection}
      </button>
    </div>
  )
}
