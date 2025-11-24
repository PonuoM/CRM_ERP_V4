-- Migration: Add creator_id column to order_items table
-- Purpose: Track which user created each order item for upsell feature
-- This allows multiple sellers to add items to the same order while maintaining sales attribution

-- Step 1: Check if column exists, if not add it
SET @col_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'order_items' 
    AND COLUMN_NAME = 'creator_id'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE `order_items` 
     ADD COLUMN `creator_id` INT(11) NULL 
     COMMENT ''รหัสผู้สร้างรายการ (อ้างอิง users.id) สำหรับแยกยอดขายในออเดอร์เดียวกัน'' 
     AFTER `parent_order_id`',
    'SELECT ''Column creator_id already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 2: Create index if it doesn't exist
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'order_items' 
    AND INDEX_NAME = 'idx_order_items_creator'
);

SET @sql = IF(@index_exists = 0,
    'CREATE INDEX `idx_order_items_creator` ON `order_items` (`creator_id`)',
    'SELECT ''Index idx_order_items_creator already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Update existing records: set creator_id from parent order's creator_id
UPDATE `order_items` oi
INNER JOIN `orders` o ON oi.parent_order_id = o.id
SET oi.creator_id = o.creator_id
WHERE oi.creator_id IS NULL;

-- Step 4: Drop foreign key if it exists (to allow modifying column)
SET @fk_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'order_items' 
    AND CONSTRAINT_NAME = 'fk_order_items_creator'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_exists > 0,
    'ALTER TABLE `order_items` DROP FOREIGN KEY `fk_order_items_creator`',
    'SELECT ''No foreign key to drop'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 5: Set column to NOT NULL
ALTER TABLE `order_items` 
MODIFY COLUMN `creator_id` INT(11) NOT NULL;

-- Step 6: Add foreign key constraint (if it was dropped or doesn't exist)
SET @fk_check = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
    WHERE TABLE_SCHEMA = DATABASE() 
    AND TABLE_NAME = 'order_items' 
    AND CONSTRAINT_NAME = 'fk_order_items_creator'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);

SET @sql = IF(@fk_check = 0,
    'ALTER TABLE `order_items`
     ADD CONSTRAINT `fk_order_items_creator` 
     FOREIGN KEY (`creator_id`) REFERENCES `users` (`id`) 
     ON DELETE RESTRICT ON UPDATE CASCADE',
    'SELECT ''Foreign key already exists'' AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify: Check that all records have creator_id
SELECT 
    COUNT(*) as total_items,
    COUNT(creator_id) as items_with_creator,
    COUNT(*) - COUNT(creator_id) as items_without_creator
FROM `order_items`;

