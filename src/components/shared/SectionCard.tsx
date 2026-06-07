import type { ReactNode } from 'react'
import { InfoTooltipByKey } from './InfoTooltip'

interface SectionCardProps {
  id?: string
  title: string
  description?: string
  metricKey?: string
  children: ReactNode
}

export function SectionCard({ id, title, description, metricKey, children }: SectionCardProps) {
  return (
    <section id={id} className="rounded-card border border-kiddo-border bg-white p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-slate-900">
          {title}
          {metricKey ? <InfoTooltipByKey metricKey={metricKey} /> : null}
        </h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {children}
    </section>
  )
}
