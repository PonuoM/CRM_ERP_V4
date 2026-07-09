-- 037_add_unit_price_to_price_announcement_tiers.sql
-- Lets the per-unit price ("ซองละใหม่") be entered/overridden manually instead of always
-- being derived as new_total_price / quantity (which doesn't always divide evenly, e.g.
-- promo bundles like "12 ขวด = ฿6,100" -> 508.33/ขวด that the source spreadsheet rounds).
-- NULL means "not overridden" — display falls back to total/quantity.

ALTER TABLE `price_announcement_tiers`
  ADD COLUMN `new_unit_price` DECIMAL(12,2) NULL AFTER `new_total_price`;
