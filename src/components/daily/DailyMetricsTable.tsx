import { useMemo } from 'react'
import type { Order, ProductTagsMap } from '../../api/types'
import {
  DAILY_TABLE_ROWS,
  buildDailyMetricsTable,
  formatDailyCell,
  formatGrowthDual,
  growthCellStyle,
} from '../../utils/dailyMetricsTable'
import { METRIC_DEFINITIONS } from '../../utils/metricDefinitions'
import { InfoTooltip } from '../shared/InfoTooltip'
import { ExportButton } from '../shared/ExportButton'
import { useDashboardContext, useDrillDown } from '../../context/DashboardContext'
import { exportFilename, downloadCsv } from '../../utils/csv'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'
import { filterOrdersThroughSameTimeOfDay } from '../../utils/dates'
import { IST, toIST } from '../../utils/dates'

interface DailyMetricsTableProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

const METRIC_DRILL_MAP: Record<string, string> = {
  totalOrdersGrowth: 'totalOrders',
  firstTimeGrowth: 'firstTimeOrders',
  repeatGrowth: 'repeatOrders',
  spendIncrease: 'gmv',
}

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(date)
}

export function DailyMetricsTable({ orders, productTagsMap }: DailyMetricsTableProps) {
  const { openDrillDown } = useDrillDown()
  const { allOrders } = useDashboardContext()
  const tableData = useMemo(
    () => buildDailyMetricsTable(orders, productTagsMap),
    [orders, productTagsMap]
  )
  const { columns, dayMetrics } = tableData

  const getOrdersForCell = (rowId: string, colIdx: number): Order[] => {
    const col = columns[colIdx]
    let dayOrders: Order[]
    if (col.isToday) {
      dayOrders = filterOrdersThroughSameTimeOfDay(
        orders.filter((o) => dayKey(toIST(o.created_at)) === col.key)
      )
    } else {
      dayOrders = orders.filter((o) => dayKey(toIST(o.created_at)) === col.key)
    }
    if (rowId === 'cac' || rowId.endsWith('Growth') || rowId === 'spendIncrease') {
      return dayOrders
    }
    return filterOrdersForMetric(dayOrders, productTagsMap, {
      metricId: rowId,
      allOrders: allOrders.length ? allOrders : orders,
    })
  }

  const exportTable = () => {
    const headers = ['Metric', ...columns.map((c) => c.label)]
    const rows = DAILY_TABLE_ROWS.filter((r) => r.kind === 'metric').map((row) => {
      if (row.kind !== 'metric') return []
      if (row.format === 'dash') return [row.label, ...columns.map(() => '–')]
      if (row.format === 'growthDual') {
        return [
          row.label,
          ...dayMetrics.map((d, i) =>
            formatGrowthDual(
              row.growthKey ? (d[row.growthKey] as number | null) : null,
              row.growthWeekKey ? (d[row.growthWeekKey] as number | null) : null,
              columns[i]?.isToday ?? false
            )
          ),
        ]
      }
      return [
        row.label,
        ...dayMetrics.map((d) => formatDailyCell(d[row.metricKey], row.format)),
      ]
    })
    downloadCsv(exportFilename('daily_metrics'), headers, rows)
  }

  return (
    <div className="rounded-card border border-kiddo-border bg-white">
      <div className="flex items-center justify-between border-b border-kiddo-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Daily metrics comparison</h3>
          <p className="text-xs text-slate-500">Last 8 days · IST · Today through current time</p>
        </div>
        <ExportButton onExport={exportTable} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full text-sm">
          <thead>
            <tr className="border-b border-kiddo-border bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="sticky left-0 z-10 min-w-[220px] bg-slate-50 px-4 py-3">Metric</th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`min-w-[120px] px-3 py-3 text-right ${col.isToday ? 'bg-emerald-50 text-emerald-800' : ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAILY_TABLE_ROWS.map((row, idx) => {
              if (row.kind === 'section') {
                return (
                  <tr key={`section-${idx}`} className="bg-slate-100/80">
                    <td colSpan={columns.length + 1} className="sticky left-0 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {row.label}
                    </td>
                  </tr>
                )
              }

              const metricDef = METRIC_DEFINITIONS[row.id] ?? METRIC_DEFINITIONS.totalOrders
              const isGrowthRow = row.format === 'growth' || row.format === 'growthDual'

              return (
                <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium text-slate-700">
                    <span className="inline-flex items-center gap-1.5">
                      {row.label}
                      <InfoTooltip metric={metricDef} />
                    </span>
                  </td>
                  {dayMetrics.map((day, colIdx) => {
                    const col = columns[colIdx]
                    const isTodayCol = col.isToday

                    if (row.format === 'growthDual') {
                      const vsY = row.growthKey ? (day[row.growthKey] as number | null) : null
                      const vsW = row.growthWeekKey ? (day[row.growthWeekKey] as number | null) : null
                      const displayVal = isTodayCol ? vsY : vsY
                      const style = growthCellStyle(displayVal)
                      return (
                        <td
                          key={col.key}
                          className={`cursor-pointer px-3 py-2.5 text-right tabular-nums text-xs ${
                            col.isToday ? 'bg-emerald-50/60' : ''
                          }`}
                          style={style}
                          onClick={() =>
                            openDrillDown({
                              title: row.label,
                              subtitle: `${col.label} · ${row.label}`,
                              orders: getOrdersForCell(METRIC_DRILL_MAP[row.id] ?? row.id, colIdx),
                            })
                          }
                        >
                          {formatGrowthDual(vsY, vsW, isTodayCol)}
                        </td>
                      )
                    }

                    const value =
                      row.format === 'dash' ? null : (day[row.metricKey] as number | null)
                    const style = row.format === 'growth' ? growthCellStyle(value) : undefined
                    const clickable = row.format !== 'dash' && !isGrowthRow

                    return (
                      <td
                        key={col.key}
                        className={`${clickable ? 'cursor-pointer' : ''} px-3 py-2.5 text-right tabular-nums ${
                          col.isToday ? 'bg-emerald-50/60' : ''
                        }`}
                        style={style}
                        onClick={
                          clickable
                            ? () =>
                                openDrillDown({
                                  title: row.label,
                                  subtitle: `${col.label} · ${row.label}`,
                                  orders: getOrdersForCell(row.id, colIdx),
                                })
                            : undefined
                        }
                      >
                        {formatDailyCell(value, row.format)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
