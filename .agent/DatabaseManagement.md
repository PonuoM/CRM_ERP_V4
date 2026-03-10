# Database Management System

ระบบจัดการฐานข้อมูลผ่าน Web UI สำหรับ sync schema/data ระหว่าง local ↔ host

## ข้อจำกัด Host
- ❌ No SSH, No shell_exec, No mysqldump (disabled ทั้งหมด)
- ✅ PHP 8.0 + PDO MySQL + MariaDB 10.6
- ✅ Memory 512MB, Upload 800MB, max_allowed_packet 100MB
- ✅ File system writable

## สิทธิ์การเข้าถึง
- **เฉพาะ Super Admin เท่านั้น** (ตรวจสอบผ่าน `get_authenticated_user()` จาก `config.php`)
- เมนูอยู่ใน Sidebar → **จัดการข้อมูล** → **จัดการฐานข้อมูล**

---

## ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | หน้าที่ |
|---|---|
| `api/Database/db_manager.php` | Backend API (6 actions) |
| `api/Database/.htaccess` | Override PHP upload limits (500MB) |
| `pages/DatabaseManagementPage.tsx` | Frontend UI (5 tabs) |
| `services/api.ts` | เพิ่ม `Database/` ใน direct-access paths |
| `components/Sidebar.tsx` | เมนู nav ในหมวดจัดการข้อมูล |
| `App.tsx` | Route: `Database Management` / `จัดการฐานข้อมูล` |

---

## Backend API — `db_manager.php`

Endpoint เดียว รับ `action` parameter:

### 1. `list_tables` (GET)
- **URL**: `?action=list_tables`
- **การทำงาน**: `SHOW TABLE STATUS` → แสดงเฉพาะ BASE TABLE (skip views ที่ Engine = NULL)
- **Response**: `{ success, tables: [...], count }`

### 2. `table_info` (GET)
- **URL**: `?action=table_info&table=TABLE_NAME`
- **การทำงาน**: 
  - `SHOW FULL COLUMNS FROM` → แสดง columns ทั้งหมด
  - `SHOW INDEX FROM` → แสดง indexes
  - `SHOW CREATE TABLE` → แสดง SQL สร้างตาราง
- **Response**: `{ success, table, columns, indexes, create_sql }`

### 3. `export_schema` (GET)
- **URL**: `?action=export_schema` หรือ `?action=export_schema&tables=t1,t2`
- **การทำงาน**: Loop `SHOW CREATE TABLE` ทุกตาราง (หรือเฉพาะที่เลือก)
- **Output**: SQL string มี `DROP TABLE IF EXISTS` + `CREATE TABLE`
- **Response**: `{ success, sql, tables_count }`

### 4. `export_data` (POST) → ZIP download
- **URL**: `?action=export_data`
- **Body**: `{ "tables": ["t1", "t2"], "limit": 0 }` (0 = ไม่จำกัด, max 100k)
- **การทำงาน**:
  1. Unbuffered query → เขียน SQL ลง **temp file** ทีละ 500 rows (ไม่กิน memory)
  2. **ZIP** compress temp file
  3. Stream ZIP ไป browser เป็น file download
- **Output**: ไฟล์ `.zip` (บีบอัด ~10-20x)
- **ตั้งค่าพิเศษ**: `set_time_limit(0)`, `memory_limit 256M`
- ⚠️ **ไม่มี action ใดลบข้อมูลอัตโนมัติ** — เป็น read-only

### 5. `import_sql` (POST) — multipart file upload
- **URL**: `?action=import_sql`
- **Body**: multipart form data, field `file` (.zip หรือ .sql)
- **การทำงาน**:
  1. ถ้า ZIP → แตกไฟล์ .sql ออกมา (stream ไม่โหลดทั้งไฟล์)
  2. อ่าน SQL ทีละบรรทัด → execute ทีละ statement (autocommit)
  3. ปิด `FOREIGN_KEY_CHECKS` ระหว่าง import
  4. รายงาน error สูงสุด 20 รายการแรก
- **Response**: `{ success, message, success_count, error_count, errors }`
- ⚠️ **Execute ตาม SQL ที่ upload มา** — ถ้ามี DROP/DELETE จะทำจริง

### 6. `run_sql` (POST)
- **URL**: `?action=run_sql`
- **Body**: `{ "sql": "ALTER TABLE ...; INSERT INTO ...;" }`
- **การทำงาน**: 
  - Split SQL by `;`
  - Execute ใน **transaction** (auto rollback ถ้า error)
  - คืนผลลัพธ์แต่ละ statement
- **Response**: `{ success, message, results: [...], success_count, error_count }`

---

## Frontend UI — `DatabaseManagementPage.tsx`

### Tab 1: 📋 Tables
- แสดงรายชื่อตาราง (เฉพาะ BASE TABLE, ไม่รวม views) + rows + size + engine + updated
- **ค้นหา**: filter ตารางตามชื่อ
- **คลิกขยาย**: แสดง columns (field, type, null, key, default, extra) + CREATE TABLE SQL
- **Copy**: ปุ่ม copy CREATE TABLE SQL

### Tab 2: 📤 Export Schema
- เลือกตารางด้วย checkbox (เลือกทั้งหมด/ยกเลิกทั้งหมด)
- กด Export → ได้ SQL ที่มี `DROP TABLE IF EXISTS` + `CREATE TABLE`
- **Copy** หรือ **Download .sql** ได้

### Tab 3: 💾 Export Data → ZIP
- เลือกตาราง + กำหนด limit (0 = all)
- กด **Export ZIP** → download ไฟล์ `.zip` (บีบอัด SQL)
- ใช้ unbuffered query + temp file → **ไม่กิน memory** แม้ export ทั้ง database

### Tab 4: 📥 Import SQL
- **Drag-drop** หรือคลิกเลือกไฟล์ `.zip` / `.sql`
- แสดงชื่อไฟล์ + ขนาดหลังเลือก
- กด Import → confirm dialog → **Loading spinner ขนาดใหญ่** พร้อมข้อความ
- แสดงผลลัพธ์: สำเร็จกี่ statement, error กี่ statement + รายละเอียด error
- Dev mode: ส่งตรงไป Apache (bypass Vite proxy ที่ไม่รองรับ multipart)

### Tab 5: ▶️ Run SQL
- Textarea สำหรับ paste SQL (สี dark theme / terminal style)
- กด Execute → แสดง confirm dialog
- Execute ใน transaction → แสดงผลลัพธ์แต่ละ statement (✅/❌)
- ถ้า error → rollback ทั้งหมด

---

## ความปลอดภัย

| Action | อ่าน/เขียน | ลบข้อมูลอัตโนมัติ? |
|---|---|---|
| `list_tables` | อ่าน | ❌ ไม่ |
| `table_info` | อ่าน | ❌ ไม่ |
| `export_schema` | อ่าน | ❌ ไม่ |
| `export_data` | อ่าน | ❌ ไม่ |
| `import_sql` | เขียน | ⚠️ ตาม SQL ที่ upload มา |
| `run_sql` | เขียน | ⚠️ ตาม SQL ที่พิมพ์มา |

> **หมายเหตุ**: `export_schema` สร้าง SQL ที่มี `DROP TABLE IF EXISTS` — ถ้าเอาไป import จะลบตารางเก่าแล้วสร้างใหม่

---

## วิธีใช้งาน — Sync Database

### Host → Local (ดึง data จาก production)
1. เปิดหน้า **Database Management** บน host
2. Tab **Export Data** → Select All (หรือเลือกเฉพาะ) → **Export ZIP**
3. ได้ไฟล์ `.zip` (1GB SQL อาจเหลือ ~80MB ZIP)
4. นำไฟล์มา local — เลือกวิธี:
   - **MySQL CLI** (แนะนำ สำหรับไฟล์ใหญ่):
     ```bash
     unzip data_export_*.zip -d /tmp/
     mysql -u root -p12345678 mini_erp < /tmp/data_export.sql
     # ใส่ --force ถ้าต้องการข้าม duplicate errors
     ```
   - **หน้า Import SQL** (สำหรับไฟล์เล็ก-กลาง): Upload .zip → กด Import
   - **phpMyAdmin**: แตก ZIP ก่อน → import .sql (จำกัด 10MB ต้องแก้ php.ini)

### Local → Host (ส่ง migration/data ขึ้น production)
1. เตรียม SQL ที่ต้องการรัน (ALTER TABLE, INSERT, etc.)
2. เปิดหน้า **Database Management** บน host
3. Tab **Run SQL** → Paste SQL → Execute
4. ตรวจสอบผลลัพธ์ — ถ้า error จะ rollback อัตโนมัติ

---

## Known Issues & Workarounds

| ปัญหา | สาเหตุ | วิธีแก้ |
|---|---|---|
| Export 503 timeout | Host มี max_execution_time 120s | Export ทีละ 10-20 ตาราง |
| Views error on export | View reference invalid table | Skip views (Engine = NULL) ✅ แก้แล้ว |
| Import ไฟล์ใหญ่ผ่าน UI | PHP upload_max_filesize เล็ก | `.htaccess` override 500MB ✅ แก้แล้ว |
| Import ผ่าน Vite proxy fail | Vite proxy ไม่ forward multipart | Dev mode ส่งตรงไป Apache ✅ แก้แล้ว |
| phpMyAdmin "Incorrect format" | ZIP format ไม่ตรง pattern | แตก ZIP ก่อน import หรือใช้ MySQL CLI |

---

## Change Log

| วันที่ | การเปลี่ยนแปลง |
|---|---|
| 2026-03-09 | สร้างระบบ Database Management (backend + frontend + sidebar nav) |
| 2026-03-09 | แก้ auth ใช้ `get_authenticated_user()` แทน `session_token` |
| 2026-03-09 | แก้ role check จาก `SuperAdmin` เป็น `Super Admin` (มีช่องว่าง) |
| 2026-03-09 | เปลี่ยน export_data เป็น streaming (แก้ memory exhaustion) |
| 2026-03-09 | เปลี่ยน export_data เป็น ZIP (temp file → ZIP → stream download) |
| 2026-03-09 | เพิ่ม `import_sql` action (ZIP/SQL file upload, line-by-line exec) |
| 2026-03-09 | เพิ่ม Tab 4: Import SQL ใน frontend (drag-drop, loading spinner) |
| 2026-03-09 | Skip views ใน `list_tables` (Engine = NULL) |
| 2026-03-09 | เพิ่ม `set_time_limit(0)` สำหรับ export_data |
| 2026-03-09 | สร้าง `api/Database/.htaccess` override upload limit 500MB |
| 2026-03-09 | Dev mode: import_sql bypass Vite proxy → ส่งตรง Apache |
