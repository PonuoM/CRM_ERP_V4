-- เพิ่ม column edited_by และ edited_at เพื่อเก็บสถิติการแก้ไข
-- user_id = ผู้บันทึกครั้งแรก (ไม่เปลี่ยน)
-- edited_by = ผู้แก้ไขล่าสุด (system admin)
-- edited_at = เวลาที่แก้ไขล่าสุด

ALTER TABLE `marketing_ads_log`
    ADD COLUMN `edited_by` INT NULL DEFAULT NULL AFTER `clicks`,
    ADD COLUMN `edited_at` TIMESTAMP NULL DEFAULT NULL AFTER `edited_by`;

-- ทำเหมือนกันสำหรับ product_ads_log (ถ้ามี)
-- ALTER TABLE `marketing_product_ads_log`
--     ADD COLUMN `edited_by` INT NULL DEFAULT NULL AFTER `clicks`,
--     ADD COLUMN `edited_at` TIMESTAMP NULL DEFAULT NULL AFTER `edited_by`;
