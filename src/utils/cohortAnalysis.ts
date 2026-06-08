import { differenceInCalendarDays, format, getDay, getHours } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { DistanceBand, Order, ProductTagsMap } from '../api/types'
import { getOrderChannel } from './channel'
import { parseMoney } from './formatters'
import {
  avg,
  buildCustomerSummaries,
  computeRepeatRate,
  getOrderL1Categories,
  type CustomerSummary,
} from './customerSummary'
import { classifyOrderPrimary, getL2ForOrder, L1_TAGS } from './taxonomy'
import { IST } from './dates'

export type CategoryMode = 'any' | 'only' | 'contains' | 'excludes'

export interface CohortFilters {
  categoryMode: CategoryMode
  selectedL1: string[]
  channel: 'all' | 'app' | 'website'
  minOrders: number | null
  maxOrders: number | null
  minSpend: number | null
  maxSpend: number | null
  minAOV: number | null
  maxAOV: number | null
  inactiveDaysMin: number | null
  hasDiscount: 'either' | 'yes' | 'no'
  firstOrderFrom: string | null
  firstOrderTo: string | null
  lastOrderFrom: string | null
  lastOrderTo: string | null
  distanceBands: DistanceBand[]
  pincodes: string[]
}

export const DEFAULT_COHORT_FILTERS: CohortFilters = {
  categoryMode: 'any',
  selectedL1: [],
  channel: 'all',
  minOrders: null,
  maxOrders: null,
  minSpend: null,
  maxSpend: null,
  minAOV: null,
  maxAOV: null,
  inactiveDaysMin: null,
  hasDiscount: 'either',
  firstOrderFrom: null,
  firstOrderTo: null,
  lastOrderFrom: null,
  lastOrderTo: null,
  distanceBands: [],
  pincodes: [],
}

export const PRESET_COHORTS: Record<string, Partial<CohortFilters>> = {
  'Only Essentials buyers': { categoryMode: 'only', selectedL1: ['Essentials'] },
  'Only Fashion buyers': { categoryMode: 'only', selectedL1: ['fashion'] },
  'Churn risk': { minOrders: 2, inactiveDaysMin: 13 },
  'Power users': { minOrders: 5 },
  'App-only users': { channel: 'app' },
  'Hyper-local': { distanceBands: ['0-5km'] },
  'First-timers last 7 days': {
    maxOrders: 1,
    firstOrderFrom: format(toZonedTime(new Date(Date.now() - 7 * 86_400_000), IST), 'yyyy-MM-dd'),
  },
  '0 rs cohort': { maxSpend: 0 },
}

export const INACTIVE_PRESETS = [
  { label: 'At risk (5d+)', days: 5 },
  { label: 'Lapsing (13d+)', days: 13 },
  { label: 'Churned (20d+)', days: 20 },
  { label: 'Lost (30d+)', days: 30 },
] as const

function matchesInactiveFilter(customer: CustomerSummary, inactiveDaysMin: number): boolean {
  return customer.daysSinceLastOrder >= inactiveDaysMin
}

function customerHasOrderMatchingDiscount(customer: CustomerSummary, mode: 'yes' | 'no'): boolean {
  const hasDiscount = customer.orders.some((o) => (o.discount_codes?.length ?? 0) > 0)
  return mode === 'yes' ? hasDiscount : !hasDiscount
}

export function applyCustomerFilters(
  _orders: Order[],
  customers: CustomerSummary[],
  filters: CohortFilters,
  productTagsMap: ProductTagsMap
): CustomerSummary[] {
  return customers.filter((customer) => {
    if (filters.minOrders != null && customer.totalOrders < filters.minOrders) return false
    if (filters.maxOrders != null && customer.totalOrders > filters.maxOrders) return false
    if (filters.minSpend != null && customer.totalSpent < filters.minSpend) return false
    if (filters.maxSpend != null && customer.totalSpent > filters.maxSpend) return false

    const aov = customer.aov
    if (filters.minAOV != null && aov < filters.minAOV) return false
    if (filters.maxAOV != null && aov > filters.maxAOV) return false

    if (filters.inactiveDaysMin != null && !matchesInactiveFilter(customer, filters.inactiveDaysMin)) {
      return false
    }

    if (filters.channel !== 'all' && customer.primaryChannel !== filters.channel) return false

    if (filters.distanceBands.length > 0 && !filters.distanceBands.includes(customer.distanceBand)) {
      return false
    }

    if (filters.pincodes.length) {
      const match = customer.orders.some((o) => {
        const zip = o.shipping_address?.zip ?? ''
        return filters.pincodes.some((p) => zip.includes(p.trim()))
      })
      if (!match) return false
    }

    if (filters.hasDiscount === 'yes' && !customerHasOrderMatchingDiscount(customer, 'yes')) return false
    if (filters.hasDiscount === 'no' && !customerHasOrderMatchingDiscount(customer, 'no')) return false

    if (filters.selectedL1.length > 0) {
      const customerCategories = new Set<string>()
      for (const order of customer.orders) {
        for (const cat of getOrderL1Categories(order, productTagsMap)) {
          customerCategories.add(cat)
        }
      }

      if (filters.categoryMode === 'only') {
        if (![...customerCategories].every((c) => filters.selectedL1.includes(c))) return false
        if (customerCategories.size === 0) return false
      } else if (filters.categoryMode === 'contains') {
        if (!filters.selectedL1.some((c) => customerCategories.has(c))) return false
      } else if (filters.categoryMode === 'excludes') {
        if (filters.selectedL1.some((c) => customerCategories.has(c))) return false
      }
    }

    if (filters.firstOrderFrom && new Date(customer.firstOrderDate) < new Date(filters.firstOrderFrom)) {
      return false
    }
    if (filters.firstOrderTo && new Date(customer.firstOrderDate) > new Date(`${filters.firstOrderTo}T23:59:59`)) {
      return false
    }
    if (filters.lastOrderFrom && new Date(customer.lastOrderDate) < new Date(filters.lastOrderFrom)) {
      return false
    }
    if (filters.lastOrderTo && new Date(customer.lastOrderDate) > new Date(`${filters.lastOrderTo}T23:59:59`)) {
      return false
    }

    return true
  })
}

export interface CohortDeepAnalysis {
  customers: CustomerSummary[]
  cohortOrders: Order[]
  summary: {
    customers: number
    orders: number
    gmv: number
    gmvShare: number
  }
  behaviour: {
    repeatRate: number
    avgOrdersPerCustomer: number
    avgSpend: number
    aov: number
    avgItemsPerOrder: number
    avgDaysBetweenOrders: number
    appPct: number
    websitePct: number
    avgDistanceKm: number
  }
  aovTrend: { month: string; cohortAov: number; storeAov: number }[]
  firstOrder: {
    l1Donut: { name: string; value: number }[]
    l2Bars: { name: string; count: number }[]
    aovHistogram: { label: string; count: number }[]
    channelDonut: { name: string; value: number }[]
    hourBars: { hour: string; count: number }[]
    dowBars: { day: string; count: number }[]
  }
  frequency: {
    histogram: { label: string; count: number }[]
    daysBetweenHistogram: { label: string; count: number }[]
    avgDaysToSecond: number
    pctSecondWithin7d: number
    pctSecondWithin30d: number
  }
  churn: {
    avgDaysSinceLast: number
    buckets: { label: string; count: number }[]
    churnRiskPct: number
  }
  categoryEvolution: { firstCategory: string; samePct: number; topSwitch: string; topSwitchPct: number }[]
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getFirstOrder(customer: CustomerSummary): Order {
  return customer.orders[0]
}

export function computeCohortDeepAnalysis(
  orders: Order[],
  filters: CohortFilters,
  productTagsMap: ProductTagsMap
): CohortDeepAnalysis {
  const allCustomers = buildCustomerSummaries(orders, productTagsMap)
  const customers = applyCustomerFilters(orders, allCustomers, filters, productTagsMap)
  const idSet = new Set(customers.map((c) => c.id))
  const cohortOrders = orders.filter((o) => o.customer?.id && idSet.has(o.customer.id))

  const gmv = cohortOrders.reduce((s, o) => s + parseMoney(o.total_price), 0)
  const allGmv = orders.reduce((s, o) => s + parseMoney(o.total_price), 0)

  const repeatRate = computeRepeatRate(customers)
  const avgOrdersPerCustomer = avg(customers.map((c) => c.totalOrders))
  const avgSpend = avg(customers.map((c) => c.totalSpent))
  const aov = cohortOrders.length > 0 ? gmv / cohortOrders.length : 0
  const avgItemsPerOrder =
    cohortOrders.length > 0
      ? cohortOrders.reduce((s, o) => s + (o.line_items ?? []).reduce((n, li) => n + (li.quantity ?? 0), 0), 0) /
        cohortOrders.length
      : 0

  const gaps: number[] = []
  for (const c of customers) {
    for (let i = 1; i < c.orders.length; i++) {
      const prev = toZonedTime(new Date(c.orders[i - 1].created_at), IST)
      const cur = toZonedTime(new Date(c.orders[i].created_at), IST)
      gaps.push(differenceInCalendarDays(cur, prev))
    }
  }

  const appPct =
    customers.length > 0
      ? (customers.filter((c) => c.primaryChannel === 'app').length / customers.length) * 100
      : 0

  const monthMap = new Map<string, { cohortSum: number; cohortN: number; storeSum: number; storeN: number }>()
  for (const order of orders) {
    const month = format(toZonedTime(new Date(order.created_at), IST), 'yyyy-MM')
    const entry = monthMap.get(month) ?? { cohortSum: 0, cohortN: 0, storeSum: 0, storeN: 0 }
    entry.storeSum += parseMoney(order.total_price)
    entry.storeN += 1
    if (order.customer?.id && idSet.has(order.customer.id)) {
      entry.cohortSum += parseMoney(order.total_price)
      entry.cohortN += 1
    }
    monthMap.set(month, entry)
  }

  const aovTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, v]) => ({
      month,
      cohortAov: v.cohortN > 0 ? v.cohortSum / v.cohortN : 0,
      storeAov: v.storeN > 0 ? v.storeSum / v.storeN : 0,
    }))

  const l1Map = new Map<string, number>()
  const l2Map = new Map<string, number>()
  const firstAovBuckets = [
    { label: '<₹500', min: 0, max: 500 },
    { label: '₹500–1k', min: 500, max: 1000 },
    { label: '₹1k–2k', min: 1000, max: 2000 },
    { label: '₹2k+', min: 2000, max: Infinity },
  ]
  const firstAovHist = firstAovBuckets.map((b) => ({ label: b.label, count: 0 }))
  const channelMap = new Map<string, number>()
  const hourMap = new Map<number, number>()
  const dowMap = new Map<number, number>()

  for (const customer of customers) {
    const first = getFirstOrder(customer)
    for (const cat of getOrderL1Categories(first, productTagsMap)) {
      l1Map.set(cat, (l1Map.get(cat) ?? 0) + 1)
    }
    for (const l2 of getL2ForOrder(first, productTagsMap)) {
      l2Map.set(l2, (l2Map.get(l2) ?? 0) + 1)
    }
    const price = parseMoney(first.total_price)
    const idx = firstAovBuckets.findIndex((b) => price >= b.min && price < b.max)
    if (idx >= 0) firstAovHist[idx].count += 1

    const ch = getOrderChannel(first)
    channelMap.set(ch, (channelMap.get(ch) ?? 0) + 1)

    const ist = toZonedTime(new Date(first.created_at), IST)
    hourMap.set(getHours(ist), (hourMap.get(getHours(ist)) ?? 0) + 1)
    dowMap.set(getDay(ist), (dowMap.get(getDay(ist)) ?? 0) + 1)
  }

  const freqBuckets = [
    { label: '1', min: 1, max: 1 },
    { label: '2', min: 2, max: 2 },
    { label: '3–5', min: 3, max: 5 },
    { label: '6–10', min: 6, max: 10 },
    { label: '11+', min: 11, max: Infinity },
  ]

  const gapBuckets = [
    { label: '0–3d', min: 0, max: 3 },
    { label: '4–7d', min: 4, max: 7 },
    { label: '8–14d', min: 8, max: 14 },
    { label: '15–30d', min: 15, max: 30 },
    { label: '31d+', min: 31, max: Infinity },
  ]

  const withSecond = customers.filter((c) => c.daysToSecondOrder != null)
  const pctSecondWithin7d =
    customers.length > 0
      ? (customers.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 7).length /
          customers.length) *
        100
      : 0
  const pctSecondWithin30d =
    customers.length > 0
      ? (customers.filter((c) => c.daysToSecondOrder != null && c.daysToSecondOrder <= 30).length /
          customers.length) *
        100
      : 0

  const churnBuckets = [
    { label: 'Last 7d', min: 0, max: 7 },
    { label: '8–14d', min: 8, max: 14 },
    { label: '15–30d', min: 15, max: 30 },
    { label: '30d+', min: 31, max: Infinity },
  ]

  const churnBucketCounts = churnBuckets.map((b) => ({
    label: b.label,
    count: customers.filter((c) => c.daysSinceLastOrder >= b.min && c.daysSinceLastOrder <= b.max).length,
  }))

  const categoryEvolution: CohortDeepAnalysis['categoryEvolution'] = []
  for (const l1 of L1_TAGS) {
    const withTwo = customers.filter((c) => {
      if (c.orders.length < 2) return false
      const firstCat = classifyOrderPrimary(c.orders[0], productTagsMap)
      return firstCat === l1
    })
    if (withTwo.length === 0) continue
    let same = 0
    const switches = new Map<string, number>()
    for (const c of withTwo) {
      const firstCat = classifyOrderPrimary(c.orders[0], productTagsMap)
      const secondCat = classifyOrderPrimary(c.orders[1], productTagsMap)
      if (firstCat === secondCat) same++
      else switches.set(secondCat, (switches.get(secondCat) ?? 0) + 1)
    }
    const topSwitch = [...switches.entries()].sort((a, b) => b[1] - a[1])[0]
    categoryEvolution.push({
      firstCategory: l1,
      samePct: (same / withTwo.length) * 100,
      topSwitch: topSwitch?.[0] ?? '—',
      topSwitchPct: topSwitch ? (topSwitch[1] / withTwo.length) * 100 : 0,
    })
  }

  return {
    customers,
    cohortOrders,
    summary: {
      customers: customers.length,
      orders: cohortOrders.length,
      gmv,
      gmvShare: allGmv > 0 ? (gmv / allGmv) * 100 : 0,
    },
    behaviour: {
      repeatRate,
      avgOrdersPerCustomer,
      avgSpend,
      aov,
      avgItemsPerOrder,
      avgDaysBetweenOrders: avg(gaps),
      appPct,
      websitePct: 100 - appPct,
      avgDistanceKm: 0,
    },
    aovTrend,
    firstOrder: {
      l1Donut: Array.from(l1Map.entries()).map(([name, value]) => ({ name, value })),
      l2Bars: Array.from(l2Map.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
      aovHistogram: firstAovHist,
      channelDonut: Array.from(channelMap.entries()).map(([name, value]) => ({ name, value })),
      hourBars: Array.from({ length: 24 }, (_, h) => ({
        hour: `${h}:00`,
        count: hourMap.get(h) ?? 0,
      })),
      dowBars: DOW.map((day, i) => ({ day, count: dowMap.get(i) ?? 0 })),
    },
    frequency: {
      histogram: freqBuckets.map((b) => ({
        label: b.label,
        count: customers.filter((c) => c.totalOrders >= b.min && c.totalOrders <= b.max).length,
      })),
      daysBetweenHistogram: gapBuckets.map((b) => ({
        label: b.label,
        count: gaps.filter((g) => g >= b.min && g <= b.max).length,
      })),
      avgDaysToSecond: avg(withSecond.map((c) => c.daysToSecondOrder!)),
      pctSecondWithin7d,
      pctSecondWithin30d,
    },
    churn: {
      avgDaysSinceLast: avg(customers.map((c) => c.daysSinceLastOrder)),
      buckets: churnBucketCounts,
      churnRiskPct:
        customers.length > 0
          ? (customers.filter((c) => c.daysSinceLastOrder >= 20).length / customers.length) * 100
          : 0,
    },
    categoryEvolution,
  }
}
