import { memo } from 'react'
import type { Order, ProductTagsMap } from '../../api/types'
import { RepeatProbabilitySection } from './RepeatProbabilitySection'
import { TimeToValueSection } from './TimeToValueSection'

interface InterventionTimingPanelProps {
  orders: Order[]
  productTagsMap: ProductTagsMap
}

export const InterventionTimingPanel = memo(function InterventionTimingPanel({
  orders,
  productTagsMap,
}: InterventionTimingPanelProps) {
  return (
    <div className="space-y-6">
      <TimeToValueSection orders={orders} productTagsMap={productTagsMap} />
      <RepeatProbabilitySection orders={orders} productTagsMap={productTagsMap} />
    </div>
  )
})
