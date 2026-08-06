-- 076: หมายเหตุแบบไทม์ไลน์ + สิทธิ์จัดการรายบัญชี ของระบบ "แพลนรับสินค้า"
--
-- 1) stock_arrival_plan_notes
--    บันทึกความคืบหน้าของแต่ละแพลนแบบต่อท้ายเรื่อย ๆ (ของกำลังออกแล้ว / ติดกรมศุลกากร /
--    ของมาไม่ครบ ฯลฯ) แสดงเป็นไทม์ไลน์ในแถบด้านขวาของปฏิทิน
--    - ผูกที่ระดับ "แพลน" (stock_arrival_plans.id) ไม่ใช่ระดับรายการสินค้า
--    - ลบได้เฉพาะคนที่พิมพ์เอง (Super Admin ลบแทนได้ในกรณีฉุกเฉิน)
--    - ใช้ soft delete (deleted_at/deleted_by) เพื่อให้ยังตรวจย้อนหลังได้ว่าใครลบอะไรออก
--
-- 2) stock_arrival_plan_managers
--    รายชื่อบัญชีที่ได้รับสิทธิ์ "เพิ่ม/ลบแพลน + เพิ่มหมายเหตุ"
--    Super Admin / Admin Control / CEO มีสิทธิ์อยู่แล้วโดยไม่ต้องมีแถวในตารางนี้
--    (ดู api/inventory/stock_plan_permission.php — ต้องแก้ทั้งสองที่ถ้าจะเปลี่ยนกติกา)
--    การถอนสิทธิ์ = ลบแถวทิ้ง (can_manage=0 เก็บไว้เผื่อกรณี toggle ปิดชั่วคราว)

CREATE TABLE IF NOT EXISTS `stock_arrival_plan_notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `plan_id` int(11) NOT NULL,
  `note` text NOT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `deleted_at` datetime DEFAULT NULL,
  `deleted_by` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sapn_plan` (`plan_id`,`deleted_at`,`created_at`),
  CONSTRAINT `fk_sapn_plan` FOREIGN KEY (`plan_id`) REFERENCES `stock_arrival_plans` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ไทม์ไลน์หมายเหตุของแพลนรับสินค้า';

CREATE TABLE IF NOT EXISTS `stock_arrival_plan_managers` (
  `user_id` int(11) NOT NULL,
  `can_manage` tinyint(1) NOT NULL DEFAULT 1,
  `granted_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_sapm_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='บัญชีที่ได้รับสิทธิ์เพิ่ม/ลบแพลนรับสินค้า';

-- Seed: คนที่ใช้งานระบบนี้อยู่แล้วต้องไม่ถูกตัดสิทธิ์ตอน deploy
-- (กรอง IN (SELECT ...) ผ่าน users เพื่อกัน created_by ที่ชี้ไปยัง user ที่ถูกลบไปแล้ว -> FK error)
INSERT IGNORE INTO `stock_arrival_plan_managers` (`user_id`, `can_manage`)
SELECT u.id, 1
FROM users u
WHERE u.id IN (
  SELECT created_by FROM stock_arrival_plans WHERE created_by IS NOT NULL
  UNION SELECT created_by FROM stock_arrival_plan_expectations WHERE created_by IS NOT NULL
  UNION SELECT created_by FROM stock_arrival_factory_holidays WHERE created_by IS NOT NULL
  UNION SELECT created_by FROM stock_arrival_products WHERE created_by IS NOT NULL
);
