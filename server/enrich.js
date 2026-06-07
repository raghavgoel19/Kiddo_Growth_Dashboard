/**
 * Shopify embeds a slim customer object on orders (no orders_count).
 * Merge full customer fields from the customers list for accurate metrics.
 */
export function enrichOrders(orders, customers) {
  if (!orders?.length || !customers?.length) return orders ?? []

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

export function mergeDashboardData({ orders = [], customers = [], products = [], customerCount = 0 }) {
  const enrichedOrders = enrichOrders(orders, customers)
  return {
    orders: enrichedOrders,
    customers,
    products,
    customerCount: customerCount || customers.length,
  }
}
