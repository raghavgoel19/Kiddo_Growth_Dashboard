import { formatDistanceToNow } from 'date-fns'
import type { SyncStatus } from '../../sync/syncEngine'

interface SyncStatusLabelProps {
  status: SyncStatus
  onRetry?: () => void
}

export function SyncStatusLabel({ status, onRetry }: SyncStatusLabelProps) {
  if (status.state === 'idle') return null

  if (status.state === 'loading-cache') {
    return (
      <span className="text-xs text-[var(--text-tertiary)]">
        {status.count.toLocaleString('en-IN')} orders loaded · Checking for new…
      </span>
    )
  }

  if (status.state === 'syncing') {
    return (
      <span className="text-xs text-[var(--text-tertiary)]">
        ⟳ Loading {status.label ?? 'orders'}… {status.fetched > 0 ? `(${status.fetched})` : ''}
      </span>
    )
  }

  if (status.state === 'done') {
    const cacheNote = status.fromCache ? ' · cached' : ''
    if (status.newOrdersFetched > 0) {
      return (
        <span className="text-xs text-[var(--text-tertiary)]">
          ✓ {status.label ?? 'Range'}: {status.ordersInDB.toLocaleString('en-IN')} orders
          {cacheNote || ` · fetched ${status.newOrdersFetched}`} ·{' '}
          {formatDistanceToNow(status.syncedAt, { addSuffix: true })}
        </span>
      )
    }
    return (
      <span className="text-xs text-[var(--text-tertiary)]">
        ✓ {status.label ?? 'Range'}: {status.ordersInDB.toLocaleString('en-IN')} orders{cacheNote} · Up to date
      </span>
    )
  }

  if (status.state === 'error') {
    if (status.cachedOrdersAvailable > 0) {
      return (
        <span className="text-xs text-[var(--yellow)]">
          ⚠ Showing {status.cachedOrdersAvailable.toLocaleString('en-IN')} cached orders · Load failed{' '}
          {onRetry ? (
            <button type="button" onClick={onRetry} className="font-medium underline hover:no-underline">
              Retry
            </button>
          ) : null}
        </span>
      )
    }
    return <span className="text-xs text-[var(--red)]">Load failed: {status.message}</span>
  }

  return null
}
