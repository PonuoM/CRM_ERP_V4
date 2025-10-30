-- Ensure client connection uses utf8mb4 for Thai text safety
SET NAMES utf8mb4;

-- Backfill missing registration timestamps
UPDATE customers
SET date_registered = COALESCE(date_registered, date_assigned, NOW())
WHERE date_registered IS NULL;

-- Guarantee ownership expiry defaults to 30 days after registration/assignment
UPDATE customers
SET ownership_expires = COALESCE(
    ownership_expires,
    DATE_ADD(COALESCE(date_registered, date_assigned, NOW()), INTERVAL 30 DAY)
)
WHERE ownership_expires IS NULL;

-- Default behavioural metadata when absent
UPDATE customers
SET behavioral_status = COALESCE(behavioral_status, 'Cold'),
    grade = COALESCE(grade, 'D');

-- Recalculate total purchase value from existing orders
UPDATE customers c
LEFT JOIN (
    SELECT customer_id, COALESCE(SUM(total_amount), 0) AS total_amount
    FROM orders
    GROUP BY customer_id
) o ON o.customer_id = c.id
SET c.total_purchases = COALESCE(o.total_amount, 0);

-- Backfill missing product references on order items via product names scoped by company
UPDATE order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN products p ON p.name = oi.product_name AND p.company_id = o.company_id
SET oi.product_id = p.id
WHERE oi.product_id IS NULL
  AND oi.product_name IS NOT NULL;
