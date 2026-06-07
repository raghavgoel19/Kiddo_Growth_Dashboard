import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { FullDateRange, Order, OrderStatus, ProductTagsMap } from '../../api/types'
import { getOrderChannel } from '../../utils/channel'
import { classifyOrder, L1_TAGS } from '../../utils/taxonomy'
import { getHourIST } from '../../utils/dates'
import { parseMoney, formatINR } from '../../utils/formatters'
import { EmptyState } from '../shared/EmptyState'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'

interface TabProps {
  orders: Order[]
  customers: unknown[]
  customerCount: number
  productTagsMap: ProductTagsMap
  dateRange: FullDateRange
  orderStatus: OrderStatus
}

function channelMetrics(orders: Order[]) {
  const app = orders.filter((o) => getOrderChannel(o) === 'app')
  const web = orders.filter((o) => getOrderChannel(o) === 'website')
  const gmv = (list: Order[]) => list.reduce((s, o) => s + parseMoney(o.total_price), 0)
  const repeat = (list: Order[]) =>
    list.length > 0
      ? (list.filter((o) => (o.customer?.orders_count ?? 0) > 1).length / list.length) * 100
      : 0

  return {
    app: { count: app.length, aov: app.length ? gmv(app) / app.length : 0, repeat: repeat(app) },
    web: { count: web.length, aov: web.length ? gmv(web) / web.length : 0, repeat: repeat(web) },
    total: orders.length || 1,
  }
}

export function ChannelTab({ orders, productTagsMap }: TabProps) {
  const filtered = orders
  const { drillFromChart } = useChartDrillDown()

  const metrics = useMemo(() => channelMetrics(filtered), [filtered])

  const weeklyTrend = useMemo(() => {
    const map = new Map<string, { app: number; web: number }>()
    for (const order of filtered) {
      const week = order.created_at.slice(0, 10)
      const entry = map.get(week) ?? { app: 0, web: 0 }
      if (getOrderChannel(order) === 'app') entry.app++
      else if (getOrderChannel(order) === 'website') entry.web++
      map.set(week, entry)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-84)
      .map(([week, v]) => ({
        week,
        appPct: v.app + v.web > 0 ? (v.app / (v.app + v.web)) * 100 : 0,
        webPct: v.app + v.web > 0 ? (v.web / (v.app + v.web)) * 100 : 0,
      }))
  }, [filtered])

  const categoryByChannel = useMemo(() => {
    return L1_TAGS.map((cat) => {
      const catOrders = filtered.filter((o) => classifyOrder(o, productTagsMap).includes(cat))
      const app = catOrders.filter((o) => getOrderChannel(o) === 'app').length
      const web = catOrders.filter((o) => getOrderChannel(o) === 'website').length
      const total = app + web || 1
      return { category: cat, appPct: (app / total) * 100, webPct: (web / total) * 100 }
    }).filter((r) => r.appPct + r.webPct > 0)
  }, [filtered, productTagsMap])

  const peakHours = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => h)
    return hours.map((hour) => ({
      hour,
      app: filtered.filter((o) => getOrderChannel(o) === 'app' && getHourIST(o.created_at) === hour).length,
      web: filtered.filter((o) => getOrderChannel(o) === 'website' && getHourIST(o.created_at) === hour).length,
    }))
  }, [filtered])

  if (filtered.length === 0) {
    return <EmptyState message="No orders match the current filters." />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'App share', value: `${((metrics.app.count / metrics.total) * 100).toFixed(1)}%` },
          { label: 'Web share', value: `${((metrics.web.count / metrics.total) * 100).toFixed(1)}%` },
          { label: 'App AOV', value: formatINR(metrics.app.aov) },
          { label: 'Web AOV', value: formatINR(metrics.web.aov) },
          { label: 'App repeat', value: `${metrics.app.repeat.toFixed(1)}%` },
          { label: 'Web repeat', value: `${metrics.web.repeat.toFixed(1)}%` },
        ].map((k) => (
          <div key={k.label} className="rounded-card border border-kiddo-border bg-white px-4 py-3">
            <p className="text-xs uppercase text-slate-400">{k.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold">App vs web share trend</h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={weeklyTrend}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="week" tick={{ fontSize: 9 }} />
            <YAxis tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
            <Legend />
            <Line type="monotone" dataKey="appPct" name="App %" stroke="#00A86B" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="webPct" name="Web %" stroke="#0F172A" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">AOV comparison</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[{ name: 'App', aov: metrics.app.aov }, { name: 'Web', aov: metrics.web.aov }]}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => formatINR(v)} />
              <Tooltip formatter={(v: number) => formatINR(v)} />
              <Bar dataKey="aov" fill="#00A86B" radius={[4, 4, 0, 0]} onClick={(data) =>
                drillFromChart({
                  title: 'Channel AOV',
                  subtitle: String(data.name),
                  orders: filterOrdersForMetric(filtered, productTagsMap, {
                    channel: data.name === 'App' ? 'app' : 'website',
                  }),
                })
              } />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-card border border-kiddo-border bg-white p-5">
          <h3 className="mb-4 text-sm font-semibold">Category preference by channel</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryByChannel}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 8 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <Legend />
              <Bar dataKey="appPct" name="App %" fill="#00A86B" stackId="a" />
              <Bar dataKey="webPct" name="Web %" fill="#0F172A" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-card border border-kiddo-border bg-white p-5">
        <h3 className="mb-4 text-sm font-semibold">Peak hour by channel</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={peakHours}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="app" name="App" fill="#00A86B" />
            <Bar dataKey="web" name="Web" fill="#0F172A" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
