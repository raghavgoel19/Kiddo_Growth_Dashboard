/** Strip Shopify bloat before sending to the browser (~52MB → ~8MB). Full data stays on disk. */

function trimLineItem(item) {
  return {
    product_id: item.product_id,
    product_title: item.product_title,
    title: item.title,
    quantity: item.quantity,
    price: item.price,
    properties: item.properties,
  }
}

export function trimOrder(order) {
  return {
    id: order.id,
    name: order.name,
    order_number: order.order_number,
    created_at: order.created_at,
    total_price: order.total_price,
    subtotal_price: order.subtotal_price,
    financial_status: order.financial_status,
    fulfillment_status: order.fulfillment_status,
    cancelled_at: order.cancelled_at,
    source_name: order.source_name,
    source_identifier: order.source_identifier,
    discount_codes: order.discount_codes,
    customer: order.customer
      ? {
          id: order.customer.id,
          email: order.customer.email,
          first_name: order.customer.first_name,
          last_name: order.customer.last_name,
          phone: order.customer.phone,
          orders_count: order.customer.orders_count,
          total_spent: order.customer.total_spent,
          created_at: order.customer.created_at,
          tags: order.customer.tags,
        }
      : null,
    shipping_address: order.shipping_address
      ? {
          city: order.shipping_address.city,
          latitude: order.shipping_address.latitude,
          longitude: order.shipping_address.longitude,
          zip: order.shipping_address.zip,
          province: order.shipping_address.province,
          country: order.shipping_address.country,
        }
      : null,
    line_items: (order.line_items ?? []).map(trimLineItem),
  }
}

export function trimCustomer(customer) {
  return {
    id: customer.id,
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    orders_count: customer.orders_count,
    total_spent: customer.total_spent,
    created_at: customer.created_at,
    tags: customer.tags,
  }
}

export function trimProduct(product) {
  return {
    id: product.id,
    title: product.title,
    tags: product.tags,
  }
}

export function trimDashboardForClient(data) {
  return {
    orders: (data.orders ?? []).map(trimOrder),
    customers: (data.customers ?? []).map(trimCustomer),
    products: (data.products ?? []).map(trimProduct),
    customerCount: data.customerCount ?? 0,
  }
}
