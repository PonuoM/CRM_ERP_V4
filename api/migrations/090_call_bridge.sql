-- 090 — สะพานระหว่าง CRM กับมือถือของเทเล (โปรเจกต์ "โทรผ่านคอม")
--
-- เทเลกดโทรบนคอม → ระบบสร้าง call_session → มือถือที่ผูกกับคนนั้นรับงานไปกดโทรให้
-- เบอร์จริงเดินทางถึงมือถือเท่านั้น ไม่เคยผ่านเบราว์เซอร์ (ดู api/phone_privacy.php)
--
-- ตั้งใจไม่ผูกกับ Firebase: มือถือถาม `call/poll` เอาเอง ทำงานได้ทันทีโดยไม่ต้องตั้ง FCM
-- ช่อง push_token เผื่อไว้ให้เติม FCM ทีหลังเพื่อลด latency โดยไม่ต้อง migrate ใหม่

-- ── เครื่องที่ลงทะเบียนไว้ ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `agent_devices` (
    `id`           INT AUTO_INCREMENT PRIMARY KEY,
    `user_id`      INT NOT NULL COMMENT 'เจ้าของเครื่อง (users.id)',
    `device_id`    VARCHAR(64)  NOT NULL COMMENT 'ค่าคงที่ต่อการติดตั้ง สร้างตอน enroll',
    `label`        VARCHAR(128) NULL COMMENT 'ยี่ห้อ/รุ่น ไว้ให้แอดมินดูว่าเครื่องไหน',
    `sim_phone`    VARCHAR(32)  NULL COMMENT 'เบอร์ซิมในเครื่อง — ใช้จับคู่กับไฟล์อัดเสียงของ OneCall',
    `push_token`   VARCHAR(255) NULL COMMENT 'เผื่อ FCM ในอนาคต ตอนนี้ยังไม่ใช้',
    `app_version`  VARCHAR(32)  NULL,
    `status`       ENUM('active','revoked') NOT NULL DEFAULT 'active',
    `last_seen_at` DATETIME NULL COMMENT 'อัปเดตทุกครั้งที่ poll — ใช้ดูว่าเครื่องไหนหลุด',
    `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY `uq_device` (`device_id`),
    KEY `idx_user_status` (`user_id`, `status`),
    KEY `idx_last_seen` (`last_seen_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='มือถือที่ผูกกับเทเลแต่ละคน';

-- ── งานโทรหนึ่งครั้ง ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `call_sessions` (
    `id`              INT AUTO_INCREMENT PRIMARY KEY,
    `company_id`      INT NOT NULL,
    `agent_user_id`   INT NOT NULL COMMENT 'เทเลที่กดโทร หรือเจ้าของเบอร์ที่รับสาย',
    `customer_id`     INT NULL COMMENT 'NULL ได้ = สายเข้าจากเบอร์ที่ยังไม่รู้จัก',
    `device_id`       VARCHAR(64) NULL COMMENT 'เครื่องที่รับงานนี้ไปทำ',
    `direction`       ENUM('outbound','inbound') NOT NULL,
    `status`          ENUM('queued','dispatched','ringing','answered','ended','failed','cancelled')
                      NOT NULL DEFAULT 'queued',
    `requested_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `dispatched_at`   DATETIME NULL COMMENT 'เวลาที่มือถือมารับงานไป',
    `answered_at`     DATETIME NULL,
    `ended_at`        DATETIME NULL,
    `duration_sec`    INT NULL,
    `failure_reason`  VARCHAR(128) NULL COMMENT 'เช่น no_device, declined, no_answer',
    `call_history_id` INT NULL COMMENT 'ผูกกับ call_history หลังวางสาย',
    KEY `idx_agent_status` (`agent_user_id`, `status`),
    KEY `idx_customer` (`customer_id`),
    KEY `idx_requested` (`requested_at`),
    KEY `idx_company_requested` (`company_id`, `requested_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='งานโทรหนึ่งครั้ง ตั้งแต่กดปุ่มจนวางสาย';

-- งานที่ค้างเกิน 2 นาทีถือว่าเครื่องไม่มารับ ปล่อยค้างไว้จะกินคิวของครั้งถัดไป
-- (เก็บกวาดใน CallController::poll ไม่ต้องพึ่ง event scheduler ของ MySQL)
