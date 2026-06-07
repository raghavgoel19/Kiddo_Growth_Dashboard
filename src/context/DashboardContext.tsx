import { createContext, useCallback, useContext, useDeferredValue, useMemo, useState, type ReactNode } from 'react'
import type { Customer, Order, ProductTagsMap } from '../api/types'
import type { FullDateRange, OrderStatus } from '../api/types'
import { filterOrdersByPeriod, filterOrdersByCustomRange, formatCustomRangeLabel } from '../utils/dates'
import { filterTestOrders, filterTestCustomers } from '../utils/testUserFilter'

export type CompareMode = 'previous' | 'lastYear' | 'custom' | null
export type DateMode = 'preset' | 'custom'

export interface GlobalFilters {
  dateMode: DateMode
  dateRange: FullDateRange
  customFrom: string | null
  customTo: string | null
  compareCustomFrom: string | null
  compareCustomTo: string | null
  orderStatuses: OrderStatus[]
  compareEnabled: boolean
  compareMode: CompareMode
  hideTestUsers: boolean
}

export interface DrillDownState {
  title: string
  subtitle: string
  orders: Order[]
}

interface DashboardContextValue {
  filters: GlobalFilters
  setDateRange: (range: FullDateRange) => void
  setCustomRange: (from: string | null, to: string | null) => void
  setCompareCustomRange: (from: string | null, to: string | null) => void
  toggleOrderStatus: (status: OrderStatus) => void
  setCompareEnabled: (v: boolean) => void
  setCompareMode: (mode: CompareMode) => void
  setHideTestUsers: (v: boolean) => void
  clearFilters: () => void
  kpiOverrides: Record<string, FullDateRange>
  setKpiOverride: (id: string, range: FullDateRange | null) => void
  filteredOrders: Order[]
  filteredCustomers: Customer[]
  drillDown: DrillDownState | null
  openDrillDown: (state: DrillDownState) => void
  closeDrillDown: () => void
  selectedOrder: Order | null
  openOrderDetail: (order: Order) => void
  closeOrderDetail: () => void
  allOrders: Order[]
  allCustomers: Customer[]
  productTagsMap: ProductTagsMap
}

const STORAGE_KEY = 'kiddo-hide-test-users'

const defaultFilters: GlobalFilters = {
  dateMode: 'preset',
  dateRange: '30d',
  customFrom: null,
  customTo: null,
  compareCustomFrom: null,
  compareCustomTo: null,
  orderStatuses: ['all'],
  compareEnabled: false,
  compareMode: null,
  hideTestUsers: localStorage.getItem(STORAGE_KEY) === 'true',
}

const DashboardContext = createContext<DashboardContextValue | null>(null)

function applyDateFilter(orders: Order[], filters: GlobalFilters): Order[] {
  if (filters.dateMode === 'custom' && filters.customFrom && filters.customTo) {
    return filterOrdersByCustomRange(orders, filters.customFrom, filters.customTo)
  }
  return filterOrdersByPeriod(orders, filters.dateRange)
}

function applyStatusFilter(orders: Order[], statuses: OrderStatus[]): Order[] {
  if (statuses.includes('all') || statuses.length === 0) return orders
  return orders.filter((o) => {
    if (statuses.includes('cancelled') && o.cancelled_at) return true
    return statuses.includes(o.financial_status as OrderStatus)
  })
}

export function DashboardProvider({
  orders,
  customers,
  productTagsMap,
  children,
}: {
  orders: Order[]
  customers: Customer[]
  productTagsMap: ProductTagsMap
  children: ReactNode
}) {
  const [filters, setFilters] = useState<GlobalFilters>(defaultFilters)
  const deferredFilters = useDeferredValue(filters)
  const [kpiOverrides, setKpiOverridesState] = useState<Record<string, FullDateRange>>({})
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  const setCustomRangeWithLog = useCallback(
    (customFrom: string | null, customTo: string | null) => {
      if (customFrom && customTo) {
        const matched = filterOrdersByCustomRange(orders, customFrom, customTo)
        console.log('[DateFilter] Applied:', {
          from: customFrom,
          to: customTo,
          matched: matched.length,
          label: formatCustomRangeLabel(customFrom, customTo),
        })
      }
      setFilters((f) => ({
        ...f,
        dateMode: 'custom',
        customFrom,
        customTo,
      }))
    },
    [orders]
  )

  const setHideTestUsers = useCallback((v: boolean) => {
    localStorage.setItem(STORAGE_KEY, String(v))
    setFilters((f) => ({ ...f, hideTestUsers: v }))
  }, [])

  const setKpiOverride = useCallback((id: string, range: FullDateRange | null) => {
    setKpiOverridesState((prev) => {
      const next = { ...prev }
      if (range == null) delete next[id]
      else next[id] = range
      return next
    })
  }, [])

  const filteredOrders = useMemo(() => {
    let result = applyDateFilter(orders, deferredFilters)
    result = applyStatusFilter(result, deferredFilters.orderStatuses)
    result = filterTestOrders(result, deferredFilters.hideTestUsers)
    return result
  }, [orders, deferredFilters])

  const filteredCustomers = useMemo(() => {
    const ids = new Set(filteredOrders.map((o) => o.customer?.id).filter(Boolean))
    const matched = customers.filter((c) => ids.has(c.id))
    return filterTestCustomers(matched, filters.hideTestUsers)
  }, [customers, filteredOrders, filters.hideTestUsers])

  const value: DashboardContextValue = {
    filters,
    setDateRange: (dateRange) =>
      setFilters((f) => ({
        ...f,
        dateMode: 'preset',
        dateRange,
        customFrom: null,
        customTo: null,
      })),
    setCustomRange: setCustomRangeWithLog,
    setCompareCustomRange: (compareCustomFrom, compareCustomTo) =>
      setFilters((f) => ({ ...f, compareCustomFrom, compareCustomTo })),
    toggleOrderStatus: (status) =>
      setFilters((f) => {
        if (status === 'all') return { ...f, orderStatuses: ['all'] }
        const withoutAll = f.orderStatuses.filter((s) => s !== 'all')
        const has = withoutAll.includes(status)
        const next = has ? withoutAll.filter((s) => s !== status) : [...withoutAll, status]
        return { ...f, orderStatuses: next.length ? next : ['all'] }
      }),
    setCompareEnabled: (compareEnabled) =>
      setFilters((f) => ({
        ...f,
        compareEnabled,
        compareMode: compareEnabled && !f.compareMode ? 'previous' : f.compareMode,
      })),
    setCompareMode: (compareMode) => setFilters((f) => ({ ...f, compareMode })),
    setHideTestUsers,
    clearFilters: () =>
      setFilters({ ...defaultFilters, hideTestUsers: filters.hideTestUsers }),
    kpiOverrides,
    setKpiOverride,
    filteredOrders,
    filteredCustomers,
    drillDown,
    openDrillDown: setDrillDown,
    closeDrillDown: () => setDrillDown(null),
    selectedOrder,
    openOrderDetail: setSelectedOrder,
    closeOrderDetail: () => setSelectedOrder(null),
    allOrders: orders,
    allCustomers: customers,
    productTagsMap,
  }

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>
}

export function useDashboardContext() {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboardContext must be used within DashboardProvider')
  return ctx
}

export function useDrillDown() {
  const { openDrillDown, openOrderDetail } = useDashboardContext()
  return { openDrillDown, openOrderDetail }
}
