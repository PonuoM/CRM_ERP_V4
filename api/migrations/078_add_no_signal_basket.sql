-- เพิ่มถัง "ไม่มีสัญญาณ" คู่กับ "ไม่รับสาย" (ID 62/68) ที่มีอยู่แล้ว
-- ตาม pattern เดียวกับ 077_add_ui_group_to_basket_config.sql
-- อ้างอิงจากที่ประชุม 3 ส.ค. 2026: ลูกค้าที่ผ่านมือเทเล 3 คนแล้วทุกคนบันทึกสถานะ
-- "ไม่มีสัญญาณ" ตรงกัน ให้แยกออกจากระบบแจกจ่ายปกติ (เงื่อนไขคัดกรองอัตโนมัติเป็นงานแยก ยังไม่ทำในไฟล์นี้)

INSERT INTO `basket_config` (`id`, `basket_key`, `basket_name`, `target_page`, `linked_basket_key`, `display_order`, `company_id`) VALUES
(72, 'no_signal', 'ไม่มีสัญญาณ', 'distribution', 'challenge_no_signal', 31, 1)
ON DUPLICATE KEY UPDATE
`linked_basket_key` = VALUES(`linked_basket_key`),
`display_order` = VALUES(`display_order`);

INSERT INTO `basket_config` (`id`, `basket_key`, `basket_name`, `target_page`, `ui_group`, `linked_basket_key`, `display_order`, `company_id`) VALUES
(73, 'challenge_no_signal', 'ไม่มีสัญญาณ', 'dashboard_v2', 'challenge', 'no_signal', 32, 1)
ON DUPLICATE KEY UPDATE
`ui_group` = VALUES(`ui_group`),
`target_page` = VALUES(`target_page`),
`linked_basket_key` = VALUES(`linked_basket_key`),
`display_order` = VALUES(`display_order`);
