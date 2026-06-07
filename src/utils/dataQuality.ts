import type { Order, Product, ProductTagsMap } from '../api/types'
import { getOrderChannel } from './channel'
import { getLocationSource } from './geography'
import { classifyOrder } from './taxonomy'
import { L1_TAGS } from './taxonomy'

export interface DataQualityCheck {
  id: string
  label: string
  count: number
  ok: boolean
  detail?: string
}

export function computeDataQuality(
  orders: Order[],
  products: Product[],
  productTagsMap: ProductTagsMap
): DataQualityCheck[] {
  const noCustomer = orders.filter((o) => !o.customer?.id).length
  const noCoords = orders.filter((o) => getLocationSource(o) === 'unknown').length
  const pincodeFallback = orders.filter((o) => getLocationSource(o) === 'pincode').length
  const noTags = orders.filter((o) => classifyOrder(o, productTagsMap).length === 0).length

  const productIds = new Set(products.map((p) => String(p.id)))
  const taggedProducts = products.filter((p) => {
    const tags = productTagsMap[String(p.id)] ?? []
    return L1_TAGS.some((t) => tags.includes(t))
  }).length
  const untaggedProducts = products.length - taggedProducts

  const ids = new Set<string>()
  let duplicates = 0
  for (const o of orders) {
    if (ids.has(o.id)) duplicates++
    ids.add(o.id)
  }

  return [
    {
      id: 'noCustomer',
      label: 'Orders with no customer',
      count: noCustomer,
      ok: noCustomer === 0,
    },
    {
      id: 'unknownChannel',
      label: 'Orders with channel = unknown',
      count: 0,
      ok: true,
    },
    {
      id: 'noLocation',
      label: 'Orders with no shipping coordinates',
      count: noCoords,
      ok: noCoords / Math.max(orders.length, 1) < 0.1,
      detail: `${pincodeFallback} estimated from pincode`,
    },
    {
      id: 'noProductTags',
      label: 'Orders with no product tags matched',
      count: noTags,
      ok: noTags / Math.max(orders.length, 1) < 0.05,
    },
    {
      id: 'untaggedProducts',
      label: 'Products with no taxonomy tags',
      count: untaggedProducts,
      ok: untaggedProducts === 0,
      detail: `${productIds.size} products in cache`,
    },
    {
      id: 'duplicateIds',
      label: 'Duplicate order IDs',
      count: duplicates,
      ok: duplicates === 0,
    },
  ]
}

export function computeChannelBreakdown(orders: Order[]) {
  let app = 0
  let website = 0
  for (const o of orders) {
    if (getOrderChannel(o) === 'website') website++
    else app++
  }
  return { app, website, unknown: 0, total: orders.length }
}

export function computeLocationBreakdown(orders: Order[]) {
  let coordinates = 0
  let pincode = 0
  let unknown = 0
  for (const o of orders) {
    const src = getLocationSource(o)
    if (src === 'coordinates') coordinates++
    else if (src === 'pincode') pincode++
    else unknown++
  }
  const total = orders.length || 1
  return {
    coordinates,
    pincode,
    unknown,
    coordPct: (coordinates / total) * 100,
    pincodePct: (pincode / total) * 100,
    unknownPct: (unknown / total) * 100,
  }
}
