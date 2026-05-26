ALTER TABLE basket_config
ADD COLUMN max_extend_appointments INT NULL DEFAULT NULL COMMENT 'จำนวนนัดหมายสูงสุดที่นำมาคูณเพิ่มวัน (NULL/0 = ไม่จำกัด)';
