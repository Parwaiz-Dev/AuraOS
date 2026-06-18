# Restaurant Growth Platform — Phase 0 + 1 Design

> **Product thesis: "Shopify for Restaurants"** — every restaurant gets a website,
> ordering, booking, loyalty, delivery, multi-branch, custom domain — one codebase.
> Built on the existing AuraOS Core. Status: **design for approval** — no code written yet.

## 0. Decisions locked

| Decision | Choice | Why |
|---|---|---|
| Tenant isolation | **Postgres RLS** (+ keep app-layer scoping) | Public surface; a forgotten `WHERE` must not leak tenants |
| Customer identity | **Phone + OTP accounts** (separate from staff `users`) | Standard for India food ordering; unblocks loyalty/favorites/history/reviews |
| First slice | **Website + Menu + Ordering** (Phase 0→2) | Demoable revenue core; defer booking/loyalty/custom-domains |
| Edge proxy / TLS | **Caddy** (on-demand per-tenant TLS) | Production-grade automatic HTTPS for unlimited custom domains |
| Image/object storage | **Cloudflare R2** (S3-compatible) | Logo/hero/gallery uploads; CDN-fronted |
| Multi-branch | **Reuse `organization_groups`** (migration 020) | Each branch = own tenant; grouped under one owner. Already modeled. |
| Delivery model | **Named zones** (locality/pincode → fee), distance optional | More practical than pure radius for Indian delivery |

## 1. Target architecture

```
                         Caddy  (edge: TLS, host-aware)
                        /                              \
        Next.js Website + Ordering (NEW)        Vite POS (existing, /admin)
        public, SSR/ISR, host->tenant           owner/staff, behind login
                        \                              /
                         AuraOS Core API (Express + TS, EXTENDED)
                         - host->tenant middleware (NEW)
                         - /public/site/* routes (NEW)
                         - reuse menu/orders/payments/sockets
                              |                    |
                         PostgreSQL (+RLS)       Redis (NEW)
                                                 - socket.io adapter
                                                 - tenant-config cache
                                                 - OTP store, rate limits
                              |
                         FastAPI Analytics (Phase 5 — stub only)
```

**Principle:** Core stays one TypeScript service — single source of truth for tenants, menu, orders, payments. The "website service" is a **new Next.js frontend + new Core routes/tables**, NOT a second backend.

## 2. What we reuse vs. build

**Reuse (already in repo):** `restaurants`/`slug` tenancy, JWT auth, `menu_*` + modifiers, `orders` + status lifecycle, `eventBroadcaster` (Socket.io), Razorpay (end-to-end, signature-verified in `public.routes.ts`), `qr_mode` ordering, subscriptions/plans (₹999/₹1999/Enterprise), `features` JSONB + `checkSubscription`.

**Build (Phase 0–2):** host→tenant middleware, Redis, RLS, branding fields + themes/gallery/hours tables, customer accounts (phone-OTP), Next.js website (Home/About/Gallery/Menu/Contact/Hours), cart + delivery address + live order tracking on the website, plan→feature gating wired to website visibility.

**Deferred (later phases):** reservations, delivery zones/fees + distance calc, coupons, loyalty, reviews, favorites, custom domains + on-demand TLS, FastAPI analytics.

## 3. Phase 0 — Foundations

### 3.1 Host → tenant resolution (NEW middleware)
- `resolveTenant` middleware reads `Host` header:
  - `*.auraos.com` → subdomain is the restaurant `slug`.
  - bare custom domain → lookup in `custom_domains` table (table created now, populated later phase).
- Resolves to `{ restaurantId, slug }`, attaches to `req`. 404 if unknown host.
- **Cached in Redis** (host→tenant config) — this runs on every public request.
- Next.js has its own `middleware.ts` mirroring this for SSR/routing; Core remains authoritative.

### 3.2 RLS (production-grade isolation)
- Add RLS policies on every tenant table keyed on `restaurant_id = current_setting('app.restaurant_id')::uuid`.
- **Connection wiring is the real work.** Current `src/config/database.ts` is a single shared pool with a global `query()` — unsafe for per-request `SET`. Plan:
  - Add a `withTenant(restaurantId, fn)` helper: checks out a client, runs `SET LOCAL app.restaurant_id = $1` inside a transaction, passes a scoped query fn.
  - Public/customer paths use `withTenant`. A `BYPASSRLS` role remains for migrations, super-admin cross-tenant endpoints, and webhooks.
  - Existing app-layer `WHERE restaurant_id` stays as defense-in-depth.
- Migration adds policies incrementally; verified with a cross-tenant read test (must return zero rows).

### 3.3 Redis (NEW)
- Socket.io Redis adapter (multi-instance sticky-free scaling).
- Tenant-config-by-host cache, OTP storage (TTL), website rate limiting.
- Added as a Docker service.

### 3.4 Branding + content schema (NEW migrations)
- Extend `restaurants`: `logo_url`, `hero_image_url`, `address`, `phone`, `whatsapp`, `email`, `social_links` (JSONB), `lat`, `lng`, `map_embed`.
- `restaurant_themes` — colors, fonts (1:1 with restaurant).
- `gallery_images` — `restaurant_id`, `url`, `category` (food/interior/event), `sort_order`.
- `opening_hours` — `restaurant_id`, `day_of_week`, `open_time`, `close_time`, `is_closed`.
- `website_pages` — `restaurant_id`, `page_key` (about/home), JSONB content.
- `custom_domains` — `restaurant_id`, `domain`, `verified`, `ssl_status` (created now, used later).
- `customers` — `phone` (unique), `name`, `created_at`; `customer_addresses` — `customer_id`, `restaurant_id`, address fields, `lat`, `lng`.
- All carry `restaurant_id` + RLS (except global `customers`).

### 3.5 Plan → feature entitlement
- Map plan (Basic/Premium/Enterprise) → `features` JSONB flags.
- Website reads features via a public config endpoint; gates which pages/actions render.

## 4. Phase 1 — Public website (read + branding + builder)

- **Next.js** (App Router, TS, Tailwind, React Query) new app at `apps/website`.
- `middleware.ts` resolves tenant from host; per-tenant theming via CSS variables from `restaurant_themes`.
- **Website Builder (owner-editable, JSONB-driven):** logo, hero section, about us, gallery,
  featured dishes, testimonials, social links, opening hours, theme colors — each a configurable
  section so every site feels unique with no code. Stored in `website_pages` (section blocks) +
  `restaurant_themes` + branding fields.
- Pages: **Home** (hero, featured dishes, testimonials, offers, CTA), **About**, **Gallery**,
  **Menu** (reuses `/public/menu/:slug`), **Contact** (phone/WhatsApp/email/socials/Maps),
  **Opening Hours**.
- **SEO (Phase 1 requirement):** dynamic meta title/description, Open Graph tags, `LocalBusiness`
  JSON-LD structured data, per-tenant sitemap + robots. Helps each restaurant rank on Google.
- **PWA (Phase 1 requirement):** installable per-tenant app (manifest + service worker), offline
  menu shell. Customers install `loca.com` without an app store.
- **ISR:** pages statically generated per tenant, revalidated on owner edits.
- New Core routes: `GET /public/site/:slug/config`, `/gallery`, `/page/:key`.

## 5. Phase 2 — Online ordering on the website

- Cart UI (quantity, modifiers, notes) — pricing/modifier logic reuses existing order endpoint.
- Customer phone-OTP login (OTP via Redis + SMS provider; provider choice TBD).
- Delivery address capture (`customer_addresses`).
- Checkout → existing `/public/order/:slug` + Razorpay (already wired) or COD.
- **Live order tracking** via Socket.io: Placed→Accepted→Preparing→Ready→Out for Delivery→Delivered (add `OUT_FOR_DELIVERY` to status enum).
- Orders land in existing kitchen pipeline + dashboard — no new order backend.

## 6. Owner dashboard (extend existing Vite POS — not the website)
- New settings screens: branding/colors/logo, gallery upload, hours, website page content, (later) zones/coupons.
- Reuses existing dashboard auth + layout patterns. "No coding required" editing lives here.

## 7. Full feature roadmap (all 12 features → phases)

| # | Feature | Phase | Notes |
|---|---|---|---|
| 1 | Website Builder (sections) | **1** | JSONB-driven; owner edits in dashboard |
| 9 | SEO (meta/OG/sitemap/JSON-LD) | **1** | Native to Next.js; cheap early, costly to retrofit |
| 10 | PWA (installable per tenant) | **1** | Manifest + service worker |
| 8 | Customer Accounts (phone OTP) | **2** | Unblocks loyalty/favorites/history/reviews |
| — | Online ordering + live tracking | **2** | Reuses orders + Razorpay + sockets |
| 7 | Multi-Branch | **3** | **Already modeled** (`organization_groups`, mig 020) |
| — | Table booking / reservations | **3** | New module; statuses pending→confirmed→completed→cancelled |
| 2 | Delivery Zones (named, not radius) | **3** | locality/pincode → fee; distance optional fallback |
| 5 | WhatsApp notifications | **4** | Order/booking events; WhatsApp already wired |
| 12 | Notifications Service | **4** | Start as Core module → extract to own service at volume |
| 4 | Coupons | **4** | Depends on customer accounts |
| 3 | Loyalty (₹1000→100pts→₹100) | **4** | Depends on customer accounts |
| 6 | Reviews (rating/text/photos) | **4** | Depends on customer accounts |
| — | Custom domains + on-demand TLS | **4** | Caddy; `custom_domains` stubbed in Phase 0 |
| 11 | FastAPI Analytics (forecasting, AI recs, wait time) | **5** | Stub contract now; build when order data exists |

**Dependency rule:** Loyalty, Coupons, Reviews, Favorites all require Customer Accounts (Phase 2) first.
Analytics requires real order history — building ML on zero data is wasted effort.

## 8. Risks
| Risk | Mitigation |
|---|---|
| RLS + shared pool misuse | `withTenant` transaction helper; cross-tenant read test in CI |
| Two frontends to maintain | Different products (SEO site vs POS); shared Core API, no logic dup |
| Image hosting/uploads | Decide storage (S3-compatible) during Phase 0; gallery/logo need it |
| SMS/OTP provider + cost | Pick provider in Phase 2; rate-limit OTP via Redis |
| ISR cache invalidation on edit | Owner save triggers on-demand revalidation of that tenant's pages |

## 9. Open items to confirm during build
- ~~Image/object storage~~ → **Cloudflare R2** (locked).
- ~~Next.js app location~~ → **`apps/website`** (locked, beside `apps/waiter`).
- SMS/OTP provider for customer login (Phase 2) — e.g. MSG91/Twilio; pick before Phase 2.
- Whether website deploys in same compose as Core or separately (recommend same compose initially).

## 10. Acceptance — first slice
- [ ] `pizzahouse.auraos.com` and `loca.auraos.com` serve distinct, themed, SEO-able sites from one codebase.
- [ ] Cross-tenant DB read returns zero rows (RLS verified).
- [ ] Menu renders from existing public API with modifiers.
- [ ] Customer logs in via phone OTP, orders, pays (Razorpay/COD), sees live status to delivery.
- [ ] Plan tier controls which website features appear.
- [ ] Owner edits branding/hours/gallery in dashboard; site updates via ISR.
