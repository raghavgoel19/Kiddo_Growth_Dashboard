import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from 'react'
import type { Customer, Order, ProductTagsMap } from '../api/types'
import type { FullDateRange, OrderStatus } from '../api/types'
import { filterOrdersByCustomRange, formatCustomRangeLabel } from '../utils/dates'
import { defaultFilters, setFiltersDebounced, useDashboardStore } from '../store'
import { useFilterWorker } from '../hooks/useComputeWorker'

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
  isFiltering: boolean
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

const DashboardContext = createContext<DashboardContextValue | null>(null)

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
  const setRawOrders = useDashboardStore((s) => s.setRawOrders)
  const setCustomers = useDashboardStore((s) => s.setCustomers)
  const setProductTagsMap = useDashboardStore((s) => s.setProductTagsMap)
  const filters = useDashboardStore((s) => s.filters)
  const setFiltersImmediate = useDashboardStore((s) => s.setFiltersImmediate)
  const filteredOrders = useDashboardStore((s) => s.filteredOrders)
  const filteredCustomers = useDashboardStore((s) => s.filteredCustomers)
  const isFiltering = useDashboardStore((s) => s.isFiltering)

  useEffect(() => {
    setRawOrders(orders)
  }, [orders, setRawOrders])

  useEffect(() => {
    setCustomers(customers)
  }, [customers, setCustomers])

  useEffect(() => {
    setProductTagsMap(productTagsMap)
  }, [productTagsMap, setProductTagsMap])

  useFilterWorker()

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
      setFiltersImmediate({
        ...filters,
        dateMode: 'custom',
        customFrom,
        customTo,
      })
    },
    [orders, filters, setFiltersImmediate]
  )

  const setHideTestUsers = useCallback(
    (v: boolean) => {
      localStorage.setItem(STORAGE_KEY, String(v))
      setFiltersImmediate({ ...filters, hideTestUsers: v })
    },
    [filters, setFiltersImmediate]
  )

  const setKpiOverride = useCallback((id: string, range: FullDateRange | null) => {
    setKpiOverridesState((prev) => {
      const next = { ...prev }
      if (range == null) delete next[id]
      else next[id] = range
      return next
    })
  }, [])

  const updateFiltersDebounced = useCallback(
    (next: GlobalFilters) => {
      setFiltersDebounced(next)
    },
    []
  )

  const value: DashboardContextValue = useMemo(
    () => ({
      filters,
      setDateRange: (dateRange) =>
        setFiltersImmediate({
          ...filters,
          dateMode: 'preset',
          dateRange,
          customFrom: null,
          customTo: null,
        }),
      setCustomRange: setCustomRangeWithLog,
      setCompareCustomRange: (compareCustomFrom, compareCustomTo) =>
        setFiltersImmediate({ ...filters, compareCustomFrom, compareCustomTo }),
      toggleOrderStatus: (status) => {
        const next =
          status === 'all'
            ? { ...filters, orderStatuses: ['all'] as OrderStatus[] }
            : (() => {
                const withoutAll = filters.orderStatuses.filter((s) => s !== 'all')
                const has = withoutAll.includes(status)
                const statuses = has ? withoutAll.filter((s) => s !== status) : [...withoutAll, status]
                return { ...filters, orderStatuses: statuses.length ? statuses : (['all'] as OrderStatus[]) }
              })()
        updateFiltersDebounced(next)
      },
      setCompareEnabled: (compareEnabled) =>
        updateFiltersDebounced({
          ...filters,
          compareEnabled,
          compareMode: compareEnabled && !filters.compareMode ? 'previous' : filters.compareMode,
        }),
      setCompareMode: (compareMode) => updateFiltersDebounced({ ...filters, compareMode }),
      setHideTestUsers,
      clearFilters: () =>
        setFiltersImmediate({ ...defaultFilters, hideTestUsers: filters.hideTestUsers }),
      kpiOverrides,
      setKpiOverride,
      filteredOrders,
      filteredCustomers,
      isFiltering,
      drillDown,
      openDrillDown: setDrillDown,
      closeDrillDown: () => setDrillDown(null),
      selectedOrder,
      openOrderDetail: setSelectedOrder,
      closeOrderDetail: () => setSelectedOrder(null),
      allOrders: orders,
      allCustomers: customers,
      productTagsMap,
    }),
    [
      filters,
      filteredOrders,
      filteredCustomers,
      isFiltering,
      kpiOverrides,
      drillDown,
      selectedOrder,
      orders,
      customers,
      productTagsMap,
      setCustomRangeWithLog,
      setHideTestUsers,
      setKpiOverride,
      setFiltersImmediate,
      updateFiltersDebounced,
    ]
  )

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
