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
import { SectionCard } from '../shared/SectionCard'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'

interface TabProps {
  orders: Order[]
  customers: { orders_count: number }[]
  customerCount: number
  productTagsMap: ProductTagsMap
  dateRange: FullDateRange
  orderStatus: OrderStatus
}

function DailyOrdersChart({ orders }: { orders: Order[] }) {
  const dailyTrend = useMemo(() => {
    const map = new Map<string, { orders: number; gmv: number }>()
    for (const order of orders) {
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
  }, [orders])

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={dailyTrend}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="orders" stroke="#00A86B" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function OrderValueDistributionChart({ orders }: { orders: Order[] }) {
  const valueBuckets = useMemo(() => bucketizeOrderValues(orders), [orders])

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={valueBuckets}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#00A86B" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function ItemsPerOrderChart({ orders }: { orders: Order[] }) {
  const itemBuckets = useMemo(() => bucketizeItemsPerOrder(orders), [orders])

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={itemBuckets}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9 }} />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#0F172A" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function EssentialSplitChart({ orders, productTagsMap }: { orders: Order[]; productTagsMap: ProductTagsMap }) {
  const { drillFromChart } = useChartDrillDown()
  const essentialSplit = useMemo(() => {
    let essential = 0
    let nonEssential = 0
    for (const order of orders) {
      if (isEssential(order, productTagsMap)) essential++
      else if (isNonEssential(order, productTagsMap)) nonEssential++
    }
    return [
      { name: 'Essential', value: essential },
      { name: 'Non-essential', value: nonEssential },
    ].filter((d) => d.value > 0)
  }, [orders, productTagsMap])

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={essentialSplit}
          dataKey="value"
          nameKey="name"
          innerRadius={45}
          outerRadius={75}
          onClick={(_, i) =>
            drillFromChart({
              title: essentialSplit[i]?.name ?? 'Orders',
              subtitle: essentialSplit[i]?.name ?? '',
              orders: orders.filter((o) =>
                essentialSplit[i]?.name === 'Essential'
                  ? isEssential(o, productTagsMap)
                  : isNonEssential(o, productTagsMap)
              ),
            })
          }
        >
          <Cell fill="#00A86B" />
          <Cell fill="#64748b" />
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

function L1CategoryChart({ orders, productTagsMap }: { orders: Order[]; productTagsMap: ProductTagsMap }) {
  const { drillFromChart } = useChartDrillDown()
  const categoryBars = useMemo(() => {
    const map = new Map<string, { orders: number; gmv: number }>()
    for (const order of orders) {
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
  }, [orders, productTagsMap])

  const totals = useMemo(
    () => ({
      orders: categoryBars.reduce((sum, row) => sum + row.orders, 0),
      gmv: categoryBars.reduce((sum, row) => sum + row.gmv, 0),
    }),
    [categoryBars]
  )

  return (
    <>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={categoryBars}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="category" tick={{ fontSize: 8 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip />
          <Bar
            yAxisId="left"
            dataKey="orders"
            fill="#00A86B"
            name="Orders"
            className="cursor-pointer"
            onClick={(data) => {
              const cat = String((data as { category?: string }).category ?? '')
              if (!cat) return
              drillFromChart({
                title: cat,
                subtitle: 'L1 category orders',
                orders: filterOrdersForMetric(orders, productTagsMap, { category: cat }),
              })
            }}
          />
          <Bar yAxisId="right" dataKey="gmv" fill="#cbd5e1" name="GMV" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-900">
        <span>Total orders: {totals.orders.toLocaleString('en-IN')}</span>
        <span>Total GMV: {formatINR(totals.gmv)}</span>
      </div>
    </>
  )
}

export function OrdersTab({ orders, customers, customerCount, productTagsMap }: TabProps) {
  const kpis = useMemo(() => computeKPIs(orders, customers as import('../../api/types').Customer[], customerCount), [orders, customers, customerCount])

  const firstTime = orders.filter((o) => (o.customer?.orders_count ?? 0) <= 1).length
  const repeat = orders.filter((o) => (o.customer?.orders_count ?? 0) > 1).length
  const cancelled = orders.filter((o) => o.cancelled_at).length
  const refunded = orders.filter((o) => o.financial_status === 'refunded').length
  const withDiscount = orders.filter((o) => (o.discount_codes?.length ?? 0) > 0).length

  const multiCategoryPct =
    orders.length > 0
      ? (orders.filter((o) => classifyOrder(o, productTagsMap).length >= 2).length / orders.length) * 100
      : 0

  if (orders.length === 0) {
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
          { label: 'Cancelled', value: `${((cancelled / (orders.length || 1)) * 100).toFixed(1)}%` },
          { label: 'Refunded', value: `${((refunded / (orders.length || 1)) * 100).toFixed(1)}%` },
          { label: 'Discount rate', value: `${((withDiscount / (orders.length || 1)) * 100).toFixed(1)}%` },
          { label: 'Multi-category', value: `${multiCategoryPct.toFixed(1)}%` },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-kiddo-border bg-white px-4 py-3">
            <p className="text-xs uppercase text-slate-400">{k.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Daily orders" orders={orders} enableBoardDateFilter defaultBoardPreset="30d">
        {(boardOrders) => <DailyOrdersChart orders={boardOrders} />}
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Order value distribution" orders={orders} enableBoardDateFilter defaultBoardPreset="30d">
          {(boardOrders) => <OrderValueDistributionChart orders={boardOrders} />}
        </SectionCard>
        <SectionCard title="Items per order" orders={orders} enableBoardDateFilter defaultBoardPreset="30d">
          {(boardOrders) => <ItemsPerOrderChart orders={boardOrders} />}
        </SectionCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Essential vs non-essential" orders={orders} enableBoardDateFilter defaultBoardPreset="30d">
          {(boardOrders) => <EssentialSplitChart orders={boardOrders} productTagsMap={productTagsMap} />}
        </SectionCard>
        <SectionCard title="L1 category (orders & GMV)" orders={orders} enableBoardDateFilter defaultBoardPreset="30d">
          {(boardOrders) => <L1CategoryChart orders={boardOrders} productTagsMap={productTagsMap} />}
        </SectionCard>
      </div>
    </div>
  )
}
