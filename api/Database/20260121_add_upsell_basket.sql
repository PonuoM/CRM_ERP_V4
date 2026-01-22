-- Add 'upsell_waiting' basket
-- Criteria: No specific criteria (entry by logic only)
-- Target Page: distribution (Waiting to be assigned to Upsell team) OR dashboard (if they pick from it?)
-- User said: "ไปที่ หน้าแจกรายชื่อเพื่อแจกไปเป็น ลูกค้าใหม่" -> "distribution"
-- But Upsell team picks them? Or auto-assigned?
-- "มาตรงก่อนเพื่ออัพเซล" -> Usually implies a list/basket they work from.

INSERT IGNORE INTO `basket_config` 
(`basket_key`, `basket_name`, `min_order_count`, `max_order_count`, `min_days_since_order`, `max_days_since_order`, `target_page`, `display_order`, `company_id`, `on_sale_basket_key`, `fail_after_days`, `on_fail_basket_key`) 
VALUES
('upsell_waiting', 'รอ Upsell (พิเศษ)', NULL, NULL, NULL, NULL, 'distribution', 0, 1, 'month_1_2', 7, 'waiting_to_woo');
-- Note: 'waiting_to_woo' is just a default fail; code will override this.
