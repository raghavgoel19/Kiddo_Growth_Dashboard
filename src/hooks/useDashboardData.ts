import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchRawData, loadCachedSnapshot, clearCache } from '../api/shopify'
import type { Customer, DashboardData, DashboardFilters, Order } from '../api/types'
import {
  bucketizeItemsPerOrder,
  bucketizeOrderValues,
  computeAOVTrend,
  computeCustomerCohort,
  computeKPIs,
  computeRevenueTrend,
  computeTopProducts,
  customersToPowerUsers,
  filterInternalAccounts,
  filterOrdersByDateRange,
  filterOrdersByStatus,
  getPowerUsers,
  getRecentOrders,
  groupByFinancialStatus,
} from '../utils/aggregators'

const defaultFilters: DashboardFilters = {
  dateRange: '12m',
  orderStatus: 'all',
}

interface RawData {
  orders: Order[]
  customers: Customer[]
  customerCount: number
}

function buildDashboardData(
  raw: RawData,
  filters: DashboardFilters,
  excludeInternal: boolean
): DashboardData {
  const filteredOrders = filterOrdersByStatus(
    filterOrdersByDateRange(raw.orders, filters.dateRange),
    filters.orderStatus
  )

  const filteredPowerUsers = filterInternalAccounts(
    getPowerUsers(raw.customers),
    excludeInternal
  )
  const powerUsers = customersToPowerUsers(filteredPowerUsers).sort(
    (a, b) => b.totalSpent - a.totalSpent
  )

  const aovTrend = computeAOVTrend(filteredOrders)
  const overallAOV =
    aovTrend.length > 0
      ? aovTrend.reduce((s, p) => s + p.aov, 0) / aovTrend.length
      : 0

  return {
    kpis: computeKPIs(filteredOrders, raw.customers, raw.customerCount),
    revenueTrend: computeRevenueTrend(filteredOrders),
    aovTrend,
    topProducts: computeTopProducts(filteredOrders),
    customerCohort: computeCustomerCohort(raw.customers),
    orderValueDistribution: bucketizeOrderValues(filteredOrders),
    itemsPerOrderDistribution: bucketizeItemsPerOrder(filteredOrders),
    orderStatusBreakdown: groupByFinancialStatus(filteredOrders),
    powerUsers,
    recentOrders: getRecentOrders(filteredOrders, 20),
    distributionOrders: filteredOrders,
    overallAOV,
  }
}

export function useDashboardData(filters: DashboardFilters = defaultFilters) {
  const [raw, setRaw] = useState<RawData | null>(null)
  const [excludeInternal, setExcludeInternal] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)
  const [fromCache, setFromCache] = useState(false)

  const applyResult = useCallback(
    (result: Awaited<ReturnType<typeof fetchRawData>>) => {
      setRaw(result.data)
      setLastFetched(new Date(result.fetchedAt))
      setFromCache(result.fromCache)
    },
    []
  )

  // Instant load: IndexedDB → then network (server disk cache, no Shopify hit)
  useEffect(() => {
    let cancelled = false

    async function init() {
      const local = await loadCachedSnapshot()
      if (cancelled) return

      if (local) {
        applyResult(local)
        setIsLoading(false)
      }

      try {
        setError(null)
        if (local) setIsRefreshing(true)
        const result = await fetchRawData()
        if (cancelled) return
        applyResult(result)
      } catch (err) {
        if (!cancelled && !local) {
          setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, [applyResult])

  const data = useMemo<DashboardData | null>(() => {
    if (!raw) return null
    return buildDashboardData(raw, filters, excludeInternal)
  }, [raw, filters, excludeInternal])

  const refetch = useCallback(async () => {
    setIsRefreshing(true)
    setError(null)
    try {
      clearCache()
      const result = await fetchRawData('all')
      applyResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh')
    } finally {
      setIsRefreshing(false)
    }
  }, [applyResult])

  const refetchRecentOrders = useCallback(async () => {
    await refetch()
  }, [refetch])

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    lastFetched,
    fromCache,
    refetch,
    refetchRecentOrders,
    excludeInternal,
    setExcludeInternal,
  }
}

export type UseDashboardDataReturn = ReturnType<typeof useDashboardData>
