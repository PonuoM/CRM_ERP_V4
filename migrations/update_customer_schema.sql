-- Start Transaction
START TRANSACTION;

-- 1. Add new columns to customers table
ALTER TABLE `customers`
ADD COLUMN `internal_id` INT AUTO_INCREMENT UNIQUE FIRST,
ADD COLUMN `customer_code` VARCHAR(32) AFTER `internal_id`,
ADD COLUMN `backup_phone` VARCHAR(20) AFTER `phone`;

-- 2. Populate customer_code with existing id
UPDATE `customers` SET `customer_code` = `id`;

-- 3. Update child tables to reference the new internal_id
-- We need to add a temporary column to child tables to store the new int id, 
-- populate it, then switch the foreign key.

-- Table: orders
ALTER TABLE `orders` ADD COLUMN `customer_int_id` INT;
UPDATE `orders` o JOIN `customers` c ON o.customer_id = c.id SET o.customer_int_id = c.internal_id;

-- Table: activities
ALTER TABLE `activities` ADD COLUMN `customer_int_id` INT;
UPDATE `activities` a JOIN `customers` c ON a.customer_id = c.id SET a.customer_int_id = c.internal_id;

-- Table: appointments
ALTER TABLE `appointments` ADD COLUMN `customer_int_id` INT;
UPDATE `appointments` a JOIN `customers` c ON a.customer_id = c.id SET a.customer_int_id = c.internal_id;

-- Table: call_history
ALTER TABLE `call_history` ADD COLUMN `customer_int_id` INT;
UPDATE `call_history` ch JOIN `customers` c ON ch.customer_id = c.id SET ch.customer_int_id = c.internal_id;

-- Table: customer_tags
ALTER TABLE `customer_tags` ADD COLUMN `customer_int_id` INT;
UPDATE `customer_tags` ct JOIN `customers` c ON ct.customer_id = c.id SET ct.customer_int_id = c.internal_id;

-- 4. Modify customers table to switch primary key
-- First drop existing primary key (if it's `id`)
ALTER TABLE `customers` DROP PRIMARY KEY;
-- Rename old id to legacy_id
ALTER TABLE `customers` CHANGE `id` `legacy_id` VARCHAR(32);
-- Make internal_id the new primary key and rename it to id
ALTER TABLE `customers` CHANGE `internal_id` `id` INT AUTO_INCREMENT PRIMARY KEY;

-- 5. Switch columns in child tables
-- Orders
ALTER TABLE `orders` DROP COLUMN `customer_id`;
ALTER TABLE `orders` CHANGE `customer_int_id` `customer_id` INT NOT NULL;

-- Activities
ALTER TABLE `activities` DROP COLUMN `customer_id`;
ALTER TABLE `activities` CHANGE `customer_int_id` `customer_id` INT NOT NULL;

-- Appointments
ALTER TABLE `appointments` DROP COLUMN `customer_id`;
ALTER TABLE `appointments` CHANGE `customer_int_id` `customer_id` INT NOT NULL;

-- Call History
ALTER TABLE `call_history` DROP COLUMN `customer_id`;
ALTER TABLE `call_history` CHANGE `customer_int_id` `customer_id` INT NOT NULL;

-- Customer Tags
ALTER TABLE `customer_tags` DROP COLUMN `customer_id`;
ALTER TABLE `customer_tags` CHANGE `customer_int_id` `customer_id` INT NOT NULL;

-- Commit Transaction
COMMIT;
