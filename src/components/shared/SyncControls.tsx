import type { SyncMeta } from '../../api/shopify'
import { formatTimeIST } from '../../utils/dates'

interface SyncControlsProps {
  isRefreshing: boolean
  syncMeta: SyncMeta | null
  onSyncOrders: () => void
  onSyncProducts: () => void
  onSyncAll: () => void
  compact?: boolean
}

function formatSyncLine(label: string, part: { fetchedAt: string; count: number } | null | undefined) {
  if (!part) return `${label}: not synced`
  return `${label}: ${part.count.toLocaleString('en-IN')} · ${formatTimeIST(new Date(part.fetchedAt))} IST`
}

export function SyncControls({
  isRefreshing,
  syncMeta,
  onSyncOrders,
  onSyncProducts,
  onSyncAll,
  compact = false,
}: SyncControlsProps) {
  return (
    <div className={compact ? 'flex flex-wrap items-center gap-2' : 'flex flex-col items-end gap-2'}>
      {!compact && syncMeta && (
        <p className="max-w-xs text-right text-[11px] leading-relaxed text-slate-400">
          {formatSyncLine('Orders', syncMeta.orders)}
          <br />
          {formatSyncLine('Products', syncMeta.products)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onSyncOrders}
          disabled={isRefreshing}
          className="rounded-md border border-kiddo-border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {isRefreshing ? 'Syncing…' : 'Sync orders'}
        </button>
        <button
          type="button"
          onClick={onSyncProducts}
          disabled={isRefreshing}
          className="rounded-md border border-kiddo-border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Sync products
        </button>
        <button
          type="button"
          onClick={onSyncAll}
          disabled={isRefreshing}
          className="rounded-md bg-[#00A86B] px-3 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          Sync all
        </button>
      </div>
    </div>
  )
}
