import type { Project } from './model'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function label(date: string): string {
  const [year, month] = date.split('-')
  return month ? `${MONTHS[Number(month) - 1]} ${year}` : year
}

export function formatPeriod(period: Project['period']): string {
  const start = label(period.start)
  if (!period.end || period.end === 'Present') return `${start} – Present`
  const end = label(period.end)
  return start === end ? start : `${start} – ${end}`
}

function compact(date: string): string {
  return date.split('-').slice(0, 2).join('.')
}

/** Short form for narrow date columns: "2025.06 – 2026.02", "2026.02 –" while ongoing. */
export function formatPeriodCompact(period: Project['period']): string {
  const start = compact(period.start)
  if (!period.end || period.end === 'Present') return `${start} –`
  const end = compact(period.end)
  return start === end ? start : `${start} – ${end}`
}
