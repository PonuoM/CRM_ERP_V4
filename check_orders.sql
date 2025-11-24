SHOW CREATE TABLE orders;
SELECT count(*) as orphan_count FROM orders WHERE customer_ref_id IS NOT NULL AND customer_ref_id NOT IN (SELECT id FROM customers);
UPDATE orders SET customer_ref_id = NULL WHERE customer_ref_id NOT IN (SELECT id FROM customers);
SELECT count(*) as orphan_count_after FROM orders WHERE customer_ref_id IS NOT NULL AND customer_ref_id NOT IN (SELECT id FROM customers);

