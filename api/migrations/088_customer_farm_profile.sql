-- 088_customer_farm_profile.sql
--
-- ที่มา: 25 ส.ค. 2569 — ต้องการเก็บ "พืชพันธุ์" และ "ขนาดสวน" ของลูกค้าให้กรองได้
--        เพื่อใช้เป็นตัวกรองตอนแจกรายชื่อ (เคสลูกค้าอยู่ถังกลางแล้วยังไม่ถูกแจก)
--        และเป็นตัวกรองในหน้าทำงานของพนักงาน
--
-- ปัญหาของเดิม (วัดจาก production 25 ส.ค. 2569):
--        call_history.crop_type / area_size เป็น free text มาตั้งแต่แรก
--        - crop_type มีค่าไม่ซ้ำกัน 20,804 แบบ สำหรับพืชจริงราว 170 ชนิด
--          (ตัวอย่าง: "ทุเรียน", "ทุเรียน\t", "\tทุเรียน", "\tทุเรียน\t" = 4 ค่า แต่คือพืชเดียวกัน 3,822 แถว)
--        - area_size หน่วยปนกัน: "ต้น" 40,387 แถว มากกว่า "ไร่" 30,192 แถว
--          เพราะชาวสวนไม้ผลนับเป็นต้น ไม่ใช่กรอกผิด — ทุเรียน 74% ตอบเป็นต้น
--        - 10,217 แถว ไม่มีตัวเลขเลย ("รอบบ้าน", "ทานเอง", "ไม่เยอะ") = กลุ่มปลูกกินเอง
--        ผลคือ filter อะไรไม่ได้เลย และ ScoringService อ่าน floatval("100 ต้น") เป็น 100 ไร่
--
-- แนวทาง: ไม่แตะ call_history เลย (ยังเป็นบันทึกว่าคุยอะไรในสายนั้น = หลักฐาน)
--         ตารางใหม่เก็บ "สถานะปัจจุบัน" ของลูกค้าแทน
--
-- โครงสร้าง 1 ลูกค้า : หลายชุด — ไม่ใช่ของเผื่ออนาคต แต่เพราะข้อมูลจริงเป็นแบบนั้นอยู่แล้ว
--         15,272 ลูกค้า (17%) มีสวนมากกว่า 1 ชุด เทเลยัดลงช่องเดียวมาตลอด
--         เช่น crop="มัน ข้าวโพด" คู่กับ area="ม40ไร่/ขพ10กว่าไร่"
--
-- ขอบเขต ณ เวลาที่เขียน: customers 239,383 แถว, call_history 613,220 แถว
-- รันซ้ำได้ (idempotent)
--
-- หลังรันไฟล์นี้ ให้รัน api/migrations/088_migrate_farm_profile.php เพื่อ seed พจนานุกรม + ย้ายข้อมูลเก่า

-- ─────────────────────────────────────────────────────────────
-- 1) ทะเบียนพืชมาตรฐาน
--
--    status = 'approved' คือพืชที่ตรวจแล้ว
--    status = 'pending'  คือพืชที่เทเลเพิ่มเอง — ใช้งานได้ทันทีทุกที่ ไม่รออนุมัติ
--                        ต่างกันแค่ไปโผล่ในคิวตรวจของ admin
--    status = 'merged'   คือถูกรวมเข้ากับพืชอื่นแล้ว ให้ตามไปที่ merged_into
--
--    name_norm มี UNIQUE — เป็นด่านกันซ้ำด่านสุดท้าย ต่อให้เทเล 2 คนกดเพิ่มพืชเดียวกัน
--    พร้อมกัน ก็จะได้ record เดียว (ใช้ INSERT ... ON DUPLICATE KEY UPDATE usage_count = usage_count+1)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `crops` (
  `crop_id`      INT(11)      NOT NULL AUTO_INCREMENT,
  `name`         VARCHAR(64)  NOT NULL COMMENT 'ชื่อที่แสดงให้ผู้ใช้เห็น',
  `name_norm`    VARCHAR(64)  NOT NULL COMMENT 'ชื่อหลังล้าง tab/วรรค/สระซ้ำ ใช้กันซ้ำ',
  `category`     VARCHAR(16)  NOT NULL DEFAULT 'อื่นๆ' COMMENT 'ไม้ผล|พืชไร่|ผัก|ไม้ดอก|รวม|อื่นๆ',
  `default_unit` VARCHAR(8)   NOT NULL DEFAULT 'ไร่'  COMMENT 'หน่วยที่ระบบตั้งให้เมื่อเลือกพืชนี้: ไร่|ต้น',
  `status`       VARCHAR(16)  NOT NULL DEFAULT 'pending' COMMENT 'approved|pending|merged',
  `merged_into`  INT(11)      DEFAULT NULL COMMENT 'ถ้า merged: ชี้ไป crop_id ตัวจริง',
  `usage_count`  INT(11)      NOT NULL DEFAULT 0 COMMENT 'จำนวนครั้งที่ถูกใช้ ใช้เรียงคิวตรวจ',
  `created_by`   INT(11)      DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`crop_id`),
  UNIQUE KEY `uq_crops_name_norm` (`name_norm`),
  KEY `idx_crops_status` (`status`),
  KEY `idx_crops_category` (`category`),
  KEY `idx_crops_queue` (`status`, `usage_count`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ทะเบียนพืชมาตรฐาน — เทเลเพิ่มเองได้ (pending) ใช้งานได้ทันที';

-- ─────────────────────────────────────────────────────────────
-- 2) ชื่อพ้อง / สะกดผิด -> พืชมาตรฐาน
--
--    ตารางนี้คือหัวใจของการค้นหา: พิมพ์ "ลำใย" แล้วเจอ "ลำไย" ได้เพราะตารางนี้
--    source = 'migration' คือมาจากพจนานุกรมตั้งต้น
--           = 'auto'      คือ fuzzy จับคำสะกดผิดให้อัตโนมัติ (เฉพาะที่ต่างกัน 1 ตัวอักษร)
--           = 'admin'     คือคนกดรวมเอง
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `crop_aliases` (
  `alias_id`   INT(11)     NOT NULL AUTO_INCREMENT,
  `alias_norm` VARCHAR(64) NOT NULL COMMENT 'ข้อความที่ผู้ใช้พิมพ์ หลังล้างแล้ว',
  `crop_id`    INT(11)     NOT NULL,
  `source`     VARCHAR(16) NOT NULL DEFAULT 'admin' COMMENT 'migration|auto|admin',
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`alias_id`),
  UNIQUE KEY `uq_alias_norm` (`alias_norm`),
  KEY `idx_alias_crop` (`crop_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ชื่อพ้อง/สะกดผิด -> พืชมาตรฐาน';

-- ─────────────────────────────────────────────────────────────
-- 3) ชุดข้อมูลสวนของลูกค้า (1 ลูกค้า : N ชุด)
--
--    แต่ละแถว = 1 ชุด อิสระเต็มตัว มีพืช/ขนาด/หน่วยของตัวเอง แก้หรือลบทีละชุดได้
--
--    ทำไมไม่เพิ่มคอลัมน์ใน customers: จะติดเพดานทันทีที่ลูกค้ามีสวนที่ 2
--    และการเพิ่ม crop2/crop3 คือปัญหาเดิมในรูปแบบใหม่
--
--    crop_id NULL ได้      = รู้ขนาดแต่ยังไม่รู้พืช
--    size_value NULL ได้   = รู้พืชแต่ยังไม่รู้ขนาด (มีประโยชน์แล้ว ใช้กรองตามพืชได้)
--    is_home_garden        = ปลูกกินเอง ไม่ใช่เชิงการค้า — เป็นช่องแยก ไม่ได้คำนวณจากขนาด
--                            เพราะคนกลุ่มนี้ไม่เคยตอบเป็นตัวเลข (10,217 แถวไม่มีตัวเลขเลย)
--                            ถ้าใช้เกณฑ์ "ไร่น้อยกว่า X" จะไม่มีวันคัดกลุ่มนี้ออกได้
--    note                  = ข้อความที่แปลงเป็นตัวเลขไม่ได้ ("เยอะ", "ไม่เยอะ", "100" เฉยๆ)
--                            เก็บให้คนอ่าน ไม่เอาไปกรอง — ถ้าภายหลังรู้ตัวเลขค่อยมาเติม
--    size_bucket           = กลุ่มขนาดที่คำนวณไว้ตอนเขียน เพื่อให้ WHERE เร็วโดยไม่ต้องคิดสด
--                            ค่า: rai_lt5|rai_5_10|rai_10_20|rai_20_50|rai_gte50
--                                 tree_lt20|tree_20_50|tree_50_100|tree_100_500|tree_gte500
--
--    ไม่ใส่ FOREIGN KEY ตามแนวทางเดิมของโปรเจกต์ (customers ถูกลบ/ย้ายบ่อย ถ้าใส่ FK จะล็อกกันเอง)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `customer_plots` (
  `plot_id`        INT(11)       NOT NULL AUTO_INCREMENT,
  `customer_id`    INT(11)       NOT NULL,
  `crop_id`        INT(11)       DEFAULT NULL,
  `size_value`     DECIMAL(10,2) DEFAULT NULL,
  `size_unit`      VARCHAR(8)    DEFAULT NULL COMMENT 'ไร่|ต้น|งาน|ตร.ว.',
  `size_bucket`    VARCHAR(16)   DEFAULT NULL COMMENT 'คำนวณตอนเขียน ใช้กรองให้เร็ว',
  `is_home_garden` TINYINT(1)    NOT NULL DEFAULT 0 COMMENT 'ปลูกกินเอง ไม่ใช่เชิงการค้า',
  `note`           VARCHAR(255)  DEFAULT NULL COMMENT 'ข้อความที่กรองไม่ได้ เก็บให้คนอ่าน',
  `source`         VARCHAR(16)   NOT NULL DEFAULT 'manual' COMMENT 'manual|migration',
  `source_call_id` INT(11)       DEFAULT NULL COMMENT 'อ้างกลับ call_history.id ที่บันทึก',
  `created_by`     INT(11)       DEFAULT NULL,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_active`      TINYINT(1)    NOT NULL DEFAULT 1 COMMENT 'ลบแบบไม่ลบจริง',
  PRIMARY KEY (`plot_id`),
  KEY `idx_plots_customer` (`customer_id`, `is_active`),
  KEY `idx_plots_crop` (`crop_id`, `is_active`),
  KEY `idx_plots_bucket` (`size_bucket`, `is_active`),
  KEY `idx_plots_home` (`is_home_garden`, `is_active`),
  KEY `idx_plots_filter` (`crop_id`, `size_unit`, `size_value`),
  KEY `idx_plots_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ชุดข้อมูลสวนของลูกค้า 1 ลูกค้ามีได้หลายชุด';
