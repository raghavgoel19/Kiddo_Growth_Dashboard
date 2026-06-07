export function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
}

export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return 'Guest'
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return 'Guest'
  return `+91 ****${digits.slice(-4)}`
}

export function guestDisplayName(order: { id: string; customer?: { phone?: string | null } | null }): string {
  if (order.customer?.phone) return maskPhone(order.customer.phone)
  const suffix = order.id.replace(/\D/g, '').slice(-4) || order.id.slice(-4)
  return `Guest #${suffix}`
}

export function formatIST(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatMonthLabel(dateStr: string): string {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(d)
}

export function timeAgo(date: Date | null): string {
  if (!date) return 'never'
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.floor(hours / 24)} days ago`
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function parseMoney(value: string | number | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  return parseFloat(value) || 0
}

export function pctChange(
  current: number,
  previous: number
): { value: string; positive: boolean } {
  if (previous === 0) return { value: 'N/A', positive: true }
  const pct = ((current - previous) / previous) * 100
  return { value: `${Math.abs(pct).toFixed(1)}%`, positive: pct >= 0 }
}

export function formatPctDelta(current: number, previous: number): string {
  const { value, positive } = pctChange(current, previous)
  if (value === 'N/A') return 'N/A'
  return `${positive ? '▲' : '▼'} ${value}`
}
