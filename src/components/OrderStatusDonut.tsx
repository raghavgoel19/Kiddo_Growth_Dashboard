import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { StatusBreakdown } from '../api/types'
import { formatPercent } from '../utils/formatters'
import { STATUS_COLORS } from '../utils/aggregators'

interface OrderStatusDonutProps {
  data: StatusBreakdown[]
}

const FALLBACK_COLORS = ['#00A86B', '#F59E0B', '#EF4444', '#3B82F6', '#8B5CF6', '#94A3B8']

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: StatusBreakdown }[] }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="font-medium text-kiddo-navy">{d.status}</p>
      <p className="text-sm text-slate-600">Count: {d.count.toLocaleString('en-IN')}</p>
      <p className="text-sm text-slate-600">{formatPercent(d.percentage)}</p>
    </div>
  )
}

export function OrderStatusDonut({ data }: OrderStatusDonutProps) {
  const chartData = data.map((d) => ({
    ...d,
    name: d.status,
    value: d.count,
  }))

  return (
    <>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={88}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, i) => (
              <Cell
                key={entry.status}
                fill={
                  STATUS_COLORS[entry.status.toLowerCase()] ??
                  FALLBACK_COLORS[i % FALLBACK_COLORS.length]
                }
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {chartData.map((entry, i) => (
          <li key={entry.status} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  STATUS_COLORS[entry.status.toLowerCase()] ??
                  FALLBACK_COLORS[i % FALLBACK_COLORS.length],
              }}
            />
            {entry.status}: {entry.count} ({formatPercent(entry.percentage, 0)})
          </li>
        ))}
      </ul>
    </>
  )
}
