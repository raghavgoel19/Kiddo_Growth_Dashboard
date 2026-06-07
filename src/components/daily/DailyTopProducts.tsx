import { buildDailyTopProducts } from '../../utils/dailyMetrics'
import { formatINR } from '../../utils/formatters'
import type { Order, ProductTagsMap } from '../../api/types'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'
import { ExportButton } from '../shared/ExportButton'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { InfoTooltipByKey } from '../shared/InfoTooltip'

interface DailyTopProductsProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

export function DailyTopProducts({ orders, productTagsMap }: DailyTopProductsProps) {
  const rows = buildDailyTopProducts(orders, productTagsMap)
  const { drillFromChart } = useChartDrillDown()

  const exportRows = () => {
    downloadCsv(
      exportFilename('daily_top_products'),
      ['Rank', 'Product', 'Units', 'Revenue', 'Category'],
      rows.map((r) => [r.rank, r.name, r.units, r.revenue, r.category])
    )
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No product sales today yet.</p>
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ExportButton onExport={exportRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <th className="pb-2 pr-3">#</th>
              <th className="pb-2 pr-3">
                <span className="inline-flex items-center gap-1">
                  Product
                  <InfoTooltipByKey metricKey="topProducts" />
                </span>
              </th>
              <th className="pb-2 pr-3 text-right">Units</th>
              <th className="pb-2 pr-3 text-right">Revenue</th>
              <th className="pb-2">Category</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.rank}
                className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                onClick={() =>
                  drillFromChart({
                    title: 'Product',
                    subtitle: `Today · ${row.name}`,
                    orders: filterOrdersForMetric(orders, productTagsMap, { productName: row.name }),
                  })
                }
              >
                <td className="py-2 pr-3 tabular-nums text-slate-400">{row.rank}</td>
                <td className="py-2 pr-3 font-medium text-slate-800">{row.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.units}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{formatINR(row.revenue)}</td>
                <td className="py-2 text-slate-600">{row.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
