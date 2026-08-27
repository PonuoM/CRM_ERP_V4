# ขอบเขตงานซ่อนเบอร์ลูกค้า — ผลสำรวจ (26 ส.ค. 2026)

งานสัปดาห์ที่ 1 ของโปรเจกต์ "โทรผ่านคอม" — ล็อกขอบเขตว่าต้องแก้ตรงไหนบ้าง
งานนี้ไม่ขึ้นกับว่าจะเลือกทางไหน (มือถือ+custom dialer / GSM Gateway / YaleCom) ทำได้เลย

## ความคืบหน้า

| งาน | สถานะ |
|---|---|
| นโยบายกลาง `api/phone_privacy.php` (2 stage) | ✅ เสร็จ |
| **กลุ่ม B — ไฟล์ export** | ✅ เสร็จ — **บังคับใช้แล้ว** |
| **กลุ่ม A — ครบทุกจุดแล้ว** | ✅ เสร็จ (32 ไฟล์ผ่าน preflight) |
| กลุ่ม C — `customer_ref_id` | ✅ `scrub_customer_row` ตัดให้อัตโนมัติ |
| **การ์ดค้นหาด้วยเบอร์** | ✅ เสร็จ — 13 จุด |
| **เติม auth ให้ 5 export endpoint** | ✅ เสร็จ |

**ฝั่ง backend ปิดครบแล้ว**

### ฝั่ง frontend

| งาน | สถานะ |
|---|---|
| `GET /api/phone_policy` + `fetchPhonePolicy()` + `usePhonePolicy()` | ✅ UI ถามสถานะจาก server ได้แล้ว ไม่ต้องเดาจากคำว่า "ซ่อน" |
| กัน `formatPhoneToPlus66()` พัง (CallHistoryPage) | ✅ |
| กัน validation บล็อกการบันทึกออเดอร์ (CreateOrderPage) | ✅ |
| กันค่า mask เขียนกลับลง DB (`OrderController` recipient_phone) | ✅ |
| ซ่อนคอลัมน์เบอร์แทนการโชว์คำว่า "ซ่อน" | ⬜ |
| ซ่อนช่องค้นหาด้วยเบอร์ตอน `can_search_phone=false` | ⬜ |
| ปุ่มกดโทร (ส่ง `customer_id`) | ⬜ รอแอป Android |
| เด้งหน้าจอตอนสายเข้า | ⬜ รอแอป Android |

### ทำไมต้องปิดการค้นหาด้วยเบอร์

`phone LIKE '%081234%'` เป็น oracle — คนที่อ่านเบอร์ไม่ได้ ยังไล่เดาทีละหลักแล้วดูว่าใครโผล่มาได้
ปิดเฉพาะตอน stage `full` เท่านั้น บริษัทที่ยังไม่ย้ายค้นหาได้เหมือนเดิม

ยกเว้น endpoint เช็คเบอร์ซ้ำ (`CustomerController` 618–630) ที่**ไม่ปิด** เพราะบังคับ ≥9 หลักอยู่แล้ว
(ต้องรู้เบอร์เกือบครบก่อนถึงค้นได้ = ไม่ใช่ oracle) และถ้าปิดจะเกิดลูกค้าซ้ำ

### สวิตช์เปิดใช้งาน (แยกตาม deployment)

เบอร์บนหน้าจอ **ยังแสดงปกติวันนี้** เพราะถ้าซ่อนตอนนี้เทเลจะโทรหาลูกค้าไม่ได้เลย

⚠️ `mini_erp` กับ `beta_test` **ใช้ฐานข้อมูลตัวเดียวกัน** (`primacom_mini_erp`) — แยกแค่โค้ด ไม่ได้แยกข้อมูล
สวิตช์จึงต้องแยก key ตาม deployment ไม่งั้นเปิดทดสอบบน beta_test แล้วเทเลบน prod ตาบอดทันที

`phone_masking_setting_key()` เลือก key ให้เองจากชื่อโฟลเดอร์ที่โค้ดรันอยู่ ไม่ต้องตั้งค่าอะไร:

| รันอยู่ที่ | key ที่ใช้ |
|---|---|
| `/public_html/mini_erp/` | `phone_masking_stage` |
| `/public_html/beta_test/` | `phone_masking_stage_beta_test` |
| เครื่อง dev | `phone_masking_stage_CRM_ERP_V4` |

### 3 stage แยกรายบริษัท

ระบบมีหลายบริษัท และบางบริษัทจะยังใช้แบบเดิม จึงต้องสลับได้ทีละบริษัท

| stage | export | หน้าจอ | ใช้เมื่อ |
|---|---|---|---|
| `off` | เห็นเบอร์ | เห็นเบอร์ | **แบบเดิมทุกอย่าง** — เป็นค่า default |
| `exports_only` | 🔒 ซ่อน | เห็นเบอร์ | ขั้นแรก ปิดรูไฟล์ที่หลุดออกนอกบริษัทได้ก่อน |
| `full` | 🔒 ซ่อน | 🔒 ซ่อน | บริษัทที่มีแอปโทรแล้ว |

**default คือ `off` → deploy โค้ดขึ้นไปแล้วไม่มีอะไรเปลี่ยนเลยจนกว่าจะเปิดให้บริษัทไหน**

ค่าใน `setting_value` เป็น JSON แถวเดียว:
```sql
INSERT INTO app_settings (setting_key, setting_value) VALUES
  ('phone_masking_stage_beta_test', '{"default":"off","companies":{"5":"full"}}')
  ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value);
```

ใส่สตริงเปล่า ๆ (`'full'`) ก็ได้ = ใช้กับทุกบริษัท เอาไว้ตอน rollout จบแล้ว

ลำดับที่แนะนำต่อบริษัท: `off` → `exports_only` (ได้ประโยชน์ทันที ไม่กระทบการโทร) → `full` (เมื่อแอปพร้อม)
ถอยกลับได้ทุกขั้นด้วยการแก้ JSON แถวเดียว

**ผู้เรียกที่ระบุตัวไม่ได้** (ยังไม่ล็อกอิน — 5 export endpoint ยังไม่มี auth) จะได้ stage ที่**เข้มที่สุด**ในบรรดาบริษัทที่เปิดไว้ เพราะโยงเข้าบริษัทไหนไม่ได้ บริษัทที่ยัง `off` ไม่กระทบ

### ตรวจแล้วว่าไม่ต้องแก้ (ใช้เบอร์เป็นคีย์ภายใน ไม่ได้ส่งออก)

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `api/Onecall_DB/*` (11 ไฟล์) | `users.phone` = เบอร์พนักงาน จับคู่กับ `phone_telesale` / `agent_phone` |
| `api/User_DB/telesale_segment_matrix.php` 362 | `$phoneBasket[$row['phone']]` เป็นคีย์ join กับข้อมูลการโทร — mask แล้วรายงานพัง |
| `api/Order_DB/export_templates.php` | นิยามคอลัมน์เฉย ๆ ตัวแปลงค่าอยู่ที่ `resolveDataSource()` ฝั่ง React ซึ่งกินข้อมูลจาก API ที่ปิดแล้ว |
| WHERE clause ที่รับเบอร์เป็น input | `distribution_helper` · `get_debt_collection_orders` 142–180 · `sales_sheet` 96 · `index.php` 1345–1370 · `CustomerController` 877–905 · `OrderController` 399 · `get_return_orders` 58 · `get_upsell_orders` 50 — รับเข้า ไม่ได้ส่งออก (ยังต้องใส่การ์ดตาม role) |
| `api/import/*`, `api/cron/*`, `api/seeds/*` | ฝั่งเขียน ไม่ออกเบราว์เซอร์ |

ยังไม่ commit และยังไม่ deploy

---

## `customer_ref_id` ฝังเบอร์ไว้ — แต่ไม่ใช่ตัวหลัก จึงไม่ต้องออกรหัสใหม่

`customer_ref_id` ฝังเบอร์ไว้จริง รูปแบบ `CUS-<เบอร์>-<company_id>` (บางแถวตัด 0 นำหน้า บางแถวไม่มีขีด)

```
CUS-00628246159-2   →  phone = 00628246159
CUS-941680028-7     →  phone = 0941680028
CUS810613776        →  phone = 0810613776
```

วัดแล้ว **238,358 จาก 238,369 ราย = 100.0%**

**แต่มันเป็นแค่คีย์กันเบอร์ซ้ำตอน import ไม่ใช่รหัสที่ระบบใช้อ้างอิงลูกค้า**
ตัวจริงคือ `customers.customer_id` ซึ่งเป็นเลขรันธรรมดา (327833, 351559, 353848 …) **ไม่ผูกกับเบอร์อยู่แล้ว**

### เพราะฉะนั้น

✅ **ไม่ต้องออกรหัสลูกค้าใหม่ ไม่ต้อง migrate 239,601 ราย** — ใช้ `customer_id` ที่มีอยู่เป็นรหัสที่โชว์ได้เลย
❌ แต่ต้อง **ตัด `customer_ref_id` ออกจาก response ของ API** เพราะถ้าติดไปด้วย เปิด DevTools ก็อ่านเบอร์ได้

### `customer_ref_id` โผล่ที่ไหนบ้าง

พบ 174 จุด / 38 ไฟล์ แต่ส่วนใหญ่เป็นสคริปต์ import, migration, archive และ cron ที่ไม่ออกเบราว์เซอร์
ที่เกี่ยวจริงมีแค่:

| จุด | อาการ |
|---|---|
| `components/BlockedCustomersModal.tsx` 380–382 | **แสดง `#CUS-00628246159-2` บนหน้าจอ** ข้างชื่อลูกค้า — และบรรทัด 386 โชว์ `c.phone` ตรง ๆ อยู่แล้ว |
| `services/api.ts` 942–948 | `DuplicateCustomerMatch` มี `customer_ref_id`, `phone`, `backup_phone` ครบ (คู่กับ `CustomerController.php` 643–686) |
| `utils/customerMapper.ts` 29, 41 · `App.tsx` 1178/1605/3702/7184 | map `customer_ref_id` เข้า object ฝั่ง React |
| `components/CustomerTable.tsx` 415 | ใช้เป็น React key fallback เฉย ๆ **ไม่ได้แสดงผล** — ไม่ต้องแก้ |

---

## ขอบเขตจริง

ตัวเลข 171 ไฟล์ที่เคยพูดถึงเป็นการนับ substring (`telephone`, `agent_phone`, `shipping_phone` ติดมาด้วย)
นับใหม่แบบ token เดี่ยว: **71 ไฟล์ / 367 จุด** ใน `api/` แล้วคัดจริงเหลือตามนี้

### กลุ่ม A — เบอร์ลูกค้าออกไปที่เบราว์เซอร์ (ต้องแก้)

| ไฟล์ | บรรทัด | หมายเหตุ |
|---|---|---|
| `api/Controllers/CustomerController.php` | 1098–1103 | `$neededCols` ของลิสต์/รายละเอียดลูกค้า — มี `phone`, `backup_phone`, `recipient_phone` ครบชุด **ตัวหลักที่สุด** |
| `api/Controllers/CustomerController.php` | 643–686 | endpoint เช็คเบอร์ซ้ำ คืน `phone` + `backup_phone` ออกมาตรง ๆ |
| `api/Controllers/CustomerController.php` | 1357, 1474 | สร้าง/แก้ไขลูกค้า แล้ว echo ค่ากลับ |
| `api/index.php` | 2854, 2871 | **API ประวัติการโทร** join `c.phone AS customer_phone` — หน้าที่เทเลใช้บ่อยที่สุด |
| `api/index.php` | 2704–2706 | รายละเอียดออเดอร์ → `customer_phone`, `phone`, `customer_backup_phone` |
| `api/index.php` | 4297 | `c.phone` ในลิสต์ |
| `api/Controllers/DistributionController.php` | 629, 653 | → คีย์ `phone` |
| `api/Controllers/DistributionExportController.php` | 155 | `cust.phone as customer_phone` |
| `api/Controllers/DistributionReportController.php` | 140 | |
| `api/Distribution/reset.php` | 206 | |
| `api/get_blocked_customers.php` | 32, 104 | |
| `api/basket_config.php` | 411 | |
| `api/dashboard_call_analysis.php` | 209, 1158 | render ลง HTML ตรง ๆ |
| `api/Finance/get_debt_collection_orders.php` | 289 | |
| `api/customer_addresses.php` | 44, 60, 65, 81 | ⚠️ ส่ง `recipient_phone` ออกมาในคีย์ชื่อ `phone` และ fallback เป็น `phone` หลัก — **จุดที่มองข้ามง่ายที่สุด** |
| `api/Address_DB/get_address_data.php` | 162–163, 249 | `$addr['phone'] = $addr['recipient_phone']` |

### กลุ่ม B — ไฟล์ export (เสี่ยงสุด เพราะดาวน์โหลดเป็น Excel ออกนอกระบบได้)

| ไฟล์ | บรรทัด |
|---|---|
| `api/Distribution/export_distribution.php` | 41, 104 |
| `api/Commission/export_commission_orders.php` | 102 |
| `api/Finance/export_debt_collection.php` | 76, 170 |
| `api/Orders/export_orders_raw.php` | 105 |
| `api/Orders/export_return_orders.php` | 62 |
| `api/Reports/export_call_history.php` | 19, 73 |
| `api/Order_DB/export_templates.php` | 248–249, 291–292 | ⚠️ เป็น template ที่ผู้ใช้เลือกคอลัมน์เองได้ (`data_source: customer.phone`) — ต้องถอดตัวเลือกออกจาก template ไม่ใช่แค่แก้คิวรี |

### กลุ่ม C — `customer_ref_id` หลุดไปกับ response

ดูตารางในหัวข้อแรก — งานคือถอดฟิลด์ออกจาก payload ไม่ใช่เปลี่ยนรหัสทั้งระบบ

---

## ตัดออกจากขอบเขต (ตรวจแล้วไม่ใช่เบอร์ลูกค้า)

| กลุ่ม | เหตุผล |
|---|---|
| `api/Onecall_DB/*` (11 ไฟล์) | เป็น `users.phone` = เบอร์พนักงาน ใช้ match กับ `phone_telesale` / `agent_phone` |
| `api/Controllers/UserController.php`, `api/get_admin_page_users.php`, `api/User_DB/hr_employee_mapping.php` | เบอร์พนักงาน |
| `api/index.php` 4573–4825 | เบอร์ของ companies / warehouses / suppliers |
| `api/import/*`, `api/cron/*`, `api/seeds/*` | ฝั่งเขียน ไม่ได้ส่งออกเบราว์เซอร์ |

⚠️ ข้อยกเว้น: `api/cron/run_batch_merge.php` 103–212 รวม `backup_phone` ตอน merge ลูกค้าซ้ำ — ไม่ใช่จุดรั่ว แต่ต้องแก้ตามถ้าเปลี่ยนโครงสร้างการเก็บเบอร์

---

## ข้อสรุปที่ตกลงแล้ว

### 1. รหัสลูกค้าที่จะโชว์
ใช้ **`customers.customer_id`** ที่มีอยู่ ไม่สร้างคอลัมน์ใหม่ ไม่ต้อง migrate
เป็นเลขรันที่ไม่ผูกกับเบอร์อยู่แล้ว และเป็นตัวที่ระบบใช้อ้างอิงจริงทุกที่

### 2. ค้นหาด้วยเบอร์
**ปิดสำหรับ role เทเลเซล เปิดให้ Admin / Supervisor**
เพราะถ้าเปิดให้เทเล จะกลายเป็นช่องยืนยันเบอร์ทีละราย (ต้องรู้เบอร์ก่อนถึงค้นได้ ความเสี่ยงจำกัด แต่ไม่จำเป็นต้องเปิด)

จุดที่รับเบอร์เป็น input (ไม่ได้ส่งออก) ต้องใส่การ์ดตาม role:
`api/customer/distribution_helper.php` 25/57/95/136 · `api/Finance/get_debt_collection_orders.php` 142–180 ·
`api/User_DB/sales_sheet.php` 96 · `api/index.php` 1345–1370 · `api/Controllers/CustomerController.php` 877–905

### 3. `backup_phone`
เก็บหลายเบอร์เป็น string คั่นจุลภาค (`run_batch_merge.php` 103–212) — **ซ่อนทั้งชุด ไม่ใช่เบอร์แรก**

---

## ลำดับที่แนะนำ

1. helper กลางฝั่งเซิร์ฟเวอร์ — จุดเดียวที่แปลง `customer_id` → เบอร์จริง สำหรับให้ระบบโทรใช้
2. แก้กลุ่ม B (export) ก่อน — ความเสี่ยงสูงสุด จำนวนน้อยสุด ปิดรูได้เร็วที่สุด
3. แก้กลุ่ม A ไล่จาก `CustomerController` (`$neededCols`) และ API ประวัติการโทร
4. แก้กลุ่ม C — ถอด `customer_ref_id` ออกจาก payload + แก้ `BlockedCustomersModal`
5. ตรวจซ้ำ: `SELECT *` บนตาราง `customers` ที่ยังหลงเหลือ

---

## สถานะอุปกรณ์

**ยืนยันแล้ว 26 ส.ค. 2026: มือถือพนักงานเป็น Android ทั้งหมด** → แนวทาง custom dialer + MDM เดินหน้าได้
งานฝั่งแอปทำขนานกับงานถอดเบอร์ข้างบนได้เลย ไม่ต้องรอกัน
