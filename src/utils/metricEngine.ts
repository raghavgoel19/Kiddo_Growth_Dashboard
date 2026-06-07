import type { Order, ProductTagsMap } from '../api/types'
import { getOrderItemCount } from './aggregators'
import { parseMoney } from './formatters'
import { buildFirstOrderIdSet, isFirstTimeOrder, isNonEssentialOrder } from './orderAnalysis'
import { filterOrdersThroughSameTimeOfDay } from './dates'

export interface OrderMetrics {
  totalOrders: number
  gmv: number
  aov: number
  firstTimeOrders: number
  repeatOrders: number
  nonEssentialOrders: number
  pctNonEssential: number
  newCustomers: number
  repeatOrdersLegacy: number
  avgItems: number
}

let cachedFirstOrderIds: Set<string> | null = null
let cachedFirstOrderSource: Order[] | null = null

export function getFirstOrderIdSet(allOrders: Order[]): Set<string> {
  if (cachedFirstOrderSource === allOrders && cachedFirstOrderIds) return cachedFirstOrderIds
  cachedFirstOrderIds = buildFirstOrderIdSet(allOrders)
  cachedFirstOrderSource = allOrders
  return cachedFirstOrderIds
}

export function computeOrderMetrics(
  orders: Order[],
  productTagsMap: ProductTagsMap,
  allOrdersForFirstTime: Order[] = orders
): OrderMetrics {
  const firstOrderIds = getFirstOrderIdSet(allOrdersForFirstTime)
  const totalOrders = orders.length
  const gmv = orders.reduce((s, o) => s + parseMoney(o.total_price), 0)
  const firstTimeOrders = orders.filter((o) => isFirstTimeOrder(o, firstOrderIds)).length
  const repeatOrders = totalOrders - firstTimeOrders
  const nonEssentialOrders = orders.filter((o) => isNonEssentialOrder(o, productTagsMap)).length
  const totalItems = orders.reduce((s, o) => s + getOrderItemCount(o), 0)

  return {
    totalOrders,
    gmv,
    aov: totalOrders > 0 ? gmv / totalOrders : 0,
    firstTimeOrders,
    repeatOrders,
    nonEssentialOrders,
    pctNonEssential: totalOrders > 0 ? (nonEssentialOrders / totalOrders) * 100 : 0,
    newCustomers: firstTimeOrders,
    repeatOrdersLegacy: repeatOrders,
    avgItems: totalOrders > 0 ? totalItems / totalOrders : 0,
  }
}

export function computeSameTimeComparison(
  todayOrders: Order[],
  yesterdayOrders: Order[],
  lastWeekOrders: Order[],
  productTagsMap: ProductTagsMap,
  allOrders: Order[]
) {
  const todaySameTime = filterOrdersThroughSameTimeOfDay(todayOrders)
  const ySame = filterOrdersThroughSameTimeOfDay(yesterdayOrders)
  const wSame = filterOrdersThroughSameTimeOfDay(lastWeekOrders)

  return {
    today: computeOrderMetrics(todaySameTime, productTagsMap, allOrders),
    yesterdaySameTime: computeOrderMetrics(ySame, productTagsMap, allOrders),
    lastWeekSameTime: computeOrderMetrics(wSame, productTagsMap, allOrders),
  }
}

export function pctGrowth(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return ((current - previous) / previous) * 100
}
