-- 006_seed.sql - Load demo data for development and testing

-- Insert demo restaurant
INSERT INTO restaurants (id, name, slug, auto_approve_online_orders, delay_threshold_minutes)
VALUES ('11111111-1111-1111-1111-111111111111'::UUID, 'Demo Kitchen', 'demo-kitchen', FALSE, 15);

-- Insert demo admin user (password: demo123)
-- bcrypt hash of "demo123": $2a$10$d9plWLBZ2YUG.9.4wpJ8Feoc/hmCek5D8bX7xyWeSmkw2hhIXJR0e
INSERT INTO users (id, restaurant_id, email, password_hash, name, role, is_active)
VALUES (
    '22222222-2222-2222-2222-222222222222'::UUID,
    '11111111-1111-1111-1111-111111111111'::UUID,
    'admin@demo-kitchen.local',
    '$2a$10$d9plWLBZ2YUG.9.4wpJ8Feoc/hmCek5D8bX7xyWeSmkw2hhIXJR0e',
    'Admin User',
    'ADMIN',
    TRUE
);

-- Insert demo waiter user
INSERT INTO users (restaurant_id, email, password_hash, name, role, is_active)
VALUES (
    '11111111-1111-1111-1111-111111111111'::UUID,
    'waiter@demo-kitchen.local',
    '$2a$10$d9plWLBZ2YUG.9.4wpJ8Feoc/hmCek5D8bX7xyWeSmkw2hhIXJR0e',
    'Waiter User',
    'WAITER',
    TRUE
);

-- Insert demo kitchen user
INSERT INTO users (restaurant_id, email, password_hash, name, role, is_active)
VALUES (
    '11111111-1111-1111-1111-111111111111'::UUID,
    'kitchen@demo-kitchen.local',
    '$2a$10$d9plWLBZ2YUG.9.4wpJ8Feoc/hmCek5D8bX7xyWeSmkw2hhIXJR0e',
    'Kitchen User',
    'KITCHEN',
    TRUE
);

-- Insert demo reception user
INSERT INTO users (restaurant_id, email, password_hash, name, role, is_active)
VALUES (
    '11111111-1111-1111-1111-111111111111'::UUID,
    'reception@demo-kitchen.local',
    '$2a$10$d9plWLBZ2YUG.9.4wpJ8Feoc/hmCek5D8bX7xyWeSmkw2hhIXJR0e',
    'Reception User',
    'RECEPTION',
    TRUE
);

-- Insert demo tables
INSERT INTO restaurant_tables (restaurant_id, table_number, seats, is_active)
VALUES
    ('11111111-1111-1111-1111-111111111111'::UUID, 'T1', 2, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'T2', 2, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'T3', 4, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'T4', 4, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'T5', 6, TRUE);

-- Insert demo menu categories
INSERT INTO menu_categories (restaurant_id, name, description, display_order, is_active)
VALUES
    ('11111111-1111-1111-1111-111111111111'::UUID, 'Starters', 'Appetizers and starters', 1, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'Mains', 'Main course dishes', 2, TRUE),
    ('11111111-1111-1111-1111-111111111111'::UUID, 'Beverages', 'Drinks and beverages', 3, TRUE);

-- Insert demo menu items
INSERT INTO menu_items (restaurant_id, category_id, name, description, price, prep_time_minutes, is_vegetarian, is_active, display_order)
VALUES
    ('11111111-1111-1111-1111-111111111111'::UUID, (SELECT id FROM menu_categories WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID AND name = 'Starters'), 'Samosa', 'Crispy fried pastry with spiced potato filling', 80.00, 5, TRUE, TRUE, 1),
    ('11111111-1111-1111-1111-111111111111'::UUID, (SELECT id FROM menu_categories WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID AND name = 'Starters'), 'Paneer Tikka', 'Grilled cottage cheese with spices', 200.00, 10, TRUE, TRUE, 2),
    ('11111111-1111-1111-1111-111111111111'::UUID, (SELECT id FROM menu_categories WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID AND name = 'Mains'), 'Butter Chicken', 'Tender chicken in creamy tomato gravy', 280.00, 20, FALSE, TRUE, 1),
    ('11111111-1111-1111-1111-111111111111'::UUID, (SELECT id FROM menu_categories WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID AND name = 'Mains'), 'Biryani', 'Fragrant rice with meat and spices', 300.00, 25, FALSE, TRUE, 2),
    ('11111111-1111-1111-1111-111111111111'::UUID, (SELECT id FROM menu_categories WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID AND name = 'Mains'), 'Paneer Curry', 'Soft cheese in aromatic curry sauce', 220.00, 15, TRUE, TRUE, 3),
    ('11111111-1111-1111-1111-111111111111'::UUID, (SELECT id FROM menu_categories WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID AND name = 'Beverages'), 'Mango Lassi', 'Refreshing yogurt drink with mango', 60.00, 2, TRUE, TRUE, 1),
    ('11111111-1111-1111-1111-111111111111'::UUID, (SELECT id FROM menu_categories WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID AND name = 'Beverages'), 'Iced Tea', 'Chilled tea with lemon', 50.00, 2, TRUE, TRUE, 2),
    ('11111111-1111-1111-1111-111111111111'::UUID, (SELECT id FROM menu_categories WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID AND name = 'Beverages'), 'Masala Chai', 'Traditional spiced tea', 40.00, 3, TRUE, TRUE, 3);

-- Initialize inventory for all menu items
INSERT INTO inventory_items (restaurant_id, menu_item_id, current_stock, reorder_level)
SELECT 
    '11111111-1111-1111-1111-111111111111'::UUID,
    id,
    100,
    10
FROM menu_items 
WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::UUID;

-- Create migrations log table to track which migrations have run
CREATE TABLE IF NOT EXISTS migrations_log (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
