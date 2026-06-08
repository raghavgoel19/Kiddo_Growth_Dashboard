import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { getDistanceBand, DISTANCE_BANDS } from '../../utils/geography'
import { parseMoney, formatINR } from '../../utils/formatters'
import { ExportButton } from '../shared/ExportButton'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { EmptyState } from '../shared/EmptyState'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'
import { computeLocationBreakdown } from '../../utils/dataQuality'
import type { DistanceBand, Order, ProductTagsMap } from '../../api/types'
import { SectionCard } from '../shared/SectionCard'
import { TableSummaryFooter } from '../shared/TableSummaryFooter'

interface TabProps {
  orders: Order[]
  customers: unknown[]
  customerCount: number
  productTagsMap: ProductTagsMap
}

function computeBandStats(orders: Order[]) {
  const bands = DISTANCE_BANDS.filter((b) => b !== 'unknown')
  const total = orders.length || 1

  return bands.map((band) => {
    const bandOrders = orders.filter((o) => getDistanceBand(o) === band)
    const gmv = bandOrders.reduce((s, o) => s + parseMoney(o.total_price), 0)
    const repeat = bandOrders.filter((o) => (o.customer?.orders_count ?? 0) > 1).length
    return {
      band,
      orders: bandOrders.length,
      pct: (bandOrders.length / total) * 100,
      aov: bandOrders.length > 0 ? gmv / bandOrders.length : 0,
      repeatRate: bandOrders.length > 0 ? (repeat / bandOrders.length) * 100 : 0,
    }
  })
}

const BAND_COLORS = ['#16A34A', '#2563EB', '#D97706', '#DC2626', '#7C3AED']

function GeographyOrdersByBandChart({ orders }: { orders: Order[] }) {
  const { drillFromChart } = useChartDrillDown()
  const bandStats = useMemo(() => computeBandStats(orders), [orders])

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={bandStats}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="band" tick={{ fontSize: 10 }} />
        <YAxis />
        <Tooltip />
        <Bar
          dataKey="orders"
          radius={[4, 4, 0, 0]}
          onClick={(data) =>
            drillFromChart({
              title: 'Geo band',
              subtitle: String(data.band),
              orders: filterOrdersForMetric(orders, {}, { geoBand: data.band as DistanceBand }),
            })
          }
        >
          {bandStats.map((_, i) => (
            <Cell key={i} fill={BAND_COLORS[i % BAND_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

function GeographyAOVByBandChart({ orders }: { orders: Order[] }) {
  const bandStats = useMemo(() => computeBandStats(orders), [orders])

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={bandStats}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="band" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
        <Tooltip formatter={(v: number) => formatINR(v)} />
        <Bar dataKey="aov" fill="#16A34A" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function GeographyPincodeTable({ orders }: { orders: Order[] }) {
  const pincodeTable = useMemo(() => {
    const map = new Map<string, { orders: number; gmv: number }>()
    for (const order of orders) {
      const zip = order.shipping_address?.zip ?? 'Unknown'
      const entry = map.get(zip) ?? { orders: 0, gmv: 0 }
      entry.orders += 1
      entry.gmv += parseMoney(order.total_price)
      map.set(zip, entry)
    }
    return Array.from(map.entries())
      .map(([pincode, v]) => ({ pincode, ...v }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 20)
  }, [orders])

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <ExportButton
          onExport={() =>
            downloadCsv(
              exportFilename('pincode_table'),
              ['Pincode', 'Orders', 'GMV'],
              pincodeTable.map((r) => [r.pincode, r.orders, r.gmv])
            )
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-sm">
          <thead>
            <tr className="table-header border-b border-[var(--border-light)]">
              <th className="px-4 py-2 text-left">Pincode</th>
              <th className="px-4 py-2 text-right">Orders</th>
              <th className="px-4 py-2 text-right">GMV</th>
            </tr>
          </thead>
          <tbody>
            {pincodeTable.map((row) => (
              <tr key={row.pincode} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-app)]">
                <td className="px-4 py-2.5 font-medium">{row.pincode}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{row.orders}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatINR(row.gmv)}</td>
              </tr>
            ))}
          </tbody>
          <TableSummaryFooter
            cells={[
              { type: 'text', values: [], label: `${pincodeTable.length} pincodes` },
              { type: 'orders', values: pincodeTable.map((r) => r.orders) },
              { type: 'currency', values: pincodeTable.map((r) => r.gmv) },
            ]}
          />
        </table>
      </div>
    </>
  )
}

export function GeographyTab({ orders }: TabProps) {
  const locationStats = useMemo(() => computeLocationBreakdown(orders), [orders])
  const bandStats = useMemo(() => computeBandStats(orders), [orders])

  if (orders.length === 0) {
    return <EmptyState message="No orders match the current filters." />
  }

  return (
    <div className="space-y-6">
      <div className="card px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.5px] text-[var(--text-secondary)]">
          Location data quality
        </p>
        <p className="mt-2 text-[13px] text-[var(--text-primary)]">
          <span className="font-semibold tabular-nums">{locationStats.coordPct.toFixed(1)}%</span> of orders have precise
          coordinates,{' '}
          <span className="font-semibold tabular-nums">{locationStats.pincodePct.toFixed(1)}%</span> estimated from
          pincode,{' '}
          <span className="font-semibold tabular-nums">{locationStats.unknownPct.toFixed(1)}%</span> unknown
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {bandStats.map((b) => (
          <div key={b.band} className="card px-4 py-3">
            <p className="text-[11px] uppercase text-[var(--text-secondary)]">{b.band}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{b.orders}</p>
            <p className="text-xs text-[var(--text-secondary)]">{b.pct.toFixed(1)}% · AOV {formatINR(b.aov)}</p>
            <p className="text-xs text-[var(--text-secondary)]">Repeat {b.repeatRate.toFixed(0)}%</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard title="Orders by distance band" orders={orders} enableBoardDateFilter defaultBoardPreset="30d">
          {(boardOrders) => <GeographyOrdersByBandChart orders={boardOrders} />}
        </SectionCard>
        <SectionCard title="AOV by distance band" orders={orders} enableBoardDateFilter defaultBoardPreset="30d">
          {(boardOrders) => <GeographyAOVByBandChart orders={boardOrders} />}
        </SectionCard>
      </div>

      <SectionCard
        title="Top 20 delivery pincodes"
        metricKey="pincodeTable"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="30d"
      >
        {(boardOrders) => <GeographyPincodeTable orders={boardOrders} />}
      </SectionCard>
    </div>
  )
}
