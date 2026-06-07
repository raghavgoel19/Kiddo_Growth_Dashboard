# Kiddo Analytics Dashboard

Multi-tab analytics for [allforkiddo.com](https://allforkiddo.com) — kids quick commerce, Noida.

## Dashboards

| Route | Dashboard |
|---|---|
| `/` | **Daily pulse** — today's KPIs vs yesterday & same day last week |
| `/full` | **Full analytics** — 7 tabs (Summary, Orders, Users, Products, Geography, Channel, Growth) |

## Setup

```bash
cp server/.env.example server/.env
# Add SHOPIFY_ACCESS_TOKEN (read_orders, read_customers, read_products)

npm install && cd server && npm install && cd ..
npm run dev
```

- Daily: http://localhost:5173/
- Full: http://localhost:5173/full

## Data & caching

Uses **Shopify Admin REST API** (not MCP — hosted MCP only works inside Cursor).

Three-layer cache for instant loads:
1. Browser IndexedDB
2. Server disk (`server/.cache/dashboard.json`)
3. Server memory (6h TTL, background refresh)

Click **Sync from Shopify** to force a fresh pull (~1–2 min first time).

## Features

- L1/L2 product taxonomy via Shopify product tags
- App vs Website channel detection (`line_item.properties.source`)
- Distance bands from dark store (Sector 104, Noida)
- IST timezone throughout
- Internal account filter (`@kiddo.app`, `@allforkiddo.com`)
