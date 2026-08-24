-- 082: ตารางแมป "บริษัท" และ "แผนก" ระหว่าง ERP กับ HR Mobile Connect
--
-- ต่อจาก 081 (users.hr_employee_id) — ตอนจับคู่พนักงานจริงพบว่า dropdown ยาวเกินไปเพราะมีพนักงาน HR
-- 145 คนจาก 3 บริษัท 36 แผนก จึงต้องมีชั้นแมปบริษัท+แผนกไว้กรองตัวเลือกให้แคบลงก่อน
--
-- ฝั่ง ERP ไม่มีตาราง "แผนก" — สิ่งที่ทำหน้าที่เป็นแผนกคือ `users.role`
-- (Telesale, Supervisor Telesale, Admin Page, Backoffice, Marketing, ...)
-- ฝั่ง HR มี `departments` แยกตามบริษัท
--
-- ชื่อสองฝั่งเขียนไม่ตรงกันและซอยไม่เท่ากัน จึงออกแบบเป็น many-to-many ตั้งใจ:
--   - หลาย role ของ ERP → แผนกเดียวของ HR   เช่น Telesale + Supervisor Telesale → HR "Telesale"
--   - role เดียวของ ERP → หลายแผนกของ HR    เช่น Marketing → "Online Marketing" + "TikTok" + "Content Creator"
-- แถวหนึ่ง = คู่ (erp_company_id, erp_role, hr_department_id) หนึ่งคู่

CREATE TABLE IF NOT EXISTS `hr_company_map` (
  `erp_company_id` INT NOT NULL COMMENT 'primacom_mini_erp.companies.id',
  `hr_company_id` INT NOT NULL COMMENT 'primacom_hr_mobile_connect.companies.id',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `updated_by` INT NULL DEFAULT NULL COMMENT 'users.id ของคนที่ตั้งค่า',
  PRIMARY KEY (`erp_company_id`),
  KEY `idx_hr_company` (`hr_company_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='แมปบริษัท ERP -> บริษัท HR (บริษัทที่ไม่มีคู่ ไม่ต้องมีแถว)';

CREATE TABLE IF NOT EXISTS `hr_department_map` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `erp_company_id` INT NOT NULL,
  `erp_role` VARCHAR(64) NOT NULL COMMENT 'ค่าใน users.role — ERP ใช้ role แทนแผนก',
  `hr_department_id` INT NOT NULL COMMENT 'primacom_hr_mobile_connect.departments.id',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_by` INT NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_hr_department_map` (`erp_company_id`, `erp_role`, `hr_department_id`),
  KEY `idx_company_role` (`erp_company_id`, `erp_role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='แมป role ของ ERP -> แผนกของ HR แบบ many-to-many';

-- seed ค่าที่เดิม hardcode ไว้ใน api/User_DB/hr_employee_mapping.php (ERP 1=HR 1, ERP 2=HR 2)
-- บริษัทอื่นปล่อยว่างไว้ให้ตั้งเองในหน้าเว็บ
INSERT INTO `hr_company_map` (`erp_company_id`, `hr_company_id`) VALUES (1, 1), (2, 2)
ON DUPLICATE KEY UPDATE `hr_company_id` = VALUES(`hr_company_id`);
