-- 097: สิทธิ์เปลี่ยนเจ้าของลูกค้าเป็นของแอดมินระดับสูงเท่านั้น
--
-- เดิมตั้งเป็น 095 แต่ชนกับ 095_basket_transition_type_enum.sql ที่ทำขนานกันมา จึงเลื่อนเป็น 097
-- ให้อยู่หลัง 096 ซึ่งสร้างตารางคำขอโอน ตรงกับลำดับที่รันจริงบน production (096 ก่อน แล้วค่อยตัวนี้)
-- สถานะ: รันบน primacom_mini_erp แล้วเมื่อ 28 ส.ค. 2569 รันซ้ำได้ไม่มีผลข้างเคียง
--
-- การเปลี่ยนเจ้าของคือช่องเดียวในฟอร์มแก้ไขลูกค้าที่ขยับเงิน มันตัดสินว่าออเดอร์ใบถัดไป
-- เป็นยอดของใคร แต่ที่ผ่านมาฝั่งเซิร์ฟเวอร์ไม่เคยตรวจสิทธิ์ช่องนี้เลย ด่านเดียวคือ dropdown
-- ในหน้าเว็บ ใครยิง PUT customers/:id พร้อม assigned_to ตรง ๆ ก็ย้ายลูกค้ามาเป็นของตัวเองได้
--
-- ใช้ระบบ permission เดิมแทนการ hardcode รายชื่อ role เพื่อให้ปรับเองได้ในหน้าจัดการสิทธิ์
-- ทีหลังโดยไม่ต้องแก้โค้ด แบบเดียวกับ orders.proxy_sale
--
-- Super Admin กับ Developer ผ่านอยู่แล้วโดยไม่ต้องมีคีย์นี้ (bypass ใน user_has_permission)
-- ที่ให้ตรงนี้คือกลุ่มแอดมินระดับสูงที่เหลือ ส่วนหัวหน้าทีมทุกสายถูกตัดตามที่ตกลงกัน
-- แล้วไปใช้เส้นทาง "ขอโอน" แทน

UPDATE role_permissions
SET data = JSON_SET(
      data,
      '$.permissions."customers.transfer_owner"',
      JSON_OBJECT('view', TRUE, 'use', TRUE)
    )
WHERE role IN ('super_admin', 'admin_system', 'ceo', 'admin_control')
  AND JSON_EXTRACT(data, '$.permissions') IS NOT NULL;

-- ที่เหลือปิดให้ชัดเจน ไม่ปล่อยให้เป็นคีย์ที่ไม่มีอยู่ เพราะหน้าจัดการสิทธิ์จะได้มองเห็น
-- และติ๊กเปิดให้ทีละ role ได้ถ้าภายหลังเปลี่ยนใจ
UPDATE role_permissions
SET data = JSON_SET(
      data,
      '$.permissions."customers.transfer_owner"',
      JSON_OBJECT('view', FALSE, 'use', FALSE)
    )
WHERE role NOT IN ('super_admin', 'admin_system', 'ceo', 'admin_control')
  AND JSON_EXTRACT(data, '$.permissions') IS NOT NULL;

-- เมนูคำขอโอน เป็นคีย์คนละตัวกับสิทธิ์อนุมัติโดยตั้งใจ
-- คนที่อนุมัติไม่ได้ก็ยังต้องเข้าหน้านี้เพื่อดูสถานะใบที่ตัวเองยื่นและถอนคำขอได้
-- เซิร์ฟเวอร์เป็นคนกรองว่าใครเห็นใบไหนและใครกดอนุมัติได้ เมนูแค่เปิดประตู
UPDATE role_permissions
SET data = JSON_SET(
      data,
      '$.permissions."nav.transfer_requests"',
      JSON_OBJECT('view', TRUE, 'use', TRUE)
    )
WHERE role IN ('super_admin', 'admin_system', 'ceo', 'admin_control',
               'supervisor_telesale', 'telesale')
  AND JSON_EXTRACT(data, '$.permissions') IS NOT NULL;

UPDATE role_permissions
SET data = JSON_SET(
      data,
      '$.permissions."nav.transfer_requests"',
      JSON_OBJECT('view', FALSE, 'use', FALSE)
    )
WHERE role NOT IN ('super_admin', 'admin_system', 'ceo', 'admin_control',
                   'supervisor_telesale', 'telesale')
  AND JSON_EXTRACT(data, '$.permissions') IS NOT NULL;
