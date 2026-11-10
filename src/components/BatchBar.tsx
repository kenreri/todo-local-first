import { CheckCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { todayKey, addDays } from '../lib/dates'
import { ui } from '../i18n/messages'
import { useTodoStore } from '../store/todoStore'

export function BatchBar() {
  const locale = useTodoStore((s) => s.locale)
  const lists = useTodoStore((s) => s.lists)
  const checkedIds = useTodoStore((s) => s.checkedIds)
  const clearChecked = useTodoStore((s) => s.clearChecked)
  const batchComplete = useTodoStore((s) => s.batchComplete)
  const batchDelete = useTodoStore((s) => s.batchDelete)
  const batchMove = useTodoStore((s) => s.batchMove)
  const batchSchedule = useTodoStore((s) => s.batchSchedule)
  const [later, setLater] = useState(false)
  const [date, setDate] = useState(addDays(todayKey(), 1))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const schedule = async (value: string | null) => {
    setSaving(true)
    setError(false)
    try { await batchSchedule(checkedIds, value); setLater(false) }
    catch { setError(true) }
    finally { setSaving(false) }
  }
  const t = ui(locale)

  if (checkedIds.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2">
      <span className="text-sm font-medium">
        {t.selectedCount.replace('{n}', String(checkedIds.length))}
      </span>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-sm text-[var(--on-accent)]"
        onClick={() => void batchComplete(checkedIds, true)}
      >
        <CheckCheck className="size-3.5" />
        {t.batchComplete}
      </button>
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-3 py-1.5 text-sm"
        onClick={() => void batchComplete(checkedIds, false)}
      >
        {t.batchReopen}
      </button>
      <select
        className="rounded-xl border border-[var(--line)] bg-[var(--bg-elevated)] px-2 py-1.5 text-sm outline-none"
        defaultValue=""
        onChange={(e) => {
          const listId = e.target.value
          if (!listId) return
          void batchMove(checkedIds, listId)
          e.currentTarget.value = ''
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
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm text-[var(--danger)]"
        onClick={() => {
          if (window.confirm(t.batchDeleteConfirm)) void batchDelete(checkedIds)
        }}
      >
        <Trash2 className="size-3.5" />
        {t.delete}
      </button>
      <button type="button" disabled={saving} className="ui-button-secondary min-h-10 px-3 py-2 text-sm" onClick={() => void schedule(todayKey())}>{t.addToToday}</button>
      <button type="button" disabled={saving} className="ui-button-secondary min-h-10 px-3 py-2 text-sm" onClick={() => void schedule(null)}>{t.unscheduled}</button>
      <button type="button" disabled={saving} aria-expanded={later} className="ui-button-secondary min-h-10 px-3 py-2 text-sm" onClick={() => setLater(!later)}>{t.doLater}</button>
      {later ? <label className="flex min-w-0 flex-wrap items-center gap-2 text-sm">{t.pickWorkDay}<input type="date" min={addDays(todayKey(), 1)} value={date} onChange={e => setDate(e.target.value)} onBlur={e => setDate(e.target.value)} className="ui-input min-w-0 px-2 py-2" /><button type="button" disabled={saving || !date} className="ui-button-secondary px-3 py-2" onClick={() => void schedule(date)}>{t.save}</button></label> : null}
      {error ? <p role="alert" className="text-sm text-[var(--danger)]">{t.taskSaveFailed}</p> : null}
      <button
        type="button"
        className="ml-auto rounded-xl px-3 py-1.5 text-sm text-[var(--muted)]"
        onClick={() => clearChecked()}
      >
        {t.clearSelection}
      </button>
    </div>
  )
}
