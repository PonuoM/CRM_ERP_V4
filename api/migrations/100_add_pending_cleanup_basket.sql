-- ถัง "รอเคลียร์ข้อมูล" (id 76) — กักลูกค้าที่ประวัติออเดอร์ทั้งหมดเป็น "ไม่ระบุสินค้า"
-- (บิล import ปี 2024-2025 ที่จับคู่ SKU ไม่ได้ และไม่มีชื่อสินค้าติดมาจากไฟล์ต้นทาง)
-- ออกจากสายแจก เพื่อไม่ให้วนแจกซ้ำให้เทเลทั้งที่โทรไปก็ไม่รู้ว่าลูกค้าเคยซื้ออะไร
--
-- พฤติกรรม (อิงแบบถัง "ลูกค้าบล็อค" id 55 ซึ่งเป็นถังกักฝั่ง distribution เหมือนกัน):
--   - ไม่มีเกณฑ์อัตโนมัติ (min/max/fail_after_days เป็น NULL ทั้งหมด)
--     => monthly cron ไม่แตะ และไม่ติดอยู่ในลิสต์ re-evaluate ของถังตามอายุออเดอร์
--   - เข้าถังนี้ด้วยการย้ายมือ/สคริปต์เท่านั้น และ **ห้ามกดแจกจากถังนี้** จนกว่าจะเคลียร์ข้อมูลเสร็จ
--   - ถ้าเคลียร์แล้ว (map สินค้าได้/ยืนยันตัวตนได้) ให้ย้ายกลับถังตามอายุออเดอร์ตามปกติ
--
-- ประกอบการ cleanup 2026-08-31: map ชื่อสินค้า 13 ชื่อกลับเป็น product จริง ~7.7K รายการ
-- (backup: _cleanup_20260831_order_items / _cleanup_20260831_customers บน prod)

INSERT INTO `basket_config`
    (`id`, `basket_key`, `basket_name`, `target_page`, `on_sale_basket_key`,
     `max_distribution_count`, `hold_days_before_redistribute`,
     `display_order`, `is_active`, `company_id`)
VALUES
    (76, 'pending_data_cleanup', 'รอเคลียร์ข้อมูล', 'distribution', 'personal_1_2m',
     0, 0, 35, 1, 1)
ON DUPLICATE KEY UPDATE
    `basket_name` = VALUES(`basket_name`),
    `target_page` = VALUES(`target_page`),
    `on_sale_basket_key` = VALUES(`on_sale_basket_key`),
    `display_order` = VALUES(`display_order`),
    `is_active` = VALUES(`is_active`);
