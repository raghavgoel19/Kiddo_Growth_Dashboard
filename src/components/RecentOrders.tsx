import type { Order } from '../api/types'
import { formatINR, formatIST, displayPhone, parseMoney } from '../utils/formatters'
import { getOrderItemCount } from '../utils/aggregators'

interface RecentOrdersProps {
  orders: Order[]
  onRefresh: () => void
  isRefreshing?: boolean
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: 'bg-green-100 text-green-800',
    pending: 'bg-amber-100 text-amber-800',
    refunded: 'bg-red-100 text-red-800',
    voided: 'bg-slate-100 text-slate-600',
  }
  const cls = colors[status.toLowerCase()] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  )
}

export function RecentOrders({ orders, onRefresh, isRefreshing }: RecentOrdersProps) {
  return (
    <>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="rounded-md border border-kiddo-border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          {isRefreshing ? 'Syncing…' : 'Refresh'}
        </button>
      </div>
      <div className="overflow-x-auto -mx-5 sm:-mx-6">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {['Order #', 'Date & Time', 'Customer', 'Items', 'Total', 'Status'].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium">
                  {order.name ?? `#${order.order_number ?? order.id}`}
                </td>
                <td className="px-4 py-3 text-sm">{formatIST(order.created_at)}</td>
                <td className="px-4 py-3 text-sm">{displayPhone(order.customer?.phone)}</td>
                <td className="px-4 py-3 text-sm">{getOrderItemCount(order)}</td>
                <td className="px-4 py-3 text-sm">{formatINR(parseMoney(order.total_price))}</td>
                <td className="px-4 py-3 text-sm">
                  <StatusBadge status={order.financial_status} />
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                  No recent orders
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

