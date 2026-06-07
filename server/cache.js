import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { mergeDashboardData } from './enrich.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CACHE_DIR = join(__dirname, '.cache')
const LEGACY_FILE = join(CACHE_DIR, 'dashboard.json')
const ORDERS_FILE = join(CACHE_DIR, 'orders.json')
const CUSTOMERS_FILE = join(CACHE_DIR, 'customers.json')
const PRODUCTS_FILE = join(CACHE_DIR, 'products.json')

function readJson(path) {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function writeJsonAtomic(path, payload) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(payload))
  renameSync(tmp, path)
}

function refuseEmptyReplace(label, next, previous) {
  const prevLen = previous?.length ?? 0
  const nextLen = next?.length ?? 0
  if (prevLen > 0 && nextLen === 0) {
    throw new Error(
      `Refusing to overwrite ${label} cache (${prevLen} rows) with empty data. Check Shopify API / token scopes.`
    )
  }
  if (prevLen > 100 && nextLen < prevLen * 0.5) {
    throw new Error(
      `Refusing to overwrite ${label} cache: new row count (${nextLen}) is less than half of cached (${prevLen}).`
    )
  }
}

function migrateLegacyCache() {
  const legacy = readJson(LEGACY_FILE)
  if (!legacy?.data?.orders) return

  const { orders, customers, products, customerCount } = legacy.data
  const fetchedAt = legacy.fetchedAt ?? new Date().toISOString()

  if (orders?.length) {
    writeJsonAtomic(ORDERS_FILE, { fetchedAt, orders })
  }
  if (customers?.length) {
    writeJsonAtomic(CUSTOMERS_FILE, {
      fetchedAt,
      customers,
      customerCount: customerCount ?? customers.length,
    })
  }
  if (products?.length) {
    writeJsonAtomic(PRODUCTS_FILE, { fetchedAt, products })
  }

  try {
    renameSync(LEGACY_FILE, `${LEGACY_FILE}.migrated`)
  } catch {
    // ignore
  }
}

migrateLegacyCache()

export function readOrdersCache() {
  const parsed = readJson(ORDERS_FILE)
  if (!parsed?.orders?.length || !parsed.fetchedAt) return null
  return { orders: parsed.orders, fetchedAt: parsed.fetchedAt }
}

export function readCustomersCache() {
  const parsed = readJson(CUSTOMERS_FILE)
  if (!parsed?.customers?.length || !parsed.fetchedAt) return null
  return {
    customers: parsed.customers,
    customerCount: parsed.customerCount ?? parsed.customers.length,
    fetchedAt: parsed.fetchedAt,
  }
}

export function readProductsCache() {
  const parsed = readJson(PRODUCTS_FILE)
  if (!parsed?.products || !parsed.fetchedAt) return null
  return { products: parsed.products, fetchedAt: parsed.fetchedAt }
}

export function readMergedCache() {
  const ordersPart = readOrdersCache()
  const customersPart = readCustomersCache()
  const productsPart = readProductsCache()

  if (!ordersPart) return null

  const data = mergeDashboardData({
    orders: ordersPart.orders,
    customers: customersPart?.customers ?? [],
    products: productsPart?.products ?? [],
    customerCount: customersPart?.customerCount ?? 0,
  })

  const fetchedAt = [
    ordersPart.fetchedAt,
    customersPart?.fetchedAt,
    productsPart?.fetchedAt,
  ]
    .filter(Boolean)
    .sort()
    .reverse()[0]

  return {
    data,
    fetchedAt,
    syncMeta: buildSyncMeta(ordersPart, customersPart, productsPart),
  }
}

/** @deprecated use readMergedCache */
export function readDiskCache() {
  return readMergedCache()
}

function buildSyncMeta(ordersPart, customersPart, productsPart) {
  return {
    orders: ordersPart
      ? { fetchedAt: ordersPart.fetchedAt, count: ordersPart.orders.length }
      : null,
    customers: customersPart
      ? {
          fetchedAt: customersPart.fetchedAt,
          count: customersPart.customers.length,
          customerCount: customersPart.customerCount,
        }
      : null,
    products: productsPart
      ? { fetchedAt: productsPart.fetchedAt, count: productsPart.products.length }
      : null,
  }
}

export function writeOrdersCache(orders) {
  const previous = readOrdersCache()
  refuseEmptyReplace('orders', orders, previous?.orders)
  const fetchedAt = new Date().toISOString()
  writeJsonAtomic(ORDERS_FILE, { fetchedAt, orders })
  return fetchedAt
}

export function writeCustomersCache(customers, customerCount) {
  const previous = readCustomersCache()
  refuseEmptyReplace('customers', customers, previous?.customers)
  const fetchedAt = new Date().toISOString()
  writeJsonAtomic(CUSTOMERS_FILE, {
    fetchedAt,
    customers,
    customerCount: customerCount ?? customers.length,
  })
  return fetchedAt
}

export function writeProductsCache(products) {
  const previous = readProductsCache()
  refuseEmptyReplace('products', products, previous?.products)
  const fetchedAt = new Date().toISOString()
  writeJsonAtomic(PRODUCTS_FILE, { fetchedAt, products })
  return fetchedAt
}

export function writeDiskCache(data) {
  if (data.orders?.length) writeOrdersCache(data.orders)
  if (data.customers?.length) writeCustomersCache(data.customers, data.customerCount)
  if (data.products) writeProductsCache(data.products)
  return new Date().toISOString()
}

export function getCacheMeta() {
  const ordersPart = readOrdersCache()
  const customersPart = readCustomersCache()
  const productsPart = readProductsCache()
  if (!ordersPart && !customersPart && !productsPart) return null
  return buildSyncMeta(ordersPart, customersPart, productsPart)
}
