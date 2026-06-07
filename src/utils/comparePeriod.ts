import { differenceInDays, subDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { Order } from '../api/types'
import type { GlobalFilters } from '../context/DashboardContext'
import { IST, filterOrdersByCustomRange, filterOrdersByPeriod } from './dates'

export interface ComparePeriodResult {
  currentOrders: Order[]
  compareOrders: Order[]
  currentLabel: string
  compareLabel: string
}

function formatRangeLabel(from: string, to: string): string {
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-IN', { timeZone: IST, day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(d + 'T00:00:00')
    )
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to)}`
}

function getCurrentRangeKeys(filters: GlobalFilters): { from: string; to: string } | null {
  if (filters.dateMode === 'custom' && filters.customFrom && filters.customTo) {
    return { from: filters.customFrom, to: filters.customTo }
  }
  const now = toZonedTime(new Date(), IST)
  const end = new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(now)
  const presets: Record<string, number> = {
    today: 0,
    yesterday: 1,
    '7d': 6,
    '30d': 29,
    '90d': 89,
    '12m': 364,
  }
  const days = presets[filters.dateRange]
  if (days == null) return null
  const startDate = subDays(now, days)
  const from = new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(startDate)
  return { from, to: end }
}

export function computeComparePeriod(
  allOrders: Order[],
  filters: GlobalFilters
): ComparePeriodResult | null {
  if (!filters.compareEnabled || !filters.compareMode) return null

  const range = getCurrentRangeKeys(filters)
  if (!range) {
    const currentOrders = filterOrdersByPeriod(allOrders, filters.dateRange)
    return {
      currentOrders,
      compareOrders: [],
      currentLabel: filters.dateRange,
      compareLabel: 'Compare',
    }
  }

  const currentOrders = filterOrdersByCustomRange(allOrders, range.from, range.to)
  const currentLabel = formatRangeLabel(range.from, range.to)

  if (filters.compareMode === 'custom') {
    if (!filters.compareCustomFrom || !filters.compareCustomTo) {
      return { currentOrders, compareOrders: [], currentLabel, compareLabel: 'Custom compare' }
    }
    const compareOrders = filterOrdersByCustomRange(
      allOrders,
      filters.compareCustomFrom,
      filters.compareCustomTo
    )
    return {
      currentOrders,
      compareOrders,
      currentLabel,
      compareLabel: formatRangeLabel(filters.compareCustomFrom, filters.compareCustomTo),
    }
  }

  const spanDays = differenceInDays(new Date(range.to), new Date(range.from)) + 1

  if (filters.compareMode === 'previous') {
    const compareTo = subDays(new Date(range.from + 'T00:00:00'), 1)
    const compareFrom = subDays(compareTo, spanDays - 1)
    const cf = new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(compareFrom)
    const ct = new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(compareTo)
    return {
      currentOrders,
      compareOrders: filterOrdersByCustomRange(allOrders, cf, ct),
      currentLabel,
      compareLabel: formatRangeLabel(cf, ct),
    }
  }

  if (filters.compareMode === 'lastYear') {
    const shift = (d: string) => {
      const date = new Date(d + 'T00:00:00')
      date.setFullYear(date.getFullYear() - 1)
      return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(date)
    }
    const cf = shift(range.from)
    const ct = shift(range.to)
    return {
      currentOrders,
      compareOrders: filterOrdersByCustomRange(allOrders, cf, ct),
      currentLabel,
      compareLabel: formatRangeLabel(cf, ct),
    }
  }

  return null
}

export function useCompareOrders(allOrders: Order[], filters: GlobalFilters) {
  return computeComparePeriod(allOrders, filters)
}
