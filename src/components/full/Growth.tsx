import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { Customer, FullDateRange, Order, OrderStatus, ProductTagsMap } from '../../api/types'
import { classifyOrder, L1_TAGS } from '../../utils/taxonomy'
import { parseMoney, formatINR, pctChange } from '../../utils/formatters'
import { subDays } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import { IST } from '../../utils/dates'
import { ExportButton } from '../shared/ExportButton'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { InfoTooltipByKey } from '../shared/InfoTooltip'
import { EmptyState } from '../shared/EmptyState'

interface TabProps {
  orders: Order[]
  customers: Customer[]
  customerCount: number
  productTagsMap: ProductTagsMap
  dateRange: FullDateRange
  orderStatus: OrderStatus
}

export function GrowthTab({ orders, customers, productTagsMap }: TabProps) {
  const filtered = orders

  const wow = useMemo(() => {
    const now = toZonedTime(new Date(), IST)
    const thisWeekStart = subDays(now, now.getDay() === 0 ? 6 : now.getDay() - 1)
    const lastWeekStart = subDays(thisWeekStart, 7)
    const lastWeekEnd = subDays(thisWeekStart, 1)

    const inRange = (o: Order, start: Date, end: Date) => {
      const d = toZonedTime(new Date(o.created_at), IST)
      return d >= start && d <= end
    }

    const thisWeek = filtered.filter((o) => inRange(o, thisWeekStart, now))
    const prevWeek = filtered.filter((o) => inRange(o, lastWeekStart, lastWeekEnd))

    const gmv = (list: Order[]) => list.reduce((s, o) => s + parseMoney(o.total_price), 0)
    const newCust = (list: Order[]) => list.filter((o) => (o.customer?.orders_count ?? 0) <= 1).length
    const repeat = (list: Order[]) => list.filter((o) => (o.customer?.orders_count ?? 0) > 1).length

    return {
      gmv: pctChange(gmv(thisWeek), gmv(prevWeek)),
      orders: pctChange(thisWeek.length, prevWeek.length),
      newCustomers: pctChange(newCust(thisWeek), newCust(prevWeek)),
      repeatOrders: pctChange(repeat(thisWeek), repeat(prevWeek)),
    }
  }, [filtered])

  const monthlyGmv = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of filtered) {
      const key = order.created_at.slice(0, 7)
      map.set(key, (map.get(key) ?? 0) + parseMoney(order.total_price))
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, gmv]) => ({ month, gmv }))
  }, [filtered])

  const categoryMomentum = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    for (const order of filtered) {
      const month = order.created_at.slice(0, 7)
      for (const cat of classifyOrder(order, productTagsMap)) {
        if (!map.has(cat)) map.set(cat, new Map())
        const m = map.get(cat)!
        m.set(month, (m.get(month) ?? 0) + 1)
      }
    }

    return L1_TAGS.map((cat) => {
      const months = map.get(cat)
      if (!months) return { category: cat, momGrowth: 0, orders: 0 }
      const sorted = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b))
      const last = sorted[sorted.length - 1]?.[1] ?? 0
      const prev = sorted[sorted.length - 2]?.[1] ?? 0
      const mom = prev > 0 ? ((last - prev) / prev) * 100 : 0
      const total = sorted.reduce((s, [, v]) => s + v, 0)
      return { category: cat, momGrowth: mom, orders: total }
    })
      .filter((r) => r.orders > 0)
      .sort((a, b) => b.momGrowth - a.momGrowth)
  }, [filtered, productTagsMap])

  const pareto = useMemo(() => {
    const spent = customers
      .map((c) => parseMoney(c.total_spent))
      .sort((a, b) => b - a)
    const total = spent.reduce((s, v) => s + v, 0) || 1
    const top10pct = Math.max(1, Math.ceil(spent.length * 0.1))
    const topGmv = spent.slice(0, top10pct).reduce((s, v) => s + v, 0)
    return (topGmv / total) * 100
  }, [customers])

  if (filtered.length === 0) {
    return <EmptyState message="No orders match the current filters." />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'WoW GMV', ...wow.gmv },
          { label: 'WoW orders', ...wow.orders },
          { label: 'WoW new customers', ...wow.newCustomers },
          { label: 'WoW repeat orders', ...wow.repeatOrders },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-kiddo-border bg-white px-4 py-4">
            <p className="text-xs uppercase text-slate-400">{k.label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${k.positive ? 'text-emerald-600' : 'text-red-500'}`}>
              {k.value === 'N/A' ? k.value : `${k.positive ? '▲' : '▼'} ${k.value}`}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">Monthly GMV</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={monthlyGmv}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Line type="monotone" dataKey="gmv" stroke="#00A86B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white px-4 py-5">
          <h3 className="mb-2 text-sm font-semibold">GMV concentration (Pareto)</h3>
          <p className="text-3xl font-semibold text-[#00A86B] tabular-nums">{pareto.toFixed(1)}%</p>
          <p className="mt-1 text-sm text-slate-500">of GMV from top 10% of customers</p>
        </div>
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-1 text-sm font-semibold">
            Category momentum (MoM order growth)
            <InfoTooltipByKey metricKey="momentum" />
          </h3>
          <ExportButton
            onExport={() =>
              downloadCsv(
                exportFilename('growth_momentum'),
                ['Category', 'Total orders', 'MoM growth %'],
                categoryMomentum.map((r) => [r.category, r.orders, r.momGrowth.toFixed(1)])
              )
            }
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[400px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-3">Category</th>
                <th className="pb-2 pr-3 text-right">Total orders</th>
                <th className="pb-2 text-right">MoM growth</th>
              </tr>
            </thead>
            <tbody>
              {categoryMomentum.map((row) => (
                <tr key={row.category} className="border-b border-slate-50">
                  <td className="py-2 pr-3 font-medium">{row.category}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{row.orders}</td>
                  <td className={`py-2 text-right tabular-nums font-medium ${row.momGrowth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {row.momGrowth >= 0 ? '+' : ''}{row.momGrowth.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
