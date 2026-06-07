import type { Order } from '../api/types'

export type OrderChannel = 'app' | 'website'

/** All non-website orders are treated as App (business rule). */
export function getOrderChannel(order: Order): OrderChannel {
  const channelName =
    (order as Order & { channelInformation?: { channelDefinition?: { channelName?: string } } })
      .channelInformation?.channelDefinition?.channelName?.toLowerCase() ?? ''
  if (channelName.includes('web') || channelName.includes('online store')) return 'website'
  if (channelName.includes('app')) return 'app'

  for (const item of order.line_items ?? []) {
    for (const prop of item.properties ?? []) {
      if (prop.name?.toLowerCase() === 'source') {
        const val = prop.value?.toLowerCase() ?? ''
        if (val.includes('web') || val.includes('website')) return 'website'
        if (val.includes('app')) return 'app'
      }
    }
  }

  const src = (
    order.source_identifier ??
    order.source_name ??
    (order as Order & { sourceIdentifier?: string }).sourceIdentifier ??
    ''
  ).toLowerCase()

  if (src.includes('web') || src === 'online_store' || src.includes('online store')) {
    return 'website'
  }
  if (src.includes('app') || src === 'android' || src === 'ios') {
    return 'app'
  }

  return 'app'
}

export function getOrderChannelLabel(channel: OrderChannel): string {
  return channel === 'website' ? 'Website' : 'App'
}
