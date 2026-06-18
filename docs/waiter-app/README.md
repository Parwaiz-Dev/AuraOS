# AuraOS Waiter App — Integration Documentation

> **Audience:** the team/AI agent building the **React Native + Expo + TypeScript Waiter Mobile App**.
> **Scope:** everything needed to build the app against the **existing AuraOS backend** without backend source access.
> **Status:** derived directly from the live backend code. Where the backend behaves in a non-obvious way, it is flagged with ⚠️.

---

## What this app is

A mobile app for **waiters** to: log in, view tables and their occupancy, browse the menu, create and append to orders, watch live kitchen/order status, generate bills, and record payments. It is a **client** of the AuraOS REST + Socket.IO API. It stores no data of its own beyond local cache.

## Document index

| # | Document | Covers |
|---|----------|--------|
| 1 | [`01-architecture.md`](./01-architecture.md) | System architecture, tenancy, roles, diagrams |
| 2 | [`02-authentication.md`](./02-authentication.md) | Login, JWT, refresh, headers |
| 3 | [`03-api-reference.md`](./03-api-reference.md) | Every endpoint waiters use, with JSON |
| 4 | [`04-socketio-events.md`](./04-socketio-events.md) | Connection, rooms, events, payloads |
| 5 | [`05-waiter-journey.md`](./05-waiter-journey.md) | End-to-end user journey |
| 6 | [`06-screen-specs.md`](./06-screen-specs.md) | Per-screen specifications |
| 7 | [`07-database-concepts.md`](./07-database-concepts.md) | Entities & relationships (conceptual) |
| 8 | [`08-role-permissions.md`](./08-role-permissions.md) | Waiter allowed/denied matrix |
| 9 | [`09-error-handling.md`](./09-error-handling.md) | Error envelope, codes, handling |
| 10 | [`10-offline-support.md`](./10-offline-support.md) | Cache, retry queue, sync, reconnect |
| 11 | [`11-notifications.md`](./11-notifications.md) | In-app & push notification triggers |
| 12 | [`diagrams.md`](./diagrams.md) | Mermaid: sequence, state, screen-flow |
| — | [`openapi.yaml`](./openapi.yaml) | OpenAPI 3.0 spec (import to Swagger/codegen) |
| — | [`auraos-waiter.postman_collection.json`](./auraos-waiter.postman_collection.json) | Postman collection |

---

## Global API facts (read first — these apply everywhere)

**Base URL**
```
http://<host>:3000/api/v1
```
All endpoints below are relative to this base. In production this is reverse-proxied (Nginx) under your domain, still at path `/api/v1`.

**Standard response envelope** — *every* JSON response uses this shape:

```jsonc
// success
{
  "success": true,
  "data": { /* endpoint-specific */ },
  "meta": { "timestamp": "2026-06-18T10:00:00.000Z", "message": "optional" }
}

// error
{
  "success": false,
  "error": { "code": "UnauthorizedError", "message": "Invalid token", "details": null },
  "meta": { "timestamp": "2026-06-18T10:00:00.000Z" }
}
```

> ⚠️ Always read `data` on success and `error.code` / `error.message` on failure. Never assume the payload is the top-level object.

**Auth header** — every protected endpoint needs:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

**Money & numbers** — amounts are plain numbers (₹, 2-dp). `total_amount`, `price`, `amount` may arrive as numeric strings from PostgreSQL in some payloads; coerce with `Number(...)` defensively.

**IDs** — all entity IDs are UUID v4 strings.

**Tech the backend uses:** Node.js + Express + TypeScript, PostgreSQL 15, Socket.IO 4, JWT (HS256). Payments via Razorpay (online) or recorded manually (cash/card/UPI).
