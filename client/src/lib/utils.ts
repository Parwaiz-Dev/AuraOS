import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns'

/** Format currency in INR */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Format a date string for display */
export function formatDate(dateStr: string | Date): string {
  const date = new Date(dateStr)
  if (isToday(date)) return `Today, ${format(date, 'h:mm a')}`
  if (isYesterday(date)) return `Yesterday, ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

/** Format relative time (e.g. "5 minutes ago") */
export function formatRelative(dateStr: string | Date): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

/** Format elapsed time as mm:ss */
export function formatElapsed(dateStr: string | Date): string {
  const elapsed = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/** Truncate a string */
export function truncate(str: string, length = 40): string {
  return str.length > length ? str.slice(0, length) + '…' : str
}

/** Get initials from a name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** Debounce a function */
export function debounce<T extends (...args: any[]) => any>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/** Join class names (simple cn utility) */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}
