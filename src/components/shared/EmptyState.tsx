interface EmptyStateProps {
  title?: string
  message: string
  onClear?: () => void
}

export function EmptyState({ title = 'No results', message, onClear }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <p className="text-base font-medium text-slate-800">{title}</p>
      <p className="mt-2 max-w-md text-sm text-slate-500">{message}</p>
      {onClear && (
        <button type="button" onClick={onClear} className="mt-4 text-sm font-medium text-[#00A86B] hover:underline">
          Clear filters
        </button>
      )}
    </div>
  )
}
