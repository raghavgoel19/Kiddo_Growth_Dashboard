import type { FullDateRange, Order, ProductTagsMap } from '../api/types'
import { getOrderChannel } from './channel'
import { getDistanceBand } from './geography'
import { parseMoney, pctChange } from './formatters'
import {
  isToday,
  isYesterday,
  isSameDayLastWeek,
  getHourIST,
  getTimeOfDayMinutesIST,
  getNowTimeOfDayMinutesIST,
  getCurrentHourIST,
  filterOrdersThroughSameTimeOfDay,
  getIntradayComparisonTimeLabel,
  filterOrdersByPeriod,
} from './dates'
import { classifyOrderPrimary, L1_TAGS } from './taxonomy'
import { computeOrderMetrics, computeSameTimeComparison } from './metricEngine'

export interface DailyMetrics {
  orders: number
  gmv: number
  aov: number
  newCustomers: number
  repeatOrders: number
  avgItems: number
}

export interface DailyKPIItem {
  id: string
  label: string
  value: string
  vsPrevDay: { value: string; positive: boolean }
  vsPrevWeek: { value: string; positive: boolean }
  timeLabel?: string
}

export function computeDailyMetrics(orders: Order[], productTagsMap?: ProductTagsMap, allOrders?: Order[]): DailyMetrics {
  const m = computeOrderMetrics(orders, productTagsMap ?? {}, allOrders ?? orders)
  return {
    orders: m.totalOrders,
    gmv: m.gmv,
    aov: m.aov,
    newCustomers: m.firstTimeOrders,
    repeatOrders: m.repeatOrders,
    avgItems: m.avgItems,
  }
}

export function splitOrdersByDay(orders: Order[]) {
  return {
    today: orders.filter((o) => isToday(o.created_at)),
    yesterday: orders.filter((o) => isYesterday(o.created_at)),
    lastWeek: orders.filter((o) => isSameDayLastWeek(o.created_at)),
  }
}

/** Cumulative orders on a day through a given hour, capped at the current clock time. */
function cumulativeOrdersThroughHour(dayOrders: Order[], throughHour: number): number {
  const currentHour = getCurrentHourIST()
  const cutoff = getNowTimeOfDayMinutesIST()

  return dayOrders.filter((o) => {
    const hour = getHourIST(o.created_at)
    if (hour < throughHour) return true
    if (hour > throughHour) return false
    if (throughHour < currentHour) return true
    return getTimeOfDayMinutesIST(o.created_at) <= cutoff
  }).length
}

export function buildDailyKPIs(allOrders: Order[], productTagsMap: ProductTagsMap = {}): DailyKPIItem[] {
  const { today, yesterday, lastWeek } = splitOrdersByDay(allOrders)
  const cmp = computeSameTimeComparison(today, yesterday, lastWeek, productTagsMap, allOrders)
  const timeLabel = getIntradayComparisonTimeLabel()

  const t = cmp.today
  const y = cmp.yesterdaySameTime
  const w = cmp.lastWeekSameTime

  return [
    {
      id: 'totalOrders',
      label: 'Orders',
      value: t.totalOrders.toLocaleString('en-IN'),
      vsPrevDay: pctChange(t.totalOrders, y.totalOrders),
      vsPrevWeek: pctChange(t.totalOrders, w.totalOrders),
      timeLabel,
    },
    {
      id: 'gmv',
      label: 'GMV',
      value: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(t.gmv),
      vsPrevDay: pctChange(t.gmv, y.gmv),
      vsPrevWeek: pctChange(t.gmv, w.gmv),
      timeLabel,
    },
    {
      id: 'aov',
      label: 'AOV',
      value: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(t.aov),
      vsPrevDay: pctChange(t.aov, y.aov),
      vsPrevWeek: pctChange(t.aov, w.aov),
      timeLabel,
    },
    {
      id: 'firstTimeOrders',
      label: 'New customers',
      value: t.firstTimeOrders.toLocaleString('en-IN'),
      vsPrevDay: pctChange(t.firstTimeOrders, y.firstTimeOrders),
      vsPrevWeek: pctChange(t.firstTimeOrders, w.firstTimeOrders),
      timeLabel,
    },
    {
      id: 'repeatOrders',
      label: 'Repeat orders',
      value: t.repeatOrders.toLocaleString('en-IN'),
      vsPrevDay: pctChange(t.repeatOrders, y.repeatOrders),
      vsPrevWeek: pctChange(t.repeatOrders, w.repeatOrders),
      timeLabel,
    },
    {
      id: 'avgItems',
      label: 'Items / order',
      value: t.avgItems.toFixed(1),
      vsPrevDay: pctChange(t.avgItems, y.avgItems),
      vsPrevWeek: pctChange(t.avgItems, w.avgItems),
      timeLabel,
    },
  ]
}

export function buildKPIsForDateRange(
  allOrders: Order[],
  productTagsMap: ProductTagsMap,
  range: FullDateRange
): DailyKPIItem[] {
  if (range === 'today') return buildDailyKPIs(allOrders, productTagsMap)
  const scoped = filterOrdersByPeriod(allOrders, range)
  const m = computeOrderMetrics(scoped, productTagsMap, allOrders)
  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
  const neutral = { value: '–', positive: true }
  return [
    { id: 'totalOrders', label: 'Orders', value: m.totalOrders.toLocaleString('en-IN'), vsPrevDay: neutral, vsPrevWeek: neutral, timeLabel: undefined },
    { id: 'gmv', label: 'GMV', value: fmtCurrency(m.gmv), vsPrevDay: neutral, vsPrevWeek: neutral, timeLabel: undefined },
    { id: 'aov', label: 'AOV', value: fmtCurrency(m.aov), vsPrevDay: neutral, vsPrevWeek: neutral, timeLabel: undefined },
    { id: 'firstTimeOrders', label: 'New customers', value: m.firstTimeOrders.toLocaleString('en-IN'), vsPrevDay: neutral, vsPrevWeek: neutral, timeLabel: undefined },
    { id: 'repeatOrders', label: 'Repeat orders', value: m.repeatOrders.toLocaleString('en-IN'), vsPrevDay: neutral, vsPrevWeek: neutral, timeLabel: undefined },
    { id: 'avgItems', label: 'Items / order', value: m.avgItems.toFixed(1), vsPrevDay: neutral, vsPrevWeek: neutral, timeLabel: undefined },
  ]
}

export function buildHourlySeries(allOrders: Order[]) {
  const { today, yesterday, lastWeek } = splitOrdersByDay(allOrders)
  const currentHour = getCurrentHourIST()

  return Array.from({ length: currentHour + 1 }, (_, hour) => ({
    hour,
    label: `${hour === 0 ? '12' : hour > 12 ? hour - 12 : hour}${hour < 12 ? ' AM' : ' PM'}`,
    today: cumulativeOrdersThroughHour(today, hour),
    yesterday: cumulativeOrdersThroughHour(yesterday, hour),
    lastWeek: cumulativeOrdersThroughHour(lastWeek, hour),
  }))
}

export interface CategoryRow {
  category: string
  orders: number
  gmv: number
  pct: number
}

export function buildCategorySplit(
  todayOrders: Order[],
  productTagsMap: ProductTagsMap
): CategoryRow[] {
  const totalGmv = todayOrders.reduce((s, o) => s + parseMoney(o.total_price), 0) || 1
  const map = new Map<string, { orders: number; gmv: number }>()

  for (const order of todayOrders) {
    const cats = classifyOrderPrimary(order, productTagsMap)
    const key = cats === 'Uncategorized' ? 'Uncategorized' : cats
    const entry = map.get(key) ?? { orders: 0, gmv: 0 }
    entry.orders += 1
    entry.gmv += parseMoney(order.total_price)
    map.set(key, entry)
  }

  return Array.from(map.entries())
    .map(([category, { orders, gmv }]) => ({
      category,
      orders,
      gmv,
      pct: (gmv / totalGmv) * 100,
    }))
    .sort((a, b) => b.gmv - a.gmv)
}

export function buildChannelSplit(allOrders: Order[]) {
  const today = allOrders.filter((o) => isToday(o.created_at))
  const yesterday = allOrders.filter((o) => isYesterday(o.created_at))
  const yesterdaySameTime = filterOrdersThroughSameTimeOfDay(yesterday)
  const timeLabel = getIntradayComparisonTimeLabel()

  const countBy = (orders: Order[]) => {
    const app = orders.filter((o) => getOrderChannel(o) === 'app').length
    const web = orders.filter((o) => getOrderChannel(o) === 'website').length
    return { app, web, total: orders.length }
  }

  const t = countBy(today)
  const y = countBy(yesterdaySameTime)

  return [
    {
      channel: 'App',
      count: t.app,
      pct: t.total > 0 ? (t.app / t.total) * 100 : 0,
      vsYesterday: pctChange(t.app, y.app),
      timeLabel,
    },
    {
      channel: 'Website',
      count: t.web,
      pct: t.total > 0 ? (t.web / t.total) * 100 : 0,
      vsYesterday: pctChange(t.web, y.web),
      timeLabel,
    },
  ]
}

export interface DailyProductRow {
  rank: number
  name: string
  units: number
  revenue: number
  category: string
}

export function buildDailyTopProducts(
  todayOrders: Order[],
  productTagsMap: ProductTagsMap,
  limit = 10
): DailyProductRow[] {
  const map = new Map<string, { units: number; revenue: number; productId?: string }>()

  for (const order of todayOrders) {
    for (const item of order.line_items ?? []) {
      const name = item.product_title ?? item.title ?? 'Unknown'
      const revenue = parseMoney(item.price) * (item.quantity ?? 0)
      const entry = map.get(name) ?? { units: 0, revenue: 0, productId: String(item.product_id ?? '') }
      entry.units += item.quantity ?? 0
      entry.revenue += revenue
      map.set(name, entry)
    }
  }

  return Array.from(map.entries())
    .map(([name, { units, revenue, productId }]) => {
      const tags = productTagsMap[productId ?? ''] ?? []
      const category =
        L1_TAGS.find((t) => tags.includes(t)) ?? 'Uncategorized'
      return { name, units, revenue, category }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map((row, i) => ({ rank: i + 1, ...row }))
}

export function buildGeoBands(todayOrders: Order[]) {
  const bands = ['0-5km', '5-10km', '10-15km', '15-20km', '20km+', 'unknown'] as const
  const total = todayOrders.length || 1

  return bands.map((band) => {
    const count = todayOrders.filter((o) => getDistanceBand(o) === band).length
    return {
      band,
      count,
      pct: (count / total) * 100,
    }
  }).filter((b) => b.count > 0 || b.band !== 'unknown')
}

export function getTodayOrders(allOrders: Order[]): Order[] {
  return allOrders.filter((o) => isToday(o.created_at))
}

export { getIntradayComparisonTimeLabel, filterOrdersThroughSameTimeOfDay }
