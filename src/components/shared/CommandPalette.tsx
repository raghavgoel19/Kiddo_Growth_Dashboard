import { useEffect, useMemo, useState } from 'react'
import type { Order } from '../../api/types'
import { Modal } from './Modal'

interface CommandPaletteProps {
  orders: Order[]
  onSelectOrder: (order: Order) => void
  onNavigate: (section: string) => void
}

export function CommandPalette({ orders, onSelectOrder, onNavigate }: CommandPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const orderMatches = orders
      .filter((o) => (o.name ?? '').toLowerCase().includes(q) || String(o.order_number).includes(q))
      .slice(0, 8)
    const phoneMatches = orders
      .filter((o) => o.customer?.phone?.replace(/\D/g, '').includes(q.replace(/\D/g, '')))
      .slice(0, 5)
    const sections = ['today', 'summary', 'orders', 'users', 'retention', 'cohorts', 'products']
      .filter((s) => s.includes(q))
      .map((s) => ({ type: 'section' as const, id: s, label: `Go to ${s}` }))
    return [
      ...orderMatches.map((o) => ({ type: 'order' as const, order: o, label: o.name ?? `#${o.order_number}` })),
      ...phoneMatches.map((o) => ({ type: 'phone' as const, order: o, label: mask(o.customer?.phone) })),
      ...sections,
    ].slice(0, 12)
  }, [query, orders])

  if (!open) return null

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <div className="p-4">
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search orders, phone, sections…"
          className="w-full rounded-md border border-kiddo-border px-3 py-2 text-sm"
        />
        <ul className="mt-3 max-h-64 overflow-y-auto">
          {results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                className="w-full rounded px-2 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  if (r.type === 'order' || r.type === 'phone') {
                    onSelectOrder(r.order)
                  } else {
                    onNavigate(r.id)
                  }
                  setOpen(false)
                  setQuery('')
                }}
              >
                {r.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}

function mask(phone?: string | null) {
  if (!phone) return 'Guest'
  const d = phone.replace(/\D/g, '')
  return `+91 ****${d.slice(-4)}`
}
