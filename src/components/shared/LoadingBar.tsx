interface LoadingBarProps {
  active: boolean
}

export function LoadingBar({ active }: LoadingBarProps) {
  if (!active) return null
  return (
    <div className="fixed left-[220px] right-0 top-0 z-40 h-0.5 overflow-hidden bg-[var(--accent-light)]">
      <div
        className="h-full w-1/3 bg-[var(--accent)]"
        style={{ animation: 'loadingBar 1.2s ease-in-out infinite' }}
      />
    </div>
  )
}
