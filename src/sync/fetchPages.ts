import type { Order, Product } from '../api/types'

export interface PageInfo {
  hasNextPage: boolean
  nextPageUrl: string | null
}

interface OrdersPageResponse {
  success?: boolean
  orders?: Order[]
  pageInfo?: PageInfo
  error?: string
}

interface ProductsPageResponse {
  success?: boolean
  products?: Product[]
  pageInfo?: PageInfo
  error?: string
}

export async function fetchOrdersPage(since: string, cursor: string | null): Promise<{
  orders: Order[]
  pageInfo: PageInfo
}> {
  const params = new URLSearchParams({ since })
  if (cursor) params.set('cursor', cursor)

  const res = await fetch(`/api/sync/orders?${params}`)
  const json = (await res.json()) as OrdersPageResponse

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Orders sync failed (${res.status})`)
  }

  return {
    orders: json.orders ?? [],
    pageInfo: json.pageInfo ?? { hasNextPage: false, nextPageUrl: null },
  }
}

export async function fetchProductsPage(cursor: string | null): Promise<{
  products: Product[]
  pageInfo: PageInfo
}> {
  const params = new URLSearchParams()
  if (cursor) params.set('cursor', cursor)

  const qs = params.toString()
  const res = await fetch(qs ? `/api/sync/products?${qs}` : '/api/sync/products')
  const json = (await res.json()) as ProductsPageResponse

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `Products sync failed (${res.status})`)
  }

  return {
    products: json.products ?? [],
    pageInfo: json.pageInfo ?? { hasNextPage: false, nextPageUrl: null },
  }
}

export async function fetchCustomerCount(): Promise<number> {
  const res = await fetch('/api/sync/customer-count')
  const json = (await res.json()) as { success?: boolean; count?: number; error?: string }
  if (!res.ok || !json.success) return 0
  return json.count ?? 0
}
