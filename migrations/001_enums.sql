-- 001_enums.sql - Create PostgreSQL enum types for AuraOS

-- User roles
CREATE TYPE user_role AS ENUM ('ADMIN', 'WAITER', 'RECEPTION', 'KITCHEN');

-- Order status state machine: CREATED -> ACCEPTED -> PREPARING -> READY -> COMPLETED (or CANCELLED)
CREATE TYPE order_status AS ENUM ('CREATED', 'ACCEPTED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED');

-- Order types
CREATE TYPE order_type AS ENUM ('DINE_IN', 'PARCEL', 'ONLINE');

-- Order sources (how the order originated)
CREATE TYPE order_source AS ENUM ('WAITER', 'RECEPTION', 'QR', 'WHATSAPP', 'ZOMATO');

-- Item status in kitchen
CREATE TYPE item_status AS ENUM ('PENDING', 'PREPARING', 'DONE');

-- Payment methods
CREATE TYPE payment_method AS ENUM ('CASH', 'CARD', 'UPI', 'ONLINE');

-- Payment status
CREATE TYPE payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED');

-- Integration source
CREATE TYPE integration_source AS ENUM ('ZOMATO', 'WHATSAPP', 'QR');

-- Integration status
CREATE TYPE integration_status AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');
