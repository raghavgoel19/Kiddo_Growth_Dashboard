import { useMemo, useState } from 'react'
import type { Order, Product, ProductTagsMap } from '../../api/types'
import { computeChannelBreakdown, computeDataQuality } from '../../utils/dataQuality'

interface DataQualityPanelProps {
  orders: Order[]
  products: Product[]
  productTagsMap: ProductTagsMap
}

export function DataQualityPanel({ orders, products, productTagsMap }: DataQualityPanelProps) {
  const [open, setOpen] = useState(false)
  const checks = useMemo(
    () => computeDataQuality(orders, products, productTagsMap),
    [orders, products, productTagsMap]
  )
  const channels = useMemo(() => computeChannelBreakdown(orders), [orders])

  return (
    <div className="card mt-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-semibold text-[var(--text-primary)]">Data quality</span>
        <span className="text-xs text-[var(--text-secondary)]">
          {checks.filter((c) => !c.ok).length} issues · {open ? 'Hide' : 'Show'}
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border-light)] px-5 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-2 text-left">Check</th>
                <th className="px-4 py-2 text-right">Status</th>
                <th className="px-4 py-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((c) => (
                <tr key={c.id} className="border-t border-[var(--border-light)] hover:bg-[var(--bg-app)]">
                  <td className="px-4 py-2.5">
                    {c.label}
                    {c.detail && (
                      <span className="ml-2 text-xs text-[var(--text-tertiary)]">({c.detail})</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">{c.ok ? '✓' : '⚠'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.count.toLocaleString('en-IN')}</td>
                </tr>
              ))}
              <tr className="border-t border-[var(--border-light)]">
                <td className="px-4 py-2.5 text-[var(--text-secondary)]">Channel: App / Website</td>
                <td className="px-4 py-2.5 text-right">✓</td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {channels.app.toLocaleString('en-IN')} / {channels.website.toLocaleString('en-IN')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
