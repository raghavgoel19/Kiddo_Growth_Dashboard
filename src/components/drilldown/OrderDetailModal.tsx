import { useMemo } from 'react'
import type { ProductTagsMap } from '../../api/types'
import { Modal } from '../shared/Modal'
import { useDashboardContext } from '../../context/DashboardContext'
import { classifyOrder } from '../../utils/taxonomy'
import { getOrderChannel } from '../../utils/channel'
import { getDistanceBand, getDistanceKm } from '../../utils/geography'
import { getCustomerOrderNumber, daysSinceLastOrder } from '../../utils/orderAnalysis'
import {
  formatINR,
  formatIST,
  formatMonthYear,
  guestDisplayName,
  displayPhone,
  parseMoney,
} from '../../utils/formatters'

interface OrderDetailModalProps {
  productTagsMap: ProductTagsMap
}

function statusBadgeClass(status: string | null | undefined): string {
  const s = (status ?? '').toLowerCase()
  if (s === 'paid') return 'badge-paid'
  if (s === 'pending' || s === 'partially_paid') return 'badge-pending'
  if (s === 'refunded' || s === 'partially_refunded') return 'rounded px-2.5 py-0.5 text-xs font-medium text-[var(--refunded)] bg-[var(--refunded-bg)]'
  if (s === 'voided' || s === 'cancelled') return 'rounded px-2.5 py-0.5 text-xs font-medium text-[var(--cancelled)] bg-[var(--cancelled-bg)]'
  return 'rounded px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--text-secondary)] bg-[var(--border-light)]'
}

export function OrderDetailModal({ productTagsMap }: OrderDetailModalProps) {
  const { selectedOrder, closeOrderDetail, allOrders } = useDashboardContext()

  const customerStats = useMemo(() => {
    if (!selectedOrder?.customer?.id) return null
    const cid = selectedOrder.customer.id
    const customerOrders = allOrders
      .filter((o) => o.customer?.id === cid)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    const totalSpent = customerOrders.reduce((s, o) => s + parseMoney(o.total_price), 0)
    const first = customerOrders[0]
    return {
      totalSpent,
      since: first ? formatMonthYear(first.created_at) : null,
      orderCount: customerOrders.length,
    }
  }, [allOrders, selectedOrder])

  if (!selectedOrder) return null

  const order = selectedOrder
  const categories = classifyOrder(order, productTagsMap)
  const channel = getOrderChannel(order)
  const orderNum = getCustomerOrderNumber(order, allOrders)
  const daysSince = daysSinceLastOrder(order, allOrders)
  const discount = order.discount_codes?.[0]
  const subtotal = parseMoney(order.subtotal_price ?? order.total_price)
  const total = parseMoney(order.total_price)
  const discountAmt = subtotal - total

  const orderLabel = order.name ?? `#${order.order_number ?? order.id.slice(-6)}`
  const addr = order.shipping_address
  const distanceKm = getDistanceKm(order)
  const distanceBand = getDistanceBand(order)

  const ordinal =
    orderNum === 1 ? '1st order' : orderNum === 2 ? '2nd order' : orderNum === 3 ? '3rd order' : `${orderNum}th order`

  return (
    <Modal open={!!selectedOrder} onClose={closeOrderDetail} wide>
      <div className="overflow-hidden rounded-xl">
        <div className="bg-[var(--bg-app)] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={closeOrderDetail}
                className="text-left text-xl font-semibold text-[var(--accent)] hover:underline"
              >
                {orderLabel}
              </button>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{formatIST(order.created_at)} IST</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className={statusBadgeClass(order.financial_status)}>
                  {(order.financial_status ?? 'unknown').toUpperCase()}
                </span>
                {order.fulfillment_status && (
                  <span className="rounded px-2.5 py-0.5 text-xs font-medium capitalize text-[var(--text-secondary)] bg-[var(--border-light)]">
                    {order.fulfillment_status}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={closeOrderDetail}
              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Items</h3>
            <table className="mt-3 w-full text-[13px]">
              <thead>
                <tr className="table-header border-b border-[var(--border-light)]">
                  <th className="px-0 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-left">Category</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Price</th>
                  <th className="px-0 py-2 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(order.line_items ?? []).map((item, i) => {
                  const lineTotal = parseMoney(item.price) * (item.quantity ?? 0)
                  return (
                    <tr key={i} className="border-b border-[var(--border-light)] hover:bg-[var(--bg-app)]">
                      <td className="py-3 pr-2">{item.product_title ?? item.title}</td>
                      <td className="px-2 py-3">
                        {categories[0] ? (
                          <span className="rounded bg-[var(--border-light)] px-2 py-0.5 text-xs">{categories[0]}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-3 text-right tabular-nums">{item.quantity}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{formatINR(parseMoney(item.price))}</td>
                      <td className="py-3 text-right tabular-nums">{formatINR(lineTotal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="mt-4 space-y-1 text-[13px] text-[var(--text-secondary)]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums text-[var(--text-primary)]">{formatINR(subtotal)}</span>
              </div>
              {discount?.code && (
                <div className="flex justify-between">
                  <span>Discount: {discount.code}</span>
                  <span className="tabular-nums text-[var(--red)]">-{formatINR(discountAmt > 0 ? discountAmt : parseMoney(discount.amount))}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-[var(--border-light)] pt-2 font-semibold text-[var(--text-primary)]">
                <span>Total</span>
                <span className="tabular-nums">{formatINR(total)}</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Customer</h3>
            <p className="mt-2 text-[13px] font-medium">{order.customer?.phone ? displayPhone(order.customer.phone) : guestDisplayName(order)}</p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {ordinal}
              {customerStats?.since ? ` · Customer since ${customerStats.since}` : ''}
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {daysSince != null ? `Last order: ${daysSince} days ago` : 'First order'}
              {customerStats ? ` · Total spent: ${formatINR(customerStats.totalSpent)}` : ''}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Delivery</h3>
            <p className="mt-2 text-[13px]">
              {[addr?.address1, addr?.city, addr?.zip].filter(Boolean).join(', ') || '—'}
            </p>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
              {distanceKm != null ? `${distanceKm.toFixed(1)} km from dark store` : 'Distance unknown'}
              {distanceBand !== 'unknown' ? ` · ${distanceBand} band` : ''}
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Channel</h3>
            <div className="mt-2 flex items-center gap-2">
              <span className={channel === 'app' ? 'badge-app' : 'badge-website'}>
                {channel === 'app' ? 'App' : 'Website'}
              </span>
              <span className="text-[13px] text-[var(--text-secondary)]">
                {channel === 'app' ? 'Placed via Mobile App' : 'Placed via Online Store'}
              </span>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  )
}
