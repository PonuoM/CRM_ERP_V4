# CRM_ERP_V4 — สิ่งที่ต้องรู้ก่อนแตะโค้ดนี้

ไฟล์นี้โหลดอัตโนมัติทุกครั้งที่เปิดคุยงานใหม่ และอยู่ใน git ทีมคนอื่นเห็นด้วย

---

## ⛔ กฎเรื่อง deploy

**ห้ามอัปโค้ดขึ้น host เองโดยไม่ถาม** — ทีมมีหลายคน build ในเครื่อง โค้ดอาจตกรุ่นแล้วทับงานคนอื่น
ขออนุญาตเป็นครั้ง ๆ ไปทุกครั้ง โดยเฉพาะ `mini_erp`

**production ล่ม = กู้ให้ใช้ได้ก่อน แล้วค่อยหา root cause**

---

## Environment บน host

| | path | URL | ใช้ทำอะไร |
|---|---|---|---|
| **prod** | `/domains/prima49.com/public_html/mini_erp` | prima49.com/mini_erp | พนักงานใช้จริงตลอดเวลา |
| **ทดสอบ** | `/domains/prima49.com/public_html/beta_test` | prima49.com/beta_test | ดูของจริงก่อนปล่อย |

สลับด้วยการแก้ `APP_BASE_PATH` ใน [appBasePath.ts](appBasePath.ts) แล้ว build ใหม่

### ⚠️ ทั้งคู่ใช้ฐานข้อมูล `primacom_mini_erp` ตัวเดียวกัน

beta_test แยก **โค้ด** ไม่ได้แยก **ข้อมูล**

- ดูหน้าจอ / โค้ดพัง → ปลอดภัย คนละไฟล์
- **กดปุ่มที่เขียน DB / รัน migration → ลง prod จริง** พนักงานเห็นทันที

**บริษัททดสอบสำหรับกดปุ่มจริง:**

| id | ชื่อ | ข้อมูล |
|---|---|---|
| **5** | บริษัท มีเงินใช้แบบไม่ จำกัด | 7 users ครบทุก role · 1,044 ลูกค้า · 1,151 ออเดอร์ ← **ใช้ตัวนี้** |
| 12 | บริษัท ธนู สุริวงศ์ (ทดสอบ) | 1 user (Admin Control) · ไม่มีลูกค้า/ออเดอร์ |

### feature flag ต้องแยกตาม deployment

DB เดียวกัน ⇒ setting key เดียวจะรั่วข้าม environment เปิดทดสอบบน beta_test แล้วโดน prod ทันที
ดูแบบอย่างที่ `phone_masking_setting_key()` ใน [api/phone_privacy.php](api/phone_privacy.php) — เอาชื่อโฟลเดอร์เหนือ `api/` มาเป็น suffix

---

## กับดักตอน deploy

**`config.php` มี 2 ไฟล์ที่ต้องเหมือนกัน** — `host-build.ts` เอา root [config.php](config.php) ทับ [api/config.php](api/config.php) บน prod
helper ที่เพิ่มแค่ `api/config.php` จะ **undefined บนเว็บจริง** → เพิ่มทั้ง 2 ไฟล์ หรือแยกเป็นไฟล์ของตัวเองไปเลย

**ไฟล์ใหม่ที่ถูก `require_once`** ต้องอัปพร้อมกันเสมอ — ลืมไฟล์เดียว API ตายทั้งระบบ

**`APP_BASE_PATH` ถูกคอมไพล์เข้า bundle** — build ค้างเป็น `/beta_test/` แล้วอัป `dist/` ขึ้น prod = จอขาว
(อัปเฉพาะ `api/*.php` ไม่ต้อง build ใหม่ base path ไม่เกี่ยว)

### ใช้สคริปต์ช่วย

```bash
npx tsx scripts/host/host-deploy.ts --target beta_test              # dry run ไม่ต้องใช้รหัส FTP
npx tsx scripts/host/host-deploy.ts --target beta_test --apply      # เฉพาะ api/*.php
npx tsx scripts/host/host-deploy.ts --target beta_test --with-dist --apply   # อัปหน้าเว็บด้วย
```

⚠️ **`dist/` อยู่ใน `.gitignore`** git จึงไม่รายงานว่าเปลี่ยน — ถ้าไม่ใส่ `--with-dist` หน้าเว็บจะไม่ถูกอัป
สคริปต์เตือนให้ทุกครั้งพร้อมบอกว่า build ล่าสุดเมื่อไหร่

ตรวจให้อัตโนมัติ: `php -l` ทุกไฟล์ · `require_once` ครบไหม · `APP_BASE_PATH` ตรง target ไหม
`--target` บังคับใส่ ไม่มี default เพื่อกันไปโดน prod โดยไม่ตั้งใจ

---

## ฐานข้อมูล

โค้ดใน repo นี้ serve **production จริง** — migration ต้องรันที่ remote `primacom_mini_erp` (202.183.192.218)
ไม่ใช่ local `mini_erp`/`erp`

**อ่านข้อความไทยจาก DB ให้ใช้ PHP/PDO อย่าใช้ `mysql.exe` CLI** — console codepage ของ Windows ทำข้อความเพี้ยนแบบเงียบ ๆ ไม่มี error
มี helper พร้อมใช้: `php C:/AppServ/www/voicecall/ops/db.php erp -e "SELECT ..."`

---

## งานที่กำลังทำอยู่

- [.agents/workflows/phone-masking-scope.md](.agents/workflows/phone-masking-scope.md) — ซ่อนเบอร์ลูกค้า (โปรเจกต์โทรผ่านคอม)
- [.agents/workflows/distribution-v2-guide.md](.agents/workflows/distribution-v2-guide.md) — Distribution V2
