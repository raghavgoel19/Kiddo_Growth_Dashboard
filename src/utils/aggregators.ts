import type {
  Customer,
  Order,
  OrderStatus,
  OrderValueBucket,
  ItemsPerOrderBucket,
  StatusBreakdown,
  PowerUser,
  FullDateRange,
  KPIs,
  TrendPoint,
  AOVPoint,
  TopProduct,
  CohortPoint,
} from '../api/types'
import { parseMoney } from './formatters'
import { filterOrdersByPeriod } from './dates'

const ORDER_VALUE_BUCKETS = [
  { label: 'Under ₹200', min: 0, max: 199 },
  { label: '₹200–500', min: 200, max: 499 },
  { label: '₹500–1000', min: 500, max: 999 },
  { label: '₹1000–2000', min: 1000, max: 1999 },
  { label: '₹2000–5000', min: 2000, max: 4999 },
  { label: '₹5000+', min: 5000, max: Infinity },
]

const ITEMS_BUCKETS = [
  { label: '1 item', min: 1, max: 1 },
  { label: '2 items', min: 2, max: 2 },
  { label: '3 items', min: 3, max: 3 },
  { label: '4–5 items', min: 4, max: 5 },
  { label: '6–10 items', min: 6, max: 10 },
  { label: '11+ items', min: 11, max: Infinity },
]

export function getOrderItemCount(order: Order): number {
  return (order.line_items ?? []).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
}

export function bucketizeOrderValues(orders: Order[]): OrderValueBucket[] {
  const counts = ORDER_VALUE_BUCKETS.map(() => 0)
  for (const order of orders) {
    const price = parseMoney(order.total_price)
    const idx = ORDER_VALUE_BUCKETS.findIndex((b) => price >= b.min && price <= b.max)
    if (idx >= 0) counts[idx]++
  }
  const total = orders.length || 1
  return ORDER_VALUE_BUCKETS.map((b, i) => ({
    label: b.label,
    count: counts[i],
    percentage: (counts[i] / total) * 100,
  }))
}

export function bucketizeItemsPerOrder(orders: Order[]): ItemsPerOrderBucket[] {
  const counts = ITEMS_BUCKETS.map(() => 0)
  for (const order of orders) {
    const qty = getOrderItemCount(order)
    const idx = ITEMS_BUCKETS.findIndex((b) => qty >= b.min && qty <= b.max)
    if (idx >= 0) counts[idx]++
  }
  const total = orders.length || 1
  return ITEMS_BUCKETS.map((b, i) => ({
    label: b.label,
    count: counts[i],
    percentage: (counts[i] / total) * 100,
  }))
}

export function groupByFinancialStatus(orders: Order[]): StatusBreakdown[] {
  const map = new Map<string, number>()
  for (const order of orders) {
    const status = order.financial_status || 'unknown'
    map.set(status, (map.get(status) ?? 0) + 1)
  }
  const total = orders.length || 1
  return Array.from(map.entries())
    .map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      percentage: (count / total) * 100,
    }))
    .sort((a, b) => b.count - a.count)
}

export function getPowerUserTier(ordersCount: number): {
  tier: PowerUser['tier']
  tierEmoji: string
} {
  if (ordersCount >= 20) return { tier: 'Champion', tierEmoji: '🥇' }
  if (ordersCount >= 10) return { tier: 'Loyal', tierEmoji: '🥈' }
  return { tier: 'Regular', tierEmoji: '🥉' }
}

export function isPowerUser(customer: Customer): boolean {
  return customer.orders_count >= 5 || parseMoney(customer.total_spent) >= 10000
}

export function filterInternalAccounts(
  customers: Customer[],
  excludeInternal: boolean
): Customer[] {
  if (!excludeInternal) return customers
  return customers.filter(
    (c) => !c.email?.toLowerCase().endsWith('@kiddo.app')
  )
}

export function customersToPowerUsers(customers: Customer[]): PowerUser[] {
  return customers
    .filter(isPowerUser)
    .map((c) => {
      const totalSpent = parseMoney(c.total_spent)
      const { tier, tierEmoji } = getPowerUserTier(c.orders_count)
      return {
        id: c.id,
        phone: c.phone ?? '',
        email: c.email,
        ordersCount: c.orders_count,
        totalSpent,
        avgOrderValue: c.orders_count > 0 ? totalSpent / c.orders_count : 0,
        customerSince: c.created_at,
        tier,
        tierEmoji,
      }
    })
}

export function dedupeCustomers(customers: Customer[]): Customer[] {
  const map = new Map<string, Customer>()
  for (const c of customers) {
    const existing = map.get(c.id)
    if (!existing || parseMoney(c.total_spent) > parseMoney(existing.total_spent)) {
      map.set(c.id, c)
    }
  }
  return Array.from(map.values())
}

export function buildOrderStatusQuery(status: OrderStatus): string | undefined {
  if (status === 'all') return undefined
  return `financial_status:${status}`
}

export function computeAvgItemsPerOrder(orders: Order[]): number {
  if (orders.length === 0) return 0
  const totalItems = orders.reduce((sum, o) => sum + getOrderItemCount(o), 0)
  return totalItems / orders.length
}

export function filterOrdersByStatus(orders: Order[], status: OrderStatus): Order[] {
  if (status === 'all') return orders
  return orders.filter((o) => o.financial_status === status)
}

export function filterOrdersByDateRange(orders: Order[], dateRange: FullDateRange): Order[] {
  return filterOrdersByPeriod(orders, dateRange)
}

function monthKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function computeKPIs(orders: Order[], customers: Customer[], customerCount: number): KPIs {
  const grossRevenue = orders.reduce((s, o) => s + parseMoney(o.total_price), 0)
  const totalOrders = orders.length
  const repeatCustomers = customers.filter((c) => c.orders_count > 1).length
  const totalCustomers = customerCount || customers.length

  return {
    totalOrders,
    grossRevenue,
    averageOrderValue: totalOrders > 0 ? grossRevenue / totalOrders : 0,
    totalCustomers,
    repeatCustomerRate: totalCustomers > 0 ? (repeatCustomers / totalCustomers) * 100 : 0,
    avgItemsPerOrder: computeAvgItemsPerOrder(orders),
  }
}

export function computeRevenueTrend(orders: Order[]): TrendPoint[] {
  const map = new Map<string, { revenue: number; orders: number }>()
  for (const order of orders) {
    const key = monthKey(order.created_at)
    const entry = map.get(key) ?? { revenue: 0, orders: 0 }
    entry.revenue += parseMoney(order.total_price)
    entry.orders += 1
    map.set(key, entry)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, { revenue, orders: count }]) => ({
      month,
      revenue,
      orders: count,
      aov: count > 0 ? revenue / count : 0,
    }))
}

export function computeAOVTrend(orders: Order[]): AOVPoint[] {
  return computeRevenueTrend(orders).map(({ month, aov }) => ({ month, aov }))
}

export function computeTopProducts(orders: Order[]): TopProduct[] {
  const map = new Map<string, { grossSales: number; orders: number }>()
  for (const order of orders) {
    const seen = new Set<string>()
    for (const item of order.line_items ?? []) {
      const title = item.product_title ?? item.title ?? 'Unknown'
      const revenue = parseMoney(item.price) * (item.quantity ?? 0)
      const entry = map.get(title) ?? { grossSales: 0, orders: 0 }
      entry.grossSales += revenue
      if (!seen.has(title)) {
        entry.orders += 1
        seen.add(title)
      }
      map.set(title, entry)
    }
  }
  return Array.from(map.entries())
    .map(([productTitle, { grossSales, orders: orderCount }]) => ({
      productTitle,
      grossSales,
      netSales: grossSales,
      orders: orderCount,
    }))
    .sort((a, b) => b.grossSales - a.grossSales)
    .slice(0, 10)
}

export function computeCustomerCohort(customers: Customer[]): CohortPoint[] {
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const map = new Map<string, { newCustomers: number; returningCustomers: number }>()

  for (const customer of customers) {
    const created = new Date(customer.created_at)
    if (created < sixMonthsAgo) continue
    const key = monthKey(customer.created_at)
    const entry = map.get(key) ?? { newCustomers: 0, returningCustomers: 0 }
    if (customer.orders_count > 1) entry.returningCustomers += 1
    else entry.newCustomers += 1
    map.set(key, entry)
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({ month, ...data }))
}

export function getPowerUsers(customers: Customer[]): Customer[] {
  return customers.filter(isPowerUser)
}

export function getRecentOrders(orders: Order[], limit = 20): Order[] {
  return [...orders]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
}

export const STATUS_COLORS: Record<string, string> = {
  paid: '#00A86B',
  pending: '#F59E0B',
  refunded: '#EF4444',
  voided: '#94A3B8',
  authorized: '#3B82F6',
  partially_paid: '#8B5CF6',
  partially_refunded: '#F97316',
}

export const GREEN_GRADIENT = [
  '#A7F3D0',
  '#6EE7B7',
  '#34D399',
  '#10B981',
  '#059669',
  '#047857',
]
