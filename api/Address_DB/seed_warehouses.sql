-- Warehouses Table Seeder
-- This file contains sample data for the warehouses table

INSERT INTO `warehouses` (`id`, `name`, `company_id`, `address`, `province`, `district`, `subdistrict`, `postal_code`, `phone`, `email`, `manager_name`, `manager_phone`, `responsible_provinces`, `is_active`, `created_at`)
VALUES
(0, 'คลัง Airport', '1', 'nothing', 'nothing', 'nothing', 'nothing', '12345', '02-123-4567', NULL, 'สมชาย ใจดี', '081-234-5678', '[\"everywhere\"]', '1', NOW());
