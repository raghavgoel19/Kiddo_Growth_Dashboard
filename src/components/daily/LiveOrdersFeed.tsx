import { useEffect, useMemo, useState } from 'react'
import { getOrderChannel, getOrderChannelLabel } from '../../utils/channel'
import { classifyOrderPrimary } from '../../utils/taxonomy'
import { getOrderItemCount } from '../../utils/aggregators'
import { formatINR, formatIST, parseMoney, displayPhone } from '../../utils/formatters'
import type { Order, ProductTagsMap } from '../../api/types'
import { useDashboardContext } from '../../context/DashboardContext'
import { ExportButton } from '../shared/ExportButton'
import { downloadCsv, exportFilename } from '../../utils/csv'
import { TableSummaryFooter } from '../shared/TableSummaryFooter'
import { InfoTooltipByKey } from '../shared/InfoTooltip'

interface LiveOrdersFeedProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

function ChannelBadge({ channel }: { channel: ReturnType<typeof getOrderChannel> }) {
  const label = getOrderChannelLabel(channel)
  return (
    <span className={channel === 'app' ? 'badge-app' : 'badge-website'}>
      {label}
    </span>
  )
}

function CustomerBadge({ order }: { order: Order }) {
  const isRepeat = (order.customer?.orders_count ?? 0) > 1
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
        isRepeat ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
      }`}
    >
      {isRepeat ? 'Repeat' : 'New'}
    </span>
  )
}

export function LiveOrdersFeed({ orders, productTagsMap }: LiveOrdersFeedProps) {
  const [tick, setTick] = useState(0)
  const { openOrderDetail } = useDashboardContext()

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 120_000)
    return () => clearInterval(id)
  }, [])

  const displayOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20),
    [orders, tick]
  )

  const exportRows = () => {
    downloadCsv(
      exportFilename('live_orders'),
      ['Time', 'Order', 'Phone', 'Channel', 'Category', 'Items', 'Total', 'Customer type'],
      displayOrders.map((order) => [
        formatIST(order.created_at),
        order.name ?? `#${order.order_number ?? order.id}`,
        displayPhone(order.customer?.phone),
        getOrderChannelLabel(getOrderChannel(order)),
        classifyOrderPrimary(order, productTagsMap),
        getOrderItemCount(order),
        parseMoney(order.total_price),
        (order.customer?.orders_count ?? 0) > 1 ? 'Repeat' : 'New',
      ])
    )
  }

  const orderTotals = useMemo(
    () => displayOrders.map((o) => parseMoney(o.total_price)),
    [displayOrders]
  )
  const itemTotals = useMemo(
    () => displayOrders.map((o) => getOrderItemCount(o)),
    [displayOrders]
  )

  if (displayOrders.length === 0) {
    return <p className="text-[13px] text-[var(--text-secondary)]">No orders in this date range.</p>
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <ExportButton onExport={exportRows} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="table-header border-b border-[var(--border-light)]">
              <th className="px-4 py-2 text-left">Time</th>
              <th className="px-4 py-2 text-left">Order</th>
              <th className="px-4 py-2 text-left">Phone</th>
              <th className="px-4 py-2 text-left">Channel</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-right">Items</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-left">
                <span className="inline-flex items-center gap-1">
                  Customer
                  <InfoTooltipByKey metricKey="liveOrders" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayOrders.map((order) => (
              <tr
                key={order.id}
                className="cursor-pointer border-b border-[var(--border-light)] hover:bg-[var(--bg-app)]"
                onClick={() => openOrderDetail(order)}
              >
                <td className="px-4 py-2.5 whitespace-nowrap text-[var(--text-secondary)]">
                  {formatIST(order.created_at).split(',')[1]?.trim() ?? formatIST(order.created_at)}
                </td>
                <td className="px-4 py-2.5 font-medium text-[var(--accent)] hover:underline">
                  {order.name ?? `#${order.order_number ?? order.id}`}
                </td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{displayPhone(order.customer?.phone)}</td>
                <td className="px-4 py-2.5">
                  <ChannelBadge channel={getOrderChannel(order)} />
                </td>
                <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                  {classifyOrderPrimary(order, productTagsMap)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{getOrderItemCount(order)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {formatINR(parseMoney(order.total_price))}
                </td>
                <td className="px-4 py-2.5">
                  <CustomerBadge order={order} />
                </td>
              </tr>
            ))}
          </tbody>
          <TableSummaryFooter
            cells={[
              { type: 'text', values: [], label: `${displayOrders.length} orders shown` },
              { type: 'text', values: [], colSpan: 4 },
              { type: 'orders', values: itemTotals },
              { type: 'currency', values: orderTotals },
              { type: 'text', values: [] },
            ]}
          />
        </table>
      </div>
    </div>
  )
}
