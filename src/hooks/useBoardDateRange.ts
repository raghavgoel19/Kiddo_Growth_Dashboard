import { useMemo, useState } from 'react'
import type { Order } from '../api/types'
import {
  boardPresetRange,
  boardRangeFromCustom,
  boardRangeLabel,
  defaultBoardRange,
  filterOrdersByBoardRange,
  isBoardPresetActive,
  type BoardDatePreset,
  type BoardDateRange,
} from '../utils/boardDateRange'

export function useBoardDateRange(defaultPreset: BoardDatePreset = '30d') {
  const [range, setRange] = useState<BoardDateRange>(() => defaultBoardRange(defaultPreset))

  return {
    range,
    setRange,
    setPreset: (preset: BoardDatePreset) => setRange(boardPresetRange(preset)),
    setCustom: (from: string, to: string) => setRange(boardRangeFromCustom(from, to)),
    label: boardRangeLabel(range),
    isPresetActive: (preset: BoardDatePreset) => isBoardPresetActive(range, preset),
  }
}

export function useBoardFilteredOrders(orders: Order[], defaultPreset: BoardDatePreset = '30d') {
  const board = useBoardDateRange(defaultPreset)
  const filtered = useMemo(
    () => filterOrdersByBoardRange(orders, board.range),
    [orders, board.range]
  )
  return { ...board, filteredOrders: filtered }
}
