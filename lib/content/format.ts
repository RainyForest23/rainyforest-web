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
