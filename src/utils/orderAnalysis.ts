import type { Order, ProductTagsMap } from '../api/types'
import { getOrderChannel } from './channel'
import { getDistanceBand, getDistanceKm } from './geography'
import { getOrderItemCount } from './aggregators'
import { classifyOrder, isEssential } from './taxonomy'
import { parseMoney, displayPhone } from './formatters'
import { formatIST } from './formatters'
import { getPowerUserTier } from './aggregators'

/** Map of order id → true if it is the customer's first-ever order. */
export function buildFirstOrderIdSet(orders: Order[]): Set<string> {
  const earliest = new Map<string, { id: string; createdAt: string }>()
  for (const order of orders) {
    const cid = order.customer?.id
    if (!cid) continue
    const prev = earliest.get(String(cid))
    if (!prev || new Date(order.created_at) < new Date(prev.createdAt)) {
      earliest.set(String(cid), { id: order.id, createdAt: order.created_at })
    }
  }
  return new Set([...earliest.values()].map((v) => v.id))
}

export function isFirstTimeOrder(order: Order, firstOrderIds: Set<string>): boolean {
  return firstOrderIds.has(order.id)
}

export function isNonEssentialOrder(order: Order, productTagsMap: ProductTagsMap): boolean {
  return !isEssential(order, productTagsMap)
}

export function getCustomerOrderNumber(order: Order, allOrders: Order[]): number {
  const cid = order.customer?.id
  if (!cid) return 1
  const customerOrders = allOrders
    .filter((o) => o.customer?.id === cid)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const idx = customerOrders.findIndex((o) => o.id === order.id)
  return idx >= 0 ? idx + 1 : customerOrders.length
}

export function daysSinceLastOrder(order: Order, allOrders: Order[]): number | null {
  const cid = order.customer?.id
  if (!cid) return null
  const customerOrders = allOrders
    .filter((o) => o.customer?.id === cid)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const idx = customerOrders.findIndex((o) => o.id === order.id)
  if (idx < 0 || idx === customerOrders.length - 1) return null
  const current = new Date(order.created_at).getTime()
  const previous = new Date(customerOrders[idx + 1].created_at).getTime()
  return Math.floor((current - previous) / 86_400_000)
}

export function getPrimaryChannelForCustomer(customerId: string, orders: Order[]): string {
  const customerOrders = orders.filter((o) => o.customer?.id === customerId)
  let app = 0
  let web = 0
  for (const o of customerOrders) {
    const ch = getOrderChannel(o)
    if (ch === 'app') app++
    else if (ch === 'website') web++
  }
  if (app > web) return 'App'
  if (web > app) return 'Website'
  return 'Mixed'
}

export function getCustomerTier(ordersCount: number): string {
  if (ordersCount <= 1) return 'New'
  const { tier, tierEmoji } = getPowerUserTier(ordersCount)
  return `${tierEmoji} ${tier}`
}

export function orderToExportRow(order: Order, allOrders: Order[], productTagsMap: ProductTagsMap) {
  const categories = classifyOrder(order, productTagsMap).join('; ') || 'Uncategorized'
  const discount = order.discount_codes?.[0]
  return {
    order_number: order.name ?? order.order_number ?? order.id,
    date_ist: formatIST(order.created_at),
    phone: displayPhone(order.customer?.phone),
    customer_order_number: getCustomerOrderNumber(order, allOrders),
    items_count: getOrderItemCount(order),
    total_inr: parseMoney(order.total_price),
    category: categories,
    channel: getOrderChannel(order),
    distance_band: getDistanceBand(order),
    payment_status: order.financial_status,
    discount_code: discount?.code ?? '',
    discount_amount: discount?.amount ?? '',
  }
}

export function customerToExportRow(customer: import('../api/types').Customer, orders: Order[], productTagsMap: ProductTagsMap) {
  const customerOrders = orders.filter((o) => o.customer?.id === customer.id)
  const sorted = [...customerOrders].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const last = sorted[sorted.length - 1]
  const first = sorted[0]
  const spent = parseMoney(customer.total_spent)
  const topCategory = (() => {
    const counts = new Map<string, number>()
    for (const o of customerOrders) {
      for (const c of classifyOrder(o, productTagsMap)) {
        counts.set(c, (counts.get(c) ?? 0) + 1)
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  })()
  const avgDist =
    customerOrders.reduce((s, o) => s + (getDistanceKm(o) ?? 0), 0) /
    (customerOrders.filter((o) => getDistanceKm(o) != null).length || 1)

  return {
    phone: displayPhone(customer.phone),
    total_orders: customer.orders_count,
    total_spent_inr: spent,
    aov_inr: customer.orders_count > 0 ? spent / customer.orders_count : 0,
    first_order_date: first ? formatIST(first.created_at).split(',')[0] : '',
    last_order_date: last ? formatIST(last.created_at).split(',')[0] : '',
    days_since_last_order: last
      ? Math.floor((Date.now() - new Date(last.created_at).getTime()) / 86_400_000)
      : '',
    primary_channel: getPrimaryChannelForCustomer(customer.id, orders),
    top_category: topCategory,
    distance_band: last ? getDistanceBand(last) : 'unknown',
    tier: getCustomerTier(customer.orders_count),
    avg_distance_km: avgDist.toFixed(1),
  }
}

import { downloadCsv, exportFilename } from './csv'

export function exportOrdersCsv(orders: Order[], allOrders: Order[], productTagsMap: ProductTagsMap, type = 'orders') {
  const rows = orders.map((o) => {
    const r = orderToExportRow(o, allOrders, productTagsMap)
    return [
      r.order_number,
      r.date_ist,
      r.phone,
      r.customer_order_number,
      r.items_count,
      r.total_inr,
      r.category,
      r.channel,
      r.distance_band,
      r.payment_status,
      r.discount_code,
      r.discount_amount,
    ]
  })
  downloadCsv(
    exportFilename(type),
    [
      'order_number',
      'date_ist',
      'phone',
      'customer_order_number',
      'items_count',
      'total_inr',
      'category',
      'channel',
      'distance_band',
      'payment_status',
      'discount_code',
      'discount_amount',
    ],
    rows
  )
}

export function exportCustomersCsv(
  customers: import('../api/types').Customer[],
  orders: Order[],
  productTagsMap: ProductTagsMap,
  type = 'customers'
) {
  const rows = customers.map((c) => {
    const r = customerToExportRow(c, orders, productTagsMap)
    return [
      r.phone,
      r.total_orders,
      r.total_spent_inr,
      r.aov_inr,
      r.first_order_date,
      r.last_order_date,
      r.days_since_last_order,
      r.primary_channel,
      r.top_category,
      r.distance_band,
      r.tier,
    ]
  })
  downloadCsv(
    exportFilename(type),
    [
      'phone',
      'total_orders',
      'total_spent_inr',
      'aov_inr',
      'first_order_date',
      'last_order_date',
      'days_since_last_order',
      'primary_channel',
      'top_category',
      'distance_band',
      'tier',
    ],
    rows
  )
}
