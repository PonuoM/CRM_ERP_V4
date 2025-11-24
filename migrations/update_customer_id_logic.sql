-- 1. Drop Foreign Keys referencing customers(id)
-- We need to drop these constraints before we can modify the primary key of the customers table.
ALTER TABLE `customer_tags` DROP FOREIGN KEY `fk_customer_tags_customer`;
ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_customer`;
ALTER TABLE `call_history` DROP FOREIGN KEY `fk_call_customer`;
ALTER TABLE `appointments` DROP FOREIGN KEY `fk_appt_customer`;
ALTER TABLE `activities` DROP FOREIGN KEY `fk_activity_customer`;
ALTER TABLE `customer_assignment_history` DROP FOREIGN KEY `fk_cah_customer`;

-- 2. Rename existing 'id' to 'customer_id' (VARCHAR)
-- Now we can safely drop the primary key
ALTER TABLE `customers` DROP PRIMARY KEY;

-- Change the column name and type (keeping it VARCHAR for the "CUS-..." format)
ALTER TABLE `customers` CHANGE `id` `customer_id` VARCHAR(32) NOT NULL;

-- 3. Add new 'id' column as INT AUTO_INCREMENT PRIMARY KEY
ALTER TABLE `customers` ADD `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;

-- 4. Add 'backup_phone' column
ALTER TABLE `customers` ADD `backup_phone` VARCHAR(64) DEFAULT NULL AFTER `phone`;

-- 5. Add UNIQUE index to 'customer_id' to ensure uniqueness of the business key
ALTER TABLE `customers` ADD UNIQUE KEY `idx_customer_id` (`customer_id`);

-- 6. Re-add Foreign Keys referencing customers(customer_id)
-- Note: The child tables still use VARCHAR for customer_id, so they refer to the new customer_id column.
ALTER TABLE `customer_tags` ADD CONSTRAINT `fk_customer_tags_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE CASCADE;
ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`);
ALTER TABLE `call_history` ADD CONSTRAINT `fk_call_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE CASCADE;
ALTER TABLE `appointments` ADD CONSTRAINT `fk_appt_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE CASCADE;
ALTER TABLE `activities` ADD CONSTRAINT `fk_activity_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE CASCADE;
ALTER TABLE `customer_assignment_history` ADD CONSTRAINT `fk_cah_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`customer_id`) ON DELETE CASCADE;

