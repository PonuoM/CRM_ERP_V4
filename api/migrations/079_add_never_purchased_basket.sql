-- เพิ่มถัง "ยังไม่เคยซื้อ" — สำหรับรายชื่อที่เก็บเข้าระบบไว้แต่ยังไม่มีประวัติสั่งซื้อเลย
--
-- ที่มาของถัง: ถังสายหลักทุกใบ (หาคนดูแลใหม่ / รอคนมาจีบ / 6-9 / 9-12 / 1-3 ปี /
-- ถังโบราณ / ลูกค้าใหม่ / Upsell) ตั้ง min_order_count = 1 ไว้ทั้งหมด แปลว่าลูกค้า
-- ที่ยังไม่เคยมีออเดอร์จะไม่ถูกจัดเข้าถังไหนเลยโดยอัตโนมัติ ถังนี้จึงมารับกลุ่มนั้น
--
-- พฤติกรรม (อิงรูปแบบเดียวกับถัง Marketplace ซึ่งเป็นถังที่เอาเข้าด้วยมือ/import เหมือนกัน):
--   - ไม่มีเกณฑ์อัตโนมัติ (min/max ต่างๆ เป็น NULL) — เข้าถังนี้ด้วยการ import หรือย้ายมือเท่านั้น
--   - แจกให้เทเลเซลล์ได้ จึงต้องมีถังคู่ฝั่ง dashboard_v2
--   - พอปิดการขายได้ ย้ายไป "ส่วนตัว 1-2 เดือน" (personal_1_2m) เป็นสิทธิ์ถือครองของคนที่ปิดได้
--   - max_distribution_count = 4 และ hold 30 วันก่อนแจกซ้ำ เท่ากับ Marketplace

INSERT INTO `basket_config`
    (`id`, `basket_key`, `basket_name`, `target_page`, `linked_basket_key`,
     `on_sale_basket_key`, `max_distribution_count`, `hold_days_before_redistribute`,
     `display_order`, `is_active`, `company_id`)
VALUES
    (74, 'never_purchased', 'ยังไม่เคยซื้อ', 'distribution', 'never_purchased_dash',
     'personal_1_2m', 4, 30, 33, 1, 1)
ON DUPLICATE KEY UPDATE
    `basket_name` = VALUES(`basket_name`),
    `linked_basket_key` = VALUES(`linked_basket_key`),
    `on_sale_basket_key` = VALUES(`on_sale_basket_key`),
    `max_distribution_count` = VALUES(`max_distribution_count`),
    `hold_days_before_redistribute` = VALUES(`hold_days_before_redistribute`),
    `display_order` = VALUES(`display_order`),
    `is_active` = VALUES(`is_active`);

INSERT INTO `basket_config`
    (`id`, `basket_key`, `basket_name`, `target_page`, `linked_basket_key`,
     `on_sale_basket_key`, `max_distribution_count`, `hold_days_before_redistribute`,
     `display_order`, `is_active`, `company_id`)
VALUES
    (75, 'never_purchased_dash', 'ยังไม่เคยซื้อ', 'dashboard_v2', 'never_purchased',
     'personal_1_2m', 4, 30, 34, 1, 1)
ON DUPLICATE KEY UPDATE
    `basket_name` = VALUES(`basket_name`),
    `linked_basket_key` = VALUES(`linked_basket_key`),
    `on_sale_basket_key` = VALUES(`on_sale_basket_key`),
    `max_distribution_count` = VALUES(`max_distribution_count`),
    `hold_days_before_redistribute` = VALUES(`hold_days_before_redistribute`),
    `display_order` = VALUES(`display_order`),
    `is_active` = VALUES(`is_active`);

-- ติด ui_group='challenge' ให้ถังชาเล้นจ์ "ฝั่ง distribution" ด้วย
-- migration 077/078 ตั้งไว้เฉพาะฝั่ง dashboard_v2 ทำให้ dropdown ฝั่ง distribution
-- ยังเป็นลิสต์ยาวรวดเดียวอ่านยาก ส่วนหน้า Dashboard V2 ของเทเลดึงเฉพาะ
-- target_page='dashboard_v2' (useBasketConfig) จึงไม่ได้รับผลกระทบจากการตั้งค่านี้
UPDATE `basket_config`
SET `ui_group` = 'challenge'
WHERE `company_id` = 1
  AND `target_page` = 'distribution'
  AND `basket_key` IN ('no_answer', 'quit_farming', 'wrong_phone_number', 'order_for_other', 'zero_total_amount', 'no_signal');
