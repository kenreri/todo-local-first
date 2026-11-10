import type { Priority } from '../types'

/** higher number = more urgent; used for list/board/today sorting */
const RANK: Record<Priority, number> = {
  high: 4,
  medium: 3,
  low: 2,
  none: 1,
}

export function priorityRank(priority: Priority | string | null | undefined): number {
  return RANK[normalizePriority(priority)]
}

export function normalizePriority(priority: Priority | string | null | undefined): Priority {
  if (priority === 'high' || priority === 'medium' || priority === 'low' || priority === 'none') {
    return priority
  }
  return 'none'
}

export function comparePriorityDesc(
  a: { priority: Priority },
  b: { priority: Priority },
): number {
  return priorityRank(b.priority) - priorityRank(a.priority)
}

/** CSS custom property name for this priority token */
export function priorityVar(priority: Priority): string {
  return `var(--priority-${normalizePriority(priority)})`
}
