-- Mock data for Suppliers and Purchases (mini_erp)
-- Pre-conditions:
--   - companies(id=1) exists (see api/Database/mini_erp.sql)
--   - warehouses(id=1..2) exist
--   - products(id=1..3) exist (adjust product_id below if different)
-- Notes:
--   - Uses high id values (9000+) to reduce collision risk
--   - purchase_items.total_cost is generated; do not insert that column

SET NAMES utf8mb4;
START TRANSACTION;

-- ================= Suppliers =================
INSERT IGNORE INTO suppliers
  (id, code, name, contact_person, phone, email, address, province, tax_id, payment_terms, credit_limit, company_id, is_active, notes, created_at)
VALUES
  (9001, 'SUP-TH-001', 'Agri Supplier Co., Ltd.', 'Ms. Naree', '081-111-1111', 'contact@agri-sup.com', '123 Rama 4 Rd, Khlong Toei', 'Bangkok', '0105555555555', '30 Days', 500000.00, 1, 1, NULL, NOW()),
  (9002, 'SUP-TH-002', 'FarmChem Trading', 'Mr. Somchai', '081-222-2222', 'sales@farmchem.co.th', '56 Super Highway Rd', 'Chiang Mai', '0105555555556', 'COD', 0.00, 1, 1, NULL, NOW());

-- ================= Purchases =================
-- PO#1 (Ordered): supplier 9001 -> warehouse 1
INSERT IGNORE INTO purchases
  (id, purchase_number, supplier_id, warehouse_id, company_id, purchase_date, expected_delivery_date, received_date, total_amount, status, payment_status, payment_method, notes, created_by, created_at)
VALUES
  (9001, 'PO-20251009-001', 9001, 1, 1, '2025-10-08', '2025-10-12', NULL, 8400.00, 'Ordered', 'Unpaid', 'Bank Transfer', 'Initial stock for season', 1, NOW());

-- PO#2 (Ordered): supplier 9002 -> warehouse 2
INSERT IGNORE INTO purchases
  (id, purchase_number, supplier_id, warehouse_id, company_id, purchase_date, expected_delivery_date, received_date, total_amount, status, payment_status, payment_method, notes, created_by, created_at)
VALUES
  (9002, 'PO-20251009-002', 9002, 2, 1, '2025-10-09', '2025-10-15', NULL, 2800.00, 'Ordered', 'Unpaid', 'Cash', 'Trial batch', 1, NOW());

-- ================= Purchase Items =================
-- Adjust product_id if your product ids differ
-- PO 9001 items
INSERT IGNORE INTO purchase_items
  (id, purchase_id, product_id, quantity, unit_cost, received_quantity, lot_number, notes)
VALUES
  (90001, 9001, 1, 50.00, 100.00, 0.00, NULL, NULL),  -- total 5000.00
  (90002, 9001, 2, 30.00,  80.00, 0.00, NULL, NULL),  -- total 2400.00
  (90003, 9001, 3, 20.00,  50.00, 0.00, NULL, NULL);  -- total 1000.00  => PO total 8400.00

-- PO 9002 items
INSERT IGNORE INTO purchase_items
  (id, purchase_id, product_id, quantity, unit_cost, received_quantity, lot_number, notes)
VALUES
  (90004, 9002, 1, 20.00, 100.00, 0.00, NULL, NULL),  -- total 2000.00
  (90005, 9002, 2, 10.00,  80.00, 0.00, NULL, NULL);  -- total  800.00  => PO total 2800.00

COMMIT;

