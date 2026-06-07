import { startOfDay, endOfDay, subDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { FullDateRange, Order } from '../api/types'

export const IST = 'Asia/Kolkata'
const DAY_MS = 86_400_000

/** Parse YYYY-MM-DD as IST start of that calendar day. */
export function parseDateInputIST(dateStr: string): Date {
  return toZonedTime(new Date(`${dateStr}T00:00:00`), IST)
}

export function formatCustomRangeLabel(from: string, to: string): string {
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-IN', {
      timeZone: IST,
      day: 'numeric',
      month: 'short',
    }).format(parseDateInputIST(d))
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
}

export function nowIST(): Date {
  return toZonedTime(new Date(), IST)
}

export function todayStartIST(): Date {
  return startOfDay(nowIST())
}

export function yesterdayStartIST(): Date {
  return startOfDay(subDays(nowIST(), 1))
}

export function sameDayLastWeekIST(): Date {
  return startOfDay(subDays(nowIST(), 7))
}

export function toIST(dateStr: string): Date {
  return toZonedTime(new Date(dateStr), IST)
}

export function isToday(dateStr: string): boolean {
  const d = toIST(dateStr)
  const today = todayStartIST()
  return d >= today && d < new Date(today.getTime() + DAY_MS)
}

export function isYesterday(dateStr: string): boolean {
  const d = toIST(dateStr)
  const yest = yesterdayStartIST()
  return d >= yest && d < todayStartIST()
}

export function isSameDayLastWeek(dateStr: string): boolean {
  const d = toIST(dateStr)
  const sdlw = sameDayLastWeekIST()
  return d >= sdlw && d < new Date(sdlw.getTime() + DAY_MS)
}

export function getHourIST(dateStr: string): number {
  return toIST(dateStr).getHours()
}

/** Minutes since midnight IST (includes seconds as fraction). */
export function getTimeOfDayMinutesIST(dateStr: string): number {
  const d = toIST(dateStr)
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60
}

export function getNowTimeOfDayMinutesIST(): number {
  const now = nowIST()
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
}

export function getCurrentHourIST(): number {
  return nowIST().getHours()
}

/** True if order time-of-day (IST) is at or before right now. */
export function isAtOrBeforeSameTimeOfDayIST(dateStr: string): boolean {
  return getTimeOfDayMinutesIST(dateStr) <= getNowTimeOfDayMinutesIST()
}

export function filterOrdersThroughSameTimeOfDay(orders: Order[]): Order[] {
  return orders.filter((o) => isAtOrBeforeSameTimeOfDayIST(o.created_at))
}

export function getIntradayComparisonTimeLabel(): string {
  return formatTimeIST(new Date())
}

export function filterOrdersByPeriod(orders: Order[], period: FullDateRange): Order[] {
  if (period === 'all') return orders
  if (period === 'today') return orders.filter((o) => isToday(o.created_at))
  if (period === 'yesterday') return orders.filter((o) => isYesterday(o.created_at))

  const daysMap: Record<Exclude<FullDateRange, 'all' | 'today' | 'yesterday'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '12m': 365,
  }
  const cutoff = startOfDay(subDays(nowIST(), daysMap[period]))
  return orders.filter((o) => toIST(o.created_at) >= cutoff)
}

export function filterOrdersByCustomRange(orders: Order[], from: string, to: string): Order[] {
  const start = startOfDay(parseDateInputIST(from))
  const end = endOfDay(parseDateInputIST(to))
  return orders.filter((o) => {
    const d = toIST(o.created_at)
    return d >= start && d <= end
  })
}

export function formatTodayHeader(): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

export function formatTimeIST(date: Date): string {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
