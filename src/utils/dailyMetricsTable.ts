import { startOfDay, subDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { Order, ProductTagsMap } from '../api/types'
import { IST, toIST, filterOrdersThroughSameTimeOfDay, isToday, isYesterday, isSameDayLastWeek } from './dates'
import { computeOrderMetrics, pctGrowth, getFirstOrderIdSet } from './metricEngine'

export interface DayColumn {
  key: string
  label: string
  isToday: boolean
  date: Date
}

export interface DayMetrics {
  totalOrders: number
  gmv: number
  aov: number
  firstTimeOrders: number
  repeatOrders: number
  nonEssentialOrders: number
  pctNonEssential: number
  totalOrdersGrowth: number | null
  totalOrdersGrowthWeek: number | null
  firstTimeGrowth: number | null
  firstTimeGrowthWeek: number | null
  repeatGrowth: number | null
  repeatGrowthWeek: number | null
  spendIncrease: number | null
  spendIncreaseWeek: number | null
}

export type DailyTableRow =
  | { kind: 'section'; label: string }
  | {
      kind: 'metric'
      id: string
      label: string
      metricKey: keyof DayMetrics
      format: 'int' | 'currency' | 'pct' | 'dash' | 'growth' | 'growthDual'
      growthKey?: keyof DayMetrics
      growthWeekKey?: keyof DayMetrics
    }

export const DAILY_TABLE_ROWS: DailyTableRow[] = [
  { kind: 'section', label: 'Core metrics' },
  { kind: 'metric', id: 'totalOrders', label: 'Total Orders', metricKey: 'totalOrders', format: 'int' },
  { kind: 'metric', id: 'aov', label: 'AOV', metricKey: 'aov', format: 'currency' },
  { kind: 'metric', id: 'firstTimeOrders', label: '1st Time Orders', metricKey: 'firstTimeOrders', format: 'int' },
  { kind: 'metric', id: 'cac', label: 'CAC (1st time orders)', metricKey: 'totalOrders', format: 'dash' },
  { kind: 'metric', id: 'repeatOrders', label: 'Repeat Orders', metricKey: 'repeatOrders', format: 'int' },
  { kind: 'metric', id: 'nonEssentialOrders', label: 'Non-Essential Orders', metricKey: 'nonEssentialOrders', format: 'int' },
  { kind: 'metric', id: 'pctNonEssential', label: '% Non-Essential Orders', metricKey: 'pctNonEssential', format: 'pct' },
  { kind: 'section', label: 'Growth rates' },
  {
    kind: 'metric',
    id: 'totalOrdersGrowth',
    label: 'Total Orders Growth Rate',
    metricKey: 'totalOrdersGrowth',
    format: 'growthDual',
    growthKey: 'totalOrdersGrowth',
    growthWeekKey: 'totalOrdersGrowthWeek',
  },
  {
    kind: 'metric',
    id: 'firstTimeGrowth',
    label: '1st Time Order Growth Rate',
    metricKey: 'firstTimeGrowth',
    format: 'growthDual',
    growthKey: 'firstTimeGrowth',
    growthWeekKey: 'firstTimeGrowthWeek',
  },
  {
    kind: 'metric',
    id: 'repeatGrowth',
    label: 'Repeat Order Growth Rate',
    metricKey: 'repeatGrowth',
    format: 'growthDual',
    growthKey: 'repeatGrowth',
    growthWeekKey: 'repeatGrowthWeek',
  },
  { kind: 'section', label: 'Spend' },
  {
    kind: 'metric',
    id: 'spendIncrease',
    label: 'Spend Increase',
    metricKey: 'spendIncrease',
    format: 'growthDual',
    growthKey: 'spendIncrease',
    growthWeekKey: 'spendIncreaseWeek',
  },
]

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(date)
}

export function getLast8DayColumns(): DayColumn[] {
  const now = toZonedTime(new Date(), IST)
  return Array.from({ length: 8 }, (_, i) => {
    const date = startOfDay(subDays(now, i))
    const label = new Intl.DateTimeFormat('en-IN', {
      timeZone: IST,
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    }).format(date)
    return {
      key: dayKey(date),
      label,
      isToday: i === 0,
      date,
    }
  }).reverse()
}

function ordersForColumn(
  col: DayColumn,
  ordersByDay: Map<string, Order[]>,
  allToday: Order[]
): Order[] {
  if (col.isToday) {
    return filterOrdersThroughSameTimeOfDay(allToday)
  }
  return ordersByDay.get(col.key) ?? []
}

export function buildDailyMetricsTable(orders: Order[], productTagsMap: ProductTagsMap) {
  const columns = getLast8DayColumns()
  getFirstOrderIdSet(orders)

  const ordersByDay = new Map<string, Order[]>()
  const allToday = orders.filter((o) => isToday(o.created_at))
  const allYesterday = orders.filter((o) => isYesterday(o.created_at))
  const allLastWeek = orders.filter((o) => isSameDayLastWeek(o.created_at))

  for (const order of orders) {
    const key = dayKey(toIST(order.created_at))
    const list = ordersByDay.get(key) ?? []
    list.push(order)
    ordersByDay.set(key, list)
  }

  const yesterdaySameTime = filterOrdersThroughSameTimeOfDay(allYesterday)
  const lastWeekSameTime = filterOrdersThroughSameTimeOfDay(allLastWeek)

  const baseMetrics = columns.map((col) => {
    const dayOrders = ordersForColumn(col, ordersByDay, allToday)
    return computeOrderMetrics(dayOrders, productTagsMap, orders)
  })

  const yesterdayMetrics = computeOrderMetrics(yesterdaySameTime, productTagsMap, orders)
  const lastWeekMetrics = computeOrderMetrics(lastWeekSameTime, productTagsMap, orders)

  const todayIdx = columns.findIndex((c) => c.isToday)

  const dayMetrics: DayMetrics[] = baseMetrics.map((base, idx) => {
    const prev = idx > 0 ? baseMetrics[idx - 1] : null
    const isTodayCol = idx === todayIdx

    if (isTodayCol) {
      return {
        ...base,
        totalOrdersGrowth: pctGrowth(base.totalOrders, yesterdayMetrics.totalOrders),
        totalOrdersGrowthWeek: pctGrowth(base.totalOrders, lastWeekMetrics.totalOrders),
        firstTimeGrowth: pctGrowth(base.firstTimeOrders, yesterdayMetrics.firstTimeOrders),
        firstTimeGrowthWeek: pctGrowth(base.firstTimeOrders, lastWeekMetrics.firstTimeOrders),
        repeatGrowth: pctGrowth(base.repeatOrders, yesterdayMetrics.repeatOrders),
        repeatGrowthWeek: pctGrowth(base.repeatOrders, lastWeekMetrics.repeatOrders),
        spendIncrease: pctGrowth(base.gmv, yesterdayMetrics.gmv),
        spendIncreaseWeek: pctGrowth(base.gmv, lastWeekMetrics.gmv),
      }
    }

    return {
      ...base,
      totalOrdersGrowth: prev ? pctGrowth(base.totalOrders, prev.totalOrders) : null,
      totalOrdersGrowthWeek: null,
      firstTimeGrowth: prev ? pctGrowth(base.firstTimeOrders, prev.firstTimeOrders) : null,
      firstTimeGrowthWeek: null,
      repeatGrowth: prev ? pctGrowth(base.repeatOrders, prev.repeatOrders) : null,
      repeatGrowthWeek: null,
      spendIncrease: prev ? pctGrowth(base.gmv, prev.gmv) : null,
      spendIncreaseWeek: null,
    }
  })

  return { columns, dayMetrics, ordersByDay, allToday, allYesterday, allLastWeek }
}

export function growthCellStyle(value: number | null): { backgroundColor?: string } | undefined {
  if (value == null || value === 0) return undefined
  const opacity = Math.min(Math.abs(value) / 30, 1) * 0.7
  if (value > 0) return { backgroundColor: `rgba(209, 250, 229, ${opacity + 0.3})` }
  return { backgroundColor: `rgba(254, 226, 226, ${opacity + 0.3})` }
}

export function formatDailyCell(
  value: number | null | undefined,
  format: 'int' | 'currency' | 'pct' | 'dash' | 'growth' | 'growthDual'
): string {
  if (format === 'dash') return '–'
  if (format === 'growthDual') return '–'
  if (value == null) return '–'
  if (format === 'int') return Math.round(value).toLocaleString('en-IN')
  if (format === 'currency') {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
  }
  if (format === 'pct') return `${value.toFixed(1)}%`
  if (format === 'growth') {
    if (value === 0) return '0.0%'
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }
  return String(value)
}

export function formatGrowthDual(
  vsYesterday: number | null,
  vsWeek: number | null,
  isTodayCol: boolean
): string {
  if (!isTodayCol) {
    const v = vsYesterday
    if (v == null) return '–'
    if (v === 0) return '0.0%'
    return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
  }
  const yStr =
    vsYesterday == null ? 'Y: –' : `Y: ${vsYesterday > 0 ? '+' : ''}${vsYesterday.toFixed(1)}%`
  const wStr = vsWeek == null ? 'W: –' : `W: ${vsWeek > 0 ? '+' : ''}${vsWeek.toFixed(1)}%`
  return `${yStr} · ${wStr}`
}
