import { ui, priorityLabel } from '../i18n/messages'
import { normalizePriority, priorityVar } from '../lib/priority'
import type { Locale, Priority } from '../types'

export function PriorityBadge({
  priority,
  locale,
}: {
  priority: Priority
  locale: Locale
}) {
  const level = normalizePriority(priority)
  const color = priorityVar(level)
  const label = priorityLabel(locale, level)

  if (level === 'none') {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
        style={{
          background: 'var(--chip)',
          color: 'var(--muted)',
        }}
      >
        <span className="size-1.5 rounded-full bg-[var(--muted)] opacity-50" />
        {label}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        color,
      }}
      title={`${ui(locale).priority}: ${label}`}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}
