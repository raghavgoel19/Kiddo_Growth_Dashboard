import {
  differenceInCalendarDays,
  endOfDay,
  endOfWeek,
  format,
  parseISO,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { Order, ProductTagsMap } from '../api/types'
import { avg, buildCustomerSummaries, type CustomerSummary } from './customerSummary'
import { getL2ForOrder, L2_MAP, L1_TAGS } from './taxonomy'
import { parseMoney } from './formatters'
import { IST } from './dates'

function getAllL2Tags(): string[] {
  return L1_TAGS.flatMap((l1) => L2_MAP[l1])
}

function getL1ForL2(l2Tag: string): string {
  for (const l1 of L1_TAGS) {
    if (L2_MAP[l1].includes(l2Tag)) return l1
  }
  return 'unknown'
}

export interface MonthlyFrequency {
  month: string
  label: string
  totalOrders: number
  activeCustomers: number
  avgOrdersPerUser: number
}

export interface FunnelStage {
  stage: string
  customers: number
  pctFromPrevious: number | null
  pctFromTotal: number
}

export interface DailyPowerUserRow {
  date: string
  dateKey: string
  firstTimeOrders: number
  powerUsers7: number | null
  powerUsers7Pct: number | null
  within15: number | null
  within15Pct: number | null
  within30: number | null
  within30Pct: number | null
  pending7: boolean
}

export interface WeekPowerUserRow {
  weekLabel: string
  newCustomers: number
  powerUsers: number
  powerUserPct: number
  within15: number
  within15Pct: number
  within30: number
  within30Pct: number
}

export interface L2RepeatRow {
  l2Tag: string
  l1: string
  totalBuyers: number
  repeaters: number
  repeatRate: number
  avgOrdersRepeaters: number
  avgDaysToRepeat: number
  avgFirstOrderAOV: number
}

export function computeMonthlyFrequency(orders: Order[]): MonthlyFrequency[] {
  const byMonth = new Map<string, Order[]>()
  for (const order of orders) {
    const month = format(toZonedTime(new Date(order.created_at), IST), 'yyyy-MM')
    const list = byMonth.get(month) ?? []
    list.push(order)
    byMonth.set(month, list)
  }

  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, monthOrders]) => {
      const activeCustomers = new Set(monthOrders.map((o) => o.customer?.id).filter(Boolean)).size
      return {
        month,
        label: format(parseISO(`${month}-01`), 'MMM yyyy'),
        totalOrders: monthOrders.length,
        activeCustomers,
        avgOrdersPerUser: activeCustomers > 0 ? monthOrders.length / activeCustomers : 0,
      }
    })
}

export function computeRepeatFunnel(customers: CustomerSummary[]): FunnelStage[] {
  if (customers.length === 0) return []
  const total = customers.length
  const stages = [1, 2, 3, 4, 5, 6]
  const rows: FunnelStage[] = []
  let prev = total

  for (const n of stages) {
    const count = customers.filter((c) => c.totalOrders >= n).length
    rows.push({
      stage: n === 1 ? 'Placed 1st order' : `Placed ${n}${n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} order`,
      customers: count,
      pctFromPrevious: rows.length === 0 ? null : prev > 0 ? (count / prev) * 100 : 0,
      pctFromTotal: total > 0 ? (count / total) * 100 : 0,
    })
    prev = count
  }
  return rows
}

export function computeDailyPowerUsers(orders: Order[], productTagsMap: ProductTagsMap): DailyPowerUserRow[] {
  const customers = buildCustomerSummaries(orders, productTagsMap)
  const today = toZonedTime(new Date(), IST)
  const rows: DailyPowerUserRow[] = []

  for (let d = 0; d < 30; d++) {
    const date = subDays(today, d)
    const dateStart = startOfDay(date)
    const dateEnd = endOfDay(date)

    const firstTimers = customers.filter((c) => {
      const firstDate = toZonedTime(new Date(c.firstOrderDate), IST)
      return firstDate >= dateStart && firstDate <= dateEnd
    })

    if (firstTimers.length === 0) continue

    const daysSinceDate = differenceInCalendarDays(today, dateStart)
    const window7Closed = daysSinceDate >= 7
    const window15Closed = daysSinceDate >= 15
    const window30Closed = daysSinceDate >= 30

    const powerUsers7 = window7Closed
      ? firstTimers.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 7).length
      : null
    const within15 = window15Closed
      ? firstTimers.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 15).length
      : null
    const within30 = window30Closed
      ? firstTimers.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 30).length
      : null

    rows.push({
      date: format(dateStart, 'd MMM yyyy'),
      dateKey: format(dateStart, 'yyyy-MM-dd'),
      firstTimeOrders: firstTimers.length,
      powerUsers7,
      powerUsers7Pct: powerUsers7 != null ? (powerUsers7 / firstTimers.length) * 100 : null,
      within15,
      within15Pct: within15 != null ? (within15 / firstTimers.length) * 100 : null,
      within30,
      within30Pct: within30 != null ? (within30 / firstTimers.length) * 100 : null,
      pending7: !window7Closed,
    })
  }

  return rows
}

export function computeWeeklyPowerUsers(orders: Order[], productTagsMap: ProductTagsMap): WeekPowerUserRow[] {
  const customers = buildCustomerSummaries(orders, productTagsMap)
  const today = toZonedTime(new Date(), IST)
  const weeks: WeekPowerUserRow[] = []

  for (let w = 1; w <= 12; w++) {
    const weekEnd = endOfWeek(subWeeks(today, w), { weekStartsOn: 1 })
    const weekStart = startOfWeek(subWeeks(today, w), { weekStartsOn: 1 })

    const newThatWeek = customers.filter((c) => {
      const firstDate = toZonedTime(new Date(c.firstOrderDate), IST)
      return firstDate >= weekStart && firstDate <= weekEnd
    })

    if (newThatWeek.length === 0) continue

    const powerUsers = newThatWeek.filter((c) => c.isPowerUser)
    const within15 = newThatWeek.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 15)
    const within30 = newThatWeek.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 30)

    weeks.push({
      weekLabel: `${format(weekStart, 'd MMM')} – ${format(weekEnd, 'd MMM')}`,
      newCustomers: newThatWeek.length,
      powerUsers: powerUsers.length,
      powerUserPct: (powerUsers.length / newThatWeek.length) * 100,
      within15: within15.length,
      within15Pct: (within15.length / newThatWeek.length) * 100,
      within30: within30.length,
      within30Pct: (within30.length / newThatWeek.length) * 100,
    })
  }

  return weeks.reverse()
}

export function computeL2RepeatRates(
  orders: Order[],
  productTagsMap: ProductTagsMap
): L2RepeatRow[] {
  const customers = buildCustomerSummaries(orders, productTagsMap)
  const l2Tags = getAllL2Tags()

  return l2Tags
    .map((l2Tag) => {
      const buyersOfL2 = customers.filter((customer) =>
        customer.orders.some((order) => getL2ForOrder(order, productTagsMap).includes(l2Tag))
      )

      if (buyersOfL2.length === 0) return null

      const repeaters = buyersOfL2.filter((c) => c.totalOrders >= 2)

      return {
        l2Tag,
        l1: getL1ForL2(l2Tag),
        totalBuyers: buyersOfL2.length,
        repeaters: repeaters.length,
        repeatRate: (repeaters.length / buyersOfL2.length) * 100,
        avgOrdersRepeaters: avg(repeaters.map((c) => c.totalOrders)),
        avgDaysToRepeat: avg(
          repeaters.map((c) => c.daysToSecondOrder).filter((d): d is number => d != null)
        ),
        avgFirstOrderAOV: avg(
          buyersOfL2.map((c) => parseMoney(c.orders[0]?.total_price ?? '0'))
        ),
      }
    })
    .filter((r): r is L2RepeatRow => r != null && r.totalBuyers > 0)
    .sort((a, b) => b.repeatRate - a.repeatRate)
}

export function computeOrderCountCohortComparison(customers: CustomerSummary[]) {
  const buckets = [
    { label: '1 order', min: 1, max: 1 },
    { label: '2 orders', min: 2, max: 2 },
    { label: '3 orders', min: 3, max: 3 },
    { label: '4 orders', min: 4, max: 4 },
    { label: '5+ orders', min: 5, max: Infinity },
  ]

  return buckets.map((b) => {
    const cohort = customers.filter((c) => c.totalOrders >= b.min && c.totalOrders <= b.max)
    const appPct =
      cohort.length > 0 ? (cohort.filter((c) => c.primaryChannel === 'app').length / cohort.length) * 100 : 0
    const topL1 = cohort[0]?.primaryCategory ?? '—'
    return {
      label: b.label,
      customers: cohort.length,
      pctOfAll: customers.length > 0 ? (cohort.length / customers.length) * 100 : 0,
      avgFirstAov: avg(cohort.map((c) => parseMoney(c.orders[0]?.total_price ?? '0'))),
      topL1,
      appPct,
      avgDaysToSecond: avg(
        cohort.filter((c) => c.daysToSecondOrder != null).map((c) => c.daysToSecondOrder!)
      ),
      pctSecond7d:
        cohort.length > 0
          ? (cohort.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 7).length /
              cohort.length) *
            100
          : 0,
      cohort,
    }
  })
}

export function powerPctColor(pct: number | null): string {
  if (pct == null) return 'text-slate-400'
  if (pct >= 40) return 'text-[#16A34A] font-semibold'
  if (pct >= 30) return 'text-[#059669]'
  if (pct >= 20) return 'text-[#CA8A04]'
  if (pct >= 10) return 'text-[#EF4444]'
  return 'text-[#DC2626] font-semibold'
}

export function powerPctBg(pct: number | null): string {
  if (pct == null) return 'bg-slate-100 text-slate-500'
  if (pct >= 40) return 'bg-[#16A34A] text-white'
  if (pct >= 30) return 'bg-[#86EFAC] text-slate-900'
  if (pct >= 20) return 'bg-[#FDE68A] text-slate-900'
  if (pct >= 10) return 'bg-[#FCA5A5] text-slate-900'
  return 'bg-[#DC2626] text-white'
}
