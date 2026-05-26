-- Migration to add sales snapshot field to quota allocations

ALTER TABLE `quota_allocations` 
ADD COLUMN `sales_at_allocation` DECIMAL(15,2) DEFAULT NULL COMMENT 'ยอดขายที่ใช้คำนวณตอนให้โควตา' AFTER `quantity`;
