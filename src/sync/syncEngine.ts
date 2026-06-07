import type { Order } from '../api/types'
import {
  bulkSaveOrders,
  getAllOrders,
  getMeta,
  getOrderCount,
  setMeta,
} from '../db/orderDB'
import { fetchOrdersPage } from './fetchPages'

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'loading-cache'; count: number }
  | { state: 'syncing'; fetched: number; total: number | null }
  | { state: 'done'; ordersInDB: number; newOrdersFetched: number; syncedAt: Date }
  | { state: 'error'; message: string; cachedOrdersAvailable: number }

const FULL_SYNC_FROM = '2020-01-01T00:00:00Z'
const SAFETY_BUFFER_MS = 10 * 60 * 1000

export async function runSync(
  onStatus: (status: SyncStatus) => void,
  onOrdersReady: (orders: Order[]) => void
) {
  onStatus({ state: 'loading-cache', count: 0 })

  const cachedOrders = await getAllOrders()
  const cachedCount = cachedOrders.length

  if (cachedCount > 0) {
    onOrdersReady(cachedOrders)
    onStatus({ state: 'syncing', fetched: 0, total: null })
  }

  const lastSyncedAt = await getMeta('lastSyncedAt')
  const syncFrom = lastSyncedAt
    ? new Date(new Date(lastSyncedAt).getTime() - SAFETY_BUFFER_MS).toISOString()
    : FULL_SYNC_FROM

  console.log(`[Sync] Starting incremental sync from ${syncFrom}`)
  console.log(`[Sync] ${cachedCount} orders already in IndexedDB`)

  try {
    const newOrders: Order[] = []
    let pageCount = 0
    let cursor: string | null = null
    let hasNextPage = true

    while (hasNextPage) {
      const result = await fetchOrdersPage(syncFrom, cursor)
      newOrders.push(...result.orders)
      hasNextPage = result.pageInfo.hasNextPage
      cursor = result.pageInfo.nextPageUrl
      pageCount++

      onStatus({
        state: 'syncing',
        fetched: newOrders.length,
        total: null,
      })

      console.log(
        `[Sync] Page ${pageCount}: fetched ${result.orders.length} orders (total so far: ${newOrders.length})`
      )
    }

    if (newOrders.length > 0) {
      await bulkSaveOrders(newOrders)
      console.log(`[Sync] Saved ${newOrders.length} orders to IndexedDB`)
    }

    await setMeta('lastSyncedAt', new Date().toISOString())

    if (newOrders.length > 0) {
      const allOrders = await getAllOrders()
      onOrdersReady(allOrders)
    } else if (cachedCount === 0) {
      onOrdersReady([])
    }

    const totalInDB = await getOrderCount()
    onStatus({
      state: 'done',
      ordersInDB: totalInDB,
      newOrdersFetched: newOrders.length,
      syncedAt: new Date(),
    })

    console.log(`[Sync] Complete. ${totalInDB} total orders, ${newOrders.length} new.`)
  } catch (err) {
    console.error('[Sync] Failed:', err)
    onStatus({
      state: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
      cachedOrdersAvailable: cachedCount,
    })
  }
}

export async function fullResync(
  onStatus: (status: SyncStatus) => void,
  onOrdersReady: (orders: Order[]) => void
) {
  const { clearOrders, deleteMeta } = await import('../db/orderDB')
  await clearOrders()
  await deleteMeta('lastSyncedAt')
  await runSync(onStatus, onOrdersReady)
}
