import { memo, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Order, ProductTagsMap } from '../../api/types'
import { useDashboardContext } from '../../context/DashboardContext'
import { buildCustomerSummaries } from '../../utils/customerSummary'
import {
  computeCorrelationMatrix,
  computeL2Gateway,
  computeSegmentHeatmap,
  DIM1_OPTIONS,
  generateKeyFindings,
  repeatRateColor,
  type CorrelationRow,
  type HeatmapDim,
} from '../../utils/correlationMatrix'
import { formatINR } from '../../utils/formatters'
import { EmptyState } from '../shared/EmptyState'
import { BoardSection } from '../shared/BoardSection'
import { TableSummaryFooter } from '../shared/TableSummaryFooter'
import { OrderJourneySection } from './OrderJourneySection'

type SortKey = 'repeatRate' | 'powerUserRate' | 'avgLtv'

interface FirstOrderSignalsPanelProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const CorrelationBoard = memo(function CorrelationBoard({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const { allOrders, openDrillDown } = useDashboardContext()
  const [sortKey, setSortKey] = useState<SortKey>('repeatRate')

  const summaries = useMemo(
    () => buildCustomerSummaries(boardOrders, productTagsMap),
    [boardOrders, productTagsMap]
  )
  const matrix = useMemo(() => computeCorrelationMatrix(summaries), [summaries])
  const findings = useMemo(() => generateKeyFindings(matrix), [matrix])
  const sortedMatrix = useMemo(
    () => [...matrix].sort((a, b) => b[sortKey] - a[sortKey]),
    [matrix, sortKey]
  )

  const openDrill = (title: string, customerIds: string[]) => {
    const idSet = new Set(customerIds)
    const drillOrders = allOrders.filter((o) => o.customer?.id && idSet.has(o.customer.id))
    openDrillDown({
      title,
      subtitle: `${customerIds.length.toLocaleString('en-IN')} customers`,
      orders: drillOrders,
    })
  }

  if (summaries.length === 0) {
    return <EmptyState message="No customers in the selected board range." />
  }

  const daysRows = sortedMatrix.filter((r) => r.avgDaysToSecond > 0)

  return (
    <>
      <p className="mb-4 text-xs text-slate-500">
        Based on {summaries.length.toLocaleString('en-IN')} customers with first-order DNA in the selected range.
      </p>

      {findings.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          {findings.map((f) => (
            <div key={f} className="rounded-lg border border-[#00A86B]/20 bg-[#ECFDF5] px-3 py-2 text-sm text-slate-800">
              {f}
            </div>
          ))}
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="text-xs text-slate-500">Sort by:</span>
        {(
          [
            ['repeatRate', 'Repeat %'],
            ['powerUserRate', 'PU %'],
            ['avgLtv', 'Avg LTV'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSortKey(key)}
            className={`rounded-full px-3 py-1 text-xs ${
              sortKey === key ? 'bg-[#00A86B] text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-400">
              <th className="pb-2 pr-4">Group</th>
              <th className="pb-2 pr-4">Attribute</th>
              <th className="pb-2 pr-4 text-right">Customers</th>
              <th className="pb-2 pr-4 text-right">Repeat%</th>
              <th className="pb-2 pr-4 text-right">PU%</th>
              <th className="pb-2 pr-4 text-right">Avg days</th>
              <th className="pb-2 text-right">Avg LTV</th>
            </tr>
          </thead>
          <tbody>
            {sortedMatrix.map((row) => (
              <CorrelationRowItem key={row.attributeKey} row={row} onDrill={openDrill} />
            ))}
          </tbody>
          <TableSummaryFooter
            cells={[
              { type: 'text', values: [], colSpan: 2 },
              { type: 'count', values: sortedMatrix.map((r) => r.customers) },
              { type: 'percentage', values: sortedMatrix.map((r) => r.repeatRate) },
              { type: 'percentage', values: sortedMatrix.map((r) => r.powerUserRate) },
              { type: 'days', values: daysRows.map((r) => r.avgDaysToSecond) },
              { type: 'currency', values: sortedMatrix.map((r) => r.avgLtv) },
            ]}
          />
        </table>
      </div>
    </>
  )
})

const SegmentHeatmapBoard = memo(function SegmentHeatmapBoard({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const { allOrders, openDrillDown } = useDashboardContext()
  const [dim1, setDim1] = useState<HeatmapDim>('channel')
  const [dim2, setDim2] = useState<HeatmapDim>('l1')

  const summaries = useMemo(
    () => buildCustomerSummaries(boardOrders, productTagsMap),
    [boardOrders, productTagsMap]
  )
  const heatmap = useMemo(() => computeSegmentHeatmap(summaries, dim1, dim2), [summaries, dim1, dim2])

  const topSegments = useMemo(
    () => [...heatmap.cells].sort((a, b) => b.repeatRate - a.repeatRate).slice(0, 3),
    [heatmap.cells]
  )
  const bottomSegments = useMemo(
    () => [...heatmap.cells].sort((a, b) => a.repeatRate - b.repeatRate).slice(0, 3),
    [heatmap.cells]
  )

  const openDrill = (title: string, customerIds: string[]) => {
    const idSet = new Set(customerIds)
    const drillOrders = allOrders.filter((o) => o.customer?.id && idSet.has(o.customer.id))
    openDrillDown({
      title,
      subtitle: `${customerIds.length.toLocaleString('en-IN')} customers`,
      orders: drillOrders,
    })
  }

  if (summaries.length === 0) {
    return <EmptyState message="No customers in the selected board range." />
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-4">
        <label className="text-xs text-slate-500">
          Dim 1
          <select
            className="ml-2 rounded border px-2 py-1 text-sm"
            value={dim1}
            onChange={(e) => setDim1(e.target.value as HeatmapDim)}
          >
            {DIM1_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Dim 2
          <select
            className="ml-2 rounded border px-2 py-1 text-sm"
            value={dim2}
            onChange={(e) => setDim2(e.target.value as HeatmapDim)}
          >
            {DIM1_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead>
            <tr>
              <th className="p-1" />
              {heatmap.cols.map((col) => (
                <th key={col} className="p-1 text-center font-medium text-slate-500">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((r) => (
              <tr key={r}>
                <td className="p-1 font-medium text-slate-600">{r}</td>
                {heatmap.cols.map((col) => {
                  const cell = heatmap.cells.find((c) => c.dim1 === r && c.dim2 === col)
                  if (!cell) {
                    return (
                      <td key={col} className="p-1 text-center text-slate-300">
                        —
                      </td>
                    )
                  }
                  return (
                    <td key={col} className="p-1">
                      <button
                        type="button"
                        onClick={() => openDrill(`${r} × ${col}`, cell.customerIds)}
                        className={`min-w-[52px] rounded px-1 py-1 tabular-nums ${repeatRateColor(cell.repeatRate)}`}
                        title={`${cell.customers} customers`}
                      >
                        {cell.repeatRate.toFixed(0)}%
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Top 3 segments</p>
          <ul className="space-y-1 text-sm">
            {topSegments.map((s) => (
              <li key={`${s.dim1}-${s.dim2}`}>
                {s.dim1} × {s.dim2}: {s.repeatRate.toFixed(0)}% ({s.customers} customers)
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase text-slate-400">Bottom 3 segments</p>
          <ul className="space-y-1 text-sm">
            {bottomSegments.map((s) => (
              <li key={`${s.dim1}-${s.dim2}`}>
                {s.dim1} × {s.dim2}: {s.repeatRate.toFixed(0)}% ({s.customers} customers)
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  )
})

const L2GatewayBoard = memo(function L2GatewayBoard({
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
  const l2Gateway = useMemo(() => computeL2Gateway(summaries), [summaries])

  const openDrill = (title: string, customerIds: string[]) => {
    const idSet = new Set(customerIds)
    const drillOrders = allOrders.filter((o) => o.customer?.id && idSet.has(o.customer.id))
    openDrillDown({
      title,
      subtitle: `${customerIds.length.toLocaleString('en-IN')} customers`,
      orders: drillOrders,
    })
  }

  if (summaries.length === 0) {
    return <EmptyState message="No customers in the selected board range." />
  }

  return (
    <>
      <p className="mb-4 text-xs text-slate-500">
        L2 sub-categories in first orders, ranked by avg customer LTV.
      </p>
      <ResponsiveContainer width="100%" height={Math.max(240, l2Gateway.slice(0, 12).length * 28)}>
        <BarChart data={l2Gateway.slice(0, 12)} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => formatINR(v)} tick={{ fontSize: 10 }} />
          <YAxis type="category" dataKey="l2" width={110} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(v: number, _n, p) => [
              formatINR(v),
              `Avg LTV · ${(p.payload as { customers: number; repeatRate: number }).customers} buyers · ${(p.payload as { repeatRate: number }).repeatRate.toFixed(0)}% repeat`,
            ]}
          />
          <Bar
            dataKey="avgLtv"
            fill="#00A86B"
            radius={[0, 4, 4, 0]}
            onClick={(data) => {
              const row = data as unknown as { customerIds?: string[]; l2?: string }
              if (row.customerIds?.length) openDrill(`First bought ${row.l2}`, row.customerIds)
            }}
            className="cursor-pointer"
          >
            {l2Gateway.slice(0, 12).map((entry, i) => (
              <Cell key={i} fill={entry.avgLtv > l2Gateway[0]!.avgLtv * 0.7 ? '#047857' : '#00A86B'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  )
})

export const FirstOrderSignalsPanel = memo(function FirstOrderSignalsPanel({
  orders,
  productTagsMap,
}: FirstOrderSignalsPanelProps) {
  if (orders.length === 0) {
    return <EmptyState message="Load orders to analyse first-order signals." />
  }

  return (
    <div className="space-y-6">
      <BoardSection
        title="What in the first order predicts repeat behaviour?"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="90d"
        boardFilterMode="first_order_cohort"
      >
        {(boardOrders) => (
          <CorrelationBoard boardOrders={boardOrders} productTagsMap={productTagsMap} />
        )}
      </BoardSection>

      <BoardSection
        title="Two-dimension segment explorer"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="90d"
        boardFilterMode="first_order_cohort"
      >
        {(boardOrders) => (
          <SegmentHeatmapBoard boardOrders={boardOrders} productTagsMap={productTagsMap} />
        )}
      </BoardSection>

      <BoardSection
        title="L2 gateway analysis"
        orders={orders}
        enableBoardDateFilter
        defaultBoardPreset="90d"
        boardFilterMode="first_order_cohort"
      >
        {(boardOrders) => <L2GatewayBoard boardOrders={boardOrders} productTagsMap={productTagsMap} />}
      </BoardSection>

      <OrderJourneySection orders={orders} productTagsMap={productTagsMap} />
    </div>
  )
})

const CorrelationRowItem = memo(function CorrelationRowItem({
  row,
  onDrill,
}: {
  row: CorrelationRow
  onDrill: (title: string, ids: string[]) => void
}) {
  return (
    <tr
      className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
      onClick={() => onDrill(row.attribute, row.customerIds)}
    >
      <td className="py-2 pr-4 text-xs text-slate-400">{row.group}</td>
      <td className="py-2 pr-4 font-medium">{row.attribute}</td>
      <td className="py-2 pr-4 text-right tabular-nums">{row.customers.toLocaleString('en-IN')}</td>
      <td className="py-2 pr-4 text-right">
        <span className={`inline-block rounded px-2 py-0.5 tabular-nums text-xs ${repeatRateColor(row.repeatRate)}`}>
          {row.repeatRate.toFixed(0)}%
        </span>
      </td>
      <td className="py-2 pr-4 text-right tabular-nums">{row.powerUserRate.toFixed(0)}%</td>
      <td className="py-2 pr-4 text-right tabular-nums">
        {row.avgDaysToSecond > 0 ? `${row.avgDaysToSecond.toFixed(0)}d` : '—'}
      </td>
      <td className="py-2 text-right tabular-nums">{formatINR(row.avgLtv)}</td>
    </tr>
  )
})
