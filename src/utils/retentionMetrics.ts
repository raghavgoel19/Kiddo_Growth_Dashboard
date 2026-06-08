import {
  differenceInCalendarDays,
  endOfWeek,
  format,
  parseISO,
  startOfWeek,
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

export function computeDailyPowerUsers(orders: Order[], _productTagsMap: ProductTagsMap): DailyPowerUserRow[] {
  const byCustomer = new Map<string, Order[]>()
  for (const order of orders) {
    const cid = order.customer?.id
    if (!cid) continue
    const list = byCustomer.get(cid) ?? []
    list.push(order)
    byCustomer.set(cid, list)
  }

  const today = toZonedTime(new Date(), IST)
  type FirstOrderRow = {
    customerId: string
    firstOrderDateKey: string
    isPowerUser: boolean
    daysToSecond: number | null
    windowClosed: boolean
  }

  const customerFirstOrderData: FirstOrderRow[] = []

  for (const [cid, customerOrders] of byCustomer) {
    const sorted = [...customerOrders].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const firstOrderIST = toZonedTime(new Date(sorted[0].created_at), IST)
    const firstOrderDateKey = format(firstOrderIST, 'yyyy-MM-dd')
    const daysSinceFirst = differenceInCalendarDays(today, firstOrderIST)
    const windowClosed = daysSinceFirst >= 7

    let daysToSecond: number | null = null
    let isPowerUser = false

    if (sorted.length >= 2) {
      const secondOrderIST = toZonedTime(new Date(sorted[1].created_at), IST)
      daysToSecond = differenceInCalendarDays(secondOrderIST, firstOrderIST)
      isPowerUser = daysToSecond <= 7
    }

    customerFirstOrderData.push({
      customerId: cid,
      firstOrderDateKey,
      isPowerUser,
      daysToSecond,
      windowClosed,
    })
  }

  const byDate = new Map<string, FirstOrderRow[]>()
  for (const row of customerFirstOrderData) {
    const list = byDate.get(row.firstOrderDateKey) ?? []
    list.push(row)
    byDate.set(row.firstOrderDateKey, list)
  }

  const rows: DailyPowerUserRow[] = []

  for (const [dateKey, cohort] of byDate) {
    const totalFirstTimers = cohort.length
    const closedWindowCustomers = cohort.filter((c) => c.windowClosed)
    const openWindowCustomers = cohort.filter((c) => !c.windowClosed)

    const powerUsers =
      closedWindowCustomers.length > 0
        ? closedWindowCustomers.filter((c) => c.isPowerUser).length
        : null
    const powerUserDenominator = closedWindowCustomers.length

    const within15 = cohort.filter((c) => c.daysToSecond != null && c.daysToSecond <= 15)
    const within30 = cohort.filter((c) => c.daysToSecond != null && c.daysToSecond <= 30)
    const daysSinceDate = differenceInCalendarDays(today, parseISO(dateKey))

    rows.push({
      date: format(parseISO(dateKey), 'd MMM yyyy'),
      dateKey,
      firstTimeOrders: totalFirstTimers,
      powerUsers7: powerUserDenominator > 0 ? powerUsers : null,
      powerUsers7Pct:
        powerUserDenominator > 0 && powerUsers != null
          ? (powerUsers / powerUserDenominator) * 100
          : null,
      within15: daysSinceDate >= 15 ? within15.length : null,
      within15Pct: daysSinceDate >= 15 ? (within15.length / totalFirstTimers) * 100 : null,
      within30: daysSinceDate >= 30 ? within30.length : null,
      within30Pct: daysSinceDate >= 30 ? (within30.length / totalFirstTimers) * 100 : null,
      pending7: openWindowCustomers.length > 0,
    })
  }

  return rows.sort((a, b) => b.dateKey.localeCompare(a.dateKey))
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
