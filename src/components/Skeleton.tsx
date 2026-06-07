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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-card bg-white p-5 shadow-card">
          <Skeleton className="mb-2 h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      ))}
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <Skeleton className="h-10 w-64" />
      <KPISkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  )
}
