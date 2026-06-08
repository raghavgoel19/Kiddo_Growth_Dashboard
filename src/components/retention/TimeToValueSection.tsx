import { memo, useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Order, ProductTagsMap } from '../../api/types'
import { useDashboardContext } from '../../context/DashboardContext'
import { buildCustomerSummaries } from '../../utils/customerSummary'
import { computeTimeToValueStats } from '../../utils/timeToValue'
import { EmptyState } from '../shared/EmptyState'
import { BoardSection } from '../shared/BoardSection'
import { TableSummaryFooter } from '../shared/TableSummaryFooter'

const BUCKET_COLORS = ['#86EFAC', '#00A86B', '#047857', '#065F46', '#064E3B', '#022C22', '#14532D']

interface TimeToValueSectionProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const TimeToValueContent = memo(function TimeToValueContent({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const { allOrders, openDrillDown } = useDashboardContext()

  const summaries = useMemo(
    () => buildCustomerSummaries(boardOrders, productTagsMap),
    [boardOrders, productTagsMap]
  )
  const stats = useMemo(() => computeTimeToValueStats(summaries), [summaries])

  const chartData = useMemo(
    () =>
      stats.buckets.map((b) => ({
        label: b.label,
        count: b.count,
        pct: b.pct,
        subtitle: b.subtitle,
        minDays: b.minDays,
        maxDays: b.maxDays,
        customerIds: b.customerIds,
      })),
    [stats.buckets]
  )

  const openBucketDrill = (label: string, customerIds: string[]) => {
    const idSet = new Set(customerIds)
    const drillOrders = allOrders.filter((o) => o.customer?.id && idSet.has(o.customer.id))
    openDrillDown({
      title: `Time to 2nd order: ${label}`,
      subtitle: `${customerIds.length.toLocaleString('en-IN')} customers`,
      orders: drillOrders,
    })
  }

  if (stats.totalWithSecond === 0) {
    return <EmptyState message="Need customers with 2+ orders to show time-to-value distribution." />
  }

  return (
    <>
      <p className="mb-4 text-xs text-slate-500">
        Distribution of days between order 1 and order 2 · {stats.totalWithSecond.toLocaleString('en-IN')}{' '}
        repeat customers
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 72, right: 24 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="label" width={68} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: number, _name, props) => {
              const row = props.payload as { pct: number; subtitle?: string }
              const sub = row.subtitle ? ` · ${row.subtitle}` : ''
              return [`${value.toLocaleString('en-IN')} (${row.pct.toFixed(0)}%)${sub}`, 'Customers']
            }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            className="cursor-pointer"
            onClick={(data) => {
              const row = data as unknown as {
                minDays: number
                maxDays: number | null
                label: string
                customerIds: string[]
              }
              if (row.customerIds?.length) {
                openBucketDrill(row.label, row.customerIds)
              }
            }}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.cumulative.map((point) => (
          <div key={point.day} className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-xs text-slate-500">{point.label}</p>
            <p className="text-lg font-semibold tabular-nums text-[#047857]">{point.pct.toFixed(0)}%</p>
            <p className="text-xs text-slate-400">{point.count.toLocaleString('en-IN')} customers</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-2">
        {stats.insights.map((text) => (
          <p key={text} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            {text}
          </p>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-400">
              <th className="pb-2">Window</th>
              <th className="pb-2 text-right">Customers</th>
              <th className="pb-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {stats.buckets.map((b) => (
              <tr
                key={b.label}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => openBucketDrill(b.label, b.customerIds)}
              >
                <td className="py-2">
                  {b.label}
                  {b.subtitle ? <span className="ml-2 text-xs text-slate-400">({b.subtitle})</span> : null}
                </td>
                <td className="py-2 text-right tabular-nums">{b.count.toLocaleString('en-IN')}</td>
                <td className="py-2 text-right tabular-nums">{b.pct.toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
          <TableSummaryFooter
            cells={[
              { type: 'text', values: [] },
              { type: 'count', values: stats.buckets.map((b) => b.count) },
              { type: 'percentage', values: stats.buckets.map((b) => b.pct) },
            ]}
          />
        </table>
      </div>
    </>
  )
})

export const TimeToValueSection = memo(function TimeToValueSection({
  orders,
  productTagsMap,
}: TimeToValueSectionProps) {
  return (
    <BoardSection
      title="Time to second order"
      orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
    >
      {(boardOrders) => (
        <TimeToValueContent boardOrders={boardOrders} productTagsMap={productTagsMap} />
      )}
    </BoardSection>
  )
})
