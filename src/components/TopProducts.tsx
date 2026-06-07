import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { TopProduct } from '../api/types'
import { formatINR } from '../utils/formatters'

interface TopProductsProps {
  data: TopProduct[]
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: TopProduct }[] }) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-1 font-medium text-kiddo-navy">{d.productTitle}</p>
      <p className="text-sm text-slate-600">Gross Sales: {formatINR(d.grossSales)}</p>
      <p className="text-sm text-slate-600">Net Sales: {formatINR(d.netSales)}</p>
      <p className="text-sm text-slate-600">Orders: {d.orders.toLocaleString('en-IN')}</p>
    </div>
  )
}

export function TopProducts({ data }: TopProductsProps) {
  const chartData = data
    .slice(0, 10)
    .map((d) => ({
      ...d,
      shortTitle: d.productTitle.length > 30 ? d.productTitle.slice(0, 30) + '…' : d.productTitle,
    }))
    .reverse()

  return (
    <div className="overflow-x-auto">
      <ResponsiveContainer width="100%" height={320} minWidth={360}>
        <BarChart data={chartData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="shortTitle" tick={{ fontSize: 10, fill: '#64748b' }} width={130} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="grossSales" fill="#059669" radius={[0, 2, 2, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
