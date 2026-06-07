import { useEffect, useRef } from 'react'

interface DrawerProps {
  open: boolean
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}

export function Drawer({ open, title, subtitle, onClose, children }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close drawer" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[400px] flex-col bg-white shadow-2xl outline-none animate-in slide-in-from-right"
        style={{ animation: 'slideIn 0.2s ease-out' }}
      >
        <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  )
}
