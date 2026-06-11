-- 011_subscriptions.sql
-- SaaS Subscription & Billing system for AuraOS.
--
-- Adds three tables:
--   subscription_plans — the catalogue of plans (Starter / Professional / Enterprise)
--   subscriptions      — one row per restaurant, tracks trial/active/grace/suspended state
--   invoices           — manual invoices (Phase 1: UPI / bank transfer / cash, marked paid by owner)
--
-- Design note: this schema is gateway-agnostic. When Razorpay subscriptions are
-- added later, we only need to populate the optional gateway_* columns — no
-- structural changes required.

-- ── Plans ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscription_plans (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          VARCHAR(100) NOT NULL,
    price         NUMERIC(10, 2) NOT NULL DEFAULT 0,   -- 0 = custom / contact sales (Enterprise)
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY'
        CHECK (billing_cycle IN ('MONTHLY', 'YEARLY', 'CUSTOM')),
    description   TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    -- gateway-agnostic placeholders for future automated billing (Razorpay etc.)
    gateway_plan_id VARCHAR(120),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ── Subscriptions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id       UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    plan_id             UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'TRIAL'
        CHECK (status IN ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED')),

    -- Trial window
    trial_started_at    TIMESTAMP,
    trial_ends_at       TIMESTAMP,

    -- Paid subscription window
    started_at          TIMESTAMP,
    expires_at          TIMESTAMP,
    grace_period_ends_at TIMESTAMP,

    -- gateway-agnostic placeholders for future automated billing
    gateway_subscription_id VARCHAR(120),

    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- one subscription per restaurant
    UNIQUE (restaurant_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_restaurant ON subscriptions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status     ON subscriptions(status);

-- ── Invoices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    invoice_number  VARCHAR(50) NOT NULL UNIQUE,
    amount          NUMERIC(10, 2) NOT NULL DEFAULT 0,
    due_date        TIMESTAMP,
    paid_at         TIMESTAMP,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED')),
    notes           TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoices_restaurant   ON invoices(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status       ON invoices(status);

-- ── Seed default plans ─────────────────────────────────────────────────────────
-- Idempotent: only insert a plan if one with that name doesn't already exist.
INSERT INTO subscription_plans (name, price, billing_cycle, description, is_active)
SELECT 'Starter', 999.00, 'MONTHLY', 'For small restaurants getting started — core POS, orders, tables, menu.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Starter');

INSERT INTO subscription_plans (name, price, billing_cycle, description, is_active)
SELECT 'Professional', 1999.00, 'MONTHLY', 'Growing restaurants — everything in Starter plus inventory, reports, integrations.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Professional');

INSERT INTO subscription_plans (name, price, billing_cycle, description, is_active)
SELECT 'Enterprise', 0.00, 'CUSTOM', 'Multi-outlet & custom needs — tailored pricing, priority support. Contact sales.', TRUE
WHERE NOT EXISTS (SELECT 1 FROM subscription_plans WHERE name = 'Enterprise');

-- ── Backfill: give every existing restaurant a 14-day trial subscription ───────
-- Restaurants created before this feature shipped get a fresh trial starting now.
INSERT INTO subscriptions (restaurant_id, status, trial_started_at, trial_ends_at)
SELECT r.id, 'TRIAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + INTERVAL '14 days'
FROM restaurants r
WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.restaurant_id = r.id);
