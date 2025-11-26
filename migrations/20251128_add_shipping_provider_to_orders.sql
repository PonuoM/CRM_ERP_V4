-- Migration: Add shipping provider column for courier selection
-- Purpose: store selected courier (J&T, Flash, Kerry, Aiport Logistic) per order

SET @col_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'shipping_provider'
);

SET @ddl = IF(@col_exists = 0,
    'ALTER TABLE `orders` ADD COLUMN `shipping_provider` VARCHAR(128) NULL AFTER `recipient_last_name`',
    'SELECT ''shipping_provider already exists'' AS message'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
