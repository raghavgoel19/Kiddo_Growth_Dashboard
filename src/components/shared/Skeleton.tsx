interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`shimmer rounded-lg ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="rounded-card bg-white p-6 shadow-card">
      <Skeleton className="mb-4 h-5 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export function KPISkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-card border border-kiddo-border bg-white p-4">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <div className="shimmer w-full rounded-lg" style={{ height }} />
}

export function SectionSkeleton() {
  return (
    <div className="space-y-6">
      <KPISkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  )
}

export function PageSkeleton() {
  return <SectionSkeleton />
}
