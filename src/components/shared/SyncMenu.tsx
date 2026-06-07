import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'

interface SyncMenuProps {
  isRefreshing: boolean
  lastSyncedAt?: Date | null
  onSyncOrders: () => Promise<void>
  onSyncProducts: () => Promise<void>
  onSyncAll: () => Promise<void>
}

export function SyncMenu({
  isRefreshing,
  lastSyncedAt,
  onSyncOrders,
  onSyncProducts,
  onSyncAll,
}: SyncMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const handleFullResync = () => {
    setOpen(false)
    const ok = window.confirm(
      'This will re-download all 13,000+ orders. It takes 2–3 minutes and is only needed if data looks wrong. Continue?'
    )
    if (ok) void onSyncAll()
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-app)]"
        title="Sync data"
        aria-label="Sync data"
      >
        <span className={isRefreshing ? 'inline-block animate-spin' : ''}>⟳</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[220px] rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
          {lastSyncedAt && (
            <p className="border-b border-[var(--border-light)] px-3 py-2 text-[11px] text-[var(--text-tertiary)]">
              Last synced: {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}
            </p>
          )}
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-app)]"
            onClick={() => {
              setOpen(false)
              void onSyncOrders()
            }}
          >
            Sync new orders
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--bg-app)]"
            onClick={() => {
              setOpen(false)
              void onSyncProducts()
            }}
          >
            Sync new products
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-left text-sm text-[var(--yellow)] hover:bg-[var(--yellow-light)]"
            onClick={handleFullResync}
          >
            Force full resync
            <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">
              Clears cache · 2–3 minutes
            </span>
          </button>
        </div>
      )}
    </div>
  )
}
