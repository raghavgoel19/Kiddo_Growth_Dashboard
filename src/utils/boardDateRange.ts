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

export type BoardFilterMode = 'order_date' | 'first_order_cohort' | 'customer_activity'

export function filterOrdersByBoardRange(orders: Order[], range: BoardDateRange): Order[] {
  return orders.filter((o) => isInDateRangeIST(o.created_at, range.from, range.to))
}

/** All orders for customers whose first order falls in the board range (full history for repeat metrics). */
export function filterOrdersForFirstOrderCohort(orders: Order[], range: BoardDateRange): Order[] {
  const byCustomer = new Map<string, Order[]>()
  for (const order of orders) {
    const cid = order.customer?.id
    if (!cid) continue
    const list = byCustomer.get(cid) ?? []
    list.push(order)
    byCustomer.set(cid, list)
  }

  const cohortIds = new Set<string>()
  for (const [cid, customerOrders] of byCustomer) {
    const first = customerOrders.reduce((a, b) =>
      new Date(a.created_at).getTime() < new Date(b.created_at).getTime() ? a : b
    )
    if (isInDateRangeIST(first.created_at, range.from, range.to)) {
      cohortIds.add(cid)
    }
  }

  return orders.filter((o) => o.customer?.id && cohortIds.has(o.customer.id))
}

/** All orders for customers with at least one order in the board range. */
export function filterOrdersForCustomerActivity(orders: Order[], range: BoardDateRange): Order[] {
  const activeIds = new Set<string>()
  for (const order of orders) {
    const cid = order.customer?.id
    if (cid && isInDateRangeIST(order.created_at, range.from, range.to)) {
      activeIds.add(cid)
    }
  }
  return orders.filter((o) => o.customer?.id && activeIds.has(o.customer.id))
}

export function filterOrdersByBoardMode(
  orders: Order[],
  range: BoardDateRange,
  mode: BoardFilterMode = 'order_date'
): Order[] {
  switch (mode) {
    case 'first_order_cohort':
      return filterOrdersForFirstOrderCohort(orders, range)
    case 'customer_activity':
      return filterOrdersForCustomerActivity(orders, range)
    case 'order_date':
    default:
      return filterOrdersByBoardRange(orders, range)
  }
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
