import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { buildCategorySplit } from '../../utils/dailyMetrics'
import { formatINR, formatPercent } from '../../utils/formatters'
import type { Order, ProductTagsMap } from '../../api/types'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'
import { useDashboardContext } from '../../context/DashboardContext'
import { ExportButton } from '../shared/ExportButton'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { InfoTooltipByKey } from '../shared/InfoTooltip'

const COLORS = ['#00A86B', '#059669', '#34D399', '#6EE7B7', '#A7F3D0', '#047857', '#10B981']

interface DailyCategorySplitProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

export function DailyCategorySplit({ orders, productTagsMap }: DailyCategorySplitProps) {
  const rows = buildCategorySplit(orders, productTagsMap)
  const { drillFromChart } = useChartDrillDown()
  const { allOrders } = useDashboardContext()

  const drillCategory = (category: string) => {
    drillFromChart({
      title: 'Category',
      subtitle: `Today · ${category}`,
      orders: filterOrdersForMetric(orders, productTagsMap, {
        category,
        allOrders: allOrders.length ? allOrders : orders,
      }),
    })
  }

  const exportRows = () => {
    downloadCsv(
      exportFilename('daily_category'),
      ['Category', 'Orders', 'GMV', 'Share %'],
      rows.map((r) => [r.category, r.orders, r.gmv, r.pct.toFixed(1)])
    )
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No orders today yet.</p>
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ExportButton onExport={exportRows} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="overflow-x-auto">
          <ResponsiveContainer width="100%" height={260} minWidth={240}>
            <PieChart>
              <Pie
                data={rows}
                dataKey="gmv"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                onClick={(_, index) => drillCategory(rows[index]?.category ?? '')}
              >
                {rows.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} className="cursor-pointer" />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatINR(value)}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <th className="pb-2 pr-4">
                  <span className="inline-flex items-center gap-1">
                    Category
                    <InfoTooltipByKey metricKey="categorySplit" />
                  </span>
                </th>
                <th className="pb-2 pr-4 text-right">Orders</th>
                <th className="pb-2 pr-4 text-right">GMV</th>
                <th className="pb-2 text-right">Share</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.category}
                  className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                  onClick={() => drillCategory(row.category)}
                >
                  <td className="py-2 pr-4 font-medium text-slate-800">{row.category}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.orders}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatINR(row.gmv)}</td>
                  <td className="py-2 text-right tabular-nums">{formatPercent(row.pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
