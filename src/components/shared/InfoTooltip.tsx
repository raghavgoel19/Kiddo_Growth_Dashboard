import { useEffect, useId, useRef, useState } from 'react'
import { METRIC_DEFINITIONS, type MetricDefinition } from '../../utils/metricDefinitions'

interface InfoTooltipProps {
  metric: MetricDefinition
  className?: string
}

export function InfoTooltip({ metric, className = '' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const [flip, setFlip] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setFlip(rect.right + 280 > window.innerWidth)
  }, [open])

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-describedby={open ? id : undefined}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[11px] text-slate-400 hover:text-slate-600"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        ⓘ
      </button>
      {open && (
        <div
          id={id}
          role="tooltip"
          className={`absolute top-6 z-50 w-64 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg ${
            flip ? 'right-0' : 'left-0'
          }`}
        >
          <p className="text-xs font-semibold text-slate-900">{metric.title}</p>
          <p className="mt-1 text-xs text-slate-600">{metric.definition}</p>
          <p className="mt-2 text-[11px] text-slate-500">
            <span className="font-medium">Formula:</span> {metric.formula}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            <span className="font-medium">Exclusions:</span> {metric.exclusions}
          </p>
        </div>
      )}
    </span>
  )
}

export function InfoTooltipByKey({ metricKey, className }: { metricKey: string; className?: string }) {
  const metric = METRIC_DEFINITIONS[metricKey]
  if (!metric) return null
  return <InfoTooltip metric={metric} className={className} />
}
