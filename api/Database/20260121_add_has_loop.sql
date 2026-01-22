-- Add 'has_loop' column to basket_config
-- Controls whether basket uses distribution looping behavior

ALTER TABLE `basket_config` 
ADD COLUMN `has_loop` TINYINT(1) NOT NULL DEFAULT 0 AFTER `on_fail_reevaluate`;

-- Default 0 = No Loop (direct transition)
-- 1 = Has Loop (distribution cycling before final transition)
