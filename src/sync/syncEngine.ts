import type { Order } from '../api/types'
import { getMeta, replaceOrders, setMeta } from '../db/orderDB'
import { fetchOrdersPage } from './fetchPages'
import type { ApiDateRange } from '../utils/rangeParams'

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'loading-cache'; count: number; label?: string }
  | { state: 'syncing'; fetched: number; label?: string }
  | { state: 'done'; ordersInDB: number; newOrdersFetched: number; syncedAt: Date; label?: string; fromCache?: boolean }
  | { state: 'error'; message: string; cachedOrdersAvailable: number }

interface RangeCacheMeta {
  fetchedAt: string
  count: number
  since: string
  until: string
}

async function readRangeCache(cacheKey: string): Promise<RangeCacheMeta | null> {
  const raw = await getMeta(`range:${cacheKey}`)
  if (!raw) return null
  try {
    return JSON.parse(raw) as RangeCacheMeta
  } catch {
    return null
  }
}

async function writeRangeCache(range: ApiDateRange, count: number) {
  const payload: RangeCacheMeta = {
    fetchedAt: new Date().toISOString(),
    count,
    since: range.since,
    until: range.until,
  }
  await setMeta(`range:${range.cacheKey}`, JSON.stringify(payload))
  await setMeta('activeRangeKey', range.cacheKey)
}

export async function fetchOrdersForRange(
  range: ApiDateRange,
  onStatus: (status: SyncStatus) => void,
  onOrdersReady: (orders: Order[]) => void,
  options: { force?: boolean } = {}
): Promise<Order[]> {
  const { force = false } = options
  const activeKey = await getMeta('activeRangeKey')

  if (!force) {
    const cached = await readRangeCache(range.cacheKey)
    if (
      cached &&
      activeKey === range.cacheKey &&
      Date.now() - new Date(cached.fetchedAt).getTime() < range.ttlMs
    ) {
      const { getAllOrders } = await import('../db/orderDB')
      const orders = await getAllOrders()
      if (orders.length > 0) {
        onStatus({
          state: 'done',
          ordersInDB: orders.length,
          newOrdersFetched: 0,
          syncedAt: new Date(cached.fetchedAt),
          label: range.label,
          fromCache: true,
        })
        onOrdersReady(orders)
        console.log(`[Sync] Cache hit for ${range.label}: ${orders.length} orders`)
        return orders
      }
    }
  }

  onStatus({ state: 'syncing', fetched: 0, label: range.label })
  console.log(`[Sync] Fetching ${range.label} (${range.since} → ${range.until})`)

  try {
    const newOrders: Order[] = []
    let cursor: string | null = null
    let hasNextPage = true
    let pageCount = 0

    while (hasNextPage) {
      const result = await fetchOrdersPage(range.since, range.until, cursor)
      newOrders.push(...result.orders)
      hasNextPage = result.pageInfo.hasNextPage
      cursor = result.pageInfo.nextPageUrl
      pageCount++
      onStatus({ state: 'syncing', fetched: newOrders.length, label: range.label })
      console.log(`[Sync] Page ${pageCount}: +${result.orders.length} (${newOrders.length} total)`)
    }

    await replaceOrders(newOrders)
    await writeRangeCache(range, newOrders.length)
    onOrdersReady(newOrders)
    onStatus({
      state: 'done',
      ordersInDB: newOrders.length,
      newOrdersFetched: newOrders.length,
      syncedAt: new Date(),
      label: range.label,
      fromCache: false,
    })
    console.log(`[Sync] ${range.label}: ${newOrders.length} orders (${pageCount} API pages)`)
    return newOrders
  } catch (err) {
    const { getAllOrders } = await import('../db/orderDB')
    const fallback = await getAllOrders()
    console.error('[Sync] Failed:', err)
    onStatus({
      state: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
      cachedOrdersAvailable: fallback.length,
    })
    if (fallback.length > 0) onOrdersReady(fallback)
    throw err
  }
}

export async function fullResync(
  range: ApiDateRange,
  onStatus: (status: SyncStatus) => void,
  onOrdersReady: (orders: Order[]) => void
) {
  const { clearOrders, deleteMeta } = await import('../db/orderDB')
  await clearOrders()
  await deleteMeta('activeRangeKey')
  return fetchOrdersForRange(range, onStatus, onOrdersReady, { force: true })
}
