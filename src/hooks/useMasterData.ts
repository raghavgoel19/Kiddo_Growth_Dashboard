import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Order, Product, ProductTagsMap } from '../api/types'
import {
  bulkSaveOrders,
  bulkSaveProducts,
  getAllOrders,
  getMeta,
  getOrderCount,
  setMeta,
  printSyncBanner,
} from '../db/orderDB'
import { buildProductTagsMap } from '../utils/taxonomy'
import { deriveCustomersFromOrders } from '../sync/customers'
import { forceSyncProducts, syncProducts } from '../sync/productSync'
import { fullResync, runSync, type SyncStatus } from '../sync/syncEngine'
import { fetchCustomerCount } from '../sync/fetchPages'

async function migrateLegacyCache(): Promise<number> {
  try {
    const count = await getOrderCount()
    if (count > 0) return count

    const { readLocalSnapshot } = await import('../utils/dataCache')
    const legacy = await readLocalSnapshot()
    if (!legacy?.orders?.length) return 0

    console.log(`[Sync] Migrating ${legacy.orders.length} orders from legacy cache`)
    await bulkSaveOrders(legacy.orders)
    if (legacy.products?.length) {
      await bulkSaveProducts(legacy.products)
    }
    if (legacy.fetchedAt) {
      await setMeta('lastSyncedAt', legacy.fetchedAt)
    }
    return legacy.orders.length
  } catch {
    return 0
  }
}

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
  const syncStarted = useRef(false)

  const customers = useMemo(() => deriveCustomersFromOrders(orders), [orders])

  const productTagsMap = useMemo<ProductTagsMap>(
    () => buildProductTagsMap(products),
    [products]
  )

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
  }, [])

  const startSync = useCallback(async () => {
    await runSync(handleSyncStatus, handleOrdersReady)
    try {
      const count = await fetchCustomerCount()
      setCustomerCount(count)
    } catch {
      setCustomerCount(customers.length)
    }
  }, [handleOrdersReady, handleSyncStatus, customers.length])

  useEffect(() => {
    if (syncStarted.current) return
    syncStarted.current = true

    void (async () => {
      await migrateLegacyCache()
      const [count, lastSync] = await Promise.all([getOrderCount(), getMeta('lastSyncedAt')])
      printSyncBanner(count, lastSync)

      const cached = count > 0 ? await getAllOrders() : []
      if (cached.length > 0) {
        setOrders(cached)
        const legacyProducts = await import('../db/orderDB').then((m) => m.getAllProducts())
        if (legacyProducts.length > 0) setProducts(legacyProducts)
      }

      await Promise.all([
        startSync(),
        syncProducts((n) => console.log(`[Products] ${n} fetched`)).then(setProducts),
      ])
    })()
  }, [startSync])

  const isLoading = syncStatus.state === 'loading-cache' && orders.length === 0
  const isRefreshing = syncStatus.state === 'syncing'

  const lastFetched = useMemo(() => {
    if (syncStatus.state === 'done') return syncStatus.syncedAt
    return null
  }, [syncStatus])

  const syncOrders = useCallback(async () => {
    setSyncWarning(null)
    await runSync(handleSyncStatus, handleOrdersReady)
  }, [handleOrdersReady, handleSyncStatus])

  const syncProductsOnly = useCallback(async () => {
    setSyncWarning(null)
    try {
      const next = await forceSyncProducts((n) => console.log(`[Products] ${n} fetched`))
      setProducts(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Products sync failed'
      if (orders.length > 0) setSyncWarning({ message, scope: 'products' })
      else setError(message)
    }
  }, [orders.length])

  const syncAll = useCallback(async () => {
    setSyncWarning(null)
    await fullResync(handleSyncStatus, handleOrdersReady)
    try {
      const next = await forceSyncProducts()
      setProducts(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Products sync failed'
      setSyncWarning({ message, scope: 'all' })
    }
  }, [handleOrdersReady, handleSyncStatus])

  const softRefresh = useCallback(() => syncOrders(), [syncOrders])

  const retrySync = useCallback(async () => {
    const scope = syncWarning?.scope ?? 'orders'
    if (scope === 'products') return syncProductsOnly()
    if (scope === 'all') return syncAll()
    return syncOrders()
  }, [syncAll, syncOrders, syncProductsOnly, syncWarning?.scope])

  return {
    orders,
    customers,
    products,
    productTagsMap,
    customerCount,
    syncStatus,
    syncMeta: null,
    isLoading,
    isRefreshing,
    error,
    syncWarning,
    dataSource: orders.length > 0 ? ('synced' as const) : ('loading' as const),
    syncStatusText: null,
    hasCachedData: orders.length > 0,
    lastFetched,
    softRefresh,
    syncOrders,
    syncProducts: syncProductsOnly,
    syncAll,
    retrySync,
  }
}

export type UseMasterDataReturn = ReturnType<typeof useMasterData>
