-- ============================================================
-- Test Event: รันที่เวลา 12:50 ของวันที่ 03/12/2025 (เวลาไทย UTC+7)
-- เวอร์ชันสำหรับ MySQL server ที่ใช้ UTC timezone
-- ============================================================
-- 
-- วิธีใช้:
--   mysql -u root -p mini_erp < api/Database/test_event_2025_12_03_1240_UTC.sql
--
-- หรือใน MySQL client:
--   USE mini_erp;
--   source api/Database/test_event_2025_12_03_1240_UTC.sql

USE `mini_erp`;

-- ตรวจสอบ timezone และเวลาปัจจุบัน
SELECT 
    @@global.time_zone AS 'Global Timezone',
    @@session.time_zone AS 'Session Timezone',
    NOW() AS 'MySQL Time Now',
    UTC_TIMESTAMP() AS 'UTC Time Now',
    TIMESTAMPDIFF(HOUR, UTC_TIMESTAMP(), NOW()) AS 'Timezone Offset (hours)';

-- ============================================================
-- สร้าง Event ที่จะรันที่ 12:50 เวลาไทย
-- สำหรับ server ที่ใช้ UTC: 12:50 ไทย = 05:50 UTC (12:50 - 7 ชั่วโมง)
-- ============================================================

DROP EVENT IF EXISTS `evt_test_move_expired_to_waiting_basket`;

DELIMITER $$

CREATE EVENT `evt_test_move_expired_to_waiting_basket`
ON SCHEDULE AT '2025-12-03 05:50:00'
ON COMPLETION NOT PRESERVE
ENABLE
COMMENT 'ทดสอบ: ย้ายลูกค้าหมดอายุเข้าตะกร้ารอที่เวลา 12:50 ของวันที่ 03/12/2025 (เวลาไทย = 05:50 UTC)'
DO
BEGIN
    -- ย้ายลูกค้าที่หมดอายุเข้าตะกร้ารอ
    UPDATE customers
    SET is_in_waiting_basket = 1,
        waiting_basket_start_date = NOW(),
        lifecycle_status = 'FollowUp'
    WHERE COALESCE(is_blocked, 0) = 0
      AND COALESCE(is_in_waiting_basket, 0) = 0
      AND ownership_expires IS NOT NULL
      AND ownership_expires <= NOW();
END$$

DELIMITER ;

-- ============================================================
-- ตรวจสอบ Event ที่สร้าง
-- ============================================================
SELECT 
    EVENT_NAME AS 'ชื่อ Event',
    STATUS AS 'สถานะ',
    ON_COMPLETION AS 'หลังรันแล้ว',
    CREATED AS 'สร้างเมื่อ',
    LAST_EXECUTED AS 'รันล่าสุด',
    EXECUTE_AT AS 'จะรันครั้งต่อไป (UTC)',
    CONCAT('12:50 (เวลาไทย) = ', EXECUTE_AT, ' (UTC)') AS 'เวลาที่รัน',
    EVENT_COMMENT AS 'หมายเหตุ'
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = DATABASE()
  AND EVENT_NAME = 'evt_test_move_expired_to_waiting_basket';

-- แสดงเวลาที่เหลือจนถึงการรัน
SELECT 
    'Event จะรันที่:' AS 'ข้อมูล',
    '2025-12-03 12:50:00 (เวลาไทย)' AS 'เวลาเป้าหมาย',
    '2025-12-03 05:50:00 (UTC)' AS 'เวลาที่ MySQL จะรัน',
    EXECUTE_AT AS 'เวลาที่ตั้งไว้',
    TIMESTAMPDIFF(MINUTE, NOW(), EXECUTE_AT) AS 'นาทีที่เหลือ',
    TIMESTAMPDIFF(HOUR, NOW(), EXECUTE_AT) AS 'ชั่วโมงที่เหลือ',
    CASE 
        WHEN TIMESTAMPDIFF(DAY, NOW(), EXECUTE_AT) > 0 
        THEN CONCAT(TIMESTAMPDIFF(DAY, NOW(), EXECUTE_AT), ' วัน')
        ELSE CONCAT(TIMESTAMPDIFF(HOUR, NOW(), EXECUTE_AT), ' ชั่วโมง')
    END AS 'เวลาที่เหลือ'
FROM INFORMATION_SCHEMA.EVENTS
WHERE EVENT_SCHEMA = DATABASE()
  AND EVENT_NAME = 'evt_test_move_expired_to_waiting_basket';

-- แสดงจำนวนลูกค้าที่จะถูกย้าย (สำหรับตรวจสอบ)
SELECT 
    COUNT(*) AS 'จำนวนลูกค้าที่จะถูกย้าย',
    'ลูกค้าที่หมดอายุและจะถูกย้ายเข้าตะกร้ารอ' AS 'คำอธิบาย'
FROM `mini_erp`.`customers`
WHERE COALESCE(is_blocked, 0) = 0
  AND COALESCE(is_in_waiting_basket, 0) = 0
  AND ownership_expires IS NOT NULL
  AND ownership_expires <= NOW();

