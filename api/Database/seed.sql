USE `mini_erp`;

INSERT INTO companies (name) VALUES
('Alpha Seeds Co.'),
('Company B Ltd.');

-- Users (plaintext passwords for demo only)
INSERT INTO users (username, password, first_name, last_name, email, phone, role, company_id, team_id, supervisor_id) VALUES
('admin1', 'admin123', 'Somchai', 'Admin', 'admin1@example.com', '0810000001', 'Admin Page', 1, NULL, NULL),
('telesale1', 'telesale123', 'Somsri', 'Telesale', 'telesale1@example.com', '0810000002', 'Telesale', 1, 1, 3),
('supervisor1', 'supervisor123', 'Somying', 'Supervisor', 'supervisor1@example.com', '0810000003', 'Supervisor Telesale', 1, 1, NULL),
('backoffice1', 'backoffice123', 'Sommai', 'Backoffice', 'backoffice1@example.com', '0810000004', 'Backoffice', 1, NULL, NULL),
('owner1', 'owner123', 'Owner', 'Control', 'owner1@example.com', '0810000005', 'Admin Control', 1, NULL, NULL),
('superadmin', 'superadmin123', 'Super', 'Admin', 'superadmin@example.com', '0810000000', 'Super Admin', 1, NULL, NULL);

-- Tags
INSERT INTO tags (name, type) VALUES
('VIP', 'SYSTEM'),
('Lead', 'SYSTEM');

-- Customers
INSERT INTO customers (
  id, first_name, last_name, phone, email, province, company_id, assigned_to, date_assigned, date_registered,
  follow_up_date, ownership_expires, lifecycle_status, behavioral_status, grade, total_purchases, total_calls,
  facebook_name, line_id, street, subdistrict, district, postal_code
) VALUES (
  'CUS-100000001', 'Mana', 'Jaidee', '0812345678', 'mana.j@example.com', 'Bangkok', 1, 2, NOW() - INTERVAL 5 DAY, NOW() - INTERVAL 10 DAY,
  NOW() + INTERVAL 2 DAY, NOW() + INTERVAL 80 DAY, 'ลูกค้าใหม่', 'Hot', 'B', 5850, 15,
  'Mana Jaidee', 'mana.j', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', '10110'
);

-- Customer tags
INSERT INTO customer_tags (customer_id, tag_id) VALUES ('CUS-100000001', 1);

-- Products
INSERT INTO products (sku, name, description, category, unit, cost, price, stock, company_id) VALUES
('SKU-001', 'Seed A', 'High yield seed', 'Seeds', 'bag', 100, 200, 500, 1);

-- Promotions (mock)
INSERT INTO promotions (sku, name, description, company_id, active) VALUES
('PROMO-001', 'ปุ๋ย แสงราชสีห์ ซื้อ 4 แถม 1', 'ซื้อ 4 แถม 1 เซ็ตปุ๋ยแสงราชสีห์', 1, 1),
('PROMO-002', 'ชุดทดลองเมล็ด 3 แถม 1', 'เลือก 3 ซอง แถม 1 ซอง', 1, 1),
('PROMO-003', 'โปรแพ็คประหยัด 10%', 'ชุดสินค้ารวม ลด10%', 1, 1);

-- Promotion items (mock)
-- PROMO-001: assumes SKU-001 is the fertilizer product ( Seed A used as example )
INSERT INTO promotion_items (promotion_id, product_id, quantity, is_freebie, price_override) VALUES
((SELECT id FROM promotions WHERE sku='PROMO-001' LIMIT 1), 1, 4, 0, NULL),
((SELECT id FROM promotions WHERE sku='PROMO-001' LIMIT 1), 1, 1, 1, 0),
((SELECT id FROM promotions WHERE sku='PROMO-002' LIMIT 1), 1, 3, 0, NULL),
((SELECT id FROM promotions WHERE sku='PROMO-002' LIMIT 1), 1, 1, 1, 0);

-- Orders
INSERT INTO orders (
  id, customer_id, company_id, creator_id, order_date, delivery_date, street, subdistrict, district, province, postal_code,
  shipping_cost, bill_discount, total_amount, payment_method, payment_status, slip_url, amount_paid, cod_amount, order_status, notes
) VALUES 
('ORD-100000001', 'CUS-100000001', 1, 2, NOW() - INTERVAL 1 DAY, NOW() + INTERVAL 1 DAY,
  '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110',
  50, 0, 2050, 'COD', 'PendingVerification', NULL, NULL, NULL, 2000, 'Picking', 'First test order'),
('ORD-100000002', 'CUS-100000001', 1, 2, NOW() - INTERVAL 2 DAY, NOW() + INTERVAL 2 DAY,
  '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110',
  60, 0, 1560, 'Transfer', 'Paid', 'https://example.com/slip1.jpg', 1560, NULL, 'Delivered', 'Transfer order'),
('ORD-100000003', 'CUS-100000001', 1, 2, NOW() - INTERVAL 3 DAY, NOW() + INTERVAL 3 DAY,
  '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110',
  40, 0, 1200, 'Transfer', 'Unpaid', NULL, NULL, NULL, NULL, 'Pending', 'Unpaid transfer order'),
('ORD-100000004', 'CUS-100000001', 1, 2, NOW() - INTERVAL 4 DAY, NOW() + INTERVAL 4 DAY,
  '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110',
  70, 0, 1800, 'PayAfter', 'Unpaid', NULL, NULL, NULL, NULL, 'Shipping', 'Pay after delivery order');

INSERT INTO order_items (order_id, product_id, product_name, quantity, price_per_unit, discount, is_freebie, box_number) VALUES
('ORD-100000001', 1, 'Seed A', 10, 200, 0, 0, 1),
('ORD-100000002', 1, 'Seed A', 8, 200, 0, 0, 1),
('ORD-100000003', 1, 'Seed A', 6, 200, 0, 0, 1),
('ORD-100000004', 1, 'Seed A', 9, 200, 0, 0, 1);

INSERT INTO order_tracking_numbers (order_id, tracking_number) VALUES
('ORD-100000001', 'TH1234567890'),
('ORD-100000002', 'TH1234567891'),
('ORD-100000004', 'TH1234567892');

INSERT INTO call_history (customer_id, date, caller, status, result, crop_type, area_size, notes, duration) VALUES
('CUS-100000001', NOW() - INTERVAL 2 DAY, 'Somsri Telesale', 'connected', 'interested', 'Rice', '10 rai', 'Good lead', 300);

INSERT INTO appointments (customer_id, date, title, status, notes) VALUES
('CUS-100000001', NOW() + INTERVAL 3 DAY, 'Follow-up Call', 'รอดำเนินการ', 'Discuss pricing');

INSERT INTO activities (customer_id, timestamp, type, description, actor_name) VALUES
('CUS-100000001', NOW() - INTERVAL 1 DAY, 'order_created', 'Created order ORD-100000001', 'Somsri Telesale');