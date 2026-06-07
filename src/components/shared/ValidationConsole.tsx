import { useMemo } from 'react'
import type { Order, Product, ProductTagsMap } from '../../api/types'
import {
  computeChannelBreakdown,
  computeDataQuality,
  computeLocationBreakdown,
} from '../../utils/dataQuality'
import { IST, toIST } from '../../utils/dates'

interface ValidationConsoleProps {
  orders: Order[]
  products: Product[]
  productTagsMap: ProductTagsMap
  open: boolean
  onClose: () => void
}

export function ValidationConsole({
  orders,
  products,
  productTagsMap,
  open,
  onClose,
}: ValidationConsoleProps) {
  const channels = useMemo(() => computeChannelBreakdown(orders), [orders])
  const location = useMemo(() => computeLocationBreakdown(orders), [orders])
  const checks = useMemo(
    () => computeDataQuality(orders, products, productTagsMap),
    [orders, products, productTagsMap]
  )

  const dateTests = useMemo(() => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date())
    const yesterday = new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(
      new Date(Date.now() - 86_400_000)
    )
    const countOn = (key: string) =>
      orders.filter(
        (o) => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(toIST(o.created_at)) === key
      ).length
    return [
      { label: today, count: countOn(today) },
      { label: yesterday, count: countOn(yesterday) },
    ]
  }, [orders])

  if (!open) return null

  const withCustomer =
    orders.length - (checks.find((c) => c.id === 'noCustomer')?.count ?? 0)

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-lg bg-[#111827] p-6 font-mono text-xs text-green-400 shadow-xl">
        <div className="mb-4 flex items-center justify-between text-white">
          <span className="font-sans text-sm font-semibold">Data validation report</span>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
            Close
          </button>
        </div>
        <pre className="whitespace-pre-wrap">{`DATA VALIDATION REPORT
─────────────────────
Total orders in cache: ${orders.length.toLocaleString('en-IN')}
Orders with customer: ${withCustomer.toLocaleString('en-IN')} (${((withCustomer / Math.max(orders.length, 1)) * 100).toFixed(1)}%)
Orders with coordinates: ${location.coordinates.toLocaleString('en-IN')} (${location.coordPct.toFixed(1)}%)
Orders with pincode fallback: ${location.pincode.toLocaleString('en-IN')} (${location.pincodePct.toFixed(1)}%)
Orders with no location: ${location.unknown.toLocaleString('en-IN')} (${location.unknownPct.toFixed(1)}%)

Channel breakdown:
  App: ${channels.app.toLocaleString('en-IN')} (${((channels.app / Math.max(channels.total, 1)) * 100).toFixed(1)}%)
  Website: ${channels.website.toLocaleString('en-IN')} (${((channels.website / Math.max(channels.total, 1)) * 100).toFixed(1)}%)
  Unknown: 0 (0.0%)

Products in cache: ${products.length.toLocaleString('en-IN')}

Date range test (IST):
${dateTests.map((d) => `  Orders on ${d.label}: ${d.count}`).join('\n')}
`}</pre>
      </div>
    </div>
  )
}
