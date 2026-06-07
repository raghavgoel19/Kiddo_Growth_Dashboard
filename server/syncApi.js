import {
  fetchCustomerCount,
  fetchOrdersPage,
  fetchProductsPage,
  isConfigured,
} from './shopify.js'
import { trimOrder, trimProduct } from './trim.js'

export function validateShopifyPageUrl(url) {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN?.trim()
  if (!shop || !url) return null
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== shop) return null
    if (!parsed.pathname.includes('/admin/api/')) return null
    return url
  } catch {
    return null
  }
}

function notConfigured() {
  return {
    status: 503,
    body: {
      success: false,
      error:
        'Shopify credentials missing. Set SHOPIFY_ACCESS_TOKEN and SHOPIFY_SHOP_DOMAIN in environment variables.',
    },
  }
}

export async function handleSyncCustomerCount() {
  if (!isConfigured()) return notConfigured()
  try {
    const count = await fetchCustomerCount()
    return { status: 200, body: { success: true, count } }
  } catch (err) {
    return {
      status: 500,
      body: { success: false, error: err instanceof Error ? err.message : String(err) },
    }
  }
}

export async function handleSyncOrders(query = {}) {
  if (!isConfigured()) return notConfigured()
  try {
    const since = String(query.since ?? '2020-01-01T00:00:00Z')
    const cursor = query.cursor ? validateShopifyPageUrl(String(query.cursor)) : null
    if (query.cursor && !cursor) {
      return { status: 400, body: { success: false, error: 'Invalid pagination cursor' } }
    }
    const { orders, nextPageUrl } = await fetchOrdersPage(since, cursor)
    return {
      status: 200,
      body: {
        success: true,
        orders: orders.map((o) => trimOrder(o)),
        pageInfo: {
          hasNextPage: !!nextPageUrl,
          nextPageUrl,
        },
      },
    }
  } catch (err) {
    console.error('Incremental orders sync error:', err)
    return {
      status: 500,
      body: { success: false, error: err instanceof Error ? err.message : String(err) },
    }
  }
}

export async function handleSyncProducts(query = {}) {
  if (!isConfigured()) return notConfigured()
  try {
    const cursor = query.cursor ? validateShopifyPageUrl(String(query.cursor)) : null
    if (query.cursor && !cursor) {
      return { status: 400, body: { success: false, error: 'Invalid pagination cursor' } }
    }
    const { products, nextPageUrl } = await fetchProductsPage(cursor)
    return {
      status: 200,
      body: {
        success: true,
        products: products.map((p) => trimProduct(p)),
        pageInfo: {
          hasNextPage: !!nextPageUrl,
          nextPageUrl,
        },
      },
    }
  } catch (err) {
    console.error('Products sync error:', err)
    return {
      status: 500,
      body: { success: false, error: err instanceof Error ? err.message : String(err) },
    }
  }
}

export function handleHealth(extra = {}) {
  return {
    status: 200,
    body: {
      ok: true,
      configured: isConfigured(),
      shop: process.env.SHOPIFY_SHOP_DOMAIN ?? null,
      ...extra,
    },
  }
}
