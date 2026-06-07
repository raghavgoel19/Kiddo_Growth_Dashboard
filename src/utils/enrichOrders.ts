import type { Customer, Order } from '../api/types'

export function enrichOrders(orders: Order[], customers: Customer[]): Order[] {
  if (!orders.length || !customers.length) return orders

  const byId = new Map(customers.map((c) => [String(c.id), c]))

  return orders.map((order) => {
    const embedded = order.customer
    if (!embedded?.id) return order

    const full = byId.get(String(embedded.id))
    if (!full) return order

    return {
      ...order,
      customer: {
        ...embedded,
        orders_count: full.orders_count ?? embedded.orders_count ?? 0,
        total_spent: full.total_spent ?? embedded.total_spent ?? '0.00',
        created_at: full.created_at ?? embedded.created_at,
        tags: full.tags ?? embedded.tags,
        phone: full.phone ?? embedded.phone,
      },
    }
  })
}
