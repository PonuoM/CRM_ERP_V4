-- 1. เพิ่มคอลัมน์ ui_group ไว้สำหรับจัดกลุ่มในหน้า Dashboard V2 (ตรวจสอบก่อนว่ามีคอลัมน์หรือยัง)
DELIMITER //
CREATE PROCEDURE AddUiGroupColumnIfNotExists()
BEGIN
    IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'basket_config'
        AND COLUMN_NAME = 'ui_group'
    ) THEN
        ALTER TABLE `basket_config` ADD COLUMN `ui_group` VARCHAR(50) DEFAULT NULL AFTER `target_page`;
    END IF;
END //
DELIMITER ;
CALL AddUiGroupColumnIfNotExists();
DROP PROCEDURE AddUiGroupColumnIfNotExists;

-- 2. Insert & Update 5 ถังพัก (Distribution Baskets) ที่มีอยู่ในเซิร์ฟเวอร์แล้ว ให้มีใน Codebase และผูก linked_basket_key
INSERT INTO `basket_config` (`id`, `basket_key`, `basket_name`, `target_page`, `linked_basket_key`, `display_order`, `company_id`) VALUES 
(62, 'no_answer', 'ไม่รับสาย', 'distribution', 'challenge_no_answer', 21, 1),
(63, 'quit_farming', 'เลิกทำสวน', 'distribution', 'challenge_quit_farming', 22, 1),
(64, 'wrong_phone_number', 'เบอร์โทรผิด', 'distribution', 'challenge_wrong_phone', 23, 1),
(65, 'order_for_other', 'ฝากสั่ง/รับแทน', 'distribution', 'challenge_order_for_other', 24, 1),
(66, 'zero_total_amount', '0 บาท', 'distribution', 'challenge_zero_amount', 25, 1)
ON DUPLICATE KEY UPDATE 
`linked_basket_key` = VALUES(`linked_basket_key`),
`display_order` = VALUES(`display_order`);

-- 3. รีเซ็ต Auto Increment และบังคับ Insert ให้ ID ตรงตามที่ต้องการ (67 - 71)
ALTER TABLE `basket_config` AUTO_INCREMENT = 67;

INSERT INTO `basket_config` (`id`, `basket_key`, `basket_name`, `target_page`, `ui_group`, `linked_basket_key`, `display_order`, `company_id`) VALUES 
(67, 'challenge_wrong_phone', 'เบอร์โทรผิด', 'dashboard_v2', 'challenge', 'wrong_phone_number', 26, 1),
(68, 'challenge_no_answer', 'ไม่รับสาย', 'dashboard_v2', 'challenge', 'no_answer', 27, 1),
(69, 'challenge_order_for_other', 'ฝากสั่ง/รับแทน', 'dashboard_v2', 'challenge', 'order_for_other', 28, 1),
(70, 'challenge_quit_farming', 'เลิกทำสวน', 'dashboard_v2', 'challenge', 'quit_farming', 29, 1),
(71, 'challenge_zero_amount', '0 บาท', 'dashboard_v2', 'challenge', 'zero_total_amount', 30, 1)
ON DUPLICATE KEY UPDATE 
`ui_group` = VALUES(`ui_group`),
`target_page` = VALUES(`target_page`),
`linked_basket_key` = VALUES(`linked_basket_key`),
`display_order` = VALUES(`display_order`);
