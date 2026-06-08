import { differenceInCalendarDays, startOfDay, endOfDay } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { DistanceBand, Order, ProductTagsMap } from '../api/types'
import { getOrderChannel } from './channel'
import { getDistanceBand } from './geography'
import { parseMoney } from './formatters'
import { classifyOrder, classifyOrderPrimary } from './taxonomy'
import { IST } from './dates'

export interface CustomerSummary {
  id: string
  phone: string | null
  totalOrders: number
  totalSpent: number
  aov: number
  firstOrderDate: string
  lastOrderDate: string
  daysSinceLastOrder: number
  primaryChannel: 'app' | 'website'
  primaryCategory: string
  distanceBand: DistanceBand
  isPowerUser: boolean
  daysToSecondOrder: number | null
  orders: Order[]
}

export function getOrderL1Categories(order: Order, productTagsMap: ProductTagsMap): string[] {
  return classifyOrder(order, productTagsMap)
}

export function buildCustomerSummaries(
  orders: Order[],
  productTagsMap: ProductTagsMap
): CustomerSummary[] {
  const byCustomer = new Map<string, Order[]>()

  for (const order of orders) {
    const cid = order.customer?.id
    if (!cid) continue
    const list = byCustomer.get(cid) ?? []
    list.push(order)
    byCustomer.set(cid, list)
  }

  const today = toZonedTime(new Date(), IST)

  return Array.from(byCustomer.entries()).map(([cid, customerOrders]) => {
    const sorted = [...customerOrders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const firstOrder = sorted[0]
    const lastOrder = sorted[sorted.length - 1]
    const totalSpent = sorted.reduce((sum, o) => sum + parseMoney(o.total_price), 0)

    const channels = sorted.map((o) => getOrderChannel(o))
    const appCount = channels.filter((c) => c === 'app').length
    const primaryChannel: 'app' | 'website' = appCount > channels.length / 2 ? 'app' : 'website'

    const categoryCounts: Record<string, number> = {}
    for (const order of sorted) {
      for (const cat of classifyOrder(order, productTagsMap)) {
        categoryCounts[cat] = (categoryCounts[cat] ?? 0) + 1
      }
    }
    const primaryCategory =
      Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      classifyOrderPrimary(firstOrder, productTagsMap)

    let isPowerUser = false
    let daysToSecondOrder: number | null = null
    if (sorted.length >= 2) {
      const first = toZonedTime(new Date(sorted[0].created_at), IST)
      const second = toZonedTime(new Date(sorted[1].created_at), IST)
      daysToSecondOrder = differenceInCalendarDays(second, first)
      isPowerUser = daysToSecondOrder <= 7
    }

    const lastOrderDate = toZonedTime(new Date(lastOrder.created_at), IST)

    return {
      id: cid,
      phone: firstOrder.customer?.phone ?? null,
      totalOrders: sorted.length,
      totalSpent,
      aov: totalSpent / sorted.length,
      firstOrderDate: firstOrder.created_at,
      lastOrderDate: lastOrder.created_at,
      daysSinceLastOrder: differenceInCalendarDays(today, lastOrderDate),
      primaryChannel,
      primaryCategory: primaryCategory === 'Uncategorized' ? 'unknown' : primaryCategory,
      distanceBand: getDistanceBand(firstOrder),
      isPowerUser,
      daysToSecondOrder,
      orders: sorted,
    }
  })
}

export function computeRepeatRate(customers: CustomerSummary[]): number {
  if (customers.length === 0) return 0
  return (customers.filter((c) => c.totalOrders >= 2).length / customers.length) * 100
}

export function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function isInDateRangeIST(isoString: string, from: Date, to: Date): boolean {
  const orderDate = toZonedTime(new Date(isoString), IST)
  const fromIST = startOfDay(toZonedTime(from, IST))
  const toIST = endOfDay(toZonedTime(to, IST))
  return orderDate >= fromIST && orderDate <= toIST
}
