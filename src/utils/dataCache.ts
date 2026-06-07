import type { Customer, Order, Product } from '../api/types'
import type { SyncMeta } from '../api/shopify'

const DB_NAME = 'kiddo-dashboard-v3'
const STORE = 'snapshots'
const KEY = 'raw'

export interface CachedSnapshot {
  orders: Order[]
  customers: Customer[]
  products: Product[]
  customerCount: number
  fetchedAt: string
  syncMeta?: SyncMeta | null
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE)
    }
  })
}

export async function readLocalSnapshot(): Promise<CachedSnapshot | null> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(KEY)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => {
        const raw = req.result as CachedSnapshot | undefined
        if (!raw?.orders?.length) {
          resolve(null)
          return
        }
        resolve({
          ...raw,
          products: raw.products ?? [],
        })
      }
    })
  } catch {
    return null
  }
}

export async function writeLocalSnapshot(snapshot: CachedSnapshot): Promise<void> {
  if (!snapshot.orders?.length) return
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).put(snapshot, KEY)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve()
    })
  } catch {
    // IndexedDB unavailable — ignore
  }
}

export async function clearLocalSnapshot(): Promise<void> {
  try {
    const db = await openDb()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      const req = tx.objectStore(STORE).delete(KEY)
      req.onerror = () => reject(req.error)
      req.onsuccess = () => resolve()
    })
  } catch {
    // ignore
  }
}
