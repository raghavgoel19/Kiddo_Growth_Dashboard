import type { Order, Product, ProductTagsMap } from '../api/types'

export const L1_TAGS = [
  'fashion',
  'Essentials',
  'Gear & Furniture',
  "New & Expecting Mom's",
  'Toys',
  'School & Stationery',
  'Books',
] as const

export type L1Tag = (typeof L1_TAGS)[number]

export const L2_MAP: Record<L1Tag, string[]> = {
  fashion: [
    'New Top Wear',
    'New Bottom Wear',
    'New One-Piece/ Sets',
    'New Utility Summerwear',
    'New Onsies & Rompers',
    'New Footwear',
    'New Inner Wear',
    'New Occasion Tags',
    'New Towels & Swaddles',
    'New Swimwear',
  ],
  Essentials: [
    'Diapering',
    'Skincare & Bath',
    'Baby Food & Formula',
    'Feeding & Nursing',
    'Safety & Health',
  ],
  'Gear & Furniture': [
    'Baby Gear',
    'Nursery and Kids Room Furniture',
    'Ride Ons & Scooters',
  ],
  "New & Expecting Mom's": [
    'Maternity Wear & Bras',
    'Pregnancy & Postpartum Care',
    'Pumping & Feeding',
  ],
  Toys: [
    'Soft & Plush Toys',
    'Rattles',
    'Building Blocks & Puzzles',
    'Art, Craft and DIY',
    'Cars and Vehicles',
    'Action Figues and Guns',
    'Dolls',
    'Pretend Play',
    'Play Sets and tents',
    'Board Games',
    'Active Play - Slides, Jungle gyms, picklers, Indoor and Outdoor Play',
    'Musical Toys',
    'Sports and Games',
    'Pillow, Milestone Based',
    'Educational Toys and STEM',
  ],
  'School & Stationery': [
    'School Bags',
    'Lunch Boxes',
    'Water Bottles',
    'Study Sets',
    'Stationery',
    'Art and Craft',
    'Kids Utensils & Containers',
    'Pouches & Pencil Boxes',
  ],
  Books: [
    'New Sensory Books',
    'New Interactive Books',
    'New First Learning / Concept Books',
    'New Picture Books (Story-based)',
    'New Rhymes & Read-Aloud Books',
    'New Activity Books / Educational Workbooks',
    'New Phonics & Early Readers',
    'New Storybooks',
  ],
}

function parseTags(tags: string | string[] | undefined): string[] {
  if (!tags) return []
  if (Array.isArray(tags)) return tags
  return tags.split(',').map((t) => t.trim()).filter(Boolean)
}

export function buildProductTagsMap(products: Product[]): ProductTagsMap {
  const map: ProductTagsMap = {}
  for (const product of products) {
    map[String(product.id)] = parseTags(product.tags)
  }
  return map
}

export function classifyOrder(order: Order, productTagsMap: ProductTagsMap): L1Tag[] {
  const categories = new Set<L1Tag>()
  for (const item of order.line_items ?? []) {
    const tags = productTagsMap[String(item.product_id ?? '')] ?? []
    for (const tag of tags) {
      if ((L1_TAGS as readonly string[]).includes(tag)) {
        categories.add(tag as L1Tag)
      }
    }
  }
  return Array.from(categories)
}

export function classifyOrderPrimary(
  order: Order,
  productTagsMap: ProductTagsMap
): L1Tag | 'Uncategorized' {
  const cats = classifyOrder(order, productTagsMap)
  return cats[0] ?? 'Uncategorized'
}

export function isEssential(order: Order, productTagsMap: ProductTagsMap): boolean {
  return classifyOrder(order, productTagsMap).includes('Essentials')
}

export function isNonEssential(order: Order, productTagsMap: ProductTagsMap): boolean {
  return !isEssential(order, productTagsMap)
}

export function getL2ForOrder(
  order: Order,
  productTagsMap: ProductTagsMap
): string[] {
  const l2Tags = new Set<string>()
  for (const item of order.line_items ?? []) {
    const tags = productTagsMap[String(item.product_id ?? '')] ?? []
    for (const tag of tags) {
      for (const l1 of L1_TAGS) {
        if (L2_MAP[l1].includes(tag)) l2Tags.add(tag)
      }
    }
  }
  return Array.from(l2Tags)
}
