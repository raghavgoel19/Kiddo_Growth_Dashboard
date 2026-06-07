import { useCallback } from 'react'
import type { Order } from '../api/types'
import { useDrillDown } from '../context/DashboardContext'

export interface ChartDrillDownParams {
  title: string
  subtitle: string
  orders: Order[]
  metricId?: string
}

export function useChartDrillDown() {
  const { openDrillDown } = useDrillDown()

  const drillFromChart = useCallback(
    (params: ChartDrillDownParams) => {
      openDrillDown({
        title: params.title,
        subtitle: params.subtitle,
        orders: params.orders,
      })
    },
    [openDrillDown]
  )

  return { drillFromChart, openDrillDown }
}
