import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { FullDateRange, Order, OrderStatus, ProductTagsMap } from '../../api/types'
import { computeTopProducts } from '../../utils/aggregators'
import { L1_TAGS, classifyOrder, L2_MAP } from '../../utils/taxonomy'
import { formatINR } from '../../utils/formatters'
import { parseMoney } from '../../utils/formatters'
import { ExportButton } from '../shared/ExportButton'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { InfoTooltipByKey } from '../shared/InfoTooltip'
import { EmptyState } from '../shared/EmptyState'

interface TabProps {
  orders: Order[]
  customers: unknown[]
  customerCount: number
  productTagsMap: ProductTagsMap
  dateRange: FullDateRange
  orderStatus: OrderStatus
}

export function ProductsTab({ orders, productTagsMap }: TabProps) {
  const filtered = orders

  const topByRevenue = useMemo(() => computeTopProducts(filtered).slice(0, 10), [filtered])

  const topByVolume = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of filtered) {
      for (const item of order.line_items ?? []) {
        const title = item.product_title ?? item.title ?? 'Unknown'
        map.set(title, (map.get(title) ?? 0) + (item.quantity ?? 0))
      }
    }
    return Array.from(map.entries())
      .map(([productTitle, units]) => ({ productTitle, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 10)
      .reverse()
  }, [filtered])

  const categoryRevenue = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of filtered) {
      for (const cat of classifyOrder(order, productTagsMap)) {
        map.set(cat, (map.get(cat) ?? 0) + parseMoney(order.total_price))
      }
    }
    return L1_TAGS.map((cat) => ({
      category: cat,
      gmv: map.get(cat) ?? 0,
    })).filter((r) => r.gmv > 0)
  }, [filtered, productTagsMap])

  const l2Table = useMemo(() => {
    const map = new Map<string, { orders: number; gmv: number }>()
    for (const order of filtered) {
      for (const item of order.line_items ?? []) {
        const tags = productTagsMap[String(item.product_id ?? '')] ?? []
        for (const tag of tags) {
          for (const l1 of L1_TAGS) {
            if (L2_MAP[l1].includes(tag)) {
              const entry = map.get(tag) ?? { orders: 0, gmv: 0 }
              entry.orders += 1
              entry.gmv += parseMoney(item.price) * (item.quantity ?? 0)
              map.set(tag, entry)
            }
          }
        }
      }
    }
    return Array.from(map.entries())
      .map(([sub, v]) => ({ sub, ...v, aov: v.orders > 0 ? v.gmv / v.orders : 0 }))
      .sort((a, b) => b.gmv - a.gmv)
      .slice(0, 15)
  }, [filtered, productTagsMap])

  if (filtered.length === 0) {
    return <EmptyState message="No orders match the current filters." />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">Top 10 by revenue</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topByRevenue.map((d) => ({ ...d, short: d.productTitle.slice(0, 28) })).reverse()} layout="vertical">
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="short" width={120} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="grossSales" fill="#00A86B" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">Top 10 by volume</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={topByVolume.map((d) => ({ ...d, short: d.productTitle.slice(0, 28) }))} layout="vertical">
              <CartesianGrid horizontal={false} strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="short" width={120} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="units" fill="#0F172A" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold">L1 category revenue</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={categoryRevenue}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="category" tick={{ fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={50} />
            <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Bar dataKey="gmv" fill="#00A86B" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-1 text-sm font-semibold">
            L2 sub-category breakdown
            <InfoTooltipByKey metricKey="l2Products" />
          </h3>
          <ExportButton
            onExport={() =>
              downloadCsv(
                exportFilename('l2_products'),
                ['Sub-category', 'Orders', 'GMV', 'AOV'],
                l2Table.map((r) => [r.sub, r.orders, r.gmv, r.aov])
              )
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3">Sub-category</th>
                <th className="pb-2 pr-3 text-right">Orders</th>
                <th className="pb-2 pr-3 text-right">GMV</th>
                <th className="pb-2 text-right">AOV</th>
              </tr>
            </thead>
            <tbody>
              {l2Table.map((row) => (
                <tr key={row.sub} className="border-b border-slate-50">
                  <td className="py-2 pr-3">{row.sub}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.orders}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatINR(row.gmv)}</td>
                  <td className="py-2 text-right tabular-nums">{formatINR(row.aov)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
