import type { ReactNode } from 'react'

interface SectionProps {
  id: string
  title: string
  description?: string
  children: ReactNode
}

export function Section({ id, title, description, children }: SectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm leading-relaxed text-slate-500">{description}</p>
        )}
      </div>
      <div className="rounded-card border border-kiddo-border bg-white p-5 sm:p-6">
        {children}
      </div>
    </section>
  )
}
