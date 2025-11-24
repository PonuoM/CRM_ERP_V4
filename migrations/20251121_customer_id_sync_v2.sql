-- Migration for customer identifier housekeeping (Fixed Collation)
-- 1. Ensure there is a backup phone column so the UI can store a secondary contact.
-- 2. Keep customer_id in sync with phone + company_id, so the FK to orders is always resolvable.
-- 3. Cascade customer_id updates into dependent tables to avoid referential errors.
-- 4. Add customer_ref_id (INT) as an immutable reference to customers.id.

START TRANSACTION;

-- Add backup_phone if not exists
SET @existing_backup_phone := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'backup_phone'
);
SET @sql := IF(@existing_backup_phone = 0,
  'ALTER TABLE `customers` ADD COLUMN `backup_phone` VARCHAR(64) NULL AFTER `phone`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop triggers that might interfere with migration
DROP TRIGGER IF EXISTS `trg_validate_order_creator`;
DROP TRIGGER IF EXISTS `orders_customer_ref_bu`;
DROP TRIGGER IF EXISTS `activities_customer_ref_bi`;
DROP TRIGGER IF EXISTS `activities_customer_ref_bu`;
DROP TRIGGER IF EXISTS `appointments_customer_ref_bi`;
DROP TRIGGER IF EXISTS `appointments_customer_ref_bu`;
DROP TRIGGER IF EXISTS `call_history_customer_ref_bi`;
DROP TRIGGER IF EXISTS `call_history_customer_ref_bu`;
DROP TRIGGER IF EXISTS `customer_assignment_history_ref_bi`;
DROP TRIGGER IF EXISTS `customer_assignment_history_ref_bu`;
DROP TRIGGER IF EXISTS `customer_tags_ref_bi`;
DROP TRIGGER IF EXISTS `customer_tags_ref_bu`;

-- Add customer_id if not exists
SET @existing_customer_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customers' AND COLUMN_NAME = 'customer_id'
);
SET @sql := IF(@existing_customer_id = 0,
  'ALTER TABLE `customers` ADD COLUMN `customer_id` VARCHAR(64) NULL AFTER `id`',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

DELIMITER $$
DROP FUNCTION IF EXISTS `generate_customer_id`$$
CREATE FUNCTION `generate_customer_id`(raw_phone VARCHAR(64), companyId INT) RETURNS VARCHAR(128)
  DETERMINISTIC
BEGIN
  DECLARE digits VARCHAR(64) DEFAULT '';
  DECLARE ch CHAR(1);
  DECLARE idx INT DEFAULT 1;
  WHILE idx <= CHAR_LENGTH(COALESCE(raw_phone, '')) DO
    SET ch = SUBSTRING(raw_phone, idx, 1);
    IF ch BETWEEN '0' AND '9' THEN
      SET digits = CONCAT(digits, ch);
    END IF;
    SET idx = idx + 1;
  END WHILE;
  IF LEFT(digits, 1) = '0' THEN
    SET digits = SUBSTRING(digits, 2);
  END IF;
  IF digits = '' THEN
    SET digits = '000000000';
  END IF;
  RETURN CONCAT(
    'CUS-',
    digits,
    CASE WHEN companyId IS NOT NULL THEN CONCAT('-', companyId) ELSE '' END
  );
END$$
DELIMITER ;

DELIMITER $$
DROP FUNCTION IF EXISTS `resolve_customer_pk`$$
CREATE FUNCTION `resolve_customer_pk`(customerIdentifier VARCHAR(64))
  RETURNS INT
  DETERMINISTIC
BEGIN
  DECLARE resolvedId INT;
  IF customerIdentifier IS NULL OR customerIdentifier = '' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO resolvedId
  FROM customers
  WHERE customer_id COLLATE utf8mb4_unicode_ci = customerIdentifier COLLATE utf8mb4_unicode_ci
     OR CAST(id AS CHAR) COLLATE utf8mb4_unicode_ci = customerIdentifier COLLATE utf8mb4_unicode_ci
  LIMIT 1;
  RETURN resolvedId;
END$$
DELIMITER ;

-- Populate customer_id for existing customers
SET @prev_fk_checks := @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;
UPDATE `customers`
SET `customer_id` = generate_customer_id(`phone`, `company_id`)
WHERE `customer_id` IS NULL OR `customer_id` = '';
SET FOREIGN_KEY_CHECKS = @prev_fk_checks;

-- Triggers to keep customer_id in sync
DROP TRIGGER IF EXISTS `customers_before_insert`;
DROP TRIGGER IF EXISTS `customers_before_update`;

DELIMITER $$
CREATE TRIGGER `customers_before_insert`
BEFORE INSERT ON `customers`
FOR EACH ROW
BEGIN
  SET NEW.customer_id = generate_customer_id(NEW.phone, NEW.company_id);
END$$

CREATE TRIGGER `customers_before_update`
BEFORE UPDATE ON `customers`
FOR EACH ROW
BEGIN
  IF NOT (NEW.phone <=> OLD.phone) OR NOT (NEW.company_id <=> OLD.company_id) THEN
    SET NEW.customer_id = generate_customer_id(NEW.phone, NEW.company_id);
  END IF;
END$$
DELIMITER ;

-- Drop old foreign keys if they exist (to avoid conflicts when modifying columns)
SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_orders_customer'
  ),
  'ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_activity_customer'
  ),
  'ALTER TABLE `activities` DROP FOREIGN KEY `fk_activity_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_appt_customer'
  ),
  'ALTER TABLE `appointments` DROP FOREIGN KEY `fk_appt_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_call_customer'
  ),
  'ALTER TABLE `call_history` DROP FOREIGN KEY `fk_call_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_cah_customer'
  ),
  'ALTER TABLE `customer_assignment_history` DROP FOREIGN KEY `fk_cah_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = 'fk_customer_tags_customer'
  ),
  'ALTER TABLE `customer_tags` DROP FOREIGN KEY `fk_customer_tags_customer`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add stable customer_ref_id columns
SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'customer_ref_id'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD COLUMN `customer_ref_id` INT NULL AFTER `customer_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities' AND COLUMN_NAME = 'customer_ref_id'
  ),
  'SELECT 1',
  'ALTER TABLE `activities` ADD COLUMN `customer_ref_id` INT NULL AFTER `customer_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND COLUMN_NAME = 'customer_ref_id'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD COLUMN `customer_ref_id` INT NULL AFTER `customer_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'call_history' AND COLUMN_NAME = 'customer_ref_id'
  ),
  'SELECT 1',
  'ALTER TABLE `call_history` ADD COLUMN `customer_ref_id` INT NULL AFTER `customer_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_assignment_history' AND COLUMN_NAME = 'customer_ref_id'
  ),
  'SELECT 1',
  'ALTER TABLE `customer_assignment_history` ADD COLUMN `customer_ref_id` INT NULL AFTER `customer_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_tags' AND COLUMN_NAME = 'customer_ref_id'
  ),
  'SELECT 1',
  'ALTER TABLE `customer_tags` ADD COLUMN `customer_ref_id` INT NULL AFTER `customer_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Backfill the immutable references with EXPLICIT COLLATION to fix "Illegal mix of collations"
UPDATE `orders` o
LEFT JOIN `customers` c ON (
  o.customer_id COLLATE utf8mb4_unicode_ci = c.customer_id COLLATE utf8mb4_unicode_ci
  OR o.customer_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci
)
SET o.customer_ref_id = c.id
WHERE o.customer_ref_id IS NULL;

UPDATE `activities` a
LEFT JOIN `customers` c ON (
  a.customer_id COLLATE utf8mb4_unicode_ci = c.customer_id COLLATE utf8mb4_unicode_ci
  OR a.customer_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci
)
SET a.customer_ref_id = c.id
WHERE a.customer_ref_id IS NULL;

UPDATE `appointments` ap
LEFT JOIN `customers` c ON (
  ap.customer_id COLLATE utf8mb4_unicode_ci = c.customer_id COLLATE utf8mb4_unicode_ci
  OR ap.customer_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci
)
SET ap.customer_ref_id = c.id
WHERE ap.customer_ref_id IS NULL;

UPDATE `call_history` ch
LEFT JOIN `customers` c ON (
  ch.customer_id COLLATE utf8mb4_unicode_ci = c.customer_id COLLATE utf8mb4_unicode_ci
  OR ch.customer_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci
)
SET ch.customer_ref_id = c.id
WHERE ch.customer_ref_id IS NULL;

UPDATE `customer_assignment_history` cah
LEFT JOIN `customers` c ON (
  cah.customer_id COLLATE utf8mb4_unicode_ci = c.customer_id COLLATE utf8mb4_unicode_ci
  OR cah.customer_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci
)
SET cah.customer_ref_id = c.id
WHERE cah.customer_ref_id IS NULL;

UPDATE `customer_tags` ct
LEFT JOIN `customers` c ON (
  ct.customer_id COLLATE utf8mb4_unicode_ci = c.customer_id COLLATE utf8mb4_unicode_ci
  OR ct.customer_id COLLATE utf8mb4_unicode_ci = CAST(c.id AS CHAR) COLLATE utf8mb4_unicode_ci
)
SET ct.customer_ref_id = c.id
WHERE ct.customer_ref_id IS NULL;

-- Add indexes for the new columns
SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND INDEX_NAME = 'idx_orders_customer_ref'
  ),
  'SELECT 1',
  'ALTER TABLE `orders` ADD KEY `idx_orders_customer_ref` (`customer_ref_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'activities' AND INDEX_NAME = 'idx_activities_customer_ref'
  ),
  'SELECT 1',
  'ALTER TABLE `activities` ADD KEY `idx_activities_customer_ref` (`customer_ref_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'appointments' AND INDEX_NAME = 'idx_appointments_customer_ref'
  ),
  'SELECT 1',
  'ALTER TABLE `appointments` ADD KEY `idx_appointments_customer_ref` (`customer_ref_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'call_history' AND INDEX_NAME = 'idx_call_history_customer_ref'
  ),
  'SELECT 1',
  'ALTER TABLE `call_history` ADD KEY `idx_call_history_customer_ref` (`customer_ref_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_assignment_history' AND INDEX_NAME = 'idx_cah_customer_ref'
  ),
  'SELECT 1',
  'ALTER TABLE `customer_assignment_history` ADD KEY `idx_cah_customer_ref` (`customer_ref_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'customer_tags' AND INDEX_NAME = 'idx_customer_tags_customer_ref'
  ),
  'SELECT 1',
  'ALTER TABLE `customer_tags` ADD KEY `idx_customer_tags_customer_ref` (`customer_ref_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


-- Ensure customer_id is unique in customers table
SET @idx_exists := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'customers'
    AND INDEX_NAME = 'uniq_customers_customer_id'
);
SET @sql := IF(
  @idx_exists > 0,
  'ALTER TABLE `customers` DROP INDEX `uniq_customers_customer_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `customers` ADD UNIQUE INDEX `uniq_customers_customer_id` (`customer_id`);

-- Ensure customer_ref_id is nullable before cleanup
ALTER TABLE `orders` MODIFY COLUMN `customer_ref_id` INT NULL;
ALTER TABLE `activities` MODIFY COLUMN `customer_ref_id` INT NULL;
ALTER TABLE `appointments` MODIFY COLUMN `customer_ref_id` INT NULL;
ALTER TABLE `call_history` MODIFY COLUMN `customer_ref_id` INT NULL;
ALTER TABLE `customer_assignment_history` MODIFY COLUMN `customer_ref_id` INT NULL;
ALTER TABLE `customer_tags` MODIFY COLUMN `customer_ref_id` INT NULL;

-- Cleanup invalid customer_ref_id values (orphans) before adding FK
UPDATE `orders` SET `customer_ref_id` = NULL WHERE `customer_ref_id` NOT IN (SELECT `id` FROM `customers`);
UPDATE `activities` SET `customer_ref_id` = NULL WHERE `customer_ref_id` NOT IN (SELECT `id` FROM `customers`);
UPDATE `appointments` SET `customer_ref_id` = NULL WHERE `customer_ref_id` NOT IN (SELECT `id` FROM `customers`);
UPDATE `call_history` SET `customer_ref_id` = NULL WHERE `customer_ref_id` NOT IN (SELECT `id` FROM `customers`);
UPDATE `customer_assignment_history` SET `customer_ref_id` = NULL WHERE `customer_ref_id` NOT IN (SELECT `id` FROM `customers`);
UPDATE `customer_tags` SET `customer_ref_id` = NULL WHERE `customer_ref_id` NOT IN (SELECT `id` FROM `customers`);

-- Add foreign keys to reference customers.id
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_ref_id`) REFERENCES `customers` (`id`)
    ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE `activities`
  ADD CONSTRAINT `fk_activity_customer` FOREIGN KEY (`customer_ref_id`) REFERENCES `customers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `appointments`
  ADD CONSTRAINT `fk_appt_customer` FOREIGN KEY (`customer_ref_id`) REFERENCES `customers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `call_history`
  ADD CONSTRAINT `fk_call_customer` FOREIGN KEY (`customer_ref_id`) REFERENCES `customers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_assignment_history`
  ADD CONSTRAINT `fk_cah_customer` FOREIGN KEY (`customer_ref_id`) REFERENCES `customers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `customer_tags`
  ADD CONSTRAINT `fk_customer_tags_customer` FOREIGN KEY (`customer_ref_id`) REFERENCES `customers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate triggers to maintain customer_ref_id
DROP TRIGGER IF EXISTS `orders_customer_ref_bu`;
DELIMITER $$
CREATE TRIGGER `orders_customer_ref_bu`
BEFORE UPDATE ON `orders`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    IF NOT (NEW.customer_id <=> OLD.customer_id) OR NEW.customer_ref_id IS NULL THEN
        SET resolvedId = resolve_customer_pk(NEW.customer_id);
        IF resolvedId IS NULL THEN
            -- Fallback: try to find by phone if customer_id format changed
            SELECT id INTO resolvedId FROM customers WHERE customer_id = NEW.customer_id LIMIT 1;
        END IF;
        
        IF resolvedId IS NOT NULL THEN
             SET NEW.customer_ref_id = resolvedId;
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `activities_customer_ref_bi`;
DELIMITER $$
CREATE TRIGGER `activities_customer_ref_bi`
BEFORE INSERT ON `activities`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    SET resolvedId = resolve_customer_pk(NEW.customer_id);
    IF resolvedId IS NOT NULL THEN
        SET NEW.customer_ref_id = resolvedId;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `activities_customer_ref_bu`;
DELIMITER $$
CREATE TRIGGER `activities_customer_ref_bu`
BEFORE UPDATE ON `activities`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    IF NOT (NEW.customer_id <=> OLD.customer_id) OR NEW.customer_ref_id IS NULL THEN
        SET resolvedId = resolve_customer_pk(NEW.customer_id);
        IF resolvedId IS NOT NULL THEN
            SET NEW.customer_ref_id = resolvedId;
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `appointments_customer_ref_bi`;
DELIMITER $$
CREATE TRIGGER `appointments_customer_ref_bi`
BEFORE INSERT ON `appointments`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    SET resolvedId = resolve_customer_pk(NEW.customer_id);
    IF resolvedId IS NOT NULL THEN
        SET NEW.customer_ref_id = resolvedId;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `appointments_customer_ref_bu`;
DELIMITER $$
CREATE TRIGGER `appointments_customer_ref_bu`
BEFORE UPDATE ON `appointments`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    IF NOT (NEW.customer_id <=> OLD.customer_id) OR NEW.customer_ref_id IS NULL THEN
        SET resolvedId = resolve_customer_pk(NEW.customer_id);
        IF resolvedId IS NOT NULL THEN
            SET NEW.customer_ref_id = resolvedId;
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `call_history_customer_ref_bi`;
DELIMITER $$
CREATE TRIGGER `call_history_customer_ref_bi`
BEFORE INSERT ON `call_history`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    SET resolvedId = resolve_customer_pk(NEW.customer_id);
    IF resolvedId IS NOT NULL THEN
        SET NEW.customer_ref_id = resolvedId;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `call_history_customer_ref_bu`;
DELIMITER $$
CREATE TRIGGER `call_history_customer_ref_bu`
BEFORE UPDATE ON `call_history`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    IF NOT (NEW.customer_id <=> OLD.customer_id) OR NEW.customer_ref_id IS NULL THEN
        SET resolvedId = resolve_customer_pk(NEW.customer_id);
        IF resolvedId IS NOT NULL THEN
            SET NEW.customer_ref_id = resolvedId;
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `customer_assignment_history_ref_bi`;
DELIMITER $$
CREATE TRIGGER `customer_assignment_history_ref_bi`
BEFORE INSERT ON `customer_assignment_history`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    SET resolvedId = resolve_customer_pk(NEW.customer_id);
    IF resolvedId IS NOT NULL THEN
        SET NEW.customer_ref_id = resolvedId;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `customer_assignment_history_ref_bu`;
DELIMITER $$
CREATE TRIGGER `customer_assignment_history_ref_bu`
BEFORE UPDATE ON `customer_assignment_history`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    IF NOT (NEW.customer_id <=> OLD.customer_id) OR NEW.customer_ref_id IS NULL THEN
        SET resolvedId = resolve_customer_pk(NEW.customer_id);
        IF resolvedId IS NOT NULL THEN
            SET NEW.customer_ref_id = resolvedId;
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `customer_tags_ref_bi`;
DELIMITER $$
CREATE TRIGGER `customer_tags_ref_bi`
BEFORE INSERT ON `customer_tags`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    SET resolvedId = resolve_customer_pk(NEW.customer_id);
    IF resolvedId IS NOT NULL THEN
        SET NEW.customer_ref_id = resolvedId;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `customer_tags_ref_bu`;
DELIMITER $$
CREATE TRIGGER `customer_tags_ref_bu`
BEFORE UPDATE ON `customer_tags`
FOR EACH ROW
BEGIN
    DECLARE resolvedId INT;
    IF NOT (NEW.customer_id <=> OLD.customer_id) OR NEW.customer_ref_id IS NULL THEN
        SET resolvedId = resolve_customer_pk(NEW.customer_id);
        IF resolvedId IS NOT NULL THEN
            SET NEW.customer_ref_id = resolvedId;
        END IF;
    END IF;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS `trg_validate_order_creator`;

DELIMITER $$
CREATE TRIGGER `trg_validate_order_creator`
BEFORE INSERT ON `orders`
FOR EACH ROW
BEGIN
    DECLARE customer_company INT;
    DECLARE creator_company INT;
    DECLARE creator_role VARCHAR(64);
    DECLARE customer_pk INT;
    
    -- Try to resolve customer_pk from customer_ref_id if provided, else from customer_id
    IF NEW.customer_ref_id IS NOT NULL THEN
        SET customer_pk = NEW.customer_ref_id;
    ELSE
        SET customer_pk = resolve_customer_pk(NEW.customer_id);
    END IF;

    IF customer_pk IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Customer not found';
    END IF;
    
    -- Ensure customer_ref_id is set
    SET NEW.customer_ref_id = customer_pk;

    SELECT company_id INTO customer_company FROM customers WHERE id = customer_pk;
    SELECT company_id, role INTO creator_company, creator_role FROM users WHERE id = NEW.creator_id;
    
    IF creator_company IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Creator user not found';
    END IF;
    
    IF creator_company != customer_company THEN
        IF creator_role != 'Super Admin' THEN
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Order creator must belong to same company as customer (unless Super Admin)';
        END IF;
    END IF;
    
    IF NEW.company_id != customer_company THEN
        SET NEW.company_id = customer_company;
    END IF;
END$$
DELIMITER ;

COMMIT;
