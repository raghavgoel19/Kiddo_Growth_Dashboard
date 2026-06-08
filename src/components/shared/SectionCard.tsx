import type { ReactNode } from 'react'
import { useMemo } from 'react'
import type { Order } from '../../api/types'
import { BoardDateFilter } from './BoardDateFilter'
import { InfoTooltipByKey } from './InfoTooltip'
import { useBoardDateRange } from '../../hooks/useBoardDateRange'
import { filterOrdersByBoardRange, type BoardDatePreset } from '../../utils/boardDateRange'

interface SectionCardProps {
  id?: string
  title: string
  description?: string
  metricKey?: string
  orders?: Order[]
  defaultBoardPreset?: BoardDatePreset
  enableBoardDateFilter?: boolean
  children: ReactNode | ((filteredOrders: Order[]) => ReactNode)
}

export function SectionCard({
  id,
  title,
  description,
  metricKey,
  orders,
  defaultBoardPreset = '30d',
  enableBoardDateFilter = false,
  children,
}: SectionCardProps) {
  const board = useBoardDateRange(defaultBoardPreset)
  const filteredOrders = useMemo(() => {
    if (!enableBoardDateFilter || !orders) return orders ?? []
    return filterOrdersByBoardRange(orders, board.range)
  }, [enableBoardDateFilter, orders, board.range])

  const content =
    typeof children === 'function' ? children(filteredOrders ?? []) : children

  return (
    <section id={id} className="rounded-card border border-kiddo-border bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="inline-flex items-center gap-1.5 text-base font-semibold text-slate-900">
            {title}
            {metricKey ? <InfoTooltipByKey metricKey={metricKey} /> : null}
          </h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {enableBoardDateFilter && orders ? (
          <BoardDateFilter
            value={board.range}
            onChange={board.setRange}
            onPreset={board.setPreset}
            onCustom={board.setCustom}
          />
        ) : null}
      </div>
      {content}
    </section>
  )
}
