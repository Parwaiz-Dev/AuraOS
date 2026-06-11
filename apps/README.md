# apps/ — Sub-Applications

This folder is reserved for standalone sub-applications that are separate
from the main staff portal (`/client`).

## Current Structure

```
apps/
├── README.md               ← You are here
└── (future apps below)
```

## Planned Apps

### customer-app/ (Future — React Native / PWA)
A dedicated mobile ordering app for customers.
Currently the customer ordering experience lives at `/client` as a web page
(`/customer?slug=demo-kitchen`). When you're ready to build a native app:

```
apps/customer-app/
├── package.json
├── src/
│   ├── screens/
│   │   ├── MenuScreen.tsx
│   │   ├── CartScreen.tsx
│   │   └── OrderConfirmScreen.tsx
│   └── api/
│       └── publicApi.ts    ← calls /api/v1/public/* (no auth)
└── README.md
```

### kiosk-app/ (Future — Electron / Kiosk browser)
A full-screen kiosk ordering terminal for self-service counters.

```
apps/kiosk-app/
├── package.json
└── src/
```

### kitchen-display/ (Future — Dedicated KDS app)
A standalone Kitchen Display System app optimized for kitchen screens.
Currently lives at `/client` as `/kitchen` route.

## Current Web Apps

| App | Location | URL | Purpose | PWA? |
|-----|----------|-----|---------|------|
| Staff Portal | `/client` | http://localhost:3001 | POS, orders, kitchen, admin | ✅ Installable |
| Customer Ordering | `/client/src/pages/CustomerApp.tsx` | /customer?slug=demo-kitchen | QR ordering | ✅ Works on mobile |
| Kitchen Display | `/client/src/pages/Kitchen.tsx` | /kitchen | KDS screen | ✅ Full-screen |

## API
All apps share the same backend at `/src`. Public endpoints (no auth) are at
`/api/v1/public/*` — safe to call from any customer-facing app.
