import type { DistanceBand, Order } from '../api/types'
import { NOIDA_PINCODE_COORDS } from './pincodeCoords'

export const DARK_STORE = { lat: 28.539868, lng: 77.371612 }

export const DISTANCE_BANDS: DistanceBand[] = [
  '0-5km',
  '5-10km',
  '10-15km',
  '15-20km',
  '20km+',
  'unknown',
]

export type LocationSource = 'coordinates' | 'pincode' | 'unknown'

function parseCoord(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(value)
  return Number.isFinite(n) && n !== 0 ? n : null
}

export function getCoordinates(order: Order): { lat: number; lng: number } | null {
  const addr = order.shipping_address
  if (!addr) return null

  const lat = parseCoord(addr.latitude)
  const lng = parseCoord(addr.longitude)
  if (lat != null && lng != null) {
    return { lat, lng }
  }

  const zip = addr.zip?.replace(/\s/g, '') ?? ''
  if (zip && NOIDA_PINCODE_COORDS[zip]) {
    return NOIDA_PINCODE_COORDS[zip]
  }
  return null
}

export function getLocationSource(order: Order): LocationSource {
  const addr = order.shipping_address
  if (!addr) return 'unknown'
  const lat = parseCoord(addr.latitude)
  const lng = parseCoord(addr.longitude)
  if (lat != null && lng != null) return 'coordinates'
  const zip = addr.zip?.replace(/\s/g, '') ?? ''
  if (zip && NOIDA_PINCODE_COORDS[zip]) return 'pincode'
  return 'unknown'
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getDistanceKm(order: Order): number | null {
  const coords = getCoordinates(order)
  if (!coords) return null
  return haversineKm(DARK_STORE.lat, DARK_STORE.lng, coords.lat, coords.lng)
}

export function getDistanceBand(order: Order): DistanceBand {
  const km = getDistanceKm(order)
  if (km == null) return 'unknown'
  if (km <= 5) return '0-5km'
  if (km <= 10) return '5-10km'
  if (km <= 15) return '10-15km'
  if (km <= 20) return '15-20km'
  return '20km+'
}
