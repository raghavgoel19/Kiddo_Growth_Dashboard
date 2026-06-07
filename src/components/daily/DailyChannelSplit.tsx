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
import { buildChannelSplit, splitOrdersByDay } from '../../utils/dailyMetrics'
import { DeltaBadge } from '../shared/DeltaBadge'
import type { Order } from '../../api/types'
import { useChartDrillDown } from '../../hooks/useChartDrillDown'
import { filterOrdersForMetric } from '../../utils/drillDownFilters'
import { filterOrdersThroughSameTimeOfDay } from '../../utils/dates'

const CHANNEL_COLORS = { App: '#16A34A', Website: '#6B7280' }
const CHANNEL_IDS: Record<string, 'app' | 'website'> = { App: 'app', Website: 'website' }

interface DailyChannelSplitProps {
  orders: Order[]
}

export function DailyChannelSplit({ orders }: DailyChannelSplitProps) {
  const rows = buildChannelSplit(orders)
  const { drillFromChart } = useChartDrillDown()
  const { today } = splitOrdersByDay(orders)
  const todaySameTime = filterOrdersThroughSameTimeOfDay(today)

  const drillChannel = (channel: string) => {
    const ch = CHANNEL_IDS[channel]
    if (!ch) return
    drillFromChart({
      title: 'Channel',
      subtitle: `Today · ${channel}`,
      orders: filterOrdersForMetric(todaySameTime, {}, { channel: ch }),
    })
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <ResponsiveContainer width="100%" height={180} minWidth={280}>
          <BarChart data={rows} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="channel"
              tick={{ fontSize: 12, fill: '#64748b' }}
              width={70}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip formatter={(v: number) => [`${v} orders`, 'Count']} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} onClick={(data) => drillChannel(String(data.channel))}>
              {rows.map((row) => (
                <Cell
                  key={row.channel}
                  fill={CHANNEL_COLORS[row.channel as keyof typeof CHANNEL_COLORS]}
                  className="cursor-pointer"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-6">
        {rows.map((row) => (
          <button
            key={row.channel}
            type="button"
            className="cursor-pointer text-left text-sm hover:opacity-80"
            onClick={() => drillChannel(row.channel)}
          >
            <p className="font-medium text-slate-800">
              {row.channel}: {row.count} ({row.pct.toFixed(1)}%)
            </p>
            <DeltaBadge
              label={row.timeLabel ? `vs Yesterday (${row.timeLabel}):` : 'vs Yesterday (same time):'}
              value={row.vsYesterday.value}
              positive={row.vsYesterday.positive}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
