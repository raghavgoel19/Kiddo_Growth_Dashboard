import type { Customer, Order } from '../api/types'

/** Build customer list from embedded order customer payloads. */
export function deriveCustomersFromOrders(orders: Order[]): Customer[] {
  const byId = new Map<string, Customer>()

  for (const order of orders) {
    const embedded = order.customer
    if (!embedded?.id) continue

    const id = String(embedded.id)
    const prev = byId.get(id)
    const ordersCount = Math.max(
      prev?.orders_count ?? 0,
      embedded.orders_count ?? 0
    )
    const totalSpent = Math.max(
      parseFloat(prev?.total_spent ?? '0'),
      parseFloat(embedded.total_spent ?? '0')
    ).toFixed(2)

    byId.set(id, {
      id,
      first_name: embedded.first_name ?? prev?.first_name,
      last_name: embedded.last_name ?? prev?.last_name,
      phone: embedded.phone ?? prev?.phone,
      email: embedded.email ?? prev?.email,
      orders_count: ordersCount,
      total_spent: totalSpent,
      created_at: embedded.created_at ?? prev?.created_at ?? order.created_at,
      tags: embedded.tags ?? prev?.tags,
    })
  }

  return Array.from(byId.values())
}
