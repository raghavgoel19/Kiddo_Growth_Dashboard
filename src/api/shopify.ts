import type { Customer, Order, Product } from '../api/types'
import { filterOrdersByStatus, getRecentOrders } from '../utils/aggregators'
import {
  readLocalSnapshot,
  writeLocalSnapshot,
  clearLocalSnapshot,
  type CachedSnapshot,
} from '../utils/dataCache'

export type SyncMode = 'orders' | 'products' | 'all'

export interface SyncMetaPart {
  fetchedAt: string
  count: number
  customerCount?: number
}

export interface SyncMeta {
  orders: SyncMetaPart | null
  customers: SyncMetaPart | null
  products: SyncMetaPart | null
}

export interface RawShopifyData {
  orders: Order[]
  customers: Customer[]
  products: Product[]
  customerCount: number
}

export interface FetchResult {
  data: RawShopifyData
  fetchedAt: string
  fromCache: boolean
  syncMeta: SyncMeta | null
}

let memoryCache: FetchResult | null = null

function parseResponse(json: {
  success?: boolean
  data?: RawShopifyData
  fetchedAt?: string
  fromCache?: boolean
  syncMeta?: SyncMeta | null
  error?: string
}): FetchResult {
  if (!json.success || !json.data) {
    throw new Error(json.error ?? 'Failed to fetch Shopify data')
  }
  return {
    data: {
      orders: json.data.orders ?? [],
      customers: json.data.customers ?? [],
      products: json.data.products ?? [],
      customerCount: json.data.customerCount ?? 0,
    },
    fetchedAt: json.fetchedAt ?? new Date().toISOString(),
    fromCache: json.fromCache ?? false,
    syncMeta: json.syncMeta ?? null,
  }
}

async function fetchFromApi(sync?: SyncMode): Promise<FetchResult> {
  const params = new URLSearchParams()
  if (sync === 'all') params.set('sync', 'all')
  else if (sync === 'orders') params.set('sync', 'orders')
  else if (sync === 'products') params.set('sync', 'products')

  const qs = params.toString()
  const url = qs ? `/api/data?${qs}` : '/api/data'
  const res = await fetch(url)
  const contentType = res.headers.get('content-type') ?? ''

  if (!contentType.includes('application/json')) {
    const text = await res.text()
    if (text.includes('Cannot GET /api/data')) {
      throw new Error('API server outdated — restart with npm run dev')
    }
    throw new Error(`API returned non-JSON (${res.status})`)
  }

  let json
  try {
    json = await res.json()
  } catch {
    throw new Error(
      'Could not parse dashboard data — response too large or server unavailable. Restart the dashboard and click Sync orders.'
    )
  }
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`)
  const parsed = parseResponse(json)
  if (parsed.data.orders.length === 0 && parsed.syncMeta?.orders?.count) {
    throw new Error(
      `Server has ${parsed.syncMeta.orders.count.toLocaleString('en-IN')} orders but none reached the browser. Click Sync orders to retry.`
    )
  }
  return parsed
}

export async function loadCachedSnapshot(): Promise<FetchResult | null> {
  if (memoryCache) return memoryCache
  const local = await readLocalSnapshot()
  if (!local) return null
  const result = {
    data: {
      orders: local.orders,
      customers: local.customers,
      products: local.products ?? [],
      customerCount: local.customerCount,
    },
    fetchedAt: local.fetchedAt,
    fromCache: true,
    syncMeta: local.syncMeta ?? null,
  }
  memoryCache = result
  return result
}

export async function fetchRawData(sync?: SyncMode): Promise<FetchResult> {
  const result = await fetchFromApi(sync)
  memoryCache = result

  writeLocalSnapshot({
    orders: result.data.orders,
    customers: result.data.customers,
    products: result.data.products,
    customerCount: result.data.customerCount,
    fetchedAt: result.fetchedAt,
    syncMeta: result.syncMeta,
  } satisfies CachedSnapshot)

  return result
}

export async function fetchRecentOrders(
  orderStatus: import('./types').OrderStatus,
  first = 20
): Promise<Order[]> {
  const { data } = memoryCache ?? (await fetchRawData())
  return getRecentOrders(filterOrdersByStatus(data.orders, orderStatus), first)
}

export function clearCache() {
  memoryCache = null
  clearLocalSnapshot()
}

export type { FullDateRange, OrderStatus } from './types'
