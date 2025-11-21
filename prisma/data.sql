-- Data export generated from Prisma schema
-- WARNING: This file may be large.

-- Table activities: no rows

-- Table ad_spend: no rows

-- Table address_districts: no rows

-- Table address_geographies: no rows

-- Table address_provinces: no rows

-- Table address_sub_districts: no rows

-- Table appointments: no rows

-- Table call_history: no rows

-- Data for table companies
INSERT INTO `companies` (`id`, `name`, `address`, `phone`, `email`, `tax_id`, `created_at`, `updated_at`) VALUES (1, 'Alpha Seeds Co.', NULL, NULL, NULL, NULL, '2025-11-21 11:56:10', '2025-11-21 11:56:10');
INSERT INTO `companies` (`id`, `name`, `address`, `phone`, `email`, `tax_id`, `created_at`, `updated_at`) VALUES (2, 'Company B Ltd.', NULL, NULL, NULL, NULL, '2025-11-21 11:56:10', '2025-11-21 11:56:10');

-- Table customer_address: no rows

-- Table customer_assignment_history: no rows

-- Table customer_blocks: no rows

-- Table customer_logs: no rows

-- Data for table customer_tags
INSERT INTO `customer_tags` (`customer_id`, `tag_id`) VALUES ('CUS-100000001', 1);

-- Data for table customers
INSERT INTO `customers` (`id`, `first_name`, `last_name`, `phone`, `email`, `province`, `company_id`, `assigned_to`, `date_assigned`, `date_registered`, `follow_up_date`, `ownership_expires`, `total_purchases`, `total_calls`, `facebook_name`, `line_id`, `street`, `subdistrict`, `district`, `postal_code`, `recipient_first_name`, `recipient_last_name`, `has_sold_before`, `follow_up_count`, `last_follow_up_date`, `last_sale_date`, `is_in_waiting_basket`, `waiting_basket_start_date`, `followup_bonus_remaining`, `is_blocked`, `first_order_date`, `last_order_date`, `order_count`, `is_new_customer`, `is_repeat_customer`, `bucket_type`) VALUES ('CUS-100000001', 'Mana', 'Jaidee', '0812345678', 'mana.j@example.com', 'Bangkok', 1, 2, '2025-11-16 11:56:10', '2025-11-11 11:56:10', '2025-11-23 11:56:10', '2026-02-09 11:56:10', 5850, 15, 'Mana Jaidee', 'mana.j', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', '10110', NULL, NULL, 0, 0, NULL, NULL, 0, NULL, 1, 0, NULL, NULL, 0, 0, 0, NULL);

-- Table env: no rows

-- Table exports: no rows

-- Table marketing_ads_log: no rows

-- Table marketing_user_page: no rows

-- Table onecall_batch: no rows

-- Table onecall_log: no rows

-- Table order_boxes: no rows

-- Table order_item_allocations: no rows

-- Data for table order_items
INSERT INTO `order_items` (`id`, `order_id`, `parent_order_id`, `product_id`, `product_name`, `quantity`, `price_per_unit`, `discount`, `is_freebie`, `box_number`, `promotion_id`, `parent_item_id`, `is_promotion_parent`) VALUES (1, 'ORD-100000001', 'ORD-100000001', 1, 'Seed A', 10, 200, 0, 0, 1, NULL, NULL, 0);
INSERT INTO `order_items` (`id`, `order_id`, `parent_order_id`, `product_id`, `product_name`, `quantity`, `price_per_unit`, `discount`, `is_freebie`, `box_number`, `promotion_id`, `parent_item_id`, `is_promotion_parent`) VALUES (2, 'ORD-100000002', 'ORD-100000002', 1, 'Seed A', 8, 200, 0, 0, 1, NULL, NULL, 0);
INSERT INTO `order_items` (`id`, `order_id`, `parent_order_id`, `product_id`, `product_name`, `quantity`, `price_per_unit`, `discount`, `is_freebie`, `box_number`, `promotion_id`, `parent_item_id`, `is_promotion_parent`) VALUES (3, 'ORD-100000003', 'ORD-100000003', 1, 'Seed A', 6, 200, 0, 0, 1, NULL, NULL, 0);
INSERT INTO `order_items` (`id`, `order_id`, `parent_order_id`, `product_id`, `product_name`, `quantity`, `price_per_unit`, `discount`, `is_freebie`, `box_number`, `promotion_id`, `parent_item_id`, `is_promotion_parent`) VALUES (4, 'ORD-100000004', 'ORD-100000004', 1, 'Seed A', 9, 200, 0, 0, 1, NULL, NULL, 0);

-- Table order_slips: no rows

-- Table order_tracking_numbers: no rows

-- Data for table orders
INSERT INTO `orders` (`id`, `customer_id`, `company_id`, `creator_id`, `order_date`, `delivery_date`, `street`, `subdistrict`, `district`, `province`, `postal_code`, `recipient_first_name`, `recipient_last_name`, `shipping_cost`, `bill_discount`, `total_amount`, `slip_url`, `amount_paid`, `cod_amount`, `notes`, `ocr_payment_date`, `sales_channel`, `sales_channel_page_id`, `bank_account_id`, `transfer_date`, `warehouse_id`) VALUES ('ORD-100000001', 'CUS-100000001', 1, 2, '2025-11-20 11:56:10', '2025-11-22 11:56:10', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', NULL, NULL, 50, 0, 2050, NULL, NULL, NULL, 'First test order', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `orders` (`id`, `customer_id`, `company_id`, `creator_id`, `order_date`, `delivery_date`, `street`, `subdistrict`, `district`, `province`, `postal_code`, `recipient_first_name`, `recipient_last_name`, `shipping_cost`, `bill_discount`, `total_amount`, `slip_url`, `amount_paid`, `cod_amount`, `notes`, `ocr_payment_date`, `sales_channel`, `sales_channel_page_id`, `bank_account_id`, `transfer_date`, `warehouse_id`) VALUES ('ORD-100000002', 'CUS-100000001', 1, 2, '2025-11-19 11:56:10', '2025-11-23 11:56:10', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', NULL, NULL, 60, 0, 1560, 'https://example.com/slip1.jpg', 1560, NULL, 'Transfer order', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `orders` (`id`, `customer_id`, `company_id`, `creator_id`, `order_date`, `delivery_date`, `street`, `subdistrict`, `district`, `province`, `postal_code`, `recipient_first_name`, `recipient_last_name`, `shipping_cost`, `bill_discount`, `total_amount`, `slip_url`, `amount_paid`, `cod_amount`, `notes`, `ocr_payment_date`, `sales_channel`, `sales_channel_page_id`, `bank_account_id`, `transfer_date`, `warehouse_id`) VALUES ('ORD-100000003', 'CUS-100000001', 1, 2, '2025-11-18 11:56:10', '2025-11-24 11:56:10', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', NULL, NULL, 40, 0, 1200, NULL, NULL, NULL, 'Unpaid transfer order', NULL, NULL, NULL, NULL, NULL, NULL);
INSERT INTO `orders` (`id`, `customer_id`, `company_id`, `creator_id`, `order_date`, `delivery_date`, `street`, `subdistrict`, `district`, `province`, `postal_code`, `recipient_first_name`, `recipient_last_name`, `shipping_cost`, `bill_discount`, `total_amount`, `slip_url`, `amount_paid`, `cod_amount`, `notes`, `ocr_payment_date`, `sales_channel`, `sales_channel_page_id`, `bank_account_id`, `transfer_date`, `warehouse_id`) VALUES ('ORD-100000004', 'CUS-100000001', 1, 2, '2025-11-17 11:56:10', '2025-11-25 11:56:10', '123 Sukhumvit Rd', 'Khlong Toei', 'Khlong Toei', 'Bangkok', '10110', NULL, NULL, 70, 0, 1800, NULL, NULL, NULL, 'Pay after delivery order', NULL, NULL, NULL, NULL, NULL, NULL);

-- Table page_list_user: no rows

-- Table page_user: no rows

-- Table pages: no rows

-- Table product_lots: no rows

-- Data for table products
INSERT INTO `products` (`id`, `sku`, `name`, `description`, `category`, `unit`, `cost`, `price`, `stock`, `company_id`) VALUES (1, 'SKU-001', 'Seed A', 'High yield seed', 'Seeds', 'bag', 100, 200, 500, 1);

-- Data for table promotion_items
INSERT INTO `promotion_items` (`id`, `promotion_id`, `product_id`, `quantity`, `is_freebie`, `price_override`) VALUES (1, 1, 1, 4, 0, NULL);
INSERT INTO `promotion_items` (`id`, `promotion_id`, `product_id`, `quantity`, `is_freebie`, `price_override`) VALUES (2, 1, 1, 1, 1, 0);
INSERT INTO `promotion_items` (`id`, `promotion_id`, `product_id`, `quantity`, `is_freebie`, `price_override`) VALUES (3, 2, 1, 3, 0, NULL);
INSERT INTO `promotion_items` (`id`, `promotion_id`, `product_id`, `quantity`, `is_freebie`, `price_override`) VALUES (4, 2, 1, 1, 1, 0);

-- Data for table promotions
INSERT INTO `promotions` (`id`, `sku`, `name`, `description`, `company_id`, `active`, `start_date`, `end_date`) VALUES (1, 'PROMO-001', 'ปุ๋ย แสงราชสีห์ ซื้อ 4 แถม 1', 'ซื้อ 4 แถม 1 เซ็ตปุ๋ยแสงราชสีห์', 1, 1, NULL, NULL);
INSERT INTO `promotions` (`id`, `sku`, `name`, `description`, `company_id`, `active`, `start_date`, `end_date`) VALUES (2, 'PROMO-002', 'ชุดทดลองเมล็ด 3 แถม 1', 'เลือก 3 ซอง แถม 1 ซอง', 1, 1, NULL, NULL);
INSERT INTO `promotions` (`id`, `sku`, `name`, `description`, `company_id`, `active`, `start_date`, `end_date`) VALUES (3, 'PROMO-003', 'โปรแพ็คประหยัด 10%', 'ชุดสินค้ารวม ลด10%', 1, 1, NULL, NULL);

-- Table role_permissions: no rows

-- Table stock_movements: no rows

-- Table stock_reservations: no rows

-- Data for table tags
INSERT INTO `tags` (`id`, `name`) VALUES (1, 'VIP');
INSERT INTO `tags` (`id`, `name`) VALUES (2, 'Lead');

-- Table user_daily_attendance: no rows

-- Table user_login_history: no rows

-- Table user_pancake_mapping: no rows

-- Table user_tags: no rows

-- Data for table users
INSERT INTO `users` (`id`, `username`, `password`, `first_name`, `last_name`, `email`, `phone`, `role`, `company_id`, `team_id`, `supervisor_id`, `id_oth`, `created_at`, `updated_at`, `last_login`, `login_count`) VALUES (1, 'admin1', 'admin123', 'Somchai', 'Admin', 'admin1@example.com', '0810000001', 'Admin Page', 1, NULL, NULL, NULL, '2025-11-21 11:56:10', '2025-11-21 11:56:10', NULL, 0);
INSERT INTO `users` (`id`, `username`, `password`, `first_name`, `last_name`, `email`, `phone`, `role`, `company_id`, `team_id`, `supervisor_id`, `id_oth`, `created_at`, `updated_at`, `last_login`, `login_count`) VALUES (2, 'telesale1', 'telesale123', 'Somsri', 'Telesale', 'telesale1@example.com', '0810000002', 'Telesale', 1, 1, 3, NULL, '2025-11-21 11:56:10', '2025-11-21 11:56:10', NULL, 0);
INSERT INTO `users` (`id`, `username`, `password`, `first_name`, `last_name`, `email`, `phone`, `role`, `company_id`, `team_id`, `supervisor_id`, `id_oth`, `created_at`, `updated_at`, `last_login`, `login_count`) VALUES (3, 'supervisor1', 'supervisor123', 'Somying', 'Supervisor', 'supervisor1@example.com', '0810000003', 'Supervisor Telesale', 1, 1, NULL, NULL, '2025-11-21 11:56:10', '2025-11-21 11:56:10', NULL, 0);
INSERT INTO `users` (`id`, `username`, `password`, `first_name`, `last_name`, `email`, `phone`, `role`, `company_id`, `team_id`, `supervisor_id`, `id_oth`, `created_at`, `updated_at`, `last_login`, `login_count`) VALUES (4, 'backoffice1', 'backoffice123', 'Sommai', 'Backoffice', 'backoffice1@example.com', '0810000004', 'Backoffice', 1, NULL, NULL, NULL, '2025-11-21 11:56:10', '2025-11-21 11:56:10', NULL, 0);
INSERT INTO `users` (`id`, `username`, `password`, `first_name`, `last_name`, `email`, `phone`, `role`, `company_id`, `team_id`, `supervisor_id`, `id_oth`, `created_at`, `updated_at`, `last_login`, `login_count`) VALUES (5, 'owner1', 'owner123', 'Owner', 'Control', 'owner1@example.com', '0810000005', 'Admin Control', 1, NULL, NULL, NULL, '2025-11-21 11:56:10', '2025-11-21 11:56:10', NULL, 0);
INSERT INTO `users` (`id`, `username`, `password`, `first_name`, `last_name`, `email`, `phone`, `role`, `company_id`, `team_id`, `supervisor_id`, `id_oth`, `created_at`, `updated_at`, `last_login`, `login_count`) VALUES (6, 'superadmin', 'superadmin123', 'Super', 'Admin', 'superadmin@example.com', '0810000000', 'Super Admin', 1, NULL, NULL, NULL, '2025-11-21 11:56:10', '2025-11-21 11:56:10', NULL, 0);

-- Table warehouse_stocks: no rows

-- Table warehouses: no rows

-- Table page_engagement_batch: no rows

-- Table page_engagement_log: no rows

-- Table page_stats_batch: no rows

-- Table page_stats_log: no rows

-- Table platforms: no rows

-- Table bank_account: no rows

-- Table cod_records: no rows

-- Table notification_read_status: no rows

-- Table notification_roles: no rows

-- Table notification_settings: no rows

-- Table notification_users: no rows

-- Table notifications: no rows

-- Table order_sequences: no rows
