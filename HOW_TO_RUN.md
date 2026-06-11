# How to Run AuraOS — Complete Guide

This guide explains how to run **every part** of AuraOS: backend API, staff
portal, waiter app, kitchen display, customer QR ordering, WhatsApp/Zomato
integrations, background jobs, monitoring, and backups.

> **TL;DR** — open 3 terminals and run, in order:
> 1. `npm run dev` (project root) → backend on **:3000**
> 2. `npm run dev` (in `client/`) → staff portal on **:3001**
> 3. `npm run dev` (in `apps/waiter/`) → waiter app on **:3002**

---

## 1. Prerequisites (install once)

| Tool | Version | Check | Notes |
|---|---|---|---|
| Node.js | 18+ | `node -v` | Runtime for everything |
| npm | 9+ | `npm -v` | Comes with Node |
| PostgreSQL | 14+ | `psql --version` | Database. v16 already installed on this machine |
| pg_dump / pg_restore | matches server | `pg_dump --version` | For backups. Auto-discovered if not on PATH |

> Windows note: all commands below work in **PowerShell** or **CMD**. Use a
> separate terminal window/tab per long-running service.

---

## 2. First-time setup (do once)

### 2.1 Install dependencies for all three apps

```powershell
# Backend (project root)
npm install

# Staff portal
cd client
npm install
cd ..

# Waiter app
cd apps\waiter
npm install
cd ..\..
```

### 2.2 Create your `.env` file

```powershell
# From the project root — copy the template, then edit values
copy .env.example .env
```

Open `.env` and set at minimum:

```ini
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/auraos
JWT_SECRET=any_random_string_at_least_32_characters_long
JWT_REFRESH_SECRET=another_random_string_at_least_32_characters
```

Everything else (payments, WhatsApp, Zomato, email, Sentry) is **optional** and
can be left blank — the app runs in safe defaults (cash-only, console email,
console monitoring). See section 8 for enabling those later.

### 2.3 Create the database & run migrations

```powershell
# Create the database (if it doesn't exist yet)
#   psql -U postgres -c "CREATE DATABASE auraos;"

# Run all schema migrations + demo seed data
npm run migrate
```

After migration you'll have a demo restaurant and login:

```
Email:    admin@demo-kitchen.local
Password: demo123
```

> If you changed the admin password during testing, use that instead.

---

## 3. Running the services (every day)

You need **3 terminals**. Start them in this order so the frontends can reach
the backend.

### Terminal 1 — Backend API (port 3000)

```powershell
# From project root
 
 
```

This single command starts **everything server-side**:
- Express REST API → `http://localhost:3000/api/v1`
- Socket.io realtime (orders → kitchen) on the same port
- Background jobs (delay detector every 30s, inventory sync every 60s)
- Monitoring (console + in-memory)
- WhatsApp & Zomato webhook receivers

You'll see a startup banner ending in `✨ Ready` when it's up.

### Terminal 2 — Staff Portal (port 3001)

```powershell
cd client
npm run dev
```

Open **http://localhost:3001** and log in. This is the main admin/staff app:
Dashboard, Orders, Tables, Menu, Payments, Kitchen, Inventory, Users, Reports,
QR Settings, Zomato Settings.

### Terminal 3 — Waiter App / PWA (port 3002)

```powershell
cd apps\waiter
npm run dev
```

Open **http://localhost:3002**. This is the lightweight, installable waiter app
for taking orders table-side (works offline, syncs when back online).

---

## 4. All the URLs

| What | URL | Auth |
|---|---|---|
| Backend health (deep) | http://localhost:3000/api/v1/health | public |
| Backend API base | http://localhost:3000/api/v1 | varies |
| Staff Portal | http://localhost:3001 | login |
| Kitchen Display | http://localhost:3001/kitchen | login |
| Tables (command center) | http://localhost:3001/tables | login |
| QR Settings (generate QR) | http://localhost:3001/qr-settings | admin |
| Customer QR ordering | http://localhost:3001/customer?slug=demo-kitchen | public |
| Waiter App (PWA) | http://localhost:3002 | login |

> The customer ordering page is served by the **staff portal** (port 3001),
> not a separate app. Generate/scan QR codes from **QR Settings**.

---

## 5. Testing on your phone (same Wi-Fi)

Both frontends bind to `host: true`, so other devices on your network can reach
them. Find your PC's IP (`ipconfig` → IPv4 Address, e.g. `192.168.1.20`), then:

- Staff/Waiter: `http://192.168.1.20:3001` or `:3002`
- Install as an app: open in Chrome/Safari → menu → **Add to Home Screen**

> For the API to be reachable from the phone, the frontends proxy `/api` to the
> backend automatically — no extra config needed on the same machine. For a
> real deployment, serve over HTTPS (PWA install requires it).

---

## 6. Monitoring — how to check the system is healthy

Monitoring is **built in and always on** (no setup). See
`src/shared/monitoring/MONITORING.md` for full details.

```powershell
# Deep health (pings the database) — use this for uptime monitors
curl http://localhost:3000/api/v1/health

# Liveness (process up?) and readiness (DB reachable?)
curl http://localhost:3000/api/v1/health/live
curl http://localhost:3000/api/v1/health/ready
```

Admin-only metrics (need a login token):

```powershell
# Get a token, then call /metrics
$login = Invoke-RestMethod -Uri "http://localhost:3000/api/v1/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@demo-kitchen.local","password":"demo123"}'
$headers = @{ Authorization = "Bearer $($login.data.token)" }
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/metrics" -Headers $headers
Invoke-RestMethod -Uri "http://localhost:3000/api/v1/metrics/errors" -Headers $headers
```

To forward errors to **Sentry** in production: `npm install @sentry/node`, set
`SENTRY_DSN` in `.env`, restart. Nothing else changes.

---

## 7. Backups — how to run & schedule

Full guide: `scripts/BACKUPS.md`.

```powershell
# Create a compressed timestamped dump into ./backups
npm run backup

# Restore (dry run first — shows what it would do)
npm run restore -- backups\auraos-2026-05-31_02-00-00.dump
# Actually restore (DESTRUCTIVE — overwrites current DB)
npm run restore -- backups\auraos-2026-05-31_02-00-00.dump --yes
```

> `pg_dump`/`pg_restore` are auto-discovered (PostgreSQL 16 detected here). If
> not found, set `PG_BIN` in `.env`, e.g.
> `PG_BIN=C:\Program Files\PostgreSQL\16\bin`.

**Schedule daily** with Windows Task Scheduler (recommended) — step-by-step in
`scripts/BACKUPS.md`. Short version: create a Basic Task → Daily 2 AM → run
`cmd /c cd /d C:\Projects\AuraOS && npm run backup`.

---

## 8. Optional integrations — how to enable & test

All of these are **off by default** and don't block normal use.

### 8.1 Online payments (Razorpay / Stripe / Cashfree / PayU)
1. In `.env`, set `PAYMENT_GATEWAY=razorpay` (or another) and fill that
   gateway's keys.
2. Restart the backend.
3. Setup details and the webhook flow: `src/config/payments.ts`.
   Webhook receiver: `POST /api/v1/webhooks/payments`.

### 8.2 WhatsApp ordering (Meta WhatsApp Business API)
1. In `.env`, set `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`,
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`.
2. Expose your local backend to the internet for testing (e.g. `ngrok http 3000`).
3. In the Meta dashboard, set the webhook URL to:
   `https://YOUR_TUNNEL/api/v1/integrations/whatsapp/webhook`
   and the verify token to the same `WHATSAPP_VERIFY_TOKEN`.
   - Meta calls `GET /webhook` once to verify (challenge handshake).
   - Incoming messages arrive at `POST /webhook` (HMAC-signature verified).
4. Check integration stats (logged in):
   `GET /api/v1/integrations/whatsapp/sync-status`

### 8.3 Zomato orders
1. In `.env`, set `ZOMATO_WEBHOOK_SECRET`.
2. Point Zomato's webhook to `POST /api/v1/integrations/zomato/...` (see
   `src/integrations/zomato/zomato.routes.ts`).
3. Map Zomato menu items to yours in the **Zomato Settings** admin page.

### 8.4 Password-reset emails
- Leave `SMTP_HOST` empty → reset links are printed to the backend console
  (fine for development).
- For real emails, fill the `SMTP_*` vars (Gmail needs an App Password).

---

## 9. Production build (when deploying)

```powershell
# Backend → compiles TypeScript to dist/
npm run build
npm start                # runs node dist/server.js

# Staff portal → static files in client/dist/
cd client
npm run build
npm run preview          # local preview, or serve dist/ with any static host

# Waiter app → static files in apps/waiter/dist/
cd apps\waiter
npm run build
npm run preview
```

Serve the two `dist/` folders behind a web server (Nginx/Caddy) over **HTTPS**,
and run the backend behind a process manager (pm2/systemd) so it restarts on
crash. Set `NODE_ENV=production` in `.env`.

---

## 10. Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Frontend loads but "Missing/invalid authorization" | Not logged in / backend down | Start backend (T1), log in again |
| `ECONNREFUSED` / API calls fail | Backend not running on :3000 | Start Terminal 1 first |
| `DATABASE_URL is required` on start | `.env` missing or unset | Create `.env` (section 2.2) |
| Port already in use (3000/3001/3002) | A previous process still running | Find & kill it (below) |
| `pg_dump not found` | PostgreSQL bin not on PATH | Set `PG_BIN` in `.env` |
| Kitchen not updating live | Socket.io blocked / backend restarted | Refresh; ensure backend is up |

**Free a stuck port (Windows):**

```powershell
netstat -ano | findstr ":3000 "
taskkill /PID <PID_FROM_ABOVE> /F
```

---

## 11. Cheat sheet

```powershell
# ── Daily run (3 terminals) ──
npm run dev                 # T1: backend  :3000
cd client; npm run dev      # T2: staff     :3001
cd apps\waiter; npm run dev # T3: waiter    :3002

# ── Database ──
npm run migrate             # apply migrations + seed
npm run backup              # create a DB backup
npm run restore -- <file> --yes   # restore a backup (overwrites!)

# ── Health ──
curl http://localhost:3000/api/v1/health
```
