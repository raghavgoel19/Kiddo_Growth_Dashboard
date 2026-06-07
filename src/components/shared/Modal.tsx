import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, children, wide }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close modal" onClick={onClose} />
      <div
        ref={ref}
        tabIndex={-1}
        className={`relative max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-2xl outline-none ${
          wide ? 'max-w-[680px]' : 'max-w-lg'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
