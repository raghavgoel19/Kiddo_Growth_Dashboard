import { memo, useMemo, useState } from 'react'
import { Drawer } from '../shared/Drawer'
import { useDashboardContext } from '../../context/DashboardContext'
import { useDashboardStore } from '../../store'
import { ExportButton } from '../shared/ExportButton'
import { VirtualTable } from '../shared/VirtualTable'
import { TableSummaryFooter } from '../shared/TableSummaryFooter'
import { formatINR, formatIST, displayPhone, parseMoney } from '../../utils/formatters'
import { exportCustomersCsv, exportOrdersCsv } from '../../utils/orderAnalysis'
import { getOrderChannel, getOrderChannelLabel } from '../../utils/channel'
import { classifyOrder } from '../../utils/taxonomy'
import { getOrderItemCount } from '../../utils/aggregators'
import {
  daysSinceFirstOrder,
  formatFirstOrderLine,
  repeatScoreEmoji,
} from '../../utils/repeatProbability'
import type { Order, ProductTagsMap } from '../../api/types'
import { downloadCsv, exportFilename } from '../../utils/csv'

function getUniqueProducts(orders: Order[], productTagsMap: ProductTagsMap) {
  const map = new Map<
    string,
    { id: string; title: string; qty: number; revenue: number; category: string }
  >()
  for (const order of orders) {
    for (const li of order.line_items ?? []) {
      const id = String(li.product_id ?? li.title ?? 'unknown')
      const prev = map.get(id)
      const qty = li.quantity ?? 0
      const revenue = parseMoney(li.price) * qty
      const cats = li.product_id ? classifyOrder({ ...order, line_items: [li] }, productTagsMap) : []
      map.set(id, {
        id,
        title: li.title ?? 'Unknown',
        qty: (prev?.qty ?? 0) + qty,
        revenue: (prev?.revenue ?? 0) + revenue,
        category: cats[0] ?? prev?.category ?? '—',
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue)
}

export const DrillDownDrawer = memo(function DrillDownDrawer() {
  const { drillDown, closeDrillDown, openOrderDetail, allOrders, productTagsMap, filteredCustomers } =
    useDashboardContext()
  const customerSummaries = useDashboardStore((s) => s.customerSummaries)
  const summaryById = useMemo(() => new Map(customerSummaries.map((c) => [c.id, c])), [customerSummaries])
  const [tab, setTab] = useState<'orders' | 'customers' | 'products'>('orders')
  const [search, setSearch] = useState('')

  const orders = drillDown?.orders ?? []

  const customers = useMemo(() => {
    const ids = new Set(orders.map((o) => o.customer?.id).filter(Boolean))
    return filteredCustomers.filter((c) => ids.has(c.id))
  }, [orders, filteredCustomers])

  const products = useMemo(() => getUniqueProducts(orders, productTagsMap), [orders, productTagsMap])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(
      (o) =>
        (o.name ?? '').toLowerCase().includes(q) ||
        displayPhone(o.customer?.phone).toLowerCase().includes(q)
    )
  }, [orders, search])

  const filteredCustomersList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter(
      (c) => displayPhone(c.phone).toLowerCase().includes(q) || (c.email ?? '').toLowerCase().includes(q)
    )
  }, [customers, search])

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
  }, [products, search])

  const orderTotals = useMemo(
    () => filteredOrders.map((o) => parseMoney(o.total_price)),
    [filteredOrders]
  )

  if (!drillDown) return null

  return (
    <Drawer open={!!drillDown} title={drillDown.title} subtitle={drillDown.subtitle} onClose={closeDrillDown}>
      <div className="flex h-full flex-col">
        <div className="flex gap-2 border-b border-slate-200 px-4 pt-3">
          {(
            [
              ['orders', orders.length],
              ['customers', customers.length],
              ['products', products.length],
            ] as const
          ).map(([t, count]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
                tab === t ? 'border-[#00A86B] text-[#00A86B]' : 'border-transparent text-slate-500'
              }`}
            >
              {t} ({count})
            </button>
          ))}
        </div>
        <div className="space-y-3 p-4">
          <input
            type="search"
            placeholder={tab === 'orders' ? 'Search order #, phone…' : tab === 'customers' ? 'Search phone…' : 'Search product…'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-kiddo-border px-3 py-2 text-sm"
          />
          <ExportButton
            label="Export CSV"
            onExport={() => {
              if (tab === 'orders') {
                exportOrdersCsv(filteredOrders, allOrders, productTagsMap, 'drilldown_orders')
              } else if (tab === 'customers') {
                exportCustomersCsv(filteredCustomersList, allOrders, productTagsMap, 'drilldown_customers')
              } else {
                downloadCsv(
                  exportFilename('drilldown_products'),
                  ['Product', 'Category', 'Qty', 'Revenue'],
                  filteredProducts.map((p) => [p.title, p.category, p.qty, p.revenue])
                )
              }
            }}
          />
        </div>
        <div className="flex-1 overflow-auto px-4 pb-4">
          {tab === 'orders' ? (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-400">
                  <th className="px-2 py-2">Order</th>
                  <th className="px-2 py-2">Date</th>
                  <th className="px-2 py-2">Phone</th>
                  <th className="px-2 py-2">Channel</th>
                  <th className="px-2 py-2 text-right">Items</th>
                  <th className="px-2 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr
                    key={o.id}
                    className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                    onClick={() => openOrderDetail(o)}
                  >
                    <td className="px-2 py-2 font-medium text-[#00A86B]">{o.name ?? `#${o.order_number}`}</td>
                    <td className="px-2 py-2 text-slate-600">{formatIST(o.created_at)}</td>
                    <td className="px-2 py-2 font-medium text-slate-900">{displayPhone(o.customer?.phone)}</td>
                    <td className="px-2 py-2">{getOrderChannelLabel(getOrderChannel(o))}</td>
                    <td className="px-2 py-2 text-right">{getOrderItemCount(o)}</td>
                    <td className="px-2 py-2 text-right font-medium">{formatINR(parseMoney(o.total_price))}</td>
                  </tr>
                ))}
              </tbody>
              <TableSummaryFooter
                cells={[
                  { type: 'text', values: [], colSpan: 2, label: `${filteredOrders.length} orders` },
                  { type: 'text', values: [], colSpan: 3 },
                  { type: 'currency', values: orderTotals },
                ]}
              />
            </table>
          ) : tab === 'customers' ? (
            <VirtualTable
              rows={filteredCustomersList}
              header={
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">Customer</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Spent</th>
                </tr>
              }
              getRowKey={(c) => c.id}
              renderRow={(c) => {
                const summary = summaryById.get(c.id)
                const repeat = summary?.repeatProbability
                return (
                  <>
                    <td className="py-2">
                      <p className="font-medium">{displayPhone(c.phone)}</p>
                      {repeat ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Repeat probability: {repeat.score}% {repeatScoreEmoji(repeat.score)} · Window:{' '}
                          {repeat.predictedWindow}
                        </p>
                      ) : null}
                      {summary?.firstOrderDNA && summary.totalOrders === 1 ? (
                        <p className="mt-0.5 text-xs text-slate-400">
                          {formatFirstOrderLine(summary.firstOrderDNA)} · {daysSinceFirstOrder(summary)}d ago
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 text-right">{c.orders_count}</td>
                    <td className="py-2 text-right">{formatINR(parseFloat(c.total_spent) || 0)}</td>
                  </>
                )
              }}
            />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="px-2 py-2">Product</th>
                  <th className="px-2 py-2">Category</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50">
                    <td className="px-2 py-2">{p.title}</td>
                    <td className="px-2 py-2">{p.category}</td>
                    <td className="px-2 py-2 text-right">{p.qty}</td>
                    <td className="px-2 py-2 text-right">{formatINR(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
              <TableSummaryFooter
                cells={[
                  { type: 'text', values: [], label: `${filteredProducts.length} products` },
                  { type: 'text', values: [] },
                  { type: 'orders', values: filteredProducts.map((p) => p.qty) },
                  { type: 'currency', values: filteredProducts.map((p) => p.revenue) },
                ]}
              />
            </table>
          )}
        </div>
      </div>
    </Drawer>
  )
})
