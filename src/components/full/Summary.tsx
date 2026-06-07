import { useMemo } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import type { Order, ProductTagsMap } from '../../api/types'
import { computeKPIs, computeRevenueTrend, computeAOVTrend } from '../../utils/aggregators'
import { classifyOrder } from '../../utils/taxonomy'
import { getOrderChannel } from '../../utils/channel'
import { formatINR, formatMonthLabel } from '../../utils/formatters'
import { useTabCompare } from '../../hooks/useTabCompare'
import { CompareChartWrapper, COMPARE_LINE_PROPS } from '../shared/CompareChartWrapper'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'
import { EmptyState } from '../shared/EmptyState'
import { DataQualityPanel } from '../shared/DataQualityPanel'
import type { Product } from '../../api/types'

interface TabProps {
  orders: Order[]
  customers: ReturnType<typeof import('../../hooks/useAppData').useAppData>['customers']
  customerCount: number
  productTagsMap: ProductTagsMap
  products: Product[]
}

const CHART_COLORS = ['#16A34A', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777']

export function SummaryTab({ orders, customers, customerCount, productTagsMap, products }: TabProps) {
  const { compareOrders, compareEnabled, currentLabel, compareLabel } = useTabCompare()
  const { drillFromChart } = useChartDrillDown()

  const kpis = useMemo(() => computeKPIs(orders, customers, customerCount), [orders, customers, customerCount])
  const revenueTrend = useMemo(() => computeRevenueTrend(orders), [orders])
  const compareRevenueTrend = useMemo(
    () => (compareEnabled ? computeRevenueTrend(compareOrders) : []),
    [compareEnabled, compareOrders]
  )
  const aovTrend = useMemo(() => computeAOVTrend(orders), [orders])
  const compareAovTrend = useMemo(
    () => (compareEnabled ? computeAOVTrend(compareOrders) : []),
    [compareEnabled, compareOrders]
  )

  const revenueMerged = useMemo(() => {
    const map = new Map<string, { label: string; revenue: number; orders: number; compareRevenue?: number; compareOrders?: number }>()
    for (const d of revenueTrend) {
      const label = formatMonthLabel(d.month)
      map.set(d.month, { label, revenue: d.revenue, orders: d.orders })
    }
    for (const d of compareRevenueTrend) {
      const existing = map.get(d.month)
      if (existing) {
        existing.compareRevenue = d.revenue
        existing.compareOrders = d.orders
      }
    }
    return Array.from(map.values())
  }, [revenueTrend, compareRevenueTrend])

  const aovMerged = useMemo(() => {
    const map = new Map<string, { label: string; aov: number; compareAov?: number }>()
    for (const d of aovTrend) {
      map.set(d.month, { label: formatMonthLabel(d.month), aov: d.aov })
    }
    for (const d of compareAovTrend) {
      const existing = map.get(d.month)
      if (existing) existing.compareAov = d.aov
    }
    return Array.from(map.values())
  }, [aovTrend, compareAovTrend])

  const overallAOV = aovTrend.length ? aovTrend.reduce((s, p) => s + p.aov, 0) / aovTrend.length : 0
  const aovWithMean = aovMerged.map((d) => ({ ...d, meanAov: overallAOV }))

  const categoryDonut = useMemo(() => {
    const map = new Map<string, number>()
    for (const order of orders) {
      for (const cat of classifyOrder(order, productTagsMap)) {
        map.set(cat, (map.get(cat) ?? 0) + 1)
      }
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }))
  }, [orders, productTagsMap])

  const channelDonut = useMemo(() => {
    let app = 0
    let web = 0
    for (const order of orders) {
      if (getOrderChannel(order) === 'website') web++
      else app++
    }
    return [
      { name: 'App', value: app },
      { name: 'Website', value: web },
    ].filter((d) => d.value > 0)
  }, [orders])

  if (orders.length === 0) {
    return <EmptyState message="No orders match the current filters." />
  }

  const kpiCards = [
    { label: 'Orders', value: kpis.totalOrders.toLocaleString('en-IN') },
    { label: 'GMV', value: formatINR(kpis.grossRevenue) },
    { label: 'AOV', value: formatINR(kpis.averageOrderValue) },
    { label: 'Customers', value: kpis.totalCustomers.toLocaleString('en-IN') },
    { label: 'Repeat rate', value: `${kpis.repeatCustomerRate.toFixed(1)}%` },
    { label: 'Items / order', value: kpis.avgItemsPerOrder.toFixed(1) },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        {kpiCards.map((k) => (
          <div key={k.label} className="card p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">{k.label}</p>
            <p className="mt-2 text-[28px] font-bold tabular-nums text-[var(--text-primary)]">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">Revenue & orders (monthly)</h3>
        <CompareChartWrapper compareEnabled={compareEnabled} currentLabel={currentLabel} compareLabel={compareLabel}>
          <ComposedChart data={revenueMerged}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#cbd5e1" />
            <Line yAxisId="left" type="monotone" dataKey="revenue" name="GMV" stroke={COMPARE_LINE_PROPS.currentStroke} strokeWidth={2} dot={false} />
            {compareEnabled && (
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="compareRevenue"
                name={compareLabel}
                stroke={COMPARE_LINE_PROPS.compareStroke}
                strokeDasharray={COMPARE_LINE_PROPS.compareStrokeDasharray}
                dot={false}
              />
            )}
          </ComposedChart>
        </CompareChartWrapper>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">L1 category mix</h3>
          <CompareChartWrapper compareEnabled={false} height={240}>
            <PieChart>
              <Pie
                data={categoryDonut}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                onClick={(_, i) =>
                  drillFromChart({
                    title: 'Category',
                    subtitle: categoryDonut[i]?.name ?? '',
                    orders: filterOrdersForMetric(orders, productTagsMap, { category: categoryDonut[i]?.name }),
                  })
                }
              >
                {categoryDonut.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} className="cursor-pointer" />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </CompareChartWrapper>
        </div>
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">App vs website</h3>
          <CompareChartWrapper compareEnabled={false} height={240}>
            <PieChart>
              <Pie
                data={channelDonut}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                onClick={(_, i) => {
                  const ch = channelDonut[i]?.name
                  const channel = ch === 'App' ? 'app' : ch === 'Website' ? 'website' : undefined
                  if (channel) {
                    drillFromChart({
                      title: 'Channel',
                      subtitle: ch ?? '',
                      orders: filterOrdersForMetric(orders, productTagsMap, { channel }),
                    })
                  }
                }}
              >
                {channelDonut.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % 2]} className="cursor-pointer" />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </CompareChartWrapper>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-4 text-sm font-semibold text-[var(--text-primary)]">AOV trend</h3>
        <CompareChartWrapper compareEnabled={compareEnabled} currentLabel={currentLabel} compareLabel={compareLabel} height={220}>
          <ComposedChart data={aovWithMean}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => formatINR(v)} />
            <Tooltip formatter={(v: number) => formatINR(v)} />
            <Legend />
            <Line type="monotone" dataKey="aov" name="AOV" stroke={COMPARE_LINE_PROPS.currentStroke} strokeWidth={2} dot={false} />
            {compareEnabled && (
              <Line
                type="monotone"
                dataKey="compareAov"
                name={compareLabel}
                stroke={COMPARE_LINE_PROPS.compareStroke}
                strokeDasharray={COMPARE_LINE_PROPS.compareStrokeDasharray}
                dot={false}
              />
            )}
            <Line type="monotone" dataKey="meanAov" name="Mean AOV" stroke="#94a3b8" strokeDasharray="4 4" dot={false} />
          </ComposedChart>
        </CompareChartWrapper>
      </div>

      <DataQualityPanel orders={orders} products={products} productTagsMap={productTagsMap} />
    </div>
  )
}
