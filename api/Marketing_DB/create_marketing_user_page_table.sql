-- สร้างตาราง marketing_user_page เพื่อเก็บข้อมูลการเชื่อมต่อระหว่างผู้ใช้ Marketing กับเพจ
-- ตารางนี้ใช้สำหรับเก็บความสัมพันธ์ Many-to-Many ระหว่างผู้ใช้และเพจ
-- สามารถรันซ้ำได้โดยไม่ส่งผลกระทบต่อข้อมูลที่มีอยู่

-- ตรวจสอบและลบตารางเก่า (ถ้ามี) เพื่อการสร้างใหม่ที่สมบูรณ์
-- DROP TABLE IF EXISTS `marketing_user_page`;

-- สร้างตารางใหม่
CREATE TABLE `marketing_user_page` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `page_id` INT NOT NULL,
  `user_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_page_id` (`page_id`),
  INDEX `idx_user_id` (`user_id`),
  UNIQUE KEY `unique_page_user` (`page_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- สร้าง Foreign Key constraints แยกต่างหาก (ปลอดภัยกว่าเมื่อรันซ้ำ)
-- เพิ่ม constraint สำหรับ page_id
ALTER TABLE `marketing_user_page`
  ADD CONSTRAINT `fk_marketing_user_page_page_id`
    FOREIGN KEY (`page_id`)
    REFERENCES `pages` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- เพิ่ม constraint สำหรับ user_id
ALTER TABLE `marketing_user_page`
  ADD CONSTRAINT `fk_marketing_user_page_user_id`
    FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- แสดงผลลัพธ์เมื่อสร้างสำเร็จ
SELECT 'Table marketing_user_page created successfully' AS status;
