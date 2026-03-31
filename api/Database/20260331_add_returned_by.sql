-- เพิ่มคอลัมน์ returned_by เพื่อเก็บ user ID ของผู้ที่ทำการอัปเดตสถานะตีกลับ
ALTER TABLE `order_boxes`
ADD COLUMN `returned_by` INT NULL COMMENT 'User ID ของผู้อัปเดตสถานะตีกลับ' AFTER `return_claim`;
