-- ============================================================================
-- Migration: Proxy Sale (ขายแทน) — บันทึกว่าใครลงออเดอร์แทนใคร
-- File: 064_add_proxy_sale_to_orders.sql
-- Created: 2026-07-16
-- Description:
--   กรณีฉุกเฉิน (เช่น Telesale ติดวันหยุด/นอกเวลา แล้วถูก geofencing บล็อก)
--   ต้องมีคนอื่นลงออเดอร์แทนให้ได้ โดยยอดขาย/ค่าคอมยังเข้าที่ Telesale เจ้าของ
--
--   creator_id       = คนที่ฝากขาย (Telesale เจ้าของยอด) — ใช้คิดยอด/คอมเหมือนเดิม
--   proxy_creator_id = คนที่ลงออเดอร์แทนจริง (NULL = ลงเอง ไม่ใช่การขายแทน)
--
--   backend เป็นคน stamp proxy_creator_id จาก token ของคนที่ล็อกอินเสมอ
--   client ส่งค่านี้มาเองไม่ได้ → กันการสวมชื่อ/แกล้งกัน
--
-- ⚠️ PRODUCTION SAFETY:
--   orders มี ~395k แถว และมีคนลงออเดอร์ตลอดเวลา จึงแยกเป็น 3 statement:
--   1) ADD COLUMN ท้ายตาราง + ALGORITHM=INSTANT  → ไม่ rebuild, ไม่ล็อก (ห้ามใส่ AFTER
--      เพราะจะบังคับให้ InnoDB rebuild ทั้งตารางและบล็อกการเขียน)
--   2) ADD INDEX + LOCK=NONE                     → online, เขียนได้ระหว่างทำ
--   3) ADD FOREIGN KEY + LOCK=NONE               → online
-- ============================================================================

-- STEP 1: เพิ่มคอลัมน์ (instant — ต้องอยู่ท้ายตาราง ห้ามใส่ AFTER)
ALTER TABLE `orders`
  ADD COLUMN `proxy_creator_id` INT NULL
    COMMENT 'ผู้ลงออเดอร์แทนจริง (NULL = creator_id ลงเอง)',
  ADD COLUMN `proxy_reason` VARCHAR(255) NULL
    COMMENT 'เหตุผลที่ขายแทน (ไม่บังคับ)',
  ALGORITHM=INSTANT;

-- STEP 2: index สำหรับ query ว่าใครลงแทนบ้าง
ALTER TABLE `orders`
  ADD INDEX `idx_orders_proxy_creator` (`proxy_creator_id`),
  ALGORITHM=INPLACE, LOCK=NONE;

-- STEP 3: FK ให้สอดคล้องกับ fk_orders_creator เดิม
-- MariaDB ไม่ยอมให้ ADD FOREIGN KEY แบบ INPLACE ถ้า foreign_key_checks ยังเปิด
-- (error: "Adding foreign keys needs foreign_key_checks=OFF. Try ALGORITHM=COPY")
-- ห้ามใช้ ALGORITHM=COPY บน prod เพราะจะ rebuild ทั้งตารางและล็อกการเขียน
-- ปิด check ได้อย่างปลอดภัยตรงนี้ เพราะ STEP 1 เพิ่งสร้างคอลัมน์ → ทุกแถวเป็น NULL
-- จึงไม่มีข้อมูลเดิมให้ validate (ยืนยันด้วย: SELECT COUNT(*) FROM orders WHERE proxy_creator_id IS NOT NULL → ต้องได้ 0)
SET SESSION foreign_key_checks = 0;
ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_proxy_creator`
    FOREIGN KEY (`proxy_creator_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ALGORITHM=INPLACE, LOCK=NONE;
SET SESSION foreign_key_checks = 1;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- SHOW COLUMNS FROM orders LIKE 'proxy%';
-- SELECT id, creator_id, proxy_creator_id, proxy_reason FROM orders WHERE proxy_creator_id IS NOT NULL;

-- ============================================================================
-- ROLLBACK
-- ============================================================================
-- ALTER TABLE `orders` DROP FOREIGN KEY `fk_orders_proxy_creator`;
-- ALTER TABLE `orders` DROP INDEX `idx_orders_proxy_creator`;
-- ALTER TABLE `orders` DROP COLUMN `proxy_reason`, DROP COLUMN `proxy_creator_id`;
