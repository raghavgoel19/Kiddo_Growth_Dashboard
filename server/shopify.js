const API_VERSION = '2024-10'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getConfig() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN
  const token = process.env.SHOPIFY_ACCESS_TOKEN
  if (!shop || !token) {
    throw new Error(
      'Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ACCESS_TOKEN in server/.env'
    )
  }
  return { shop, token, base: `https://${shop}/admin/api/${API_VERSION}` }
}

function getNextUrl(linkHeader) {
  if (!linkHeader) return null
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/)
  return match ? match[1] : null
}

async function shopifyFetch(url, token) {
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': token,
      'Content-Type': 'application/json',
    },
  })
  if (res.status === 401) throw new Error('Shopify API 401: Invalid access token')
  if (res.status === 403) {
    throw new Error(
      'Shopify API 403: Token lacks scopes (read_orders, read_customers, read_products)'
    )
  }
  if (!res.ok) throw new Error(`Shopify API error: ${res.status}`)
  return res
}

async function paginate(url, token, key) {
  const all = []
  while (url) {
    const res = await shopifyFetch(url, token)
    const data = await res.json()
    all.push(...(data[key] ?? []))
    url = getNextUrl(res.headers.get('Link'))
    if (url) await sleep(500)
  }
  return all
}

export async function fetchAllOrders() {
  const { token, base } = getConfig()
  // Full order payload — no fields filter, so line_items.properties, shipping lat/lng, etc. stay intact.
  const url = `${base}/orders.json?status=any&limit=250`
  return paginate(url, token, 'orders')
}

export async function fetchOrdersPage(createdAtMin, nextUrl = null) {
  const { token, base } = getConfig()
  const url =
    nextUrl ??
    `${base}/orders.json?status=any&limit=250&order=created_at+asc&created_at_min=${encodeURIComponent(createdAtMin)}`
  const res = await shopifyFetch(url, token)
  const data = await res.json()
  return {
    orders: data.orders ?? [],
    nextPageUrl: getNextUrl(res.headers.get('Link')),
  }
}

export async function fetchProductsPage(nextUrl = null) {
  const { token, base } = getConfig()
  const url = nextUrl ?? `${base}/products.json?limit=250&fields=id,tags,title`
  const res = await shopifyFetch(url, token)
  const data = await res.json()
  return {
    products: data.products ?? [],
    nextPageUrl: getNextUrl(res.headers.get('Link')),
  }
}

export async function fetchAllCustomers() {
  const { token, base } = getConfig()
  const fields = 'id,first_name,last_name,email,phone,orders_count,total_spent,created_at,tags'
  const url = `${base}/customers.json?limit=250&fields=${fields}`
  return paginate(url, token, 'customers')
}

export async function fetchAllProducts() {
  const { token, base } = getConfig()
  const url = `${base}/products.json?limit=250&fields=id,tags,title`
  return paginate(url, token, 'products')
}

export async function fetchCustomerCount() {
  const { token, base } = getConfig()
  const res = await shopifyFetch(`${base}/customers/count.json`, token)
  const data = await res.json()
  return data.count ?? 0
}

export function isConfigured() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN?.trim()
  const token = process.env.SHOPIFY_ACCESS_TOKEN?.trim()
  return !!(shop && token && token !== 'shpat_your_admin_api_token_here')
}
