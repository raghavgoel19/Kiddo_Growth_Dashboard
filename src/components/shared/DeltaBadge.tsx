interface DeltaBadgeProps {
  label: string
  value: string
  positive: boolean
}

export function DeltaBadge({ label, value, positive }: DeltaBadgeProps) {
  const isNA = value === 'N/A'
  const color = isNA
    ? 'text-[var(--text-tertiary)]'
    : positive
      ? 'text-[var(--accent)]'
      : 'text-[var(--red)]'

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium">
      <span className="font-normal text-[var(--text-secondary)]">{label}</span>
      <span className={`tabular-nums ${color}`}>
        {isNA ? value : `${positive ? '▲' : '▼'} ${value}`}
      </span>
    </span>
  )
}
