SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS ev_move_expired_to_waiting;
DROP EVENT IF EXISTS ev_waiting_to_ready;
DROP EVENT IF EXISTS ev_refresh_customer_grade;

DELIMITER $$

-- 1) หมดอายุ -> เข้า “ตะกร้ารอ”
CREATE EVENT ev_move_expired_to_waiting
    ON SCHEDULE EVERY 1 DAY
    STARTS TIMESTAMP(CURRENT_DATE, '14:45:00')
    ON COMPLETION PRESERVE
    ENABLE
DO
BEGIN
  UPDATE customers
  SET assigned_to = NULL,
      lifecycle_status = 'Old',
      is_in_waiting_basket = 1,
      waiting_basket_start_date = NOW(),
      followup_bonus_remaining = 1
      -- bucket_type เป็น generated จะเปลี่ยนเป็น waiting อัตโนมัติ
  WHERE ownership_expires IS NOT NULL
    AND ownership_expires <= NOW()
    AND COALESCE(is_in_waiting_basket,0) = 0
    AND COALESCE(is_blocked,0) = 0;
END$$

-- 2) ตะกร้ารอครบ 30 วัน -> ready
CREATE EVENT ev_waiting_to_ready
    ON SCHEDULE EVERY 1 DAY
    STARTS TIMESTAMP(CURRENT_DATE, '14:45:00')
    ON COMPLETION PRESERVE
    ENABLE
DO
BEGIN
  UPDATE customers
  SET is_in_waiting_basket = 0,
      waiting_basket_start_date = NULL,
      assigned_to = NULL,
      ownership_expires = DATE_ADD(NOW(), INTERVAL 30 DAY),
      lifecycle_status = 'Old',
      follow_up_count = 0,
      followup_bonus_remaining = 1
      -- bucket_type จะกลายเป็น ready อัตโนมัติ (ไม่ waiting, ไม่ blocked, assigned_to NULL)
  WHERE ownership_expires IS NOT NULL
    AND NOW() > DATE_ADD(ownership_expires, INTERVAL 30 DAY)
    AND COALESCE(is_in_waiting_basket,0) = 1
    AND COALESCE(is_blocked,0) = 0;
END$$

-- 3) อัปเดต grade ตามยอดซื้อสะสม
CREATE EVENT ev_refresh_customer_grade
    ON SCHEDULE EVERY 1 DAY
    STARTS TIMESTAMP(CURRENT_DATE, '14:45:00')
    ON COMPLETION PRESERVE
    ENABLE
DO
BEGIN
  UPDATE customers
  SET grade = CASE
      WHEN total_purchases >= 50000 THEN 'A+'
      WHEN total_purchases >= 20000 THEN 'A'
      WHEN total_purchases >= 5000  THEN 'B'
      WHEN total_purchases >= 2000  THEN 'C'
      ELSE 'D'
    END;
END$$

DELIMITER ;
