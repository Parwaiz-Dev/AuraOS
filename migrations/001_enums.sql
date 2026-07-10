-- 001_enums.sql - Create PostgreSQL enum types for AuraOS

DO $$ BEGIN CREATE TYPE user_role AS ENUM ('ADMIN', 'WAITER', 'RECEPTION', 'KITCHEN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_status AS ENUM ('CREATED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_type AS ENUM ('DINE_IN', 'PARCEL', 'ONLINE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE order_source AS ENUM ('WAITER', 'RECEPTION', 'QR', 'WHATSAPP', 'ZOMATO'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE item_status AS ENUM ('PENDING', 'PREPARING', 'DONE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'UPI', 'ONLINE'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE integration_source AS ENUM ('ZOMATO', 'WHATSAPP', 'QR'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE integration_status AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
