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

## Deploying to Vercel

The frontend is static; **API routes live in `/api`** as Vercel serverless functions (they call Shopify using env vars).

1. Push to GitHub and connect the repo in Vercel
2. In **Project → Settings → Environment Variables**, add:
   - `SHOPIFY_ACCESS_TOKEN` — Admin API token (`read_orders`, `read_customers`, `read_products`)
   - `SHOPIFY_SHOP_DOMAIN` — e.g. `your-store.myshopify.com`
3. Deploy — `vercel.json` builds the Vite app and serves `/api/sync/*` endpoints

After deploy, verify: `https://your-app.vercel.app/api/health` should return `{ "ok": true, "configured": true }`.

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
