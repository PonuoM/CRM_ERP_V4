 # ระบบ Pancake Integration

ระบบเชื่อมต่อกับ **Pancake** (pages.fm / pancake.in.th) เพื่อดึงสถิติเพจ, สถิติ Engagement ลูกค้า และจัดการ mapping ผู้ใช้ระหว่าง CRM กับ Pancake

---

## ภาพรวมหน้าจอ

| หน้า | Sidebar Label | ไฟล์ | หน้าที่หลัก |
|------|---------------|------|-------------|
| Page Stats | `Page Stats` / `Page Performance` | `pages/PageStatsPage.tsx` | สถิติรายเพจ (ลูกค้าใหม่, แชท, คอมเม้น, ออเดอร์) |
| Engagement Insights | `Engagement Insights` | `pages/EngagementStatsPage.tsx` | สถิติ Engagement (ลูกค้าใหม่/เก่า ที่ตอบกลับ, อัตราสั่งซื้อ) |
| Pancake User Mapping | `Pancake User Mapping` | `pages/PancakeUserIntegrationPage.tsx` | เชื่อมต่อผู้ใช้ CRM กับผู้ใช้ Pancake |

---

## 1. PageStatsPage — สถิติรายเพจ

### หน้าที่
แสดงสถิติรายวัน/รายชั่วโมงของแต่ละเพจ เช่น จำนวนลูกค้าใหม่, เบอร์โทร, คอมเม้น, แชท, ออเดอร์

### ข้อมูลที่แสดง (StatCards)
- ลูกค้าใหม่ (`new_customer_count`)
- เบอร์โทรทั้งหมด (`uniq_phone_number_count`)
- เบอร์โทรใหม่ (`phone_number_count`)
- คอมเม้นจากลูกค้า (`customer_comment_count`)
- แชทจากลูกค้า (`customer_inbox_count`)
- คอมเม้นจากเพจ (`page_comment_count`)
- แชทจากเพจ (`page_inbox_count`)
- แชทใหม่ (`new_inbox_count`)
- แชทจากลูกค้าเก่า (`inbox_interactive_count`)
- ลูกค้าจากเว็บ (logged-in / guest)
- ยอดออเดอร์ (`order_count`)

### ฟีเจอร์
1. **เลือกช่วงเวลา** — 7 วัน, สัปดาห์นี้/ก่อน, เดือนนี้/ก่อน, custom date range
2. **เลือกเพจ** — dropdown จาก `listPages()` (เฉพาะ platform=pancake)
3. **ดึงข้อมูลจาก Pancake API** — กด "ค้นหา" → เรียก API
4. **มุมมองรายวัน / รายชั่วโมง** — toggle `viewMode` = `daily` / `hourly`
5. **กราฟ Multi-line** — แสดงจำนวนคอมเม้น + แชท ตามเวลา
6. **เปรียบเทียบช่วงก่อน** — คำนวณ % change เทียบกับช่วงก่อนหน้า
7. **Export CSV** — เลือกเพจ + ช่วงวัน → ดึงจาก Pancake → download CSV
8. **อัปเดตฐานข้อมูล** — ดึงข้อมูลจาก Pancake → บันทึกลง DB (ตรวจสอบวันที่ซ้ำ)
9. **จัดการ Batch** — ดูรายการ batch ที่ upload แล้ว, ลบ batch ได้

### Pancake API ที่ใช้
```
POST https://pages.fm/api/v1/pages/{pageId}/generate_page_access_token
     ?access_token={ACCESS_TOKEN}

GET  https://pages.fm/api/public_api/v1/pages/{pageId}/statistics/pages
     ?since={unix}&until={unix}&page_access_token={token}
     &select_fields=[...fields...]
```

### Backend APIs
| API | Method | หน้าที่ |
|-----|--------|---------|
| `Page_DB/env_manager.php` | GET | ดึง env variables (ACCESS_TOKEN) |
| `Page_DB/get_date_ranges.php?source=page_stats` | GET | ดึงช่วงวันที่มีในฐานข้อมูล |
| `Page_DB/page_stats_import.php` | POST | บันทึกข้อมูลสถิติลง DB |
| `Page_DB/delete_batches.php` | POST | ลบ batch records |

---

## 2. EngagementStatsPage — สถิติ Engagement

### หน้าที่
แสดงสถิติ customer engagement ของเพจ — วัดว่าลูกค้าใหม่/เก่าตอบกลับเท่าไร, อัตราการสั่งซื้อ

### ข้อมูลที่แสดง
- **ลูกค้าใหม่ที่ตอบกลับ** (`new_customer_replied`)
- **ลูกค้าเก่าที่ตอบกลับ** (total - new)
- **รวมทั้งหมด** (`total`)
- **กี่เท่า** (old/new ratio)
- **ยอดออเดอร์** (`order_count`)
- **ออเดอร์ลูกค้าใหม่** (order_count - old_order_count)
- **% สั่งซื้อ/ติดต่อ** (orders/total)
- **% สั่งซื้อ/ลูกค้าใหม่** (newOrders/newCustomerReplied)

### Tabs
1. **ตามเวลา** (`time`) — ตารางสถิติรายวัน + กราฟ Semi gauge (อัตราคุยได้, อัตราออเดอร์)
2. **ตามผู้ใช้** (`user`) — เจ้าหน้าที่แต่ละคนมียอด interact/orders เท่าไร + user engagement จาก Pancake
3. **ตามเพจ** (`page`) — สถิติแยกตามเพจ พร้อม date range แยก

### ฟีเจอร์
1. **เลือกเพจ** — เลือกเพจเดี่ยว หรือ "ทุกเพจ" (รวมทุกเพจ active)
2. **เลือกช่วงวัน** — DateRangePicker
3. **ดึงข้อมูลจาก Pancake API** — ทั้ง engagement stats + user engagement breakdown
4. **Export CSV** — เลือกเพจ + ช่วงวัน → download CSV
5. **Upload to Database** — ดึง engagement data → บันทึกลง DB

### Pancake API ที่ใช้
```
POST https://pages.fm/api/v1/pages/{pageId}/generate_page_access_token
     ?access_token={ACCESS_TOKEN}

GET  https://pages.fm/api/public_api/v1/pages/{pageId}/statistics/customer_engagements
     ?page_access_token={token}&page_id={pageId}
     &date_range={DD/MM/YYYY HH:mm:ss - DD/MM/YYYY HH:mm:ss}
```

### Response Structure
```json
{
  "success": true,
  "data": {
    "categories": ["2026-03-01", "2026-03-02", ...],
    "series": [
      { "name": "inbox", "data": [10, 20, ...] },
      { "name": "comment", "data": [5, 8, ...] },
      { "name": "total", "data": [15, 28, ...] },
      { "name": "new_customer_replied", "data": [7, 12, ...] },
      { "name": "order_count", "data": [3, 5, ...] },
      { "name": "old_order_count", "data": [1, 2, ...] }
    ]
  },
  "users_engagements": [
    {
      "user_id": "123",
      "name": "สมชาย",
      "total_engagement": 50,
      "new_customer_replied_count": 20,
      "order_count": 10,
      "old_order_count": 3
    }
  ]
}
```

### Backend APIs
| API | Method | หน้าที่ |
|-----|--------|---------|
| `Page_DB/env_manager.php` | GET | ดึง env variables |
| `Page_DB/get_date_ranges.php?source=page_engagement` | GET | ดึงช่วงวันที่มีใน DB |
| `Page_DB/setup_engagement_tables.php` | GET | สร้าง tables ถ้ายังไม่มี |
| `Page_DB/page_engagement_upload.php` | POST | บันทึก engagement data ลง DB |

---

## 3. PancakeUserIntegrationPage — เชื่อมต่อผู้ใช้

### หน้าที่
จับคู่ (Map) ผู้ใช้ CRM ภายใน กับ ผู้ใช้บนเพจ Pancake เพื่อให้ระบบรู้ว่า user ไหนใน Pancake คือ user ไหนใน CRM

### Tabs
1. **การเชื่อมต่อทั้งหมด** (`mappings`) — แสดงรายการเพจ + ผู้ใช้ในแต่ละเพจ, กรองตามสถานะ (active/removed) และการเชื่อมต่อ (connected/not)
2. **ค้นหาและเชื่อมต่อ** (`search`) — เลือก internal user + page user → เชื่อมต่อ

### ข้อมูลที่ใช้
| แหล่งข้อมูล | Interface | มาจาก |
|-------------|-----------|-------|
| ผู้ใช้ CRM (Admin Page) | `AdminPageUserFromDB` | `get_admin_page_users.php` |
| ผู้ใช้เพจ | `PageUserFromDB` | `get_page_users.php` |
| เพจทั้งหมด + ผู้ใช้ | `PageWithUsers` | `get_pages_with_users.php` |

### ฟีเจอร์
1. **ดูรายการเพจและผู้ใช้** — cards ของเพจ, expand เพื่อดูผู้ใช้ในแต่ละเพจ
2. **กรอง** — ตามสถานะ user (active/removed/other) + ตามการเชื่อมต่อ (connected/not)
3. **เชื่อมต่อ** — คลิก user ที่ยังไม่เชื่อมต่อ → เลือก internal user → กด "เชื่อมต่อ"
4. **ยกเลิกการเชื่อมต่อ** — เลือก page user ที่เชื่อมต่อแล้ว → กด "ยกเลิก"

### Backend APIs
| API | Method | หน้าที่ |
|-----|--------|---------|
| `get_admin_page_users.php` | GET | ดึงรายชื่อ user Admin Page |
| `get_page_users.php` | GET | ดึง page users จาก DB |
| `get_pages_with_users.php` | POST | ดึงเพจพร้อมผู้ใช้ |
| `update_page_user_connection.php` | POST | เชื่อมต่อ page user กับ internal user |
| `Page_DB/disconnect_page_user.php` | POST | ยกเลิกการเชื่อมต่อ |

---

## Shared Components

### PancakeEnvOffSidebar
- Sidebar จัดการ **Environment Variables** (เช่น `ACCESS_TOKEN_PANCAKE_{companyId}`)
- เปิดจากปุ่ม ⚙️ ลอยมุมขวาล่าง (เฉพาะ SuperAdmin / AdminControl)
- ใช้ร่วมกันทั้ง 3 หน้า

### PageIconFront
- แสดง icon เพจตาม platform (facebook, instagram, etc.)

### StatCard (StatCard_EngagementPage)
- Card แสดงตัวเลข + trend % change

---

## Authentication & Access Token

### Flow
1. Admin ตั้งค่า `ACCESS_TOKEN_PANCAKE_{companyId}` ผ่าน **PancakeEnvOffSidebar** → `Page_DB/env_manager.php`
2. ทุกครั้งที่ดึงข้อมูล จะ:
   - ดึง Access Token จาก `env_manager.php`
   - เรียก Pancake API เพื่อ **Generate Page Access Token** (per page)
   - ใช้ Page Access Token ดึงข้อมูลสถิติ

### Access Token Warning
- ถ้าไม่พบ `ACCESS_TOKEN_PANCAKE_{companyId}` → แสดง Warning Modal แนะนำให้ตั้งค่า

---

## Database Storage

### page_store_db Setting
- env variable `page_store_db` = `1` (enable) / `0` (disable)
- ควบคุมว่าจะเก็บข้อมูลสถิติลง DB หรือไม่

### Tables ที่เกี่ยวข้อง
- **page_stats** — ข้อมูลสถิติรายชั่วโมงของเพจ (จาก `page_stats_import.php`)
- **page_engagement** — ข้อมูล customer engagement (จาก `page_engagement_upload.php`)
- **page_users** — ผู้ใช้เพจ (จาก Pancake sync)
- **page_user_mapping** — mapping ระหว่าง CRM user กับ Pancake user

### Date Range & Batch Management
- ระบบตรวจสอบว่าวันที่ที่จะ upload มีอยู่ใน DB แล้วหรือไม่ → ป้องกันข้อมูลซ้ำ
- แต่ละ upload สร้าง batch record → ดู/ลบได้

---

## Backend API Files

| ไฟล์ | หน้าที่ |
|------|---------|
| `api/Page_DB/env_manager.php` | CRUD สำหรับ env variables (Access Token etc.) |
| `api/Page_DB/sync_pages.php` | Sync รายชื่อเพจจาก Pancake |
| `api/Page_DB/sync_page_users.php` | Sync รายชื่อผู้ใช้เพจจาก Pancake |
| `api/Page_DB/sync_page_list_user.php` | Sync ผู้ใช้ของแต่ละเพจ |
| `api/Page_DB/page_stats_import.php` | Import ข้อมูล page stats ลง DB |
| `api/Page_DB/page_engagement_upload.php` | Upload ข้อมูล engagement ลง DB |
| `api/Page_DB/get_date_ranges.php` | ดึงช่วงวันที่ที่มีข้อมูลใน DB |
| `api/Page_DB/delete_batches.php` | ลบ batch records |
| `api/Page_DB/disconnect_page_user.php` | ยกเลิกการเชื่อมต่อ page user |
| `api/Page_DB/setup_engagement_tables.php` | สร้าง tables สำหรับ engagement |

---

## Retry Mechanism
ทั้ง EngagementStatsPage และ PageStatsPage มี `fetchWithRetry()`:
- retry สูงสุด 3 ครั้ง
- exponential backoff (1s, 2s, 4s)
- retry เฉพาะกรณี "Server internal error"
