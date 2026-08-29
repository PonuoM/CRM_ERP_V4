# ⚠️ ประกาศทีม — ลบสคริปต์อันตรายออกจาก api/ (28 ส.ค. 2569)

**อ่านก่อน build หรือ deploy ครั้งต่อไป**

---

## เกิดอะไรขึ้น

พบว่ามีสคริปต์ใน `api/` ที่ **ใครก็ตามในอินเทอร์เน็ตเปิด URL ครั้งเดียวแล้วทำงานทันที**
ไม่ต้องล็อกอิน ไม่ต้องมี token ไม่มีการถามยืนยัน

ยืนยันแล้วว่าเรียกได้จริงจากภายนอก — ยิง `GET /mini_erp/api/dump_schema.php` ได้ schema
ฐานข้อมูลกลับมาเป็น JSON ไม่มี 401 ไม่มี redirect ไปหน้า login

### สองตัวที่ร้ายแรงที่สุด

| ไฟล์ | ทำอะไร |
|---|---|
| `api/migrate_reset_sheet_table.php` | `DROP TABLE google_sheet_shipping` — ตารางนี้มีข้อมูลจริง **18,366 แถว** หายทั้งหมดในคลิกเดียว |
| `api/kill_processes.php` | วน `KILL` ทุก connection ของฐานข้อมูล — **ระบบล่มทันที** (ตัวไฟล์เขียน URL สาธารณะไว้เองที่บรรทัด 4) |

### ตัวอื่นที่เป็นระเบิดเวลา

| ไฟล์ | ทำอะไร |
|---|---|
| `api/convert_users.php` | ดึง username + password ทุกคนออกมาเดารหัสจาก common password list แล้วเขียนไฟล์ `.sql` ลงในโฟลเดอร์ที่เว็บอ่านได้ (ตอนนี้ยังพังเพราะชื่อคอลัมน์เปลี่ยน — ถ้าใครไปแก้เมื่อไหร่คือรั่วทันที) |
| `api/manual_redistribute_60.php` | `UPDATE customers SET assigned_to` ย้ายเจ้าของลูกค้ายกล็อต |
| `api/database_sync.php` | ยิง `npm run db:push / db:pull / db:seed` ผ่าน `popen()` |

---

## ทำไมมันหลุดออกไปได้

`.htaccess` ให้ไฟล์ที่มีอยู่จริงถูก serve ตรง ไม่ผ่าน `index.php`

```apache
RewriteCond %{REQUEST_FILENAME} !-f     # ถ้าเป็นไฟล์จริง → ไม่ route เข้า index.php
```

การตรวจสอบสิทธิ์ทั้งหมดของระบบอยู่ใน `index.php` **สคริปต์ที่วางไว้ข้าง ๆ จึงข้ามด่านไปทั้งหมด**

และ `scripts/host/host-build.ts:118` copy ทั้งโฟลเดอร์ `api/` ขึ้น host
→ **ไฟล์แบบนี้ขึ้น production ทุกครั้งที่มีคน build**

---

## สิ่งที่ทำไปแล้ว

1. **ลบออกจาก repo แล้ว 25 ไฟล์** (`api/` เหลือ 51 → 26 ไฟล์)
2. **ลบ `api/auth_debug.log`** (4.3 MB บันทึก request + token ที่โหลดอ่านได้)
3. **ลบ `api/logs/`** (23 ไฟล์ มี `mysql://root:12345678@...` อยู่ข้างใน)
4. **เพิ่มการ์ดใน `api/.htaccess`** บล็อกไฟล์ตามรูปแบบชื่อที่เป็นปัญหา
5. ลบออกจาก host ทั้ง 3 ที่: `mini_erp`, `beta_test`, `testweb1`

### รายชื่อไฟล์ที่ถูกลบ

**อันตรายทันที**
```
migrate_reset_sheet_table.php    kill_processes.php
convert_users.php                manual_redistribute_60.php
database_sync.php
```

**สคริปต์ DDL ครั้งเดียว** (ตอนนี้เป็น no-op เพราะคอลัมน์มีครบแล้ว แต่ไม่ควรเปิดสาธารณะ)
```
add_missing_columns.php          add_deleted_at_to_products.php
create_token_table.php           create_stock_tables.php
create_stock_images_table.php    ensure_ai_schema.php
optimize_stats_db.php
```

**เปิดเผยโครงสร้างฐานข้อมูล**
```
dump_schema.php                  show_triggers.php
describe_status.php              list_statuses_detailed.php
scan_status.php
```

**ไฟล์ทดสอบและไฟล์ร้าง**
```
test_db.php                      test_dummy.php
test_duplicate_count.php         test_retro.php
test_tables.php                  clean_shopee.php
send_post.php                    sync_customer_orders.php
```

---

## 🔴 สิ่งที่ทุกคนต้องทำ

### 1. `git pull` ก่อนทำงานต่อ

ถ้ายังใช้ branch เก่าที่มีไฟล์พวกนี้อยู่ **แล้ว build + deploy มันจะขึ้นไปใหม่ทันที**

### 2. ถ้ามีไฟล์เหล่านี้ค้างในเครื่อง ให้ลบทิ้ง

```bash
git pull
git status          # ต้องไม่เห็นไฟล์ในรายการข้างบน
```

### 3. เลิกวางสคริปต์ครั้งเดียวไว้ใน `api/`

`api/` = โค้ดที่ให้บริการอยู่ ทุกไฟล์ในนั้นเปิดจากอินเทอร์เน็ตได้

**ต้องแก้ schema** → เขียนเป็นไฟล์ใน `api/migrations/` แล้วรันจากเครื่องตัวเอง
**ต้องแก้ข้อมูลครั้งเดียว** → เขียนสคริปต์ไว้นอก `api/` (เช่น `scripts/`) แล้วรันผ่าน CLI
**ต้องทดสอบอะไร** → เขียนใน `api/tests/` หรืออย่าให้ขึ้น host

ตอนนี้ `api/.htaccess` บล็อกชื่อไฟล์ที่ขึ้นต้นด้วย `test_` `fix_` `migrate_` `dump_`
`create_*table` `add_*column` ฯลฯ ไว้แล้ว — ถ้าตั้งชื่อแบบนี้จะโดนบล็อกอัตโนมัติ

---

## ⚠️ งานที่ยังค้างอยู่

### `api/cron/` ยังเปิดอยู่ (ยกเว้นไว้ชั่วคราว)

มีสคริปต์ 13 ตัวในนั้นที่ชื่อตรงกับรูปแบบที่ถูกบล็อก แต่ผม**ยกเว้นไว้** เพราะบางตัว
อาจถูกตั้งเวลาเรียกผ่าน URL จาก host — บล็อกไปแล้วงานตามเวลาจะหยุดเงียบ ๆ ซึ่งแย่กว่า

ไฟล์ที่ได้รับการยกเว้น (ดู `api/cron/.htaccess`) ยังเปิดจากอินเทอร์เน็ตได้อยู่:
```
fix_basket_38_to_39.php    fix_basket_38_to_52.php    fix_stuck_basket51.php
fix_user_role_ids.php      init_basket_assignment.php init_baskets_web.php
init_customer_baskets.php  test_basket_move.php       test_merge_group_1.php
test_merge_group_1_b.php   test_query.php             test_simple.php
```

**ทางแก้ที่ถูกต้อง**: ให้ทุกสคริปต์ใน `api/cron/` ตรวจ token ลับก่อนทำงาน
เช่นอ่านค่าจาก `app_settings` แล้วเทียบกับ `?token=` แล้วจึงถอดข้อยกเว้นใน
`api/cron/.htaccess` ทิ้ง

**ใครรับงานนี้ช่วยบอกด้วย** — ตราบใดที่ยังไม่ทำ ช่องนี้ยังเปิดอยู่

### ต้องตรวจว่ามี cron ตัวไหนถูกตั้งไว้บ้าง

ก่อนถอดข้อยกเว้น ต้องเข้าไปดูใน control panel ของ host ว่ามี scheduled task
ตัวไหนเรียก URL ใน `api/cron/` อยู่บ้าง จะได้ไม่ตัดของที่ใช้งานจริง
