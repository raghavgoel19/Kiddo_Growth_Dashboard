import { formatDistanceToNow } from 'date-fns'
import type { SyncStatus } from '../../sync/syncEngine'

interface SyncStatusLabelProps {
  status: SyncStatus
  onRetry?: () => void
}

export function SyncStatusLabel({ status, onRetry }: SyncStatusLabelProps) {
  if (status.state === 'idle') return null

  if (status.state === 'loading-cache') {
    return <span className="text-xs text-[var(--text-tertiary)]">Loading from cache…</span>
  }

  if (status.state === 'syncing') {
    return (
      <span className="text-xs text-[var(--text-tertiary)]">
        ⟳ Syncing {status.fetched.toLocaleString('en-IN')} new orders…
      </span>
    )
  }

  if (status.state === 'done') {
    if (status.newOrdersFetched > 0) {
      return (
        <span className="text-xs text-[var(--text-tertiary)]">
          ✓ {status.ordersInDB.toLocaleString('en-IN')} orders · {status.newOrdersFetched} new · Synced{' '}
          {formatDistanceToNow(status.syncedAt, { addSuffix: true })}
        </span>
      )
    }
    return (
      <span className="text-xs text-[var(--text-tertiary)]">
        ✓ {status.ordersInDB.toLocaleString('en-IN')} orders · Up to date
      </span>
    )
  }

  if (status.state === 'error') {
    if (status.cachedOrdersAvailable > 0) {
      return (
        <span className="text-xs text-[var(--yellow)]">
          ⚠ Showing {status.cachedOrdersAvailable.toLocaleString('en-IN')} cached orders · Sync failed{' '}
          {onRetry ? (
            <button type="button" onClick={onRetry} className="font-medium underline hover:no-underline">
              Retry
            </button>
          ) : null}
        </span>
      )
    }
    return <span className="text-xs text-[var(--red)]">Sync failed: {status.message}</span>
  }

  return null
}
