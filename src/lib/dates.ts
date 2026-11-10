/** Local calendar helpers using YYYY-MM-DD strings */

export function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayKey(now = new Date()): string {
  return toDateKey(now)
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key)
  date.setDate(date.getDate() + days)
  return toDateKey(date)
}

export function startOfMonth(key: string): string {
  const date = parseDateKey(key)
  date.setDate(1)
  return toDateKey(date)
}

export function endOfMonth(key: string): string {
  const date = parseDateKey(key)
  date.setMonth(date.getMonth() + 1, 0)
  return toDateKey(date)
}

export function compareDateKey(a: string, b: string): number {
  return a.localeCompare(b)
}

export function isBefore(a: string, b: string): boolean {
  return compareDateKey(a, b) < 0
}

export function isAfter(a: string, b: string): boolean {
  return compareDateKey(a, b) > 0
}

export function clampRange(from: string, to: string): { from: string; to: string } {
  return compareDateKey(from, to) <= 0 ? { from, to } : { from: to, to: from }
}
