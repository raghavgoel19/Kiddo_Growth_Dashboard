import { endOfDay, startOfDay, subDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { Order } from '../api/types'
import { isInDateRangeIST } from './customerSummary'
import { formatCustomRangeLabel, nowIST, parseDateInputIST } from './dates'
import { IST } from './dates'

export interface BoardDateRange {
  from: Date
  to: Date
  preset: BoardDatePreset | 'custom'
}

export type BoardDatePreset = 'today' | 'yesterday' | '7d' | '30d' | '90d'

export function boardPresetRange(preset: BoardDatePreset): BoardDateRange {
  const now = nowIST()
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now), preset: 'today' }
    case 'yesterday': {
      const y = subDays(now, 1)
      return { from: startOfDay(y), to: endOfDay(y), preset: 'yesterday' }
    }
    case '7d':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), preset: '7d' }
    case '90d':
      return { from: startOfDay(subDays(now, 89)), to: endOfDay(now), preset: '90d' }
    case '30d':
    default:
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), preset: '30d' }
  }
}

export function defaultBoardRange(preset: BoardDatePreset = '30d'): BoardDateRange {
  return boardPresetRange(preset)
}

export function filterOrdersByBoardRange(orders: Order[], range: BoardDateRange): Order[] {
  return orders.filter((o) => isInDateRangeIST(o.created_at, range.from, range.to))
}

export function isBoardPresetActive(range: BoardDateRange, preset: BoardDatePreset): boolean {
  return range.preset === preset
}

export function boardRangeLabel(range: BoardDateRange): string {
  if (range.preset !== 'custom') {
    const labels: Record<BoardDatePreset, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      '7d': '7d',
      '30d': '30d',
      '90d': '90d',
    }
    return labels[range.preset as BoardDatePreset] ?? 'Custom'
  }
  const fromStr = toZonedTime(range.from, IST).toISOString().slice(0, 10)
  const toStr = toZonedTime(range.to, IST).toISOString().slice(0, 10)
  return formatCustomRangeLabel(fromStr, toStr)
}

export function boardRangeFromCustom(from: string, to: string): BoardDateRange {
  return {
    from: startOfDay(parseDateInputIST(from)),
    to: endOfDay(parseDateInputIST(to)),
    preset: 'custom',
  }
}
