interface ExportButtonProps {
  label?: string
  onExport: () => void
  className?: string
}

export function ExportButton({ label = 'Export CSV', onExport, className = '' }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onExport}
      className={`inline-flex items-center gap-1.5 rounded-md border border-kiddo-border bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 ${className}`}
    >
      <span aria-hidden>↓</span>
      {label}
    </button>
  )
}
