import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { AOVPoint } from '../api/types'
import { formatINR, formatMonthLabel } from '../utils/formatters'

interface AOVTrendProps {
  data: AOVPoint[]
  overallAOV: number
}

function CustomTooltip({
  active,
  payload,
  label,
  overallAOV,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  overallAOV: number
}) {
  if (!active || !payload?.[0]) return null
  const aov = payload[0].value
  const delta = overallAOV > 0 ? ((aov - overallAOV) / overallAOV) * 100 : 0
  const sign = delta >= 0 ? '+' : ''
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="font-medium text-kiddo-navy">
        {formatMonthLabel(String(label))}: {formatINR(aov)}
      </p>
      <p className="text-sm text-slate-600">
        vs avg: {sign}{delta.toFixed(1)}%
      </p>
    </div>
  )
}

export function AOVTrend({ data, overallAOV }: AOVTrendProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatMonthLabel(d.month),
  }))

  return (
    <div className="overflow-x-auto">
      <ResponsiveContainer width="100%" height={280} minWidth={360}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${v}`} />
          <Tooltip content={<CustomTooltip overallAOV={overallAOV} />} />
          <ReferenceLine
            y={overallAOV}
            stroke="#94a3b8"
            strokeDasharray="4 4"
            label={{ value: `Avg ${formatINR(overallAOV)}`, position: 'insideTopRight', fontSize: 10, fill: '#64748b' }}
          />
          <Line type="monotone" dataKey="aov" stroke="#059669" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
