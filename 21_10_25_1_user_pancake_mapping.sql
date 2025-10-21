-- =====================================================
-- Table: user_pancake_mapping
-- Purpose: เก็บข้อมูลการเชื่อมต่อ user ภายในกับ user จาก Pancake
-- Created: 21/10/2025
-- =====================================================

-- สร้างตารางสำหรับเชื่อมต่อ id user ภายในกับ id จาก Pancake
CREATE TABLE IF NOT EXISTS `user_pancake_mapping` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_user` int(11) NOT NULL COMMENT 'ID ของผู้ใช้ในระบบภายใน (table: users)',
  `id_panake` varchar(191) NOT NULL COMMENT 'ID ของผู้ใช้จาก Pancake',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'วันเวลาที่สร้างการเชื่อมต่อ',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_mapping` (`id_user`) COMMENT 'ทำให้แต่ละ user มีการ map กับ pancake เพียงครั้งเดียว',
  UNIQUE KEY `unique_panake_mapping` (`id_panake`) COMMENT 'ทำให้แต่ละ user pancake เชื่อมต่อได้กับ user ภายในเพียงคนเดียว',
  KEY `idx_id_user` (`id_user`),
  KEY `idx_id_panake` (`id_panake`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางเชื่อมต่อ user ภายในกับ user จาก Pancake';

-- เพิ่ม Foreign Key constraint (ถ้าต้องการความสัมพันธ์)
ALTER TABLE `user_pancake_mapping`
  ADD CONSTRAINT `fk_user_pancake_user`
    FOREIGN KEY (`id_user`)
    REFERENCES `users` (`id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE;

-- =====================================================
-- Insert ข้อมูลตัวอย่าง (Sample Data)
-- =====================================================

-- ข้อมูลตัวอย่างการเชื่อมต่อผู้ใช้
INSERT INTO `user_pancake_mapping` (`id_user`, `id_panake`)
VALUES
(1, 'pancake_001'),  -- admin1 กับ pancake_001
(92, 'pancake_002'); -- TIK TOK SHOP กับ pancake_002

-- =====================================================
-- View สำหรับดูข้อมูลการเชื่อมต่อ
-- =====================================================

-- View สำหรับดูการเชื่อมต่อพร้อมข้อมูล user
CREATE OR REPLACE VIEW `v_user_pancake_mapping` AS
SELECT
    m.id,
    m.id_user,
    u.username,
    CONCAT(u.first_name, ' ', u.last_name) as full_name,
    u.email,
    u.role,
    m.id_panake,
    m.created_at
FROM user_pancake_mapping m
LEFT JOIN users u ON m.id_user = u.id
ORDER BY m.created_at DESC;

-- =====================================================
-- Stored Procedures (ถ้าต้องการ)
-- =====================================================

DELIMITER $$

-- Procedure สำหรับสร้าง/อัปเดตการเชื่อมต่อ
CREATE PROCEDURE IF NOT EXISTS `sp_create_user_pancake_mapping`(
    IN p_id_user INT,
    IN p_id_panake VARCHAR(191)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;

    -- ตรวจสอบว่ามีการ map อยู่แล้วหรือไม่
    SELECT COUNT(*) INTO v_count
    FROM user_pancake_mapping
    WHERE id_user = p_id_user;

    IF v_count > 0 THEN
        -- ถ้ามีอยู่แล้ว ให้อัปเดต
        UPDATE user_pancake_mapping
        SET id_panake = p_id_panake,
            created_at = NOW()
        WHERE id_user = p_id_user;

        SELECT 'updated' as action, id_user, id_panake;
    ELSE
        -- ถ้ายังไม่มี ให้สร้างใหม่
        INSERT INTO user_pancake_mapping (id_user, id_panake)
        VALUES (p_id_user, p_id_panake);

        SELECT 'created' as action, id_user, id_panake;
    END IF;
END$$

-- Procedure สำหรับลบการเชื่อมต่อ
CREATE PROCEDURE IF NOT EXISTS `sp_delete_user_pancake_mapping`(
    IN p_id_user INT
)
BEGIN
    DELETE FROM user_pancake_mapping
    WHERE id_user = p_id_user;

    SELECT ROW_COUNT() as deleted_count;
END$$

DELIMITER ;

-- =====================================================
-- Comments สำหรับอธิบาย
-- =====================================================

ALTER TABLE `user_pancake_mapping`
COMMENT = 'ตารางเชื่อมต่อ id user ภายในกับ id จาก Pancake - สร้าง 21/10/2025';

-- =====================================================
-- สิ้นสุดการสร้างตาราง
-- =====================================================
