-- Add 'on_fail_reevaluate' flag to basket_config
-- When TRUE, system will re-evaluate customer criteria on fail instead of using fixed on_fail_basket_key

ALTER TABLE `basket_config` 
ADD COLUMN `on_fail_reevaluate` TINYINT(1) NOT NULL DEFAULT 0 AFTER `on_fail_basket_key`;

-- Default 0 means use existing on_fail_basket_key behavior
-- Set to 1 to enable smart re-evaluation based on customer data (e.g., last_order_date)
