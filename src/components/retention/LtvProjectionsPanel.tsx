import { memo, useMemo } from 'react'
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
import { computeLtvProjections, type LtvProjectionRow } from '../../utils/ltvProjections'
import { formatINR } from '../../utils/formatters'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { ExportButton } from '../shared/ExportButton'
import { EmptyState } from '../shared/EmptyState'
import { BoardSection } from '../shared/BoardSection'
import { TableSummaryFooter } from '../shared/TableSummaryFooter'

const BAR_COLORS = ['#047857', '#00A86B', '#10B981', '#34D399', '#6EE7B7', '#065F46', '#064E3B', '#022C22']

interface LtvProjectionsPanelProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const LtvProjectionsSummary = memo(function LtvProjectionsSummary({
  boardOrders,
  productTagsMap,
}: {
  boardOrders: Order[]
  productTagsMap: ProductTagsMap
}) {
  const summaries = useMemo(
    () => buildCustomerSummaries(boardOrders, productTagsMap),
    [boardOrders, productTagsMap]
  )
  const projection = useMemo(() => computeLtvProjections(summaries, 30, 90), [summaries])

  if (projection.totalNewCustomers === 0) {
    return (
      <EmptyState message="No new customers in the selected range. Widen the board filter or wait for fresh first orders." />
    )
  }

  return (
    <>
      <p className="text-sm text-slate-700">
        Based on your last {projection.lookbackDays} days&apos; new customers (
        {projection.totalNewCustomers.toLocaleString('en-IN')} total) and historical LTV patterns for
        customers with similar first orders.
      </p>
      <p className="mt-3 text-lg font-semibold text-[#047857]">
        Total projected GMV (90 days): {formatINR(projection.totalProjectedGmv)}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        LTV from avg spend in first 90 days for historical matches (≥{projection.historicalMinDays}d since
        first order), or modeled from AOV × orders × repeat rate when sample is small.
      </p>
    </>
  )
})

const LtvProjectionsChart = memo(function LtvProjectionsChart({
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
  const projection = useMemo(() => computeLtvProjections(summaries, 30, 90), [summaries])

  const chartData = useMemo(
    () =>
      projection.rows
        .filter((r) => r.newCustomers > 0)
        .map((r) => ({
          name: r.label,
          gmv: r.expectedGmv,
          customers: r.newCustomers,
          key: r.key,
          customerIds: r.customerIds,
        })),
    [projection.rows]
  )

  const openSegmentDrill = (row: LtvProjectionRow) => {
    if (row.customerIds.length === 0) return
    const idSet = new Set(row.customerIds)
    const drillOrders = allOrders.filter((o) => o.customer?.id && idSet.has(o.customer.id))
    openDrillDown({
      title: row.label,
      subtitle: `${row.newCustomers.toLocaleString('en-IN')} new customers · est. ${formatINR(row.expected90dLtv)} 90d LTV`,
      orders: drillOrders,
    })
  }

  if (chartData.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={Math.max(280, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 140, right: 24 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={(v) => formatINR(v)} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 10 }} />
        <Tooltip
          formatter={(value: number, _name, props) => {
            const row = props.payload as { customers: number }
            return [formatINR(value), `${row.customers} new customers`]
          }}
        />
        <Bar
          dataKey="gmv"
          radius={[0, 4, 4, 0]}
          className="cursor-pointer"
          onClick={(data) => {
            const row = projection.rows.find((r) => r.key === (data as { key: string }).key)
            if (row) openSegmentDrill(row)
          }}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

const LtvProjectionsTable = memo(function LtvProjectionsTable({
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
  const projection = useMemo(() => computeLtvProjections(summaries, 30, 90), [summaries])

  const openSegmentDrill = (row: LtvProjectionRow) => {
    if (row.customerIds.length === 0) return
    const idSet = new Set(row.customerIds)
    const drillOrders = allOrders.filter((o) => o.customer?.id && idSet.has(o.customer.id))
    openDrillDown({
      title: row.label,
      subtitle: `${row.newCustomers.toLocaleString('en-IN')} new customers · est. ${formatINR(row.expected90dLtv)} 90d LTV`,
      orders: drillOrders,
    })
  }

  const rowsWithCustomers = projection.rows.filter((r) => r.newCustomers > 0)

  return (
    <>
      <div className="mb-4 flex justify-end">
        <ExportButton
          label="Export CSV"
          onExport={() =>
            downloadCsv(
              exportFilename('ltv_projections'),
              ['Segment', 'New customers', 'Expected 90d LTV', 'Expected GMV', 'Historical sample'],
              projection.rows.map((r) => [
                r.label,
                r.newCustomers,
                Math.round(r.expected90dLtv),
                Math.round(r.expectedGmv),
                r.historicalSample,
              ])
            )
          }
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-400">
              <th className="pb-2 pr-4">Segment</th>
              <th className="pb-2 pr-4 text-right">New customers</th>
              <th className="pb-2 pr-4 text-right">Expected 90d LTV</th>
              <th className="pb-2 pr-4 text-right">Expected GMV</th>
              <th className="pb-2 text-right">Hist. sample</th>
            </tr>
          </thead>
          <tbody>
            {projection.rows.map((row) => (
              <tr
                key={row.key}
                className={`border-t border-slate-100 ${row.newCustomers > 0 ? 'cursor-pointer hover:bg-slate-50' : ''}`}
                onClick={() => row.newCustomers > 0 && openSegmentDrill(row)}
              >
                <td className="py-2.5 pr-4 font-medium">{row.label}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums">
                  {row.newCustomers.toLocaleString('en-IN')}
                </td>
                <td className="py-2.5 pr-4 text-right tabular-nums">{formatINR(row.expected90dLtv)}</td>
                <td className="py-2.5 pr-4 text-right tabular-nums font-medium text-[#047857]">
                  {formatINR(row.expectedGmv)}
                </td>
                <td className="py-2.5 text-right tabular-nums text-slate-500">
                  {row.historicalSample.toLocaleString('en-IN')}
                </td>
              </tr>
            ))}
          </tbody>
          <TableSummaryFooter
            cells={[
              { type: 'text', values: [], label: 'Total projected GMV' },
              { type: 'count', values: rowsWithCustomers.map((r) => r.newCustomers) },
              { type: 'aov', values: rowsWithCustomers.map((r) => r.expected90dLtv) },
              {
                type: 'currency',
                values: rowsWithCustomers.map((r) => r.expectedGmv),
                label: formatINR(projection.totalProjectedGmv),
              },
              { type: 'count', values: rowsWithCustomers.map((r) => r.historicalSample) },
            ]}
          />
        </table>
      </div>
    </>
  )
})

export const LtvProjectionsPanel = memo(function LtvProjectionsPanel({
  orders,
  productTagsMap,
}: LtvProjectionsPanelProps) {
  if (orders.length === 0) {
    return <EmptyState message="No orders in the selected range for LTV projections." />
  }

  return (
    <div className="space-y-6">
      <BoardSection
        title="90-day LTV projections"
        orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
      boardFilterMode="first_order_cohort"
      >
        {(boardOrders) => (
          <LtvProjectionsSummary boardOrders={boardOrders} productTagsMap={productTagsMap} />
        )}
      </BoardSection>

      <BoardSection
        title="Projected GMV by segment"
        orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
      boardFilterMode="first_order_cohort"
      >
        {(boardOrders) => (
          <LtvProjectionsChart boardOrders={boardOrders} productTagsMap={productTagsMap} />
        )}
      </BoardSection>

      <BoardSection
        title="Segment breakdown"
        orders={orders}
      enableBoardDateFilter
      defaultBoardPreset="30d"
      boardFilterMode="first_order_cohort"
      >
        {(boardOrders) => (
          <LtvProjectionsTable boardOrders={boardOrders} productTagsMap={productTagsMap} />
        )}
      </BoardSection>
    </div>
  )
})
