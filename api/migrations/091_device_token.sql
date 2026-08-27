-- 091 — token ประจำเครื่องสำหรับแอปโทรศัพท์
--
-- ปัญหา: ผู้ใช้ที่อยู่ในขอบเขต geofence จะได้ token ที่หมดอายุตาม geo_logout_time ของบริษัท
-- (ไม่ตั้งไว้ = เที่ยงคืน) ซึ่งถูกต้องสำหรับการล็อกอินเว็บ แต่ทำให้มือถือที่วางอยู่บนโต๊ะ
-- หลุดล็อกอินทุกคืน พนักงานต้องเดินไปกรอกรหัสใหม่ทุกเช้า 51 เครื่อง
--
-- ทางแก้: เครื่องมี token ของตัวเองที่อายุยาว แยกจาก session ของเว็บโดยสิ้นเชิง
-- เครื่องพวกนี้แอดมินเป็นคนลงทะเบียนและ MDM ล็อกไว้ ไม่ใช่เบราว์เซอร์ที่พกกลับบ้านได้
-- กฎ geofence ของเว็บไม่เปลี่ยนแม้แต่ข้อเดียว
--
-- ขอบเขตของ token นี้แคบมาก: ใช้ได้เฉพาะ endpoint ใน CallController เท่านั้น
-- ต่อให้หลุดออกไปก็อ่านข้อมูลลูกค้าจากส่วนอื่นของ API ไม่ได้

ALTER TABLE `agent_devices`
    ADD COLUMN IF NOT EXISTS `device_token` VARCHAR(64) NULL
        COMMENT 'token ประจำเครื่อง ใช้ได้เฉพาะ endpoint การโทร' AFTER `push_token`,
    ADD COLUMN IF NOT EXISTS `token_expires_at` DATETIME NULL
        COMMENT 'ต่ออายุอัตโนมัติทุกครั้งที่เครื่อง poll — เครื่องที่เลิกใช้จึงตายไปเอง' AFTER `device_token`,
    ADD COLUMN IF NOT EXISTS `revoked_at` DATETIME NULL
        COMMENT 'เวลาที่แอดมินสั่งเพิกถอน (เครื่องหาย/พนักงานลาออก)' AFTER `token_expires_at`;

-- ค้นด้วย token ต้องเร็ว เพราะเรียกทุก 2 วินาทีต่อเครื่อง
ALTER TABLE `agent_devices`
    ADD UNIQUE KEY IF NOT EXISTS `uq_device_token` (`device_token`);
