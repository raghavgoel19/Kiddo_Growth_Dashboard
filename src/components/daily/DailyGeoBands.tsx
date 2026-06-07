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
import { buildGeoBands } from '../../utils/dailyMetrics'
import type { DistanceBand, Order } from '../../api/types'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'

const BAND_COLORS = ['#00A86B', '#059669', '#34D399', '#6EE7B7', '#A7F3D0', '#94A3B8']

interface DailyGeoBandsProps {
  orders: Order[]
}

export function DailyGeoBands({ orders }: DailyGeoBandsProps) {
  const rows = buildGeoBands(orders)
  const { drillFromChart } = useChartDrillDown()

  const drillBand = (band: string) => {
    drillFromChart({
      title: 'Geo band',
      subtitle: `Today · ${band}`,
      orders: filterOrdersForMetric(orders, {}, { geoBand: band as DistanceBand }),
    })
  }

  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No geo data for today&apos;s orders.</p>
  }

  return (
    <div className="overflow-x-auto">
      <ResponsiveContainer width="100%" height={220} minWidth={320}>
        <BarChart data={rows} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis
            type="category"
            dataKey="band"
            tick={{ fontSize: 11, fill: '#64748b' }}
            width={60}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(count: number, _name, props) => {
              const pct = (props.payload as { pct: number }).pct
              return [`${count} orders (${pct.toFixed(1)}%)`, 'Count']
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} onClick={(data) => drillBand(String(data.band))}>
            {rows.map((_, i) => (
              <Cell key={i} fill={BAND_COLORS[i % BAND_COLORS.length]} className="cursor-pointer" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
