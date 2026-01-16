-- Migration: Create basket_return_config table for monthly batch processing
-- Date: 2026-01-16
-- Purpose: Configurable rules for returning customers to pool

CREATE TABLE IF NOT EXISTS `basket_return_config` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `config_key` VARCHAR(50) UNIQUE NOT NULL,
    `config_value` VARCHAR(255) NOT NULL,
    `description` VARCHAR(500),
    `is_active` BOOLEAN DEFAULT TRUE,
    `company_id` INT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME ON UPDATE CURRENT_TIMESTAMP
);

-- Default configuration values
INSERT INTO `basket_return_config` (`config_key`, `config_value`, `description`, `company_id`) VALUES
('return_to_pool_days', '90', 'จำนวนวันที่ไม่มี order แล้วคืนกลับ pool', 1),
('check_field', 'last_order_date', 'Field ที่ใช้เช็ค (last_order_date หรือ last_call_date)', 1),
('exclude_grades', '', 'Grade ที่ยกเว้น (เช่น A,A+) - เว้นว่างถ้าไม่ยกเว้น', 1),
('exclude_has_appointment_days', '30', 'ยกเว้นลูกค้าที่มีนัดหมายใน X วันข้างหน้า (0 = ไม่ยกเว้น)', 1),
('batch_run_day', '1', 'วันที่รัน batch (1-28)', 1),
('is_enabled', '1', 'เปิด/ปิดระบบ return to pool (1=on, 0=off)', 1);

-- Table to log return-to-pool actions
CREATE TABLE IF NOT EXISTS `basket_return_log` (
    `id` INT PRIMARY KEY AUTO_INCREMENT,
    `customer_id` INT NOT NULL,
    `previous_assigned_to` INT,
    `reason` VARCHAR(255),
    `days_since_last_order` INT,
    `batch_date` DATE,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX `idx_customer_id` (`customer_id`),
    INDEX `idx_batch_date` (`batch_date`),
    INDEX `idx_previous_assigned` (`previous_assigned_to`)
);

-- MySQL Event for monthly batch processing
DELIMITER //

DROP EVENT IF EXISTS `evt_monthly_return_to_pool`//

CREATE EVENT `evt_monthly_return_to_pool`
ON SCHEDULE EVERY 1 MONTH
STARTS CONCAT(DATE_FORMAT(DATE_ADD(CURDATE(), INTERVAL 1 MONTH), '%Y-%m'), '-01 02:00:00')
ON COMPLETION PRESERVE
ENABLE
COMMENT 'Monthly batch: Return customers to pool if no order > X days'
DO
BEGIN
    DECLARE v_return_days INT DEFAULT 90;
    DECLARE v_check_field VARCHAR(50) DEFAULT 'last_order_date';
    DECLARE v_exclude_grades VARCHAR(255) DEFAULT '';
    DECLARE v_exclude_appt_days INT DEFAULT 30;
    DECLARE v_is_enabled INT DEFAULT 1;
    DECLARE v_company_id INT DEFAULT 1;
    DECLARE v_batch_date DATE DEFAULT CURDATE();
    
    -- Get config values
    SELECT COALESCE(config_value, '90') INTO v_return_days FROM basket_return_config WHERE config_key = 'return_to_pool_days' AND company_id = v_company_id LIMIT 1;
    SELECT COALESCE(config_value, 'last_order_date') INTO v_check_field FROM basket_return_config WHERE config_key = 'check_field' AND company_id = v_company_id LIMIT 1;
    SELECT COALESCE(config_value, '') INTO v_exclude_grades FROM basket_return_config WHERE config_key = 'exclude_grades' AND company_id = v_company_id LIMIT 1;
    SELECT COALESCE(config_value, '30') INTO v_exclude_appt_days FROM basket_return_config WHERE config_key = 'exclude_has_appointment_days' AND company_id = v_company_id LIMIT 1;
    SELECT COALESCE(config_value, '1') INTO v_is_enabled FROM basket_return_config WHERE config_key = 'is_enabled' AND company_id = v_company_id LIMIT 1;
    
    -- Only run if enabled
    IF v_is_enabled = 1 THEN
        -- Log customers being returned to pool
        INSERT INTO basket_return_log (customer_id, previous_assigned_to, reason, days_since_last_order, batch_date)
        SELECT 
            c.customer_id,
            c.assigned_to,
            CONCAT('No order for ', DATEDIFF(CURDATE(), COALESCE(c.last_order_date, c.date_registered)), ' days'),
            DATEDIFF(CURDATE(), COALESCE(c.last_order_date, c.date_registered)),
            v_batch_date
        FROM customers c
        WHERE c.assigned_to IS NOT NULL
          AND c.company_id = v_company_id
          AND DATEDIFF(CURDATE(), COALESCE(c.last_order_date, c.date_registered)) > v_return_days
          -- Exclude customers with upcoming appointments
          AND (v_exclude_appt_days = 0 OR NOT EXISTS (
              SELECT 1 FROM appointments a 
              WHERE a.customer_id = c.customer_id 
                AND a.status != 'เสร็จสิ้น'
                AND a.date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL v_exclude_appt_days DAY)
          ));
        
        -- Return customers to pool
        UPDATE customers c
        SET c.assigned_to = NULL,
            c.date_assigned = NULL
        WHERE c.assigned_to IS NOT NULL
          AND c.company_id = v_company_id
          AND DATEDIFF(CURDATE(), COALESCE(c.last_order_date, c.date_registered)) > v_return_days
          AND (v_exclude_appt_days = 0 OR NOT EXISTS (
              SELECT 1 FROM appointments a 
              WHERE a.customer_id = c.customer_id 
                AND a.status != 'เสร็จสิ้น'
                AND a.date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL v_exclude_appt_days DAY)
          ));
    END IF;
END//

DELIMITER ;
