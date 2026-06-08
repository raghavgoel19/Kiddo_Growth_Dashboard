import { getHours, getDay } from 'date-fns'
import { toZonedTime } from 'date-fns-tz'
import type { DistanceBand, Order, ProductTagsMap } from '../api/types'
import { getOrderChannel } from './channel'
import { getDistanceBand, getDistanceKm } from './geography'
import { parseMoney } from './formatters'
import { classifyOrder, getL2ForOrder } from './taxonomy'
import { IST } from './dates'

export type OrderValueBucket = 'under500' | '500-1k' | '1k-2k' | '2k-5k' | '5k+'
export type TimeSlot = 'early-morning' | 'morning' | 'afternoon' | 'evening' | 'night'

export interface FirstOrderDNA {
  l1Categories: string[]
  l2Categories: string[]
  specificProducts: string[]
  itemCount: number
  orderValue: number
  orderValueBucket: OrderValueBucket
  usedDiscount: boolean
  discountDepth: number
  hourOfDay: number
  dayOfWeek: number
  isWeekend: boolean
  timeSlot: TimeSlot
  channel: 'app' | 'website'
  distanceBand: DistanceBand
  distanceKm: number | null
  isNewParentSignal: boolean
  isGiftSignal: boolean
  isPureEssentials: boolean
  isPureLifestyle: boolean
  isMixedBasket: boolean
}

const NEW_PARENT_L2 = [
  'Diapering',
  'Baby Food & Formula',
  'Feeding & Nursing',
  'New Sensory Books',
  'New Onsies & Rompers',
  'Safety & Health',
]

const GIFT_L2 = [
  'Soft & Plush Toys',
  'Board Games',
  'Dolls',
  'New Picture Books (Story-based)',
  'Action Figues and Guns',
  'Cars and Vehicles',
]

export function getOrderL2Categories(order: Order, productTagsMap: ProductTagsMap): string[] {
  return getL2ForOrder(order, productTagsMap)
}

function valueBucket(value: number): OrderValueBucket {
  if (value < 500) return 'under500'
  if (value < 1000) return '500-1k'
  if (value < 2000) return '1k-2k'
  if (value < 5000) return '2k-5k'
  return '5k+'
}

function timeSlotFromHour(hour: number): TimeSlot {
  if (hour >= 5 && hour < 9) return 'early-morning'
  if (hour >= 9 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 21) return 'evening'
  return 'night'
}

export function computeFirstOrderDNA(firstOrder: Order, productTagsMap: ProductTagsMap): FirstOrderDNA {
  const orderDateIST = toZonedTime(new Date(firstOrder.created_at), IST)
  const hour = getHours(orderDateIST)
  const dow = getDay(orderDateIST)
  const isWeekend = dow === 0 || dow === 6

  const l1Categories = classifyOrder(firstOrder, productTagsMap)
  const l2Categories = getL2ForOrder(firstOrder, productTagsMap)
  const l1Set = new Set(l1Categories)

  const value = parseMoney(firstOrder.total_price)
  const subtotal = parseMoney(firstOrder.subtotal_price ?? firstOrder.total_price)
  const discountAmount = Math.max(0, subtotal - value)
  const usedDiscount = (firstOrder.discount_codes?.length ?? 0) > 0 || discountAmount > 0
  const discountDepth = value + discountAmount > 0 ? (discountAmount / (value + discountAmount)) * 100 : 0

  const itemCount = (firstOrder.line_items ?? []).reduce((sum, li) => sum + (li.quantity ?? 0), 0)
  const specificProducts = (firstOrder.line_items ?? [])
    .map((li) => String(li.product_id ?? ''))
    .filter(Boolean)

  const hasEssentials = l1Set.has('Essentials')
  const isPureEssentials = l1Categories.length > 0 && l1Categories.every((l1) => l1 === 'Essentials')
  const isPureLifestyle = l1Categories.length > 0 && !hasEssentials
  const isMixedBasket = hasEssentials && l1Categories.length > 1

  return {
    l1Categories,
    l2Categories,
    specificProducts,
    itemCount,
    orderValue: value,
    orderValueBucket: valueBucket(value),
    usedDiscount,
    discountDepth,
    hourOfDay: hour,
    dayOfWeek: (dow + 6) % 7,
    isWeekend,
    timeSlot: timeSlotFromHour(hour),
    channel: getOrderChannel(firstOrder),
    distanceBand: getDistanceBand(firstOrder),
    distanceKm: getDistanceKm(firstOrder),
    isNewParentSignal: l2Categories.some((l2) => NEW_PARENT_L2.includes(l2)),
    isGiftSignal: l2Categories.length > 0 && l2Categories.every((l2) => GIFT_L2.includes(l2)),
    isPureEssentials,
    isPureLifestyle,
    isMixedBasket,
  }
}
