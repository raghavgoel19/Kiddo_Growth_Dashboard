import { useMemo, useState, useCallback } from 'react'
import type { Customer, Order, ProductTagsMap } from '../api/types'
import type { DistanceBand } from '../api/types'
import { L1_TAGS } from '../utils/taxonomy'
import { classifyOrder, classifyOrderPrimary } from '../utils/taxonomy'
import { getOrderChannel } from '../utils/channel'
import { getDistanceBand } from '../utils/geography'
import { parseMoney } from '../utils/formatters'
import { getOrderItemCount } from '../utils/aggregators'

export interface CohortFilters {
  categories: string[]
  channel: 'all' | 'app' | 'website'
  minOrders: number | null
  maxOrders: number | null
  minSpend: number | null
  maxSpend: number | null
  minAov: number | null
  maxAov: number | null
  hasDiscount: 'either' | 'yes' | 'no'
  firstOrderFrom: string | null
  firstOrderTo: string | null
  lastOrderFrom: string | null
  lastOrderTo: string | null
  minDaysSinceLastOrder: number | null
  distanceBands: DistanceBand[]
  pincodes: string[]
}

export const DEFAULT_COHORT_FILTERS: CohortFilters = {
  categories: [],
  channel: 'all',
  minOrders: null,
  maxOrders: null,
  minSpend: null,
  maxSpend: null,
  minAov: null,
  maxAov: null,
  hasDiscount: 'either',
  firstOrderFrom: null,
  firstOrderTo: null,
  lastOrderFrom: null,
  lastOrderTo: null,
  minDaysSinceLastOrder: null,
  distanceBands: [],
  pincodes: [],
}

const SAVED_KEY = 'kiddo-saved-cohorts'

export function useCohortBuilder(orders: Order[], customers: Customer[], productTagsMap: ProductTagsMap) {
  const [filters, setFilters] = useState<CohortFilters>(DEFAULT_COHORT_FILTERS)
  const [savedCohorts, setSavedCohorts] = useState<{ name: string; filters: CohortFilters }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]')
    } catch {
      return []
    }
  })

  const matchingOrders = useMemo(() => {
    return orders.filter((order) => {
      const customer = order.customer
      if (!customer) return false

      if (filters.categories.length) {
        const cats = classifyOrder(order, productTagsMap)
        if (!filters.categories.some((c) => cats.includes(c as (typeof L1_TAGS)[number]))) return false
      }

      if (filters.channel !== 'all') {
        const ch = getOrderChannel(order)
        if (filters.channel === 'app' && ch !== 'app') return false
        if (filters.channel === 'website' && ch !== 'website') return false
      }

      if (filters.hasDiscount === 'yes' && !(order.discount_codes?.length)) return false
      if (filters.hasDiscount === 'no' && order.discount_codes?.length) return false

      if (filters.distanceBands.length && !filters.distanceBands.includes(getDistanceBand(order))) return false

      if (filters.pincodes.length) {
        const zip = order.shipping_address?.zip ?? ''
        if (!filters.pincodes.some((p) => zip.includes(p.trim()))) return false
      }

      return true
    })
  }, [orders, filters, productTagsMap])

  const matchingCustomers = useMemo(() => {
    const byCustomer = new Map<string, Order[]>()
    for (const o of matchingOrders) {
      const id = o.customer?.id
      if (!id) continue
      const list = byCustomer.get(id) ?? []
      list.push(o)
      byCustomer.set(id, list)
    }

    return customers.filter((c) => {
      const customerOrders = byCustomer.get(c.id) ?? orders.filter((o) => o.customer?.id === c.id)
      if (!customerOrders.length) return false

      const spent = parseMoney(c.total_spent)
      const aov = c.orders_count > 0 ? spent / c.orders_count : 0
      if (filters.minOrders != null && c.orders_count < filters.minOrders) return false
      if (filters.maxOrders != null && c.orders_count > filters.maxOrders) return false
      if (filters.minSpend != null && spent < filters.minSpend) return false
      if (filters.maxSpend != null && spent > filters.maxSpend) return false
      if (filters.minAov != null && aov < filters.minAov) return false
      if (filters.maxAov != null && aov > filters.maxAov) return false

      const sorted = [...customerOrders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const first = sorted[0]
      const last = sorted[sorted.length - 1]

      if (filters.firstOrderFrom && new Date(first.created_at) < new Date(filters.firstOrderFrom)) return false
      if (filters.firstOrderTo && new Date(first.created_at) > new Date(filters.firstOrderTo)) return false
      if (filters.lastOrderFrom && new Date(last.created_at) < new Date(filters.lastOrderFrom)) return false
      if (filters.lastOrderTo && new Date(last.created_at) > new Date(filters.lastOrderTo)) return false

      if (filters.minDaysSinceLastOrder != null) {
        const days = Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86_400_000)
        if (days < filters.minDaysSinceLastOrder) return false
      }

      if (filters.categories.length) {
        const onlyThese = customerOrders.every((o) => {
          const primary = classifyOrderPrimary(o, productTagsMap)
          return filters.categories.includes(primary === 'Uncategorized' ? 'Uncategorized' : primary)
        })
        if (!onlyThese) return false
      }

      return byCustomer.has(c.id)
    })
  }, [customers, matchingOrders, orders, filters, productTagsMap])

  const cohortOrders = useMemo(() => {
    const ids = new Set(matchingCustomers.map((c) => c.id))
    return orders.filter((o) => o.customer?.id && ids.has(o.customer.id))
  }, [orders, matchingCustomers])

  const saveCohort = useCallback(
    (name: string) => {
      const next = [...savedCohorts.filter((s) => s.name !== name), { name, filters }]
      setSavedCohorts(next)
      localStorage.setItem(SAVED_KEY, JSON.stringify(next))
    },
    [filters, savedCohorts]
  )

  const applyPreset = useCallback((preset: Partial<CohortFilters>) => {
    setFilters({ ...DEFAULT_COHORT_FILTERS, ...preset })
  }, [])

  const totalGmv = cohortOrders.reduce((s, o) => s + parseMoney(o.total_price), 0)
  const allGmv = orders.reduce((s, o) => s + parseMoney(o.total_price), 0)

  const frequencyHistogram = useMemo(() => {
    const buckets = [
      { label: '1', min: 1, max: 1 },
      { label: '2', min: 2, max: 2 },
      { label: '3', min: 3, max: 3 },
      { label: '4–5', min: 4, max: 5 },
      { label: '6–10', min: 6, max: 10 },
      { label: '11+', min: 11, max: Infinity },
    ]
    return buckets.map((b) => ({
      label: b.label,
      count: matchingCustomers.filter((c) => c.orders_count >= b.min && c.orders_count <= b.max).length,
    }))
  }, [matchingCustomers])

  const aovDistribution = useMemo(() => {
    const buckets = [
      { label: '<₹500', min: 0, max: 500 },
      { label: '₹500–1k', min: 500, max: 1000 },
      { label: '₹1k–2k', min: 1000, max: 2000 },
      { label: '₹2k–5k', min: 2000, max: 5000 },
      { label: '₹5k+', min: 5000, max: Infinity },
    ]
    return buckets.map((b) => ({
      label: b.label,
      count: cohortOrders.filter((o) => {
        const v = parseMoney(o.total_price)
        return v >= b.min && v < b.max
      }).length,
    }))
  }, [cohortOrders])

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of cohortOrders) {
      const key = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
      }).format(new Date(o.created_at))
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, orders]) => ({ month, orders }))
  }, [cohortOrders])

  return {
    filters,
    setFilters,
    matchingCustomers,
    cohortOrders,
    savedCohorts,
    saveCohort,
    applyPreset,
    frequencyHistogram,
    aovDistribution,
    monthlyTrend,
    summary: {
      customers: matchingCustomers.length,
      orders: cohortOrders.length,
      gmv: totalGmv,
      gmvShare: allGmv > 0 ? (totalGmv / allGmv) * 100 : 0,
      repeatRate:
        matchingCustomers.length > 0
          ? (matchingCustomers.filter((c) => c.orders_count > 1).length / matchingCustomers.length) * 100
          : 0,
      aov: cohortOrders.length > 0 ? totalGmv / cohortOrders.length : 0,
      avgItems:
        cohortOrders.length > 0
          ? cohortOrders.reduce((s, o) => s + getOrderItemCount(o), 0) / cohortOrders.length
          : 0,
    },
  }
}

export const COHORT_PRESETS: { label: string; filters: Partial<CohortFilters> }[] = [
  { label: 'Only Essentials buyers', filters: { categories: ['Essentials'] } },
  { label: 'Only Fashion buyers', filters: { categories: ['fashion'] } },
  { label: 'Churn risk', filters: { minOrders: 2, minDaysSinceLastOrder: 30 } },
  { label: 'Power users', filters: { minOrders: 5 } },
  { label: 'App-only users', filters: { channel: 'app' } },
  { label: 'Hyper-local', filters: { distanceBands: ['0-5km'] } },
  { label: 'First-timers last 7 days', filters: { minOrders: 1, maxOrders: 1 } },
]
