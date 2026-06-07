import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { buildHourlySeries, splitOrdersByDay } from '../../utils/dailyMetrics'
import type { Order } from '../../api/types'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { useDashboardContext } from '../../context/DashboardContext'
import { computeComparePeriod } from '../../utils/comparePeriod'
import { getHourIST, filterOrdersThroughSameTimeOfDay } from '../../utils/dates'
import { filterTestOrders } from '../../utils/testUserFilter'
import type { OrderStatus } from '../../api/types'

interface HourlyChartProps {
  orders: Order[]
}

function applyStatusFilter(orders: Order[], statuses: OrderStatus[]): Order[] {
  if (statuses.includes('all') || statuses.length === 0) return orders
  return orders.filter((o) => {
    if (statuses.includes('cancelled') && o.cancelled_at) return true
    return statuses.includes(o.financial_status as OrderStatus)
  })
}

function HourlyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number; name: string }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-1 font-medium text-slate-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm text-slate-600">
          {p.name}: {p.value} orders
        </p>
      ))}
    </div>
  )
}

export function HourlyChart({ orders }: HourlyChartProps) {
  const { drillFromChart } = useChartDrillDown()
  const { filters, allOrders } = useDashboardContext()
  const { today } = splitOrdersByDay(orders)

  const compareResult = useMemo(() => computeComparePeriod(allOrders, filters), [allOrders, filters])

  const compareOrders = useMemo(() => {
    if (!filters.compareEnabled || !compareResult?.compareOrders.length) return []
    let result = compareResult.compareOrders
    result = applyStatusFilter(result, filters.orderStatuses)
    result = filterTestOrders(result, filters.hideTestUsers)
    return result
  }, [compareResult, filters])

  const data = useMemo(() => {
    const base = buildHourlySeries(orders)
    if (!filters.compareEnabled || compareOrders.length === 0) return base

    const compareByHour = new Map<number, number>()
    for (const o of compareOrders) {
      const h = getHourIST(o.created_at)
      compareByHour.set(h, (compareByHour.get(h) ?? 0) + 1)
    }
    let cumulative = 0
    return base.map((row) => {
      cumulative += compareByHour.get(row.hour) ?? 0
      return { ...row, compare: cumulative }
    })
  }, [orders, filters.compareEnabled, compareOrders])

  const handleClick = (state: { activeLabel?: string }) => {
    if (!state?.activeLabel) return
    const hourMatch = data.find((d) => d.label === state.activeLabel)
    if (hourMatch == null) return
    const hour = hourMatch.hour
    const hourOrders = filterOrdersThroughSameTimeOfDay(
      today.filter((o) => getHourIST(o.created_at) === hour)
    )
    drillFromChart({
      title: 'Hourly orders',
      subtitle: `Today · ${state.activeLabel}`,
      orders: hourOrders,
    })
  }

  return (
    <div className="overflow-x-auto">
      <ResponsiveContainer width="100%" height={300} minWidth={480}>
        <LineChart data={data} onClick={handleClick}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            interval={2}
          />
          <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip content={<HourlyTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {!filters.compareEnabled && (
            <>
              <Line type="monotone" dataKey="today" name="Today" stroke="#00A86B" strokeWidth={2.5} dot={false} />
              <Line type="monotone" dataKey="yesterday" name="Yesterday" stroke="#64748b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="lastWeek" name="Last week" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="2 4" dot={false} />
            </>
          )}
          {filters.compareEnabled && (
            <>
              <Line type="monotone" dataKey="today" name="Today" stroke="#00A86B" strokeWidth={2.5} dot={false} />
              <Line
                type="monotone"
                dataKey="compare"
                name={compareResult?.compareLabel ?? 'Compare'}
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="5 5"
                dot={false}
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
