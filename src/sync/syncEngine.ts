import { endOfDay } from 'date-fns'
import type { Order } from '../api/types'
import { bulkSaveOrders, getAllOrders, getMeta, setMeta } from '../db/orderDB'
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

export async function fetchOrdersSince(since: string, until?: string): Promise<Order[]> {
  const allNew: Order[] = []
  let cursor: string | null = null
  let hasNextPage = true
  const untilIso = until ?? endOfDay(new Date()).toISOString()

  while (hasNextPage) {
    const result = await fetchOrdersPage(since, untilIso, cursor)
    allNew.push(...result.orders)
    hasNextPage = result.pageInfo.hasNextPage
    cursor = result.pageInfo.nextPageUrl
  }

  return allNew
}

/** Load IndexedDB cache immediately, then fetch only orders newer than last sync. */
export async function startupSync(
  onStatus: (status: SyncStatus) => void,
  onOrdersReady: (orders: Order[]) => void
): Promise<Order[]> {
  const cached = await getAllOrders()

  if (cached.length > 0) {
    onStatus({ state: 'loading-cache', count: cached.length })
    onOrdersReady(cached)
    console.log(`[Sync] ${cached.length.toLocaleString('en-IN')} orders loaded from cache`)
  }

  const lastSync = await getMeta('lastSyncedAt')
  const since = lastSync
    ? new Date(new Date(lastSync).getTime() - 10 * 60 * 1000).toISOString()
    : null

  if (!since) {
    if (cached.length > 0) {
      onStatus({
        state: 'done',
        ordersInDB: cached.length,
        newOrdersFetched: 0,
        syncedAt: new Date(),
        label: `${cached.length.toLocaleString('en-IN')} orders · cached`,
        fromCache: true,
      })
    }
    return cached
  }

  onStatus({
    state: 'syncing',
    fetched: 0,
    label: `${cached.length.toLocaleString('en-IN')} orders loaded · Checking for new…`,
  })

  try {
    const newOrders = await fetchOrdersSince(since)
    if (newOrders.length > 0) {
      await bulkSaveOrders(newOrders)
      console.log(`[Sync] Merged ${newOrders.length} new orders into IndexedDB`)
    }

    await setMeta('lastSyncedAt', new Date().toISOString())
    const all = await getAllOrders()
    onOrdersReady(all)

    const message =
      newOrders.length > 0
        ? `${all.length.toLocaleString('en-IN')} orders · ${newOrders.length} new`
        : `${all.length.toLocaleString('en-IN')} orders · Up to date`

    onStatus({
      state: 'done',
      ordersInDB: all.length,
      newOrdersFetched: newOrders.length,
      syncedAt: new Date(),
      label: message,
      fromCache: newOrders.length === 0 && cached.length > 0,
    })
    return all
  } catch (err) {
    console.error('[Sync] Incremental sync failed:', err)
    onStatus({
      state: 'error',
      message: err instanceof Error ? err.message : 'Sync failed',
      cachedOrdersAvailable: cached.length,
    })
    return cached
  }
}

export async function incrementalRefresh(
  onStatus: (status: SyncStatus) => void,
  onOrdersReady: (orders: Order[]) => void
): Promise<Order[]> {
  return startupSync(onStatus, onOrdersReady)
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
    const { getAllOrders } = await import('../db/orderDB')
    const existing = await getAllOrders()
    if (
      existing.length > 0 &&
      cached &&
      activeKey === range.cacheKey &&
      Date.now() - new Date(cached.fetchedAt).getTime() < range.ttlMs
    ) {
      onStatus({
        state: 'done',
        ordersInDB: existing.length,
        newOrdersFetched: 0,
        syncedAt: new Date(cached.fetchedAt),
        label: range.label,
        fromCache: true,
      })
      onOrdersReady(existing)
      console.log(`[Sync] Cache hit for ${range.label}: ${existing.length} orders`)
      return existing
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

    if (newOrders.length > 0) {
      await bulkSaveOrders(newOrders)
    }
    await setMeta('lastSyncedAt', new Date().toISOString())
    const all = await getAllOrders()
    await writeRangeCache(range, all.length)
    onOrdersReady(all)
    onStatus({
      state: 'done',
      ordersInDB: all.length,
      newOrdersFetched: newOrders.length,
      syncedAt: new Date(),
      label: range.label,
      fromCache: false,
    })
    console.log(`[Sync] ${range.label}: merged ${newOrders.length} orders (${pageCount} API pages), ${all.length} total in DB`)
    return all
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
  await deleteMeta('lastSyncedAt')
  return fetchOrdersForRange(range, onStatus, onOrdersReady, { force: true })
}
