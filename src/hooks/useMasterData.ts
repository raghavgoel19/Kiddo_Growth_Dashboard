import { useCallback, useRef, useState } from 'react'
import type { Order, Product, ProductTagsMap } from '../api/types'
import { getAllProducts, printSyncBanner } from '../db/orderDB'
import { buildProductTagsMap } from '../utils/taxonomy'
import { deriveCustomersFromOrders } from '../sync/customers'
import { forceSyncProducts, syncProducts } from '../sync/productSync'
import { fetchOrdersForRange, fullResync, type SyncStatus } from '../sync/syncEngine'
import {
  apiRangeForSection,
  sectionNeedsOrders,
  type ApiDateRange,
  type DashboardSection,
} from '../utils/rangeParams'
import type { GlobalFilters } from '../context/DashboardContext'
import { useMemo } from 'react'

export type { SyncStatus }

export interface SyncError {
  message: string
  scope: 'orders' | 'products' | 'all' | 'refresh'
}

export function useMasterData() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customerCount, setCustomerCount] = useState(0)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: 'idle' })
  const [syncWarning, setSyncWarning] = useState<SyncError | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadedRange, setLoadedRange] = useState<ApiDateRange | null>(null)
  const productsLoaded = useRef(false)
  const loadInFlight = useRef<string | null>(null)

  const customers = useMemo(() => deriveCustomersFromOrders(orders), [orders])
  const productTagsMap = useMemo<ProductTagsMap>(() => buildProductTagsMap(products), [products])

  const handleSyncStatus = useCallback((status: SyncStatus) => {
    setSyncStatus(status)
    if (status.state === 'error') {
      if (status.cachedOrdersAvailable > 0) {
        setSyncWarning({ message: status.message, scope: 'orders' })
        setError(null)
      } else {
        setError(status.message)
        setSyncWarning(null)
      }
    } else if (status.state === 'done') {
      setSyncWarning(null)
      setError(null)
    }
  }, [])

  const handleOrdersReady = useCallback((nextOrders: Order[]) => {
    setOrders(nextOrders)
    setCustomerCount(new Set(nextOrders.map((o) => o.customer?.id).filter(Boolean)).size)
  }, [])

  const ensureProducts = useCallback(async () => {
    if (productsLoaded.current && products.length > 0) return products
    const cached = await getAllProducts()
    if (cached.length > 0) {
      setProducts(cached)
      productsLoaded.current = true
      return cached
    }
    const synced = await syncProducts()
    setProducts(synced)
    productsLoaded.current = true
    return synced
  }, [products.length])

  const loadForPage = useCallback(
    async (
      section: DashboardSection,
      filters: GlobalFilters,
      options: { force?: boolean } = {}
    ) => {
      await ensureProducts()

      if (!sectionNeedsOrders(section)) {
        setSyncStatus({ state: 'idle' })
        return
      }

      const range = apiRangeForSection(section, filters)
      const loadKey = `${section}:${range.cacheKey}:${options.force ? 'f' : 'c'}`
      if (loadInFlight.current === loadKey) return
      loadInFlight.current = loadKey

      try {
        await fetchOrdersForRange(range, handleSyncStatus, handleOrdersReady, options)
        setLoadedRange(range)
      } catch {
        // error state set in handleSyncStatus
      } finally {
        loadInFlight.current = null
      }
    },
    [ensureProducts, handleOrdersReady, handleSyncStatus]
  )

  const refreshPage = useCallback(
    (section: DashboardSection, filters: GlobalFilters) =>
      loadForPage(section, filters, { force: true }),
    [loadForPage]
  )

  const syncProductsOnly = useCallback(async () => {
    setSyncWarning(null)
    try {
      const next = await forceSyncProducts()
      setProducts(next)
      productsLoaded.current = true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Products sync failed'
      setSyncWarning({ message, scope: 'products' })
    }
  }, [])

  const syncAll = useCallback(
    async (section: DashboardSection, filters: GlobalFilters) => {
      setSyncWarning(null)
      const range = apiRangeForSection(section, filters)
      try {
        await fullResync(range, handleSyncStatus, handleOrdersReady)
        setLoadedRange(range)
        await forceSyncProducts().then(setProducts)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Full resync failed'
        setSyncWarning({ message, scope: 'all' })
      }
    },
    [handleOrdersReady, handleSyncStatus]
  )

  const retrySync = useCallback(
    async (section: DashboardSection, filters: GlobalFilters) => {
      const scope = syncWarning?.scope ?? 'orders'
      if (scope === 'products') return syncProductsOnly()
      if (scope === 'all') return syncAll(section, filters)
      return refreshPage(section, filters)
    },
    [refreshPage, syncAll, syncProductsOnly, syncWarning?.scope]
  )

  const isLoading = syncStatus.state === 'syncing' && orders.length === 0
  const isRefreshing = syncStatus.state === 'syncing'

  const lastFetched = useMemo(() => {
    if (syncStatus.state === 'done') return syncStatus.syncedAt
    return null
  }, [syncStatus])

  return {
    orders,
    customers,
    products,
    productTagsMap,
    customerCount,
    syncStatus,
    loadedRange,
    syncMeta: null,
    isLoading,
    isRefreshing,
    error,
    syncWarning,
    dataSource: orders.length > 0 ? ('synced' as const) : ('idle' as const),
    syncStatusText: null,
    hasCachedData: orders.length > 0,
    lastFetched,
    loadForPage,
    refreshPage,
    syncProducts: syncProductsOnly,
    syncAll,
    retrySync,
    printSyncBannerOnInit: printSyncBanner,
  }
}

export type UseMasterDataReturn = ReturnType<typeof useMasterData>
