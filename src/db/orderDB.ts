import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Order, Product } from '../api/types'

interface KiddoDB extends DBSchema {
  orders: {
    key: string
    value: Order
    indexes: {
      'by-created-at': string
    }
  }
  products: {
    key: string
    value: Product
  }
  meta: {
    key: string
    value: string
  }
}

let db: IDBPDatabase<KiddoDB> | null = null

export async function getDB() {
  if (db) return db
  db = await openDB<KiddoDB>('kiddo-dashboard', 1, {
    upgrade(database) {
      const orderStore = database.createObjectStore('orders', { keyPath: 'id' })
      orderStore.createIndex('by-created-at', 'created_at')
      database.createObjectStore('products', { keyPath: 'id' })
      database.createObjectStore('meta')
    },
  })
  return db
}

function normalizeOrder(order: Order): Order {
  return {
    ...order,
    id: String(order.id),
    line_items: order.line_items ?? [],
  }
}

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    id: String(product.id),
  }
}

export async function replaceOrders(orders: Order[]) {
  const database = await getDB()
  const tx = database.transaction('orders', 'readwrite')
  await tx.store.clear()
  if (orders.length > 0) {
    await Promise.all([
      ...orders.map((order) => tx.store.put(normalizeOrder(order))),
      tx.done,
    ])
  } else {
    await tx.done
  }
}

export async function bulkSaveOrders(orders: Order[]) {
  if (!orders.length) return
  const database = await getDB()
  const tx = database.transaction('orders', 'readwrite')
  await Promise.all([
    ...orders.map((order) => tx.store.put(normalizeOrder(order))),
    tx.done,
  ])
}

export async function bulkSaveProducts(products: Product[]) {
  if (!products.length) return
  const database = await getDB()
  const tx = database.transaction('products', 'readwrite')
  await Promise.all([
    ...products.map((product) => tx.store.put(normalizeProduct(product))),
    tx.done,
  ])
}

export async function getAllOrders(): Promise<Order[]> {
  const database = await getDB()
  return database.getAll('orders')
}

export async function getAllProducts(): Promise<Product[]> {
  const database = await getDB()
  return database.getAll('products')
}

export async function getMeta(key: string): Promise<string | null> {
  const database = await getDB()
  return (await database.get('meta', key)) ?? null
}

export async function setMeta(key: string, value: string) {
  const database = await getDB()
  await database.put('meta', value, key)
}

export async function getOrderCount(): Promise<number> {
  const database = await getDB()
  return database.count('orders')
}

export async function clearOrders() {
  const database = await getDB()
  await database.clear('orders')
}

export async function clearProducts() {
  const database = await getDB()
  await database.clear('products')
}

export async function deleteMeta(key: string) {
  const database = await getDB()
  await database.delete('meta', key)
}

export async function printSyncBanner(count: number, lastSync: string | null) {
  console.log(`
╔═══════════════════════════════════╗
║     Kiddo Dashboard Sync Log      ║
╠═══════════════════════════════════╣
║  IndexedDB orders: ${String(count).padEnd(17)}║
║  Last synced: ${(lastSync ?? 'never').slice(0, 24).padEnd(24)}║
║  Sync started: ${new Date().toISOString().slice(0, 24).padEnd(24)}║
╚═══════════════════════════════════╝
`)
}
