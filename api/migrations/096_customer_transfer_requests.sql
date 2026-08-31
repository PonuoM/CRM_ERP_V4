-- 096: คำขอโอนลูกค้า
--
-- ทุกวันนี้การขอโอนเกิดขึ้นนอกระบบ คุยกันในไลน์บ้าง เจอหน้าบ้าง แล้วยื่นเรื่องให้ไอทีแก้ให้
-- ผลคือไม่มีใครตอบได้ว่าใครขออะไรกับใคร ด้วยเหตุผลอะไร และใครเป็นคนตัดสินใจ
-- พอ 095 ตัดสิทธิ์เปลี่ยนเจ้าของออกจากหัวหน้าทีมแล้ว ตารางนี้คือเส้นทางทดแทน
--
-- เก็บ current_owner_id ไว้ตอนยื่นด้วยโดยตั้งใจ ไม่ใช่ข้อมูลซ้ำซ้อน เพราะระหว่างรออนุมัติ
-- cron ดึงคืนรอบเดือนหรือการแจกลูกค้าอาจเปลี่ยนเจ้าของไปแล้ว ตอนกดอนุมัติจะได้เทียบได้ว่า
-- สิ่งที่แอดมินกำลังอนุมัติยังเป็นเรื่องเดียวกับที่คนยื่นขอมาหรือเปล่า

CREATE TABLE IF NOT EXISTS customer_transfer_requests (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    customer_id        VARCHAR(32)  NOT NULL,
    company_id         INT          NOT NULL,

    requested_by       INT          NOT NULL COMMENT 'คนกดยื่นคำขอ',
    -- ปกติคือคนเดียวกับ requested_by แต่หัวหน้ายื่นแทนลูกทีมได้ จึงแยกคอลัมน์ไว้
    requested_owner_id INT          NOT NULL COMMENT 'คนที่ควรได้ลูกค้าไปดูแล',
    current_owner_id   INT          NULL     COMMENT 'เจ้าของ ณ ตอนยื่น NULL คือยังไม่มีเจ้าของ',

    reason             TEXT         NULL     COMMENT 'เหตุผลที่ขอ ใช้ตอนแอดมินตัดสินใจ',

    status             ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    decided_by         INT          NULL,
    decided_at         DATETIME     NULL,
    decision_note      TEXT         NULL,

    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status_created (status, created_at),
    INDEX idx_customer (customer_id),
    INDEX idx_requested_by (requested_by),
    INDEX idx_company_status (company_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- กันยื่นซ้ำซ้อน ลูกค้าหนึ่งรายมีคำขอที่ยังไม่ตัดสินได้ทีละใบเดียว
-- ใช้คอลัมน์ generated แทน UNIQUE ตรง ๆ เพราะต้องการให้ใบที่ปิดแล้วซ้ำได้ไม่จำกัด
ALTER TABLE customer_transfer_requests
  ADD COLUMN pending_key VARCHAR(32)
    GENERATED ALWAYS AS (IF(status = 'pending', customer_id, NULL)) VIRTUAL,
  ADD UNIQUE KEY uq_one_pending_per_customer (pending_key);
