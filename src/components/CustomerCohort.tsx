import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import type { CohortPoint } from '../api/types'
import { formatMonthLabel } from '../utils/formatters'

interface CustomerCohortProps {
  data: CohortPoint[]
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-1 font-medium text-kiddo-navy">{formatMonthLabel(String(label))}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm text-slate-600">
          {p.name}: {p.value.toLocaleString('en-IN')}
        </p>
      ))}
    </div>
  )
}

export function CustomerCohort({ data }: CustomerCohortProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatMonthLabel(d.month),
    oneTime: d.newCustomers,
    repeat: d.returningCustomers,
  }))

  return (
    <div className="overflow-x-auto">
      <ResponsiveContainer width="100%" height={280} minWidth={360}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="oneTime" name="One-time" stackId="a" fill="#cbd5e1" />
          <Bar dataKey="repeat" name="Repeat" stackId="a" fill="#059669" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
