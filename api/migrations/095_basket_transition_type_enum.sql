-- 095 — เติมค่าที่หายไปใน enum ของ basket_transition_log.transition_type
--
-- ปัญหา
--   transition_type เป็น ENUM และ sql_mode บน prod เป็น NO_ENGINE_SUBSTITUTION
--   (ไม่ใช่ STRICT) ค่าที่ไม่อยู่ในลิสต์จึงถูกเขียนเป็นสตริงว่างเงียบ ๆ ไม่มี error
--   ไม่มี exception โค้ดฝั่ง PHP มองว่าสำเร็จทุกครั้ง
--
--   ผลจริง ณ 28 ส.ค. 2569: basket_transition_log มีแถวที่ transition_type = ''
--   อยู่ 65,671 แถว ในนั้นเป็นการย้ายถังจากออเดอร์ที่ถูกยกเลิก/ตีกลับ 147 แถว
--   ซึ่งตรงกับจำนวนใน customer_audit_log (basket_routing_v2/cancelled_*) พอดี
--   แปลว่าถังขยับจริงแต่ประวัติหายทั้งหมด สืบย้อนไม่ได้ว่าใครย้ายเพราะอะไร
--
--   BasketRoutingServiceV2::handleCancelledOrder() ส่งค่า 3 ตัวนี้มาตั้งแต่ต้น
--   แต่ไม่เคยมีใน enum เลย และ reconcile_orphan เป็นของใหม่ที่กำลังจะใช้
--
-- ⚠️ ต่อท้ายเท่านั้น ห้ามสลับลำดับหรือลบค่าเดิม
--   MySQL/MariaDB เก็บ ENUM เป็นเลข index ไม่ใช่ข้อความ การสลับลำดับจะทำให้
--   ข้อมูลเดิม 324,000 แถวแปลความหมายผิดทั้งตาราง ค่า '' ที่ค้างอยู่คือ index 0
--   (ช่องสำหรับค่าผิด) การต่อท้ายอย่างเดียวจึงปลอดภัย ไม่กระทบของเก่า
--
-- migration นี้ไม่แก้ข้อมูล 65,671 แถวที่เสียไปแล้ว — กู้ไม่ได้ เพราะค่าเดิมไม่เหลือ
-- อยู่ที่ไหนเลย ทำได้แค่หยุดไม่ให้เสียเพิ่ม
--
-- วิธีรัน:
--   php C:/AppServ/www/voicecall/ops/db.php erp api/migrations/095_basket_transition_type_enum.sql

-- ⚠️ สองบรรทัดคุมความปลอดภัยข้างล่าง อย่าลบ อย่าถอด
--
--   ตารางนี้มี 2,020,104 แถว / 417 MB (ณ 28 ส.ค. 2569) ถ้าปล่อยให้ MariaDB
--   เลือกวิธีเอง แล้วมันตัดสินใจ COPY ตารางทั้งใบ จะล็อกเขียนนานหลายนาที
--   กลางเวลาทำงาน -- ทุกการแจกงาน/กดออเดอร์ที่เขียน log ถังจะค้างตามไปด้วย
--
--   1. lock_wait_timeout = 5
--      ค่า default บนเครื่องนี้คือ 86400 (24 ชั่วโมง!) ถ้ามี query ค้างอยู่บน
--      ตารางตอน ALTER ขอ metadata lock มันจะรอเงียบ ๆ ได้ทั้งวัน และ query
--      ที่มาทีหลังจะต่อคิวหลัง ALTER อีกที = เว็บค้างยกแผง (เคยเกิดตอน 093)
--      ตั้งสั้น ๆ ให้ ALTER ยอมแพ้เองแทนที่จะไปขวางทางคนอื่น แล้วรันใหม่
--
--   2. ALGORITHM=INPLACE, LOCK=NONE
--      LOCK=NONE คือตัวประกัน: สั่งว่า "ถ้าทำโดยไม่บล็อกคนอื่นไม่ได้ ให้ error
--      ทิ้งไปเลย" ไม่ยอมให้แอบล็อกตาราง
--
--      หมายเหตุจากการรันจริงบน prod (MariaDB 10.6.19):
--      ALGORITHM=INSTANT ถูกปฏิเสธ ต้องใช้ INPLACE แทน -- ซึ่งก็ไม่ copy ตาราง
--      อยู่ดี รันจริงเสร็จใน 0.0165 วินาที ไม่บล็อกใครเลย
--      ถ้าวันหนึ่ง INPLACE ถูกปฏิเสธด้วย แปลว่าต้อง rebuild จริง ให้เลื่อนไป
--      รันนอกเวลาทำการ อย่าถอด LOCK=NONE ออกเพื่อให้มันผ่าน

SET SESSION lock_wait_timeout = 5;

ALTER TABLE basket_transition_log
  MODIFY COLUMN transition_type ENUM(
    -- ── ของเดิม เรียงลำดับเดิมทุกตัว ห้ามแตะ ──
    'sale',
    'fail',
    'monthly_cron',
    'manual',
    'redistribute',
    'pending_admin_owned',
    'pending_admin_unowned',
    'picking_upsell_sold',
    'picking_upsell_not_sold',
    'picking_upsell_return_39',
    'picking_dist_to_pool',
    'picking_telesale_own',
    'picking_admin_to_upsell',
    'picking_telesale_from_dist',
    'picking_admin_no_owner',
    'aging_timeout',
    'upsell_by_others',
    'upsell_exit',
    'upsell_distribution',
    'distribute',
    'reclaim',
    'transfer',
    'blocked',
    'unblocked',
    'sync_fix',
    -- ── เติมใหม่ ต่อท้ายเท่านั้น ──
    -- handleCancelledOrder() ส่งมาตั้งแต่แรกแต่ไม่เคยมีใน enum
    'cancelled_upsell_return_39',
    'cancelled_upsell_to_pool',
    'cancelled_dist_to_pool',
    -- ตาข่ายรับลูกค้าที่หลุดออกนอกระบบถัง (reconcileOrphanedBaskets)
    'reconcile_orphan'
  ) NOT NULL,
  ALGORITHM=INPLACE, LOCK=NONE;

-- รันบน prod แล้วเมื่อ 28 ส.ค. 2569 ผลตรวจหลังรัน:
--   ENUM 25 -> 29 ค่า, ลำดับ 25 ค่าเดิมคงที่ทุกตัว
--   แถวรวม 2,020,104 เท่าเดิม, แถวที่ transition_type='' ยังคง 65,671 (ตามที่ตั้งใจ)
