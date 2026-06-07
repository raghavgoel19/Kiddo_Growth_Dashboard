import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { TrendPoint } from '../api/types'
import { formatINR, formatMonthLabel } from '../utils/formatters'

interface RevenueTrendProps {
  data: TrendPoint[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const revenue = payload.find((p) => p.name === 'Revenue')?.value ?? 0
  const orders = payload.find((p) => p.name === 'Orders')?.value ?? 0
  const aov = orders > 0 ? revenue / orders : 0
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-1 font-medium text-kiddo-navy">{formatMonthLabel(String(label))}</p>
      <p className="text-sm text-slate-600">Revenue: {formatINR(revenue)}</p>
      <p className="text-sm text-slate-600">Orders: {orders.toLocaleString('en-IN')}</p>
      <p className="text-sm text-slate-600">AOV: {formatINR(aov)}</p>
    </div>
  )
}

export function RevenueTrend({ data }: RevenueTrendProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatMonthLabel(d.month),
  }))

  return (
    <div className="overflow-x-auto">
      <ResponsiveContainer width="100%" height={300} minWidth={480}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
          />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar yAxisId="right" dataKey="orders" name="Orders" fill="#cbd5e1" radius={[2, 2, 0, 0]} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="revenue"
            name="Revenue"
            stroke="#059669"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
