import type { ReactElement, ReactNode } from 'react'
import { ResponsiveContainer } from 'recharts'

interface CompareChartWrapperProps {
  compareEnabled: boolean
  currentLabel?: string
  compareLabel?: string
  height?: number
  children: ReactNode
  emptyMessage?: string
}

export function CompareChartWrapper({
  compareEnabled,
  currentLabel = 'Current',
  compareLabel = 'Compare',
  height = 280,
  children,
  emptyMessage,
}: CompareChartWrapperProps) {
  return (
    <div>
      {compareEnabled && (
        <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-[#00A86B]" />
            {currentLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-slate-400" />
            {compareLabel}
          </span>
        </div>
      )}
      {emptyMessage ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          {children as ReactElement}
        </ResponsiveContainer>
      )}
    </div>
  )
}

export const COMPARE_LINE_PROPS = {
  compareStroke: '#94a3b8',
  compareStrokeDasharray: '5 5',
  currentStroke: '#00A86B',
} as const
