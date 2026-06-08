import type { Product } from '../api/types'
import { bulkSaveProducts, getAllProducts, getMeta, setMeta } from '../db/orderDB'
import { fetchProductsPage } from './fetchPages'

const PRODUCT_TTL_HOURS = 6

export async function syncProducts(onProgress?: (count: number) => void): Promise<Product[]> {
  const lastSync = await getMeta('lastProductSyncedAt')

  if (lastSync) {
    const hoursSince = (Date.now() - new Date(lastSync).getTime()) / 3_600_000
    if (hoursSince < PRODUCT_TTL_HOURS) {
      console.log('[Products] Cache fresh, skipping sync')
      return getAllProducts()
    }
  }

  const products: Product[] = []
  let cursor: string | null = null
  let hasNextPage = true
  let page = 0

  while (hasNextPage) {
    const result = await fetchProductsPage(cursor)
    products.push(...result.products)
    cursor = result.pageInfo.nextPageUrl
    hasNextPage = result.pageInfo.hasNextPage
    page++
    onProgress?.(products.length)
    console.log(`[Products] Page ${page}: ${result.products.length} products (${products.length} total)`)
  }

  if (products.length > 0) {
    await bulkSaveProducts(products)
  }

  await setMeta('lastProductSyncedAt', new Date().toISOString())
  return products.length > 0 ? products : getAllProducts()
}

export async function forceSyncProducts(onProgress?: (count: number) => void): Promise<Product[]> {
  const { deleteMeta } = await import('../db/orderDB')
  await deleteMeta('lastProductSyncedAt')
  return syncProducts(onProgress)
}
