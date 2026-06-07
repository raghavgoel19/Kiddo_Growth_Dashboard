import { useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import type { FullDateRange, Order, OrderStatus, ProductTagsMap } from '../../api/types'
import {
  bucketizeItemsPerOrder,
  bucketizeOrderValues,
  computeKPIs,
} from '../../utils/aggregators'
import { isEssential, isNonEssential, classifyOrder, L1_TAGS } from '../../utils/taxonomy'
import { parseMoney, formatINR } from '../../utils/formatters'
import { EmptyState } from '../shared/EmptyState'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'

interface TabProps {
  orders: Order[]
  customers: { orders_count: number }[]
  customerCount: number
  productTagsMap: ProductTagsMap
  dateRange: FullDateRange
  orderStatus: OrderStatus
}

export function OrdersTab({ orders, customers, customerCount, productTagsMap }: TabProps) {
  const filtered = orders

  const kpis = useMemo(() => computeKPIs(filtered, customers as import('../../api/types').Customer[], customerCount), [filtered, customers, customerCount])

  const firstTime = filtered.filter((o) => (o.customer?.orders_count ?? 0) <= 1).length
  const repeat = filtered.filter((o) => (o.customer?.orders_count ?? 0) > 1).length
  const cancelled = filtered.filter((o) => o.cancelled_at).length
  const refunded = filtered.filter((o) => o.financial_status === 'refunded').length
  const withDiscount = filtered.filter((o) => (o.discount_codes?.length ?? 0) > 0).length

  const dailyTrend = useMemo(() => {
    const map = new Map<string, { orders: number; gmv: number }>()
    for (const order of filtered) {
      const key = order.created_at.slice(0, 10)
      const entry = map.get(key) ?? { orders: 0, gmv: 0 }
      entry.orders += 1
      entry.gmv += parseMoney(order.total_price)
      map.set(key, entry)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, v]) => ({ date, ...v }))
  }, [filtered])

  const valueBuckets = bucketizeOrderValues(filtered)
  const itemBuckets = bucketizeItemsPerOrder(filtered)

  const essentialSplit = useMemo(() => {
    let essential = 0
    let nonEssential = 0
    for (const order of filtered) {
      if (isEssential(order, productTagsMap)) essential++
      else if (isNonEssential(order, productTagsMap)) nonEssential++
    }
    return [
      { name: 'Essential', value: essential },
      { name: 'Non-essential', value: nonEssential },
    ].filter((d) => d.value > 0)
  }, [filtered, productTagsMap])

  const categoryBars = useMemo(() => {
    const map = new Map<string, { orders: number; gmv: number }>()
    for (const order of filtered) {
      for (const cat of classifyOrder(order, productTagsMap)) {
        const entry = map.get(cat) ?? { orders: 0, gmv: 0 }
        entry.orders += 1
        entry.gmv += parseMoney(order.total_price)
        map.set(cat, entry)
      }
    }
    return L1_TAGS.map((cat) => ({
      category: cat,
      orders: map.get(cat)?.orders ?? 0,
      gmv: map.get(cat)?.gmv ?? 0,
    })).filter((r) => r.orders > 0)
  }, [filtered, productTagsMap])

  const multiCategoryPct =
    filtered.length > 0
      ? (filtered.filter((o) => classifyOrder(o, productTagsMap).length >= 2).length / filtered.length) * 100
      : 0

  const { drillFromChart } = useChartDrillDown()

  if (filtered.length === 0) {
    return <EmptyState message="No orders match the current filters." />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5">
        {[
          { label: 'Orders', value: kpis.totalOrders.toLocaleString('en-IN') },
          { label: 'GMV', value: formatINR(kpis.grossRevenue) },
          { label: 'AOV', value: formatINR(kpis.averageOrderValue) },
          { label: '1st-time', value: firstTime.toLocaleString('en-IN') },
          { label: 'Repeat', value: repeat.toLocaleString('en-IN') },
          { label: 'Cancelled', value: `${((cancelled / (filtered.length || 1)) * 100).toFixed(1)}%` },
          { label: 'Refunded', value: `${((refunded / (filtered.length || 1)) * 100).toFixed(1)}%` },
          { label: 'Discount rate', value: `${((withDiscount / (filtered.length || 1)) * 100).toFixed(1)}%` },
          { label: 'Multi-category', value: `${multiCategoryPct.toFixed(1)}%` },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-kiddo-border bg-white px-4 py-3">
            <p className="text-xs uppercase text-slate-400">{k.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold">Daily orders</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dailyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="orders" stroke="#00A86B" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">Order value distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={valueBuckets}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#00A86B" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">Items per order</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={itemBuckets}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0F172A" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">Essential vs non-essential</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={essentialSplit} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} onClick={(_, i) =>
                drillFromChart({
                  title: essentialSplit[i]?.name ?? 'Orders',
                  subtitle: essentialSplit[i]?.name ?? '',
                  orders: filtered.filter((o) =>
                    essentialSplit[i]?.name === 'Essential'
                      ? isEssential(o, productTagsMap)
                      : isNonEssential(o, productTagsMap)
                  ),
                })
              }>
                <Cell fill="#00A86B" />
                <Cell fill="#64748b" />
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">L1 category (orders & GMV)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={categoryBars}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" tick={{ fontSize: 8 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip />
              <Bar yAxisId="left" dataKey="orders" fill="#00A86B" name="Orders" />
              <Bar yAxisId="right" dataKey="gmv" fill="#cbd5e1" name="GMV" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
