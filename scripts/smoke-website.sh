#!/usr/bin/env bash
# Smoke test for the multi-tenant public website (Phase 0–1).
#
# Brings up Postgres, applies migrations (incl. RLS + branding + website seed),
# starts Core, and curls the public site endpoints for the seeded demo tenant.
# Then tells you how to load the Next.js site in a browser.
#
# Usage:  bash scripts/smoke-website.sh
# Requires: Docker running, Node deps installed (npm ci), and a free port 3000.

set -euo pipefail
cd "$(dirname "$0")/.."

SLUG="demo-kitchen"
API="http://localhost:3000/api/v1"

echo "▶ 1/5  Starting Postgres (docker compose)…"
docker compose up -d postgres
echo "   waiting for healthy…"
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U auraos_user -d auraos >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "▶ 2/5  Applying migrations…"
DATABASE_URL="postgresql://auraos_user:auraos_password@localhost:5433/auraos" npm run migrate

echo "▶ 3/5  Starting Core API in background…"
DATABASE_URL="postgresql://auraos_user:auraos_password@localhost:5433/auraos" \
  npm run dev >/tmp/auraos-core.log 2>&1 &
CORE_PID=$!
trap 'kill $CORE_PID 2>/dev/null || true' EXIT
for i in $(seq 1 30); do
  if curl -fs "$API/health" >/dev/null 2>&1; then break; fi
  sleep 2
done

echo "▶ 4/5  Curling public site endpoints for '$SLUG'…"
echo "   GET /public/site/$SLUG/config";  curl -fs "$API/public/site/$SLUG/config"  | head -c 400; echo
echo "   GET /public/site/$SLUG/gallery"; curl -fs "$API/public/site/$SLUG/gallery" | head -c 200; echo
echo "   GET /public/site/$SLUG/page/home"; curl -fs "$API/public/site/$SLUG/page/home" | head -c 200; echo
echo "   GET /public/menu/$SLUG";         curl -fs "$API/public/menu/$SLUG"          | head -c 200; echo

echo "▶ 5/5  Done. To view the website:"
echo "   cd apps/website && cp .env.example .env   # DEV_TENANT_SLUG=$SLUG"
echo "   npm install && npm run dev                # http://localhost:3002"
echo
echo "Core logs: /tmp/auraos-core.log"
