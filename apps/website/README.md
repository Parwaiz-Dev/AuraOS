# AuraOS Website (`apps/website`)

Multi-tenant **public** restaurant website. One Next.js codebase serves every
restaurant's site, themed per tenant, resolved from the request Host header.

> This app is a **thin client over the existing AuraOS Core API**. It has no
> database and no business logic of its own. Core (Express + PostgreSQL + RLS)
> remains the single source of truth.

```
Next.js Website (this app)
        ↓  HTTP (public, read-only)
AuraOS Core API  (/api/v1/public/site/*)
        ↓
PostgreSQL + RLS
```

## How tenant resolution works

| Host | Resolves to |
|------|-------------|
| `pizza.auraos.com` | subdomain → restaurant slug `pizza` |
| `loca.com` | custom domain → resolved by Core via `custom_domains` |
| `localhost:3002` | `DEV_TENANT_SLUG` (development only) |

`src/middleware.ts` extracts the slug and forwards it as `x-tenant-slug`. Server
components read it (`currentSlug()`), fetch `/public/site/:slug/config` from Core,
and render the themed page. Theme colors are injected as CSS variables.

## Develop

```bash
cd apps/website
cp .env.example .env        # set DEV_TENANT_SLUG to a real restaurant slug
npm install
npm run dev                 # http://localhost:3002
```

Core must be running (default `http://localhost:3000/api/v1`).

## Status

Phase 0b foundation: tenant routing, theming, SEO metadata, home page (hero /
about / contact / hours). Phase 1 adds the full Website Builder sections,
gallery, menu, and PWA. Ordering and payments come later — not in this app yet.

## Image handling

All images (logo, hero, gallery, menu, QR) are referenced by **URL** pointing at
Cloudflare R2 / CDN. No image bytes are stored in PostgreSQL or this app.
