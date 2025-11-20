CREATE TABLE IF NOT EXISTS `activities` (
`id` BIGINT AUTO_INCREMENT NOT NULL,
`customer_id` VARCHAR(32) NULL,
`timestamp` DATETIME NULL,
`type` VARCHAR(64) NULL,
`description` TEXT NULL,
`actor_name` VARCHAR(128) NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `activities` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(32) NULL;
ALTER TABLE `activities` ADD COLUMN IF NOT EXISTS `timestamp` DATETIME NULL;
ALTER TABLE `activities` ADD COLUMN IF NOT EXISTS `type` VARCHAR(64) NULL;
ALTER TABLE `activities` ADD COLUMN IF NOT EXISTS `description` TEXT NULL;
ALTER TABLE `activities` ADD COLUMN IF NOT EXISTS `actor_name` VARCHAR(128) NULL;

CREATE TABLE IF NOT EXISTS `ad_spend` (
`id` INT AUTO_INCREMENT NOT NULL,
`page_id` INT NULL,
`spend_date` DATE NULL,
`amount` DECIMAL(12, 2) NULL,
`notes` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `ad_spend` ADD COLUMN IF NOT EXISTS `page_id` INT NULL;
ALTER TABLE `ad_spend` ADD COLUMN IF NOT EXISTS `spend_date` DATE NULL;
ALTER TABLE `ad_spend` ADD COLUMN IF NOT EXISTS `amount` DECIMAL(12, 2) NULL;
ALTER TABLE `ad_spend` ADD COLUMN IF NOT EXISTS `notes` VARCHAR(255) NULL;

CREATE TABLE IF NOT EXISTS `address_districts` (
`id` INT NOT NULL,
`name_th` VARCHAR(255) NULL,
`name_en` VARCHAR(255) NULL,
`province_id` INT NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
`deleted_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `address_districts` ADD COLUMN IF NOT EXISTS `name_th` VARCHAR(255) NULL;
ALTER TABLE `address_districts` ADD COLUMN IF NOT EXISTS `name_en` VARCHAR(255) NULL;
ALTER TABLE `address_districts` ADD COLUMN IF NOT EXISTS `province_id` INT NULL;
ALTER TABLE `address_districts` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `address_districts` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;
ALTER TABLE `address_districts` ADD COLUMN IF NOT EXISTS `deleted_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `address_geographies` (
`id` INT NOT NULL,
`name` VARCHAR(255) NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
`deleted_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `address_geographies` ADD COLUMN IF NOT EXISTS `name` VARCHAR(255) NULL;
ALTER TABLE `address_geographies` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `address_geographies` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;
ALTER TABLE `address_geographies` ADD COLUMN IF NOT EXISTS `deleted_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `address_provinces` (
`id` INT NOT NULL,
`name_th` VARCHAR(255) NULL,
`name_en` VARCHAR(255) NULL,
`geography_id` INT NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
`deleted_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `address_provinces` ADD COLUMN IF NOT EXISTS `name_th` VARCHAR(255) NULL;
ALTER TABLE `address_provinces` ADD COLUMN IF NOT EXISTS `name_en` VARCHAR(255) NULL;
ALTER TABLE `address_provinces` ADD COLUMN IF NOT EXISTS `geography_id` INT NULL;
ALTER TABLE `address_provinces` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `address_provinces` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;
ALTER TABLE `address_provinces` ADD COLUMN IF NOT EXISTS `deleted_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `address_sub_districts` (
`id` INT NOT NULL,
`zip_code` VARCHAR(10) NULL,
`name_th` VARCHAR(255) NULL,
`name_en` VARCHAR(255) NULL,
`district_id` INT NULL,
`lat` DECIMAL(10, 8) NULL,
`long` DECIMAL(11, 8) NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
`deleted_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `zip_code` VARCHAR(10) NULL;
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `name_th` VARCHAR(255) NULL;
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `name_en` VARCHAR(255) NULL;
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `district_id` INT NULL;
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `lat` DECIMAL(10, 8) NULL;
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `long` DECIMAL(11, 8) NULL;
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;
ALTER TABLE `address_sub_districts` ADD COLUMN IF NOT EXISTS `deleted_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `appointments` (
`id` INT AUTO_INCREMENT NOT NULL,
`customer_id` VARCHAR(32) NULL,
`date` DATETIME NULL,
`title` VARCHAR(255) NULL,
`status` VARCHAR(64) NULL,
`notes` TEXT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `appointments` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(32) NULL;
ALTER TABLE `appointments` ADD COLUMN IF NOT EXISTS `date` DATETIME NULL;
ALTER TABLE `appointments` ADD COLUMN IF NOT EXISTS `title` VARCHAR(255) NULL;
ALTER TABLE `appointments` ADD COLUMN IF NOT EXISTS `status` VARCHAR(64) NULL;
ALTER TABLE `appointments` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL;

CREATE TABLE IF NOT EXISTS `call_history` (
`id` INT AUTO_INCREMENT NOT NULL,
`customer_id` VARCHAR(32) NULL,
`date` DATETIME NULL,
`caller` VARCHAR(128) NULL,
`status` VARCHAR(64) NULL,
`result` VARCHAR(255) NULL,
`crop_type` VARCHAR(128) NULL,
`area_size` VARCHAR(128) NULL,
`notes` TEXT NULL,
`duration` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(32) NULL;
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `date` DATETIME NULL;
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `caller` VARCHAR(128) NULL;
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `status` VARCHAR(64) NULL;
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `result` VARCHAR(255) NULL;
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `crop_type` VARCHAR(128) NULL;
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `area_size` VARCHAR(128) NULL;
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL;
ALTER TABLE `call_history` ADD COLUMN IF NOT EXISTS `duration` INT NULL;

CREATE TABLE IF NOT EXISTS `companies` (
`id` INT AUTO_INCREMENT NOT NULL,
`name` VARCHAR(255) NULL,
`address` TEXT NULL,
`phone` VARCHAR(64) NULL,
`email` VARCHAR(255) NULL,
`tax_id` VARCHAR(32) NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `companies` ADD COLUMN IF NOT EXISTS `name` VARCHAR(255) NULL;
ALTER TABLE `companies` ADD COLUMN IF NOT EXISTS `address` TEXT NULL;
ALTER TABLE `companies` ADD COLUMN IF NOT EXISTS `phone` VARCHAR(64) NULL;
ALTER TABLE `companies` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) NULL;
ALTER TABLE `companies` ADD COLUMN IF NOT EXISTS `tax_id` VARCHAR(32) NULL;
ALTER TABLE `companies` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `companies` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `customer_address` (
`id` INT AUTO_INCREMENT NOT NULL,
`customer_id` VARCHAR(255) NULL,
`address` VARCHAR(255) NULL,
`recipient_first_name` VARCHAR(128) NULL,
`recipient_last_name` VARCHAR(128) NULL,
`province` VARCHAR(100) NULL,
`district` VARCHAR(100) NULL,
`sub_district` VARCHAR(100) NULL,
`zip_code` VARCHAR(10) NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(255) NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `address` VARCHAR(255) NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `recipient_first_name` VARCHAR(128) NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `recipient_last_name` VARCHAR(128) NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `province` VARCHAR(100) NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `district` VARCHAR(100) NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `sub_district` VARCHAR(100) NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `zip_code` VARCHAR(10) NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `customer_address` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `customer_assignment_history` (
`id` BIGINT AUTO_INCREMENT NOT NULL,
`customer_id` VARCHAR(32) NULL,
`user_id` INT NULL,
`assigned_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `customer_assignment_history` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(32) NULL;
ALTER TABLE `customer_assignment_history` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `customer_assignment_history` ADD COLUMN IF NOT EXISTS `assigned_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `customer_blocks` (
`id` INT AUTO_INCREMENT NOT NULL,
`customer_id` VARCHAR(64) NULL,
`reason` TEXT NULL,
`blocked_by` INT NULL,
`blocked_at` DATETIME NULL,
`unblocked_by` INT NULL,
`unblocked_at` DATETIME NULL,
`active` BOOLEAN NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `customer_blocks` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(64) NULL;
ALTER TABLE `customer_blocks` ADD COLUMN IF NOT EXISTS `reason` TEXT NULL;
ALTER TABLE `customer_blocks` ADD COLUMN IF NOT EXISTS `blocked_by` INT NULL;
ALTER TABLE `customer_blocks` ADD COLUMN IF NOT EXISTS `blocked_at` DATETIME NULL;
ALTER TABLE `customer_blocks` ADD COLUMN IF NOT EXISTS `unblocked_by` INT NULL;
ALTER TABLE `customer_blocks` ADD COLUMN IF NOT EXISTS `unblocked_at` DATETIME NULL;
ALTER TABLE `customer_blocks` ADD COLUMN IF NOT EXISTS `active` BOOLEAN NULL;

CREATE TABLE IF NOT EXISTS `customer_logs` (
`id` INT AUTO_INCREMENT NOT NULL,
`customer_id` VARCHAR(32) NULL,
`bucket_type` VARCHAR(16) NULL,
`assigned_to` INT NULL,
`old_values` JSON NULL,
`new_values` JSON NULL,
`changed_fields` JSON NULL,
`created_by` INT NULL,
`created_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `customer_logs` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(32) NULL;
ALTER TABLE `customer_logs` ADD COLUMN IF NOT EXISTS `bucket_type` VARCHAR(16) NULL;
ALTER TABLE `customer_logs` ADD COLUMN IF NOT EXISTS `assigned_to` INT NULL;
ALTER TABLE `customer_logs` ADD COLUMN IF NOT EXISTS `old_values` JSON NULL;
ALTER TABLE `customer_logs` ADD COLUMN IF NOT EXISTS `new_values` JSON NULL;
ALTER TABLE `customer_logs` ADD COLUMN IF NOT EXISTS `changed_fields` JSON NULL;
ALTER TABLE `customer_logs` ADD COLUMN IF NOT EXISTS `created_by` INT NULL;
ALTER TABLE `customer_logs` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `customer_tags` (
`customer_id` VARCHAR(32) NULL,
`tag_id` INT NULL
);
ALTER TABLE `customer_tags` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(32) NULL;
ALTER TABLE `customer_tags` ADD COLUMN IF NOT EXISTS `tag_id` INT NULL;

CREATE TABLE IF NOT EXISTS `customers` (
`id` VARCHAR(32) NOT NULL,
`first_name` VARCHAR(128) NULL,
`last_name` VARCHAR(128) NULL,
`phone` VARCHAR(64) NULL,
`email` VARCHAR(255) NULL,
`province` VARCHAR(128) NULL,
`company_id` INT NULL,
`assigned_to` INT NULL,
`date_assigned` DATETIME NULL,
`date_registered` DATETIME NULL,
`follow_up_date` DATETIME NULL,
`ownership_expires` DATETIME NULL,
`total_purchases` DECIMAL(12, 2) NULL,
`total_calls` INT NULL,
`facebook_name` VARCHAR(255) NULL,
`line_id` VARCHAR(128) NULL,
`street` VARCHAR(255) NULL,
`subdistrict` VARCHAR(128) NULL,
`district` VARCHAR(128) NULL,
`postal_code` VARCHAR(16) NULL,
`recipient_first_name` VARCHAR(128) NULL,
`recipient_last_name` VARCHAR(128) NULL,
`has_sold_before` BOOLEAN NULL,
`follow_up_count` INT NULL,
`last_follow_up_date` DATETIME NULL,
`last_sale_date` DATETIME NULL,
`is_in_waiting_basket` BOOLEAN NULL,
`waiting_basket_start_date` DATETIME NULL,
`followup_bonus_remaining` BOOLEAN NULL,
`is_blocked` BOOLEAN NULL,
`first_order_date` DATETIME NULL,
`last_order_date` DATETIME NULL,
`order_count` INT NULL,
`is_new_customer` BOOLEAN NULL,
`is_repeat_customer` BOOLEAN NULL,
`bucket_type` VARCHAR(16) NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `first_name` VARCHAR(128) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `last_name` VARCHAR(128) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `phone` VARCHAR(64) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `province` VARCHAR(128) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `assigned_to` INT NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `date_assigned` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `date_registered` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `follow_up_date` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `ownership_expires` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `total_purchases` DECIMAL(12, 2) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `total_calls` INT NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `facebook_name` VARCHAR(255) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `line_id` VARCHAR(128) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `street` VARCHAR(255) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `subdistrict` VARCHAR(128) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `district` VARCHAR(128) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `postal_code` VARCHAR(16) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `recipient_first_name` VARCHAR(128) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `recipient_last_name` VARCHAR(128) NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `has_sold_before` BOOLEAN NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `follow_up_count` INT NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `last_follow_up_date` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `last_sale_date` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `is_in_waiting_basket` BOOLEAN NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `waiting_basket_start_date` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `followup_bonus_remaining` BOOLEAN NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `is_blocked` BOOLEAN NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `first_order_date` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `last_order_date` DATETIME NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `order_count` INT NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `is_new_customer` BOOLEAN NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `is_repeat_customer` BOOLEAN NULL;
ALTER TABLE `customers` ADD COLUMN IF NOT EXISTS `bucket_type` VARCHAR(16) NULL;

CREATE TABLE IF NOT EXISTS `env` (
`id` INT AUTO_INCREMENT NOT NULL,
`key` VARCHAR(255) NULL,
`value` TEXT NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `env` ADD COLUMN IF NOT EXISTS `key` VARCHAR(255) NULL;
ALTER TABLE `env` ADD COLUMN IF NOT EXISTS `value` TEXT NULL;
ALTER TABLE `env` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `env` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `exports` (
`id` INT AUTO_INCREMENT NOT NULL,
`filename` VARCHAR(255) NULL,
`file_path` VARCHAR(1024) NULL,
`orders_count` INT NULL,
`user_id` INT NULL,
`exported_by` VARCHAR(128) NULL,
`created_at` DATETIME NULL,
`download_count` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `exports` ADD COLUMN IF NOT EXISTS `filename` VARCHAR(255) NULL;
ALTER TABLE `exports` ADD COLUMN IF NOT EXISTS `file_path` VARCHAR(1024) NULL;
ALTER TABLE `exports` ADD COLUMN IF NOT EXISTS `orders_count` INT NULL;
ALTER TABLE `exports` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `exports` ADD COLUMN IF NOT EXISTS `exported_by` VARCHAR(128) NULL;
ALTER TABLE `exports` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `exports` ADD COLUMN IF NOT EXISTS `download_count` INT NULL;

CREATE TABLE IF NOT EXISTS `marketing_ads_log` (
`id` INT AUTO_INCREMENT NOT NULL,
`page_id` INT NULL,
`user_id` INT NULL,
`date` DATE NULL,
`ads_cost` INT NULL,
`impressions` INT NULL,
`reach` INT NULL,
`clicks` INT NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `page_id` INT NULL;
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `date` DATE NULL;
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `ads_cost` INT NULL;
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `impressions` INT NULL;
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `reach` INT NULL;
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `clicks` INT NULL;
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `marketing_ads_log` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `marketing_user_page` (
`id` INT AUTO_INCREMENT NOT NULL,
`page_id` INT NULL,
`user_id` INT NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `marketing_user_page` ADD COLUMN IF NOT EXISTS `page_id` INT NULL;
ALTER TABLE `marketing_user_page` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `marketing_user_page` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `marketing_user_page` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `onecall_batch` (
`id` INT AUTO_INCREMENT NOT NULL,
`startdate` DATE NULL,
`enddate` DATE NULL,
`amount_record` INT NULL,
`created_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `onecall_batch` ADD COLUMN IF NOT EXISTS `startdate` DATE NULL;
ALTER TABLE `onecall_batch` ADD COLUMN IF NOT EXISTS `enddate` DATE NULL;
ALTER TABLE `onecall_batch` ADD COLUMN IF NOT EXISTS `amount_record` INT NULL;
ALTER TABLE `onecall_batch` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `onecall_log` (
`id` INT AUTO_INCREMENT NOT NULL,
`timestamp` TIMESTAMP NULL,
`duration` INT NULL,
`localParty` VARCHAR(255) NULL,
`remoteParty` VARCHAR(255) NULL,
`direction` VARCHAR(10) NULL,
`phone_telesale` VARCHAR(255) NULL,
`batch_id` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `onecall_log` ADD COLUMN IF NOT EXISTS `timestamp` TIMESTAMP NULL;
ALTER TABLE `onecall_log` ADD COLUMN IF NOT EXISTS `duration` INT NULL;
ALTER TABLE `onecall_log` ADD COLUMN IF NOT EXISTS `localParty` VARCHAR(255) NULL;
ALTER TABLE `onecall_log` ADD COLUMN IF NOT EXISTS `remoteParty` VARCHAR(255) NULL;
ALTER TABLE `onecall_log` ADD COLUMN IF NOT EXISTS `direction` VARCHAR(10) NULL;
ALTER TABLE `onecall_log` ADD COLUMN IF NOT EXISTS `phone_telesale` VARCHAR(255) NULL;
ALTER TABLE `onecall_log` ADD COLUMN IF NOT EXISTS `batch_id` INT NULL;

CREATE TABLE IF NOT EXISTS `order_boxes` (
`id` INT AUTO_INCREMENT NOT NULL,
`order_id` VARCHAR(32) NULL,
`box_number` INT NULL,
`cod_amount` DECIMAL(12, 2) NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `order_boxes` ADD COLUMN IF NOT EXISTS `order_id` VARCHAR(32) NULL;
ALTER TABLE `order_boxes` ADD COLUMN IF NOT EXISTS `box_number` INT NULL;
ALTER TABLE `order_boxes` ADD COLUMN IF NOT EXISTS `cod_amount` DECIMAL(12, 2) NULL;

CREATE TABLE IF NOT EXISTS `order_item_allocations` (
`id` INT AUTO_INCREMENT NOT NULL,
`order_id` VARCHAR(32) NULL,
`order_item_id` INT NULL,
`product_id` INT NULL,
`promotion_id` INT NULL,
`is_freebie` BOOLEAN NULL,
`required_quantity` INT NULL,
`allocated_quantity` INT NULL,
`warehouse_id` INT NULL,
`lot_number` VARCHAR(128) NULL,
`notes` TEXT NULL,
`created_by` INT NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `order_id` VARCHAR(32) NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `order_item_id` INT NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `product_id` INT NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `promotion_id` INT NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `is_freebie` BOOLEAN NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `required_quantity` INT NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `allocated_quantity` INT NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `warehouse_id` INT NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `lot_number` VARCHAR(128) NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `created_by` INT NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `order_item_allocations` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `order_items` (
`id` INT AUTO_INCREMENT NOT NULL,
`order_id` VARCHAR(32) NULL,
`parent_order_id` VARCHAR(32) NULL,
`product_id` INT NULL,
`product_name` VARCHAR(255) NULL,
`quantity` INT NULL,
`price_per_unit` DECIMAL(12, 2) NULL,
`discount` DECIMAL(12, 2) NULL,
`is_freebie` BOOLEAN NULL,
`box_number` INT NULL,
`promotion_id` INT NULL,
`parent_item_id` INT NULL,
`is_promotion_parent` BOOLEAN NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `order_id` VARCHAR(32) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `parent_order_id` VARCHAR(32) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `product_id` INT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `product_name` VARCHAR(255) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `quantity` INT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `price_per_unit` DECIMAL(12, 2) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `discount` DECIMAL(12, 2) NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `is_freebie` BOOLEAN NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `box_number` INT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `promotion_id` INT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `parent_item_id` INT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `is_promotion_parent` BOOLEAN NULL;

CREATE TABLE IF NOT EXISTS `order_slips` (
`id` INT AUTO_INCREMENT NOT NULL,
`amount` INT NULL,
`bank_account_id` INT NULL,
`transfer_date` DATETIME NULL,
`order_id` VARCHAR(32) NULL,
`url` VARCHAR(1024) NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `order_slips` ADD COLUMN IF NOT EXISTS `amount` INT NULL;
ALTER TABLE `order_slips` ADD COLUMN IF NOT EXISTS `bank_account_id` INT NULL;
ALTER TABLE `order_slips` ADD COLUMN IF NOT EXISTS `transfer_date` DATETIME NULL;
ALTER TABLE `order_slips` ADD COLUMN IF NOT EXISTS `order_id` VARCHAR(32) NULL;
ALTER TABLE `order_slips` ADD COLUMN IF NOT EXISTS `url` VARCHAR(1024) NULL;
ALTER TABLE `order_slips` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `order_slips` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `order_tracking_numbers` (
`id` INT AUTO_INCREMENT NOT NULL,
`order_id` VARCHAR(32) NULL,
`tracking_number` VARCHAR(128) NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `order_tracking_numbers` ADD COLUMN IF NOT EXISTS `order_id` VARCHAR(32) NULL;
ALTER TABLE `order_tracking_numbers` ADD COLUMN IF NOT EXISTS `tracking_number` VARCHAR(128) NULL;

CREATE TABLE IF NOT EXISTS `orders` (
`id` VARCHAR(32) NOT NULL,
`customer_id` VARCHAR(32) NULL,
`company_id` INT NULL,
`creator_id` INT NULL,
`order_date` DATETIME NULL,
`delivery_date` DATETIME NULL,
`street` VARCHAR(255) NULL,
`subdistrict` VARCHAR(128) NULL,
`district` VARCHAR(128) NULL,
`province` VARCHAR(128) NULL,
`postal_code` VARCHAR(16) NULL,
`recipient_first_name` VARCHAR(128) NULL,
`recipient_last_name` VARCHAR(128) NULL,
`shipping_cost` DECIMAL(12, 2) NULL,
`bill_discount` DECIMAL(12, 2) NULL,
`total_amount` DECIMAL(12, 2) NULL,
`slip_url` VARCHAR(1024) NULL,
`amount_paid` DECIMAL(12, 2) NULL,
`cod_amount` DECIMAL(12, 2) NULL,
`notes` TEXT NULL,
`ocr_payment_date` DATETIME NULL,
`sales_channel` VARCHAR(128) NULL,
`sales_channel_page_id` INT NULL,
`bank_account_id` INT NULL,
`transfer_date` DATETIME NULL,
`warehouse_id` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `customer_id` VARCHAR(32) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `creator_id` INT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `order_date` DATETIME NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_date` DATETIME NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `street` VARCHAR(255) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `subdistrict` VARCHAR(128) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `district` VARCHAR(128) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `province` VARCHAR(128) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `postal_code` VARCHAR(16) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `recipient_first_name` VARCHAR(128) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `recipient_last_name` VARCHAR(128) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `shipping_cost` DECIMAL(12, 2) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `bill_discount` DECIMAL(12, 2) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `total_amount` DECIMAL(12, 2) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `slip_url` VARCHAR(1024) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `amount_paid` DECIMAL(12, 2) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `cod_amount` DECIMAL(12, 2) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `ocr_payment_date` DATETIME NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `sales_channel` VARCHAR(128) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `sales_channel_page_id` INT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `bank_account_id` INT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `transfer_date` DATETIME NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `warehouse_id` INT NULL;

CREATE TABLE IF NOT EXISTS `page_list_user` (
`id` INT AUTO_INCREMENT NOT NULL,
`page_id` VARCHAR(255) NULL,
`page_user_id` VARCHAR(255) NULL,
`status` VARCHAR(50) NULL,
`still_in_list` BOOLEAN NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `page_list_user` ADD COLUMN IF NOT EXISTS `page_id` VARCHAR(255) NULL;
ALTER TABLE `page_list_user` ADD COLUMN IF NOT EXISTS `page_user_id` VARCHAR(255) NULL;
ALTER TABLE `page_list_user` ADD COLUMN IF NOT EXISTS `status` VARCHAR(50) NULL;
ALTER TABLE `page_list_user` ADD COLUMN IF NOT EXISTS `still_in_list` BOOLEAN NULL;
ALTER TABLE `page_list_user` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `page_list_user` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `page_user` (
`id` INT AUTO_INCREMENT NOT NULL,
`user_id` INT NULL,
`page_user_id` VARCHAR(255) NULL,
`page_user_name` VARCHAR(255) NULL,
`page_count` INT NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `page_user` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `page_user` ADD COLUMN IF NOT EXISTS `page_user_id` VARCHAR(255) NULL;
ALTER TABLE `page_user` ADD COLUMN IF NOT EXISTS `page_user_name` VARCHAR(255) NULL;
ALTER TABLE `page_user` ADD COLUMN IF NOT EXISTS `page_count` INT NULL;
ALTER TABLE `page_user` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `page_user` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `pages` (
`id` INT AUTO_INCREMENT NOT NULL,
`page_id` VARCHAR(255) NULL,
`name` VARCHAR(255) NULL,
`platform` VARCHAR(64) NULL,
`page_type` VARCHAR(50) NULL,
`url` VARCHAR(1024) NULL,
`company_id` INT NULL,
`active` BOOLEAN NULL,
`still_in_list` BOOLEAN NULL,
`user_count` INT NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `page_id` VARCHAR(255) NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `name` VARCHAR(255) NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `platform` VARCHAR(64) NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `page_type` VARCHAR(50) NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `url` VARCHAR(1024) NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `active` BOOLEAN NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `still_in_list` BOOLEAN NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `user_count` INT NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `pages` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `product_lots` (
`id` INT AUTO_INCREMENT NOT NULL,
`lot_number` VARCHAR(128) NULL,
`product_id` INT NULL,
`warehouse_id` INT NULL,
`purchase_date` DATE NULL,
`expiry_date` DATE NULL,
`quantity_received` DECIMAL(12, 2) NULL,
`quantity_remaining` DECIMAL(12, 2) NULL,
`unit_cost` DECIMAL(12, 2) NULL,
`supplier_id` INT NULL,
`supplier_invoice` VARCHAR(128) NULL,
`notes` TEXT NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `lot_number` VARCHAR(128) NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `product_id` INT NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `warehouse_id` INT NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `purchase_date` DATE NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `expiry_date` DATE NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `quantity_received` DECIMAL(12, 2) NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `quantity_remaining` DECIMAL(12, 2) NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `unit_cost` DECIMAL(12, 2) NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `supplier_id` INT NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `supplier_invoice` VARCHAR(128) NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `product_lots` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `products` (
`id` INT AUTO_INCREMENT NOT NULL,
`sku` VARCHAR(64) NULL,
`name` VARCHAR(255) NULL,
`description` TEXT NULL,
`category` VARCHAR(128) NULL,
`unit` VARCHAR(32) NULL,
`cost` DECIMAL(12, 2) NULL,
`price` DECIMAL(12, 2) NULL,
`stock` INT NULL,
`company_id` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `sku` VARCHAR(64) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `name` VARCHAR(255) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `description` TEXT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `category` VARCHAR(128) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `unit` VARCHAR(32) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `cost` DECIMAL(12, 2) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `price` DECIMAL(12, 2) NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `stock` INT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;

CREATE TABLE IF NOT EXISTS `promotion_items` (
`id` INT AUTO_INCREMENT NOT NULL,
`promotion_id` INT NULL,
`product_id` INT NULL,
`quantity` INT NULL,
`is_freebie` BOOLEAN NULL,
`price_override` DECIMAL(12, 2) NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `promotion_items` ADD COLUMN IF NOT EXISTS `promotion_id` INT NULL;
ALTER TABLE `promotion_items` ADD COLUMN IF NOT EXISTS `product_id` INT NULL;
ALTER TABLE `promotion_items` ADD COLUMN IF NOT EXISTS `quantity` INT NULL;
ALTER TABLE `promotion_items` ADD COLUMN IF NOT EXISTS `is_freebie` BOOLEAN NULL;
ALTER TABLE `promotion_items` ADD COLUMN IF NOT EXISTS `price_override` DECIMAL(12, 2) NULL;

CREATE TABLE IF NOT EXISTS `promotions` (
`id` INT AUTO_INCREMENT NOT NULL,
`sku` VARCHAR(64) NULL,
`name` VARCHAR(255) NULL,
`description` TEXT NULL,
`company_id` INT NULL,
`active` BOOLEAN NULL,
`start_date` DATETIME NULL,
`end_date` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `promotions` ADD COLUMN IF NOT EXISTS `sku` VARCHAR(64) NULL;
ALTER TABLE `promotions` ADD COLUMN IF NOT EXISTS `name` VARCHAR(255) NULL;
ALTER TABLE `promotions` ADD COLUMN IF NOT EXISTS `description` TEXT NULL;
ALTER TABLE `promotions` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `promotions` ADD COLUMN IF NOT EXISTS `active` BOOLEAN NULL;
ALTER TABLE `promotions` ADD COLUMN IF NOT EXISTS `start_date` DATETIME NULL;
ALTER TABLE `promotions` ADD COLUMN IF NOT EXISTS `end_date` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `role_permissions` (
`role` VARCHAR(64) NOT NULL,
`data` TEXT NULL,
  PRIMARY KEY (`role`)
);
ALTER TABLE `role_permissions` ADD COLUMN IF NOT EXISTS `data` TEXT NULL;

CREATE TABLE IF NOT EXISTS `stock_movements` (
`id` INT AUTO_INCREMENT NOT NULL,
`warehouse_id` INT NULL,
`product_id` INT NULL,
`quantity` INT NULL,
`lot_number` VARCHAR(128) NULL,
`reference_type` VARCHAR(64) NULL,
`reference_id` VARCHAR(64) NULL,
`reason` VARCHAR(255) NULL,
`notes` TEXT NULL,
`created_by` INT NULL,
`created_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `warehouse_id` INT NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `product_id` INT NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `quantity` INT NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `lot_number` VARCHAR(128) NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `reference_type` VARCHAR(64) NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `reference_id` VARCHAR(64) NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `reason` VARCHAR(255) NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `created_by` INT NULL;
ALTER TABLE `stock_movements` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `stock_reservations` (
`id` INT AUTO_INCREMENT NOT NULL,
`warehouse_id` INT NULL,
`product_id` INT NULL,
`order_id` VARCHAR(32) NULL,
`quantity` INT NULL,
`lot_number` VARCHAR(128) NULL,
`reserved_at` DATETIME NULL,
`expires_at` DATETIME NULL,
`created_by` INT NULL,
`created_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `warehouse_id` INT NULL;
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `product_id` INT NULL;
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `order_id` VARCHAR(32) NULL;
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `quantity` INT NULL;
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `lot_number` VARCHAR(128) NULL;
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `reserved_at` DATETIME NULL;
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `expires_at` DATETIME NULL;
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `created_by` INT NULL;
ALTER TABLE `stock_reservations` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `tags` (
`id` INT AUTO_INCREMENT NOT NULL,
`name` VARCHAR(128) NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `tags` ADD COLUMN IF NOT EXISTS `name` VARCHAR(128) NULL;

CREATE TABLE IF NOT EXISTS `user_daily_attendance` (
`id` BIGINT AUTO_INCREMENT NOT NULL,
`user_id` INT NULL,
`work_date` DATE NULL,
`first_login` DATETIME NULL,
`last_logout` DATETIME NULL,
`login_sessions` INT NULL,
`effective_seconds` INT NULL,
`percent_of_workday` DECIMAL(5, 2) NULL,
`attendance_value` DECIMAL(3, 1) NULL,
`computed_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `work_date` DATE NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `first_login` DATETIME NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `last_logout` DATETIME NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `login_sessions` INT NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `effective_seconds` INT NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `percent_of_workday` DECIMAL(5, 2) NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `attendance_value` DECIMAL(3, 1) NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `computed_at` DATETIME NULL;
ALTER TABLE `user_daily_attendance` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `user_login_history` (
`id` BIGINT AUTO_INCREMENT NOT NULL,
`user_id` INT NULL,
`login_time` DATETIME NULL,
`ip_address` VARCHAR(45) NULL,
`user_agent` TEXT NULL,
`logout_time` DATETIME NULL,
`session_duration` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `user_login_history` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `user_login_history` ADD COLUMN IF NOT EXISTS `login_time` DATETIME NULL;
ALTER TABLE `user_login_history` ADD COLUMN IF NOT EXISTS `ip_address` VARCHAR(45) NULL;
ALTER TABLE `user_login_history` ADD COLUMN IF NOT EXISTS `user_agent` TEXT NULL;
ALTER TABLE `user_login_history` ADD COLUMN IF NOT EXISTS `logout_time` DATETIME NULL;
ALTER TABLE `user_login_history` ADD COLUMN IF NOT EXISTS `session_duration` INT NULL;

CREATE TABLE IF NOT EXISTS `user_pancake_mapping` (
`id` INT AUTO_INCREMENT NOT NULL,
`id_user` INT NULL,
`id_panake` VARCHAR(255) NULL,
`created_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `user_pancake_mapping` ADD COLUMN IF NOT EXISTS `id_user` INT NULL;
ALTER TABLE `user_pancake_mapping` ADD COLUMN IF NOT EXISTS `id_panake` VARCHAR(255) NULL;
ALTER TABLE `user_pancake_mapping` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `user_tags` (
`user_id` INT NULL,
`tag_id` INT NULL
);
ALTER TABLE `user_tags` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `user_tags` ADD COLUMN IF NOT EXISTS `tag_id` INT NULL;

CREATE TABLE IF NOT EXISTS `users` (
`id` INT AUTO_INCREMENT NOT NULL,
`username` VARCHAR(64) NULL,
`password` VARCHAR(255) NULL,
`first_name` VARCHAR(128) NULL,
`last_name` VARCHAR(128) NULL,
`email` VARCHAR(255) NULL,
`phone` VARCHAR(64) NULL,
`role` VARCHAR(64) NULL,
`company_id` INT NULL,
`team_id` INT NULL,
`supervisor_id` INT NULL,
`id_oth` VARCHAR(255) NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
`last_login` DATETIME NULL,
`login_count` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `username` VARCHAR(64) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password` VARCHAR(255) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `first_name` VARCHAR(128) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `last_name` VARCHAR(128) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `phone` VARCHAR(64) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `role` VARCHAR(64) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `team_id` INT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `supervisor_id` INT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `id_oth` VARCHAR(255) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `last_login` DATETIME NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `login_count` INT NULL;

CREATE TABLE IF NOT EXISTS `warehouse_stocks` (
`id` INT AUTO_INCREMENT NOT NULL,
`warehouse_id` INT NULL,
`product_id` INT NULL,
`lot_number` VARCHAR(128) NULL,
`product_lot_id` INT NULL,
`quantity` INT NULL,
`reserved_quantity` INT NULL,
`available_quantity` INT NULL,
`expiry_date` DATE NULL,
`purchase_price` DECIMAL(12, 2) NULL,
`selling_price` DECIMAL(12, 2) NULL,
`location_in_warehouse` VARCHAR(255) NULL,
`notes` TEXT NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `warehouse_id` INT NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `product_id` INT NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `lot_number` VARCHAR(128) NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `product_lot_id` INT NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `quantity` INT NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `reserved_quantity` INT NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `available_quantity` INT NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `expiry_date` DATE NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `purchase_price` DECIMAL(12, 2) NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `selling_price` DECIMAL(12, 2) NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `location_in_warehouse` VARCHAR(255) NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `notes` TEXT NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `warehouse_stocks` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `warehouses` (
`id` INT AUTO_INCREMENT NOT NULL,
`name` VARCHAR(255) NULL,
`company_id` INT NULL,
`address` TEXT NULL,
`province` VARCHAR(128) NULL,
`district` VARCHAR(128) NULL,
`subdistrict` VARCHAR(128) NULL,
`postal_code` VARCHAR(16) NULL,
`phone` VARCHAR(64) NULL,
`email` VARCHAR(255) NULL,
`manager_name` VARCHAR(255) NULL,
`manager_phone` VARCHAR(64) NULL,
`responsible_provinces` TEXT NULL,
`is_active` BOOLEAN NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `name` VARCHAR(255) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `address` TEXT NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `province` VARCHAR(128) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `district` VARCHAR(128) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `subdistrict` VARCHAR(128) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `postal_code` VARCHAR(16) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `phone` VARCHAR(64) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `email` VARCHAR(255) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `manager_name` VARCHAR(255) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `manager_phone` VARCHAR(64) NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `responsible_provinces` TEXT NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `is_active` BOOLEAN NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `warehouses` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `page_engagement_batch` (
`id` INT AUTO_INCREMENT NOT NULL,
`date_range` VARCHAR(100) NULL,
`created_at` TIMESTAMP NULL,
`records_count` INT NULL,
`user_id` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `page_engagement_batch` ADD COLUMN IF NOT EXISTS `date_range` VARCHAR(100) NULL;
ALTER TABLE `page_engagement_batch` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `page_engagement_batch` ADD COLUMN IF NOT EXISTS `records_count` INT NULL;
ALTER TABLE `page_engagement_batch` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;

CREATE TABLE IF NOT EXISTS `page_engagement_log` (
`id` INT AUTO_INCREMENT NOT NULL,
`batch_id` INT NULL,
`page_id` VARCHAR(50) NULL,
`date` DATE NULL,
`inbox` INT NULL,
`comment` INT NULL,
`total` INT NULL,
`new_customer_replied` INT NULL,
`customer_engagement_new_inbox` INT NULL,
`order_count` INT NULL,
`old_order_count` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `batch_id` INT NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `page_id` VARCHAR(50) NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `date` DATE NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `inbox` INT NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `comment` INT NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `total` INT NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `new_customer_replied` INT NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `customer_engagement_new_inbox` INT NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `order_count` INT NULL;
ALTER TABLE `page_engagement_log` ADD COLUMN IF NOT EXISTS `old_order_count` INT NULL;

CREATE TABLE IF NOT EXISTS `page_stats_batch` (
`id` INT AUTO_INCREMENT NOT NULL,
`date_range` VARCHAR(255) NULL,
`created_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `page_stats_batch` ADD COLUMN IF NOT EXISTS `date_range` VARCHAR(255) NULL;
ALTER TABLE `page_stats_batch` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `page_stats_log` (
`id` INT AUTO_INCREMENT NOT NULL,
`batch_id` INT NULL,
`page_id` VARCHAR(255) NULL,
`time_column` VARCHAR(255) NULL,
`new_customers` INT NULL,
`total_phones` INT NULL,
`new_phones` INT NULL,
`total_comments` INT NULL,
`total_chats` INT NULL,
`total_page_comments` INT NULL,
`total_page_chats` INT NULL,
`new_chats` INT NULL,
`chats_from_old_customers` INT NULL,
`web_logged_in` INT NULL,
`web_guest` INT NULL,
`orders_count` INT NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `batch_id` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `page_id` VARCHAR(255) NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `time_column` VARCHAR(255) NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `new_customers` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `total_phones` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `new_phones` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `total_comments` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `total_chats` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `total_page_comments` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `total_page_chats` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `new_chats` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `chats_from_old_customers` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `web_logged_in` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `web_guest` INT NULL;
ALTER TABLE `page_stats_log` ADD COLUMN IF NOT EXISTS `orders_count` INT NULL;

CREATE TABLE IF NOT EXISTS `platforms` (
`id` INT AUTO_INCREMENT NOT NULL,
`name` VARCHAR(64) NULL,
`display_name` VARCHAR(128) NULL,
`description` VARCHAR(255) NULL,
`company_id` INT NULL,
`active` BOOLEAN NULL,
`sort_order` INT NULL,
`show_pages_from` VARCHAR(64) NULL,
`created_at` TIMESTAMP NULL,
`updated_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `name` VARCHAR(64) NULL;
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `display_name` VARCHAR(128) NULL;
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `description` VARCHAR(255) NULL;
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `active` BOOLEAN NULL;
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `sort_order` INT NULL;
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `show_pages_from` VARCHAR(64) NULL;
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `created_at` TIMESTAMP NULL;
ALTER TABLE `platforms` ADD COLUMN IF NOT EXISTS `updated_at` TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS `bank_account` (
`id` INT AUTO_INCREMENT NOT NULL,
`company_id` INT NULL,
`bank` VARCHAR(100) NULL,
`bank_number` VARCHAR(50) NULL,
`is_active` BOOLEAN NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
`deleted_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `bank_account` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `bank_account` ADD COLUMN IF NOT EXISTS `bank` VARCHAR(100) NULL;
ALTER TABLE `bank_account` ADD COLUMN IF NOT EXISTS `bank_number` VARCHAR(50) NULL;
ALTER TABLE `bank_account` ADD COLUMN IF NOT EXISTS `is_active` BOOLEAN NULL;
ALTER TABLE `bank_account` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `bank_account` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;
ALTER TABLE `bank_account` ADD COLUMN IF NOT EXISTS `deleted_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `cod_records` (
`id` INT AUTO_INCREMENT NOT NULL,
`tracking_number` VARCHAR(128) NULL,
`delivery_start_date` DATE NULL,
`delivery_end_date` DATE NULL,
`cod_amount` DECIMAL(12, 2) NULL,
`received_amount` DECIMAL(12, 2) NULL,
`difference` DECIMAL(12, 2) NULL,
`company_id` INT NULL,
`created_by` INT NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `tracking_number` VARCHAR(128) NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `delivery_start_date` DATE NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `delivery_end_date` DATE NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `cod_amount` DECIMAL(12, 2) NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `received_amount` DECIMAL(12, 2) NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `difference` DECIMAL(12, 2) NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `created_by` INT NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `cod_records` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `notification_read_status` (
`id` INT AUTO_INCREMENT NOT NULL,
`notification_id` VARCHAR(50) NULL,
`user_id` INT NULL,
`read_at` DATETIME NULL,
`created_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `notification_read_status` ADD COLUMN IF NOT EXISTS `notification_id` VARCHAR(50) NULL;
ALTER TABLE `notification_read_status` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `notification_read_status` ADD COLUMN IF NOT EXISTS `read_at` DATETIME NULL;
ALTER TABLE `notification_read_status` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `notification_roles` (
`id` INT AUTO_INCREMENT NOT NULL,
`notification_id` VARCHAR(50) NULL,
`created_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `notification_roles` ADD COLUMN IF NOT EXISTS `notification_id` VARCHAR(50) NULL;
ALTER TABLE `notification_roles` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `notification_settings` (
`id` INT AUTO_INCREMENT NOT NULL,
`user_id` INT NULL,
`notification_type` VARCHAR(50) NULL,
`in_app_enabled` BOOLEAN NULL,
`email_enabled` BOOLEAN NULL,
`sms_enabled` BOOLEAN NULL,
`business_hours_only` BOOLEAN NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `notification_settings` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `notification_settings` ADD COLUMN IF NOT EXISTS `notification_type` VARCHAR(50) NULL;
ALTER TABLE `notification_settings` ADD COLUMN IF NOT EXISTS `in_app_enabled` BOOLEAN NULL;
ALTER TABLE `notification_settings` ADD COLUMN IF NOT EXISTS `email_enabled` BOOLEAN NULL;
ALTER TABLE `notification_settings` ADD COLUMN IF NOT EXISTS `sms_enabled` BOOLEAN NULL;
ALTER TABLE `notification_settings` ADD COLUMN IF NOT EXISTS `business_hours_only` BOOLEAN NULL;
ALTER TABLE `notification_settings` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `notification_settings` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `notification_users` (
`id` INT AUTO_INCREMENT NOT NULL,
`notification_id` VARCHAR(50) NULL,
`user_id` INT NULL,
`created_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `notification_users` ADD COLUMN IF NOT EXISTS `notification_id` VARCHAR(50) NULL;
ALTER TABLE `notification_users` ADD COLUMN IF NOT EXISTS `user_id` INT NULL;
ALTER TABLE `notification_users` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `notifications` (
`id` VARCHAR(50) NOT NULL,
`title` VARCHAR(255) NULL,
`message` TEXT NULL,
`timestamp` DATETIME NULL,
`is_read` BOOLEAN NULL,
`related_id` VARCHAR(50) NULL,
`page_id` INT NULL,
`page_name` VARCHAR(255) NULL,
`platform` VARCHAR(50) NULL,
`previous_value` DECIMAL(10, 2) NULL,
`current_value` DECIMAL(10, 2) NULL,
`percentage_change` DECIMAL(5, 2) NULL,
`action_url` VARCHAR(255) NULL,
`action_text` VARCHAR(100) NULL,
`metadata` JSON NULL,
`created_at` DATETIME NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `title` VARCHAR(255) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `message` TEXT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `timestamp` DATETIME NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `is_read` BOOLEAN NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `related_id` VARCHAR(50) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `page_id` INT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `page_name` VARCHAR(255) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `platform` VARCHAR(50) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `previous_value` DECIMAL(10, 2) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `current_value` DECIMAL(10, 2) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `percentage_change` DECIMAL(5, 2) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `action_url` VARCHAR(255) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `action_text` VARCHAR(100) NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `metadata` JSON NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `created_at` DATETIME NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;

CREATE TABLE IF NOT EXISTS `order_sequences` (
`id` INT AUTO_INCREMENT NOT NULL,
`company_id` INT NULL,
`prefix` VARCHAR(8) NULL,
`last_sequence` INT NULL,
`updated_at` DATETIME NULL,
  PRIMARY KEY (`id`)
);
ALTER TABLE `order_sequences` ADD COLUMN IF NOT EXISTS `company_id` INT NULL;
ALTER TABLE `order_sequences` ADD COLUMN IF NOT EXISTS `prefix` VARCHAR(8) NULL;
ALTER TABLE `order_sequences` ADD COLUMN IF NOT EXISTS `last_sequence` INT NULL;
ALTER TABLE `order_sequences` ADD COLUMN IF NOT EXISTS `updated_at` DATETIME NULL;
