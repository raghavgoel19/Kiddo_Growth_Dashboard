import type { Order, OrderStatus } from '../api/types'
import type { GlobalFilters } from '../context/DashboardContext'
import { filterTestOrders } from './testUserFilter'

export function applyStatusFilter(orders: Order[], statuses: OrderStatus[]): Order[] {
  if (statuses.includes('all') || statuses.length === 0) return orders
  return orders.filter((o) => {
    if (statuses.includes('cancelled') && o.cancelled_at) return true
    return statuses.includes(o.financial_status as OrderStatus)
  })
}

export function applyFilters(orders: Order[], filters: GlobalFilters): Order[] {
  let result = orders
  result = applyStatusFilter(result, filters.orderStatuses)
  result = filterTestOrders(result, filters.hideTestUsers)
  return result
}
