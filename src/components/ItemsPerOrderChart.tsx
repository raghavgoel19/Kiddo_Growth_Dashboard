import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import type { ItemsPerOrderBucket } from '../api/types'
import { formatPercent } from '../utils/formatters'
import { GREEN_GRADIENT } from '../utils/aggregators'

interface ItemsPerOrderChartProps {
  data: ItemsPerOrderBucket[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ItemsPerOrderBucket }[] }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="font-medium text-kiddo-navy">{d.label}</p>
      <p className="text-sm text-slate-600">Orders: {d.count.toLocaleString('en-IN')}</p>
      <p className="text-sm text-slate-600">{formatPercent(d.percentage)} of total</p>
    </div>
  )
}

export function ItemsPerOrderChart({ data }: ItemsPerOrderChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    labelWithPct: `${d.count} (${formatPercent(d.percentage, 0)})`,
  }))

  return (
    <div className="overflow-x-auto">
      <ResponsiveContainer width="100%" height={280} minWidth={360}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} width={88} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[0, 2, 2, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={GREEN_GRADIENT[i % GREEN_GRADIENT.length]} />
            ))}
            <LabelList dataKey="labelWithPct" position="right" fontSize={10} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
