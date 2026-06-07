import { useMemo, useState } from 'react'
import { Drawer } from '../shared/Drawer'
import { useDashboardContext } from '../../context/DashboardContext'
import { ExportButton } from '../shared/ExportButton'
import { formatINR, formatIST, maskPhone } from '../../utils/formatters'
import { exportCustomersCsv, exportOrdersCsv } from '../../utils/orderAnalysis'

export function DrillDownDrawer() {
  const { drillDown, closeDrillDown, openOrderDetail, allOrders, productTagsMap, filteredCustomers } =
    useDashboardContext()
  const [tab, setTab] = useState<'orders' | 'customers'>('orders')
  const [search, setSearch] = useState('')

  const orders = drillDown?.orders ?? []

  const customers = useMemo(() => {
    const ids = new Set(orders.map((o) => o.customer?.id).filter(Boolean))
    return filteredCustomers.filter((c) => ids.has(c.id))
  }, [orders, filteredCustomers])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter(
      (o) =>
        (o.name ?? '').toLowerCase().includes(q) ||
        maskPhone(o.customer?.phone).includes(q)
    )
  }, [orders, search])

  const filteredCustomersList = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => maskPhone(c.phone).includes(q) || (c.email ?? '').toLowerCase().includes(q))
  }, [customers, search])

  if (!drillDown) return null

  return (
    <Drawer open={!!drillDown} title={drillDown.title} subtitle={drillDown.subtitle} onClose={closeDrillDown}>
      <div className="flex h-full flex-col">
        <div className="flex gap-2 border-b border-slate-200 px-4 pt-3">
          {(['orders', 'customers'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`border-b-2 px-3 py-2 text-sm font-medium capitalize ${
                tab === t ? 'border-[#00A86B] text-[#00A86B]' : 'border-transparent text-slate-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="space-y-3 p-4">
          <input
            type="search"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-kiddo-border px-3 py-2 text-sm"
          />
          <ExportButton
            onExport={() =>
              tab === 'orders'
                ? exportOrdersCsv(filteredOrders, allOrders, productTagsMap, 'drilldown_orders')
                : exportCustomersCsv(filteredCustomersList, allOrders, productTagsMap, 'drilldown_customers')
            }
          />
        </div>
        <div className="flex-1 overflow-auto px-4 pb-4">
          {tab === 'orders' ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">Order #</th>
                  <th className="pb-2">Date</th>
                  <th className="pb-2">Customer</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="py-2">
                      <button type="button" className="font-medium text-[#00A86B] hover:underline" onClick={() => openOrderDetail(o)}>
                        {o.name ?? `#${o.order_number}`}
                      </button>
                    </td>
                    <td className="py-2 text-slate-600">{formatIST(o.created_at)}</td>
                    <td className="py-2">{maskPhone(o.customer?.phone)}</td>
                    <td className="py-2 text-right">{formatINR(parseFloat(o.total_price) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="pb-2">Phone</th>
                  <th className="pb-2 text-right">Orders</th>
                  <th className="pb-2 text-right">Spent</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomersList.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="py-2">{maskPhone(c.phone)}</td>
                    <td className="py-2 text-right">{c.orders_count}</td>
                    <td className="py-2 text-right">{formatINR(parseFloat(c.total_spent) || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Drawer>
  )
}
