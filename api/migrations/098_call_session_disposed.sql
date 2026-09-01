-- 098: ติดตามว่าบันทึกผลการโทร (disposition) ของ session นั้นเสร็จแล้วหรือยัง
--
-- ฟอร์มบันทึกการโทรเด้งได้ทั้งบนคอมและมือถือ ถ้าคนกรอกบนคอมเสร็จแล้ว ฟอร์มบนมือถือ
-- ต้องปิดเอง ไม่ให้กรอกซ้ำ คอลัมน์นี้เป็นธงกลางให้ทั้งสองฝั่งดู
--
-- nullable ไม่มี default = ALTER แบบ instant บนตารางเล็ก (call_sessions มีไม่กี่ร้อยแถว)
-- ไม่ล็อกใคร รันกลางวันได้

ALTER TABLE call_sessions
  ADD COLUMN disposed_at DATETIME NULL DEFAULT NULL COMMENT 'เวลาที่บันทึกผลการโทรเสร็จ (คอมหรือมือถือ)'
  AFTER call_history_id;
