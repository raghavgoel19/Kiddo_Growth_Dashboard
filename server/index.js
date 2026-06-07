import express from 'express'
import cors from 'cors'
import { gzip } from 'zlib'
import { promisify } from 'util'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import {
  fetchAllOrders,
  fetchAllCustomers,
  fetchCustomerCount,
  fetchAllProducts,
  fetchOrdersPage,
  fetchProductsPage,
  isConfigured,
} from './shopify.js'
import {
  readMergedCache,
  writeOrdersCache,
  writeCustomersCache,
  writeProductsCache,
  getCacheMeta,
} from './cache.js'
import { mergeDashboardData } from './enrich.js'
import { trimDashboardForClient, trimOrder, trimProduct } from './trim.js'

function validateShopifyPageUrl(url) {
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
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env') })

const app = express()
const PORT = 3001
const ORDERS_STALE_MS = 6 * 60 * 60 * 1000 // 6 hours
const PRODUCTS_STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

app.use(cors())
app.use(express.json())

let memoryCache = null
let memoryFetchedAt = null
let memorySyncMeta = null
let backgroundRefresh = null

function loadMemoryFromDisk() {
  const disk = readMergedCache()
  if (disk) {
    memoryCache = disk.data
    memoryFetchedAt = disk.fetchedAt
    memorySyncMeta = disk.syncMeta
    console.log(
      `Loaded disk cache: ${disk.data.orders?.length ?? 0} orders, ${disk.data.customers?.length ?? 0} customers, ${disk.data.products?.length ?? 0} products`
    )
  }
}

function isStale(fetchedAt, maxAgeMs) {
  if (!fetchedAt) return true
  return Date.now() - new Date(fetchedAt).getTime() > maxAgeMs
}

function buildResult(data, syncMeta, fromCache) {
  const fetchedAt =
    [
      syncMeta?.orders?.fetchedAt,
      syncMeta?.customers?.fetchedAt,
      syncMeta?.products?.fetchedAt,
    ]
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? new Date().toISOString()

  return { data, fetchedAt, syncMeta, fromCache }
}

function getCachedResult() {
  if (memoryCache) {
    return buildResult(memoryCache, memorySyncMeta ?? getCacheMeta(), true)
  }
  const disk = readMergedCache()
  if (!disk) return null
  memoryCache = disk.data
  memoryFetchedAt = disk.fetchedAt
  memorySyncMeta = disk.syncMeta
  return buildResult(disk.data, disk.syncMeta, true)
}

async function syncOrders() {
  console.log('Syncing orders + customers from Shopify…')
  const [orders, customers, customerCount] = await Promise.all([
    fetchAllOrders(),
    fetchAllCustomers(),
    fetchCustomerCount(),
  ])

  const ordersFetchedAt = writeOrdersCache(orders)
  const customersFetchedAt = writeCustomersCache(customers, customerCount)

  const products = memoryCache?.products ?? readMergedCache()?.data.products ?? []
  const data = mergeDashboardData({ orders, customers, products, customerCount })

  memoryCache = data
  memorySyncMeta = {
    orders: { fetchedAt: ordersFetchedAt, count: orders.length },
    customers: {
      fetchedAt: customersFetchedAt,
      count: customers.length,
      customerCount,
    },
    products: memorySyncMeta?.products ?? getCacheMeta()?.products ?? null,
  }
  memoryFetchedAt = [ordersFetchedAt, customersFetchedAt].sort().reverse()[0]

  console.log(`Orders sync complete: ${orders.length} orders, ${customers.length} customers`)
  return buildResult(data, memorySyncMeta, false)
}

async function syncProducts() {
  console.log('Syncing products from Shopify…')
  const products = await fetchAllProducts()
  const productsFetchedAt = writeProductsCache(products)

  const cached = readMergedCache()?.data ?? memoryCache ?? {
    orders: [],
    customers: [],
    customerCount: 0,
    products: [],
  }

  const data = mergeDashboardData({
    orders: cached.orders,
    customers: cached.customers,
    products,
    customerCount: cached.customerCount,
  })

  memoryCache = data
  memorySyncMeta = {
    ...(memorySyncMeta ?? getCacheMeta() ?? {}),
    products: { fetchedAt: productsFetchedAt, count: products.length },
  }
  memoryFetchedAt = memorySyncMeta.orders?.fetchedAt ?? memoryFetchedAt

  console.log(`Products sync complete: ${products.length} products`)
  return buildResult(data, memorySyncMeta, false)
}

async function syncAll() {
  console.log('Full sync from Shopify…')
  const [orders, customers, customerCount, products] = await Promise.all([
    fetchAllOrders(),
    fetchAllCustomers(),
    fetchCustomerCount(),
    fetchAllProducts(),
  ])

  const ordersFetchedAt = writeOrdersCache(orders)
  const customersFetchedAt = writeCustomersCache(customers, customerCount)
  const productsFetchedAt = writeProductsCache(products)

  const data = mergeDashboardData({ orders, customers, products, customerCount })
  memoryCache = data
  memorySyncMeta = {
    orders: { fetchedAt: ordersFetchedAt, count: orders.length },
    customers: {
      fetchedAt: customersFetchedAt,
      count: customers.length,
      customerCount,
    },
    products: { fetchedAt: productsFetchedAt, count: products.length },
  }
  memoryFetchedAt = [ordersFetchedAt, customersFetchedAt, productsFetchedAt]
    .sort()
    .reverse()[0]

  console.log(
    `Full sync complete: ${orders.length} orders, ${customers.length} customers, ${products.length} products`
  )
  return buildResult(data, memorySyncMeta, false)
}

function parseSyncMode(query) {
  if (query.refresh === 'true' || query.sync === 'all') return 'all'
  if (query.sync === 'orders') return 'orders'
  if (query.sync === 'products') return 'products'
  return null
}

async function getData(syncMode = null) {
  if (syncMode === 'all') return syncAll()
  if (syncMode === 'orders') return syncOrders()
  if (syncMode === 'products') return syncProducts()

  const cached = getCachedResult()
  if (!cached) return syncAll()

  const meta = cached.syncMeta ?? getCacheMeta()
  const ordersStale = isStale(meta?.orders?.fetchedAt, ORDERS_STALE_MS)
  const productsStale = isStale(meta?.products?.fetchedAt, PRODUCTS_STALE_MS)

  if ((ordersStale || productsStale) && !backgroundRefresh) {
    backgroundRefresh = (async () => {
      try {
        if (ordersStale) await syncOrders()
        if (productsStale) await syncProducts()
      } catch (err) {
        console.error('Background refresh failed:', err)
      } finally {
        backgroundRefresh = null
      }
    })()
  }

  return cached
}

loadMemoryFromDisk()

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: isConfigured(),
    shop: process.env.SHOPIFY_SHOP_DOMAIN ?? null,
    cached: !!memoryCache,
    fetchedAt: memoryFetchedAt,
    syncMeta: memorySyncMeta ?? getCacheMeta(),
    backgroundRefresh: !!backgroundRefresh,
  })
})

app.get('/api/sync/customer-count', async (_req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ success: false, error: 'Shopify credentials missing' })
    }
    const count = await fetchCustomerCount()
    res.json({ success: true, count })
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/sync/orders', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ success: false, error: 'Shopify credentials missing' })
    }
    const since = String(req.query.since ?? '2020-01-01T00:00:00Z')
    const cursor = req.query.cursor ? validateShopifyPageUrl(String(req.query.cursor)) : null
    if (req.query.cursor && !cursor) {
      return res.status(400).json({ success: false, error: 'Invalid pagination cursor' })
    }
    const { orders, nextPageUrl } = await fetchOrdersPage(since, cursor)
    res.json({
      success: true,
      orders: orders.map((o) => trimOrder(o)),
      pageInfo: {
        hasNextPage: !!nextPageUrl,
        nextPageUrl,
      },
    })
  } catch (err) {
    console.error('Incremental orders sync error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/sync/products', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({ success: false, error: 'Shopify credentials missing' })
    }
    const cursor = req.query.cursor ? validateShopifyPageUrl(String(req.query.cursor)) : null
    if (req.query.cursor && !cursor) {
      return res.status(400).json({ success: false, error: 'Invalid pagination cursor' })
    }
    const { products, nextPageUrl } = await fetchProductsPage(cursor)
    res.json({
      success: true,
      products: products.map((p) => trimProduct(p)),
      pageInfo: {
        hasNextPage: !!nextPageUrl,
        nextPageUrl,
      },
    })
  } catch (err) {
    console.error('Products sync error:', err)
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) })
  }
})

app.get('/api/data', async (req, res) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        error:
          'Shopify credentials missing. Open server/.env and set SHOPIFY_ACCESS_TOKEN, then restart.',
      })
    }

    const syncMode = parseSyncMode(req.query)
    const result = await getData(syncMode)
    const payload = JSON.stringify({
      success: true,
      data: trimDashboardForClient(result.data),
      fetchedAt: result.fetchedAt,
      syncMeta: result.syncMeta,
      fromCache: result.fromCache,
    })

    const acceptEncoding = req.headers['accept-encoding'] ?? ''
    if (acceptEncoding.includes('gzip')) {
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Encoding', 'gzip')
      res.send(await gzipAsync(payload))
      return
    }

    res.type('json').send(payload)
  } catch (err) {
    console.error('Data fetch error:', err)
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ success: false, error: message })
  }
})

app.listen(PORT, () => {
  console.log(`Shopify proxy running on http://localhost:${PORT}`)
  if (!isConfigured()) {
    console.warn('WARNING: Shopify credentials not configured')
  } else {
    console.log(`Store: ${process.env.SHOPIFY_SHOP_DOMAIN}`)
  }
})
