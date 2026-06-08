import type { Customer, Order, PowerUser } from '../api/types'
import { getPowerUserTier } from './aggregators'
import { parseMoney } from './formatters'

export interface PowerUserRow extends PowerUser {
  rank: number
  ordersInWindow: number
  spentInWindow: number
}

function weekKeyIST(date: Date): string {
  const ist = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const day = ist.getDay()
  const diff = ist.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(ist)
  monday.setDate(diff)
  return monday.toISOString().slice(0, 10)
}

export function computePowerUserTable(orders: Order[], customers: Customer[]): PowerUserRow[] {
  const now = Date.now()
  const windowMs = 12 * 7 * 24 * 60 * 60 * 1000
  const cutoff = now - windowMs

  const stats = new Map<
    string,
    { orders: number; spent: number; phone: string; email: string | null; weeks: Set<string> }
  >()

  for (const order of orders) {
    const created = new Date(order.created_at).getTime()
    if (created < cutoff) continue
    const id = order.customer?.id
    if (!id) continue
    const entry = stats.get(id) ?? {
      orders: 0,
      spent: 0,
      phone: order.customer?.phone ?? '',
      email: order.customer?.email ?? null,
      weeks: new Set<string>(),
    }
    entry.orders += 1
    entry.spent += parseMoney(order.total_price)
    entry.weeks.add(weekKeyIST(new Date(order.created_at)))
    if (order.customer?.phone) entry.phone = order.customer.phone
    if (order.customer?.email) entry.email = order.customer.email
    stats.set(id, entry)
  }

  const customerById = new Map(customers.map((c) => [c.id, c]))

  const rows: PowerUserRow[] = []
  for (const [id, stat] of stats) {
    const isPower = stat.orders >= 5 || stat.spent >= 10_000
    if (!isPower) continue
    const customer = customerById.get(id)
    const { tier, tierEmoji } = getPowerUserTier(stat.orders)
    rows.push({
      id,
      phone: stat.phone || customer?.phone || '',
      email: stat.email ?? customer?.email ?? undefined,
      ordersCount: stat.orders,
      totalSpent: stat.spent,
      avgOrderValue: stat.orders > 0 ? stat.spent / stat.orders : 0,
      customerSince: customer?.created_at ?? '',
      tier,
      tierEmoji,
      rank: 0,
      ordersInWindow: stat.orders,
      spentInWindow: stat.spent,
    })
  }

  return rows
    .sort((a, b) => b.spentInWindow - a.spentInWindow || b.ordersInWindow - a.ordersInWindow)
    .slice(0, 100)
    .map((row, i) => ({ ...row, rank: i + 1 }))
}
