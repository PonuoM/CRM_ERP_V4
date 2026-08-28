-- 089_distribution_integrity_fixes.sql
--
-- เก็บงานค้างจากการตรวจ Distribution V2 (25 ส.ค. 2026) ที่ยืนยันด้วยข้อมูลจริงบน prod แล้ว
-- รันซ้ำได้ (idempotent)

-- ─────────────────────────────────────────────────────────────
-- 1) customer_assign_check ไม่มี UNIQUE KEY -> มีแถวซ้ำ 22,680 แถว
--
--    ตารางนี้จำว่า "ลูกค้า X เคยถูกแจกให้พนักงาน Y" แต่ไม่มีอะไรกันแถวซ้ำ
--    (โค้ด INSERT ตรง ๆ ทุกครั้งที่แจก) ผลกระทบอยู่ที่ logic รีเซ็ตรอบใน handleDistribute
--    ซึ่งเช็คว่า COUNT(*) >= จำนวนพนักงานทั้งบริษัท แล้วล้างประวัติทิ้ง — นับ "แถว" ไม่ใช่ "คน"
--    วัดจริง: company 7 (พนักงาน 3 คน) มีลูกค้า 3,174 รายที่เข้าเงื่อนไขรีเซ็ตทั้งที่ยังไม่ครบทุกคนจริง
--    -> ประวัติกันแจกซ้ำถูกล้างก่อนกำหนด แล้วลูกค้าวนกลับไปหาคนเดิม
--
--    เก็บ id ต่ำสุดของแต่ละคู่ไว้ ประวัติ "เคยแจกให้ใคร" ยังครบเหมือนเดิม
--    สิ่งที่หายคือ "แจกซ้ำกี่ครั้ง" ซึ่งไม่มีโค้ดไหนอ่านค่านี้

--    สำรองแถวที่จะลบไว้ก่อน เผื่อต้องกู้คืน (ตารางนี้ลบทิ้งได้เมื่อมั่นใจแล้ว)
CREATE TABLE IF NOT EXISTS `customer_assign_check_dup_backup_088` (
    `id` INT NOT NULL,
    `customer_id` INT NOT NULL,
    `user_id` INT NOT NULL,
    `company_id` INT NOT NULL,
    `created_at` DATETIME NULL,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `customer_assign_check_dup_backup_088` (`id`, `customer_id`, `user_id`, `company_id`, `created_at`)
SELECT ac.id, ac.customer_id, ac.user_id, ac.company_id, ac.created_at
FROM `customer_assign_check` ac
JOIN (
    SELECT customer_id, user_id, MIN(id) AS keep_id
    FROM `customer_assign_check`
    GROUP BY customer_id, user_id
    HAVING COUNT(*) > 1
) dup ON dup.customer_id = ac.customer_id
     AND dup.user_id = ac.user_id
     AND ac.id > dup.keep_id;

DELETE ac FROM `customer_assign_check` ac
JOIN (
    SELECT customer_id, user_id, MIN(id) AS keep_id
    FROM `customer_assign_check`
    GROUP BY customer_id, user_id
    HAVING COUNT(*) > 1
) dup ON dup.customer_id = ac.customer_id
     AND dup.user_id = ac.user_id
     AND ac.id > dup.keep_id;

ALTER TABLE `customer_assign_check`
    ADD UNIQUE KEY IF NOT EXISTS `uniq_cac_customer_user` (`customer_id`, `user_id`);

-- ─────────────────────────────────────────────────────────────
-- 2) undo ไม่คืนค่า basket_entered_date
--
--    ตอนแจก โค้ดเซ็ต basket_entered_date = NOW() พอกด undo จะคืนแค่ assigned_to /
--    current_basket_key / lifecycle_status / date_assigned แต่ basket_entered_date ค้างเป็นเวลาที่แจก
--    ผลคือรายชื่อที่ดึงกลับกลายเป็น "เพิ่งเข้าถัง" ไปต่อท้ายคิว ทั้งที่จริงอยู่ในถังมานานแล้ว
--    วัดจริง: มี 22 session ที่เคย undo รวม 385 รายชื่อ
ALTER TABLE `distribution_session_details`
    ADD COLUMN IF NOT EXISTS `previous_basket_entered_date` DATETIME NULL DEFAULT NULL
        COMMENT 'basket_entered_date ก่อนถูกแจก เอาไว้คืนค่าตอน undo' AFTER `previous_basket_key`;

-- ─────────────────────────────────────────────────────────────
-- 3) guard กันแจกทับเจ้าของเดิม (SELECT ... FOR UPDATE ตอนแจก)
--    ล็อกด้วย PRIMARY KEY (customer_id) ที่มีอยู่แล้ว ไม่ต้องเพิ่ม index
--    บันทึกไว้ว่าตรวจแล้ว — การแก้อยู่ฝั่งโค้ด (DistributionController::handleDistribute)
