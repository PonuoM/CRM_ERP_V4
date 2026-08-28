# แอปโทรศัพท์ของบริษัท — สเปกลงมือ

โปรเจกต์ "โทรผ่านคอม" ส่วนที่เหลือ ต่อจาก [phone-masking-scope.md](phone-masking-scope.md)
ยืนยันแล้ว: มือถือพนักงาน **เป็น Android ทั้งหมด**

---

## หลักการ

มือถือถูกลดบทบาทเหลือ **"หูฟังที่มีซิม"** งานทั้งหมดอยู่บนคอม

```
เทเลกดโทรบน CRM ──→ POST /api/call/dial {customer_id}
                        │  (เบราว์เซอร์ไม่เคยได้เบอร์จริง)
                        ↓
                   call_sessions [queued]
                        ↑
        มือถือถาม ──→ GET /api/call/poll?device_id=   ← เบอร์จริงออกตรงนี้ที่เดียว
                        │
                   แอปกดโทร → ซิมเดิม → ลูกค้าเห็นเบอร์เดิม
                        │
                   POST /api/call/event {status, duration}  → call_history
```

**ฝั่ง server เสร็จแล้ว** — `api/Controllers/CallController.php` + migration `090_call_bridge.sql`

---

## API ที่พร้อมใช้

| endpoint | ใคร | ทำอะไร |
|---|---|---|
| `POST /api/device/register` | แอป | ผูกเครื่องกับบัญชี `{device_id, label, sim_phone, app_version}` |
| `GET /api/call/poll?device_id=` | แอป | ถามงาน — คืน `{session_id, customer_id, customer_name, dial}` **`dial` คือเบอร์จริง** |
| `POST /api/call/event` | แอป | รายงาน `ringing` / `answered` / `ended` / `failed` + `duration_sec` |
| `POST /api/call/identify` | แอป | สายเข้า: ส่งเบอร์ไป คืนชื่อ+รหัสลูกค้า |
| `POST /api/call/dial` | CRM | ขอโทร คืน `session_id` **ไม่คืนเบอร์** |
| `GET /api/call/status` | CRM | ดูสถานะเพื่อโชว์ ringing/answered |
| `POST /api/call/cancel` | CRM | ยกเลิกก่อนติด |

ทุก endpoint ใช้ `Authorization: Bearer <token>` เดียวกับ CRM

### กติกาที่ server บังคับไว้แล้ว
- 1 เทเล = 1 สายที่ยังไม่จบ — กดรัวจะได้ session เดิม
- งานค้างเกิน 120 วินาที = `failed/timeout` อัตโนมัติ
- `poll` claim งานแบบ atomic — สองเครื่องแย่งงานเดียวกันไม่ได้
- ไม่มีเครื่องลงทะเบียน → `dial` ตอบ `NO_DEVICE` ทันที ไม่ปล่อยให้ค้างหมุน

---

## ทำไมเลือก polling ไม่ใช่ FCM

FCM เร็วกว่าประมาณ 1 วินาที แต่แลกด้วย Firebase project + service account + `google-services.json` ในตัว build
= ของนอกระบบที่พังแล้วทำให้ทั้งบริษัทโทรไม่ได้

`agent_devices.push_token` เตรียมช่องไว้แล้ว เติม FCM ทีหลังได้โดยไม่ต้อง migrate ใหม่

**จังหวะ poll ที่แนะนำ:** 2 วินาทีตอนแอปอยู่หน้าจอ, 10 วินาทีตอนพับไว้ (เครื่องเสียบชาร์จอยู่บนโต๊ะ ไม่ต้องห่วงแบต)

---

## ฝั่ง Android

### ต้องเป็นแอปโทรศัพท์หลัก (default dialer)
ไม่ใช่แค่ "แอปที่โทรได้" — ต้องเป็น default dialer ถึงจะคุมหน้าจอได้

| API | ใช้ทำอะไร |
|---|---|
| `RoleManager.ROLE_DIALER` | ขอเป็นแอปโทรศัพท์หลัก (Android 10+) |
| `InCallService` | **วาดหน้าจอระหว่างสายเอง** — โชว์ชื่อ + รหัสลูกค้า ไม่โชว์เบอร์ |
| `CallScreeningService` | สายเข้า: เรียก `/api/call/identify` แล้วโชว์เป็นชื่อ |
| `ConnectionService` / `TelecomManager.placeCall()` | กดโทรออกตามงานที่ได้จาก poll |

`CallRedirectionService` **ไม่จำเป็น** ในสถาปัตยกรรมนี้ เพราะแอปเป็นคนเริ่มโทรเองอยู่แล้ว
(จะใช้ก็ต่อเมื่ออยากดักการโทรที่เริ่มจากที่อื่น)

### Permission ที่ต้องมี
`CALL_PHONE` · `READ_PHONE_STATE` · `READ_CALL_LOG` (สำหรับ duration) · `POST_NOTIFICATIONS` · `INTERNET`
ทั้งหมดต้องเป็น **runtime permission** และ MDM grant ให้อัตโนมัติได้

### หน้าจอในแอป (มีแค่ 3)
1. **ล็อกอิน** — ครั้งเดียวตอน enroll เก็บ token แล้วเรียก `device/register`
2. **สแตนด์บาย** — โชว้ว่าเชื่อมต่ออยู่ + เบอร์ซิม + ชื่อพนักงาน ไม่มีปุ่มอะไรเลย
3. **ระหว่างสาย** — ชื่อลูกค้า + รหัส + ปุ่มวางสาย/ปิดไมค์ **ห้ามมีตัวเลขเบอร์ใด ๆ**

---

## MDM — Android Enterprise (fully managed)

ใช้ Android Management API ตรง ๆ ได้ฟรี หรือเช่า MDM สำเร็จรูปเพื่อความเร็ว

**นโยบายที่ต้องล็อก:**

| ปิด | เหตุผล |
|---|---|
| แอปรายชื่อผู้ติดต่อ | สมุดโทรศัพท์คือช่องรั่วหลัก |
| แอป SMS | ลูกค้าส่ง SMS มา เบอร์โผล่ |
| ประวัติการโทรของระบบ | เห็นเบอร์ย้อนหลังได้ |
| Play Store / ติดตั้งแอปเอง | ลงแอปอ่าน call log มาแทน |
| USB file transfer | ดูดข้อมูลออกทางสาย |
| จับภาพหน้าจอ | ถ่ายจอเก็บ |
| เพิ่มบัญชีผู้ใช้ | หลบ policy |

**Kiosk mode** ให้เหลือแอปเดียว

### ⚠️ Samsung Auto Blocker บล็อกการขอเป็นแอปโทรศัพท์หลัก

เจอจริงตอนทดสอบ (26 ส.ค. 2026) — เครื่อง Samsung ขึ้น *"แอปถูกปฏิเสธไม่ให้เข้าถึงเพื่อเป็นแอปโทรศัพท์เริ่มต้น"*
Auto Blocker กันแอปที่ติดตั้งนอก Play Store ไม่ให้รับ role ที่อ่อนไหว

- **แก้ตอนทดสอบ:** การตั้งค่า → ความปลอดภัยและความเป็นส่วนตัว → ตัวบล็อกอัตโนมัติ → ปิด
  (สำรอง: การตั้งค่า → แอป → Primacom Dialer → ⋮ → อนุญาตการตั้งค่าที่ถูกจำกัด)
- **ตอน rollout ไม่ต้องแก้:** ติดตั้งผ่าน MDM + Managed Google Play จะไม่ชน Auto Blocker เลย
  เพราะนับเป็นแอปที่องค์กรอนุมัติ ไม่ใช่ของนอกร้าน

→ เหตุผลเพิ่มอีกข้อว่าทำไม rollout ต้องผ่าน MDM ไม่ใช่ลากไฟล์ลงทีละเครื่อง

⚠️ **ตอน enroll ต้องล้างรายชื่อผู้ติดต่อและประวัติการโทรเดิมออกจากเครื่อง** — ข้อมูลที่อยู่ในเครื่องมาก่อนไม่ได้หายไปเอง ข้ามขั้นนี้แล้วทั้งโปรเจกต์เสียเปล่า

---

## ลำดับลงมือ

| ขั้น | งาน | เสร็จแล้วได้อะไร |
|---|---|---|
| 1 | รัน migration 090 บน prod | ตารางพร้อม |
| 2 | แอปเปล่า: ล็อกอิน + `device/register` + poll ทุก 2 วิ (ยังไม่ต้องโทร) | พิสูจน์ว่าสะพานเชื่อมติด |
| 3 | ต่อ `TelecomManager.placeCall()` + รายงาน event | **โทรออกได้จริงจากคอม** |
| 4 | `InCallService` วาดหน้าจอเอง | เบอร์หายจากหน้าจอมือถือ |
| 5 | `CallScreeningService` + `/call/identify` | สายเข้าโชว์เป็นชื่อ |
| 6 | MDM policy + enroll + ล้างเครื่อง | ปิดช่องที่เหลือ |
| 7 | เปิด `phone_masking_stage` = `full` ให้บริษัทนั้น | จบโปรเจกต์ |

**ขั้น 2–3 คือหัวใจ** — ผ่านสองขั้นนี้แล้วที่เหลือเป็นงานประกอบ

---

## ฝั่ง CRM ที่ยังต้องเพิ่ม

- ปุ่ม "โทร" เรียก `POST /api/call/dial` แล้ว poll `/api/call/status`
- สถานะบนหน้าจอ: กำลังโทร → ดังอยู่ → คุยอยู่ (นับเวลา) → วางสาย
- ปุ่มยกเลิกตอนยังไม่ติด
- สายเข้า: เด้งการ์ดลูกค้าขึ้นมา (poll `call_sessions` direction=inbound หรือ WebSocket)
