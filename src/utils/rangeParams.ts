import { subDays, startOfDay, endOfDay } from 'date-fns'
import type { FullDateRange } from '../api/types'
import type { GlobalFilters } from '../context/DashboardContext'
import { formatCustomRangeLabel, nowIST, parseDateInputIST } from './dates'

export interface ApiDateRange {
  since: string
  until: string
  cacheKey: string
  label: string
  ttlMs: number
}

const TTL_YESTERDAY = 60 * 60 * 1000
const TTL_WEEK = 2 * 60 * 60 * 1000
const TTL_MONTH = 2 * 60 * 60 * 1000
const TTL_LONG = 4 * 60 * 60 * 1000
const TTL_CUSTOM = 60 * 60 * 1000
const TTL_TODAY_TAB = 5 * 60 * 1000

function toUtcIso(date: Date): string {
  return date.toISOString()
}

export function filtersToApiRange(filters: GlobalFilters): ApiDateRange {
  const now = nowIST()

  if (filters.dateMode === 'custom' && filters.customFrom && filters.customTo) {
    const start = startOfDay(parseDateInputIST(filters.customFrom))
    const end = endOfDay(parseDateInputIST(filters.customTo))
    return {
      since: toUtcIso(start),
      until: toUtcIso(end),
      cacheKey: `custom:${filters.customFrom}:${filters.customTo}`,
      label: formatCustomRangeLabel(filters.customFrom, filters.customTo),
      ttlMs: TTL_CUSTOM,
    }
  }

  switch (filters.dateRange) {
    case 'yesterday': {
      const day = subDays(now, 1)
      return {
        since: toUtcIso(startOfDay(day)),
        until: toUtcIso(endOfDay(day)),
        cacheKey: 'preset:yesterday',
        label: 'Yesterday',
        ttlMs: TTL_YESTERDAY,
      }
    }
    case '7d':
      return {
        since: toUtcIso(startOfDay(subDays(now, 6))),
        until: toUtcIso(endOfDay(now)),
        cacheKey: 'preset:7d',
        label: 'Last 7d',
        ttlMs: TTL_WEEK,
      }
    case '90d':
      return {
        since: toUtcIso(startOfDay(subDays(now, 89))),
        until: toUtcIso(endOfDay(now)),
        cacheKey: 'preset:90d',
        label: 'Last 90d',
        ttlMs: TTL_LONG,
      }
    case '12m':
      return {
        since: toUtcIso(startOfDay(subDays(now, 364))),
        until: toUtcIso(endOfDay(now)),
        cacheKey: 'preset:12m',
        label: 'Last 12m',
        ttlMs: TTL_LONG,
      }
    case 'all':
      return {
        since: toUtcIso(startOfDay(subDays(now, 730))),
        until: toUtcIso(endOfDay(now)),
        cacheKey: 'preset:all',
        label: 'All time',
        ttlMs: TTL_LONG,
      }
    case '30d':
    default:
      return {
        since: toUtcIso(startOfDay(subDays(now, 29))),
        until: toUtcIso(endOfDay(now)),
        cacheKey: 'preset:30d',
        label: 'Last 30d',
        ttlMs: TTL_MONTH,
      }
  }
}

export function todayTabApiRange(): ApiDateRange {
  const now = nowIST()
  return {
    since: toUtcIso(startOfDay(subDays(now, 7))),
    until: toUtcIso(endOfDay(now)),
    cacheKey: 'page:today-8d',
    label: 'Last 8 days',
    ttlMs: TTL_TODAY_TAB,
  }
}

export type DashboardSection =
  | 'today'
  | 'summary'
  | 'orders'
  | 'users'
  | 'retention'
  | 'cohorts'
  | 'products'
  | 'geography'
  | 'channel'
  | 'growth'

export function apiRangeForSection(section: DashboardSection, filters: GlobalFilters): ApiDateRange {
  if (section === 'today') return todayTabApiRange()
  return filtersToApiRange(filters)
}

export function sectionNeedsOrders(section: DashboardSection): boolean {
  return section !== 'products'
}

export const DATE_PRESET_OPTIONS: { label: string; value: FullDateRange }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7d', value: '7d' },
  { label: 'Last 30d', value: '30d' },
  { label: 'Last 90d', value: '90d' },
  { label: 'Last 12m', value: '12m' },
  { label: 'All time', value: 'all' },
]

export function presetLabel(range: FullDateRange): string {
  return DATE_PRESET_OPTIONS.find((p) => p.value === range)?.label ?? range
}
