---
description: คู่มืออธิบายการทำงานระบบ Export Template (ส่งออกข้อมูลออเดอร์)
---

# ระบบ Export Template

ระบบส่งออกข้อมูลออเดอร์แบบเลือก Template ได้ รองรับสูตรกำหนดแหล่งข้อมูลเอง + เลือกรูปแบบการแสดง (ทุกแถว / เฉพาะแถวแรก)

## สถาปัตยกรรม

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  ExportTemplateSettingsPage │     │       ManageOrdersPage       │
│  (ตั้งค่า Template)         │     │  (ส่งออก / ประวัติ)          │
└──────────────┬──────────────┘     └──────────────┬───────────────┘
               │                                   │
               ▼                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│  services/api.ts                                                │
│  fetchExportTemplates / setDefaultTemplate / getExportOrderIds  │
│  logExport / listTemplateDefaults / listExportCompanies         │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
               ▼                                  ▼
┌────────────────────────────────────┐  ┌─────────────────────────┐
│ api/Order_DB/export_templates.php  │  │ api/index.php           │
│ CRUD + seed + setDefault +         │  │ handle_exports           │
│ listDefaults                       │  │ log export + orderItems  │
├────────────────────────────────────┤  └────────────┬────────────┘
│ api/Order_DB/companies.php         │               │
│ List companies (id, name)          │               │
└──────────────┬─────────────────────┘               │
               │                                     │
               ▼                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  MySQL Tables                                                   │
│  export_templates / export_template_columns (+ display_mode) /  │
│  export_template_defaults / exports (+ template_id) /           │
│  export_order_items                                             │
└─────────────────────────────────────────────────────────────────┘
```

## Database Tables

**SQL Migration:** `api/Order_DB/create_export_templates.sql`
**SQL Seed:** `api/Order_DB/seed_export_templates.sql`

| ตาราง | หน้าที่ |
|---|---|
| `export_templates` | เก็บชื่อ template (**global** ใช้ร่วมทุกบริษัท, ไม่มี company_id) |
| `export_template_columns` | เก็บ header_name, data_source, sort_order, default_value, **display_mode** ต่อ template |
| `export_template_defaults` | เก็บ default template **แยกตาม company** (company_id + template_id, UNIQUE on company_id) |
| `exports` | เก็บประวัติ export (+ `template_id` column) |
| `export_order_items` | junction table เก็บ order_id ที่ถูก export ในแต่ละครั้ง |

### display_mode (column ใน export_template_columns)

| ค่า | ความหมาย | ตัวอย่าง field |
|---|---|---|
| `all` (default) | แสดงค่าทุก row | ชื่อร้านค้า, ชื่อสินค้า, จำนวน |
| `index` | แสดงค่าเฉพาะ row แรกของแต่ละกลุ่มออเดอร์ | หมายเลขออเดอร์, ผู้รับ, ที่อยู่, เบอร์โทร |

> **สำคัญ:** การแสดง/ซ่อนแถวถูกควบคุมโดย `display_mode` ไม่ได้ hardcode ใน resolveDataSource อีกต่อไป

## ไฟล์ที่เกี่ยวข้อง

### Backend
- `api/Order_DB/export_templates.php` — CRUD, seed, setDefault, listDefaults สำหรับ templates
- `api/Order_DB/companies.php` — API ดึงรายชื่อบริษัท (id, name) สำหรับหน้าตั้งค่า
- `api/index.php` → `handle_exports()` — log export, ดาวน์โหลด, query orderItems

### Frontend
- `pages/ExportTemplateSettingsPage.tsx` — หน้าตั้งค่า template (CRUD, จัดลำดับ, ตั้ง default, **ตั้ง display_mode**, **ตั้ง default แยกบริษัท**)
- `pages/ManageOrdersPage.tsx` — modal เลือก template + `generateAndDownloadCsv()` + ประวัติส่งออก
- `services/api.ts` — `fetchExportTemplates`, `setDefaultTemplate`, `listTemplateDefaults`, `listExportCompanies`, `getExportOrderIds`, `logExport`
- `components/Sidebar.tsx` — เมนู "ตั้งค่าการส่งออกข้อมูล"
- `App.tsx` — route สำหรับ ExportTemplateSettingsPage

## Flow การส่งออก

1. กด **"ส่งออกข้อมูล"** → เปิด modal เลือก template (auto-select default)
2. เลือก template → กด **"ยืนยัน"**
3. `generateAndDownloadCsv(orders, template)` ถูกเรียก
4. สร้าง Excel โดยใช้ `resolveDataSource()` แปลง `data_source` → ค่าจริง
5. ตรวจ `display_mode` ของแต่ละ column: ถ้า `index` และไม่ใช่ row แรก → แสดง `''`
6. `logExport()` บันทึกประวัติ + template_id + order_ids ลง DB
7. ดาวน์โหลดไฟล์ .xlsx

## Flow ส่งออกซ้ำ (จากประวัติ)

1. กด **"ประวัติการส่งออก"** → โหลดประวัติ + templates
2. **Export เก่า** (ไม่มี template_id) → แสดง badge "v.1 ระบบเก่า" ดาวน์โหลดไฟล์เดิมได้อย่างเดียว
3. **Export ใหม่** → เลือก template จาก dropdown → กด "ส่งออกซ้ำ"
4. `getExportOrderIds(exportId)` → ดึง order IDs → fetch ข้อมูลออเดอร์ (รวม customerInfo) → สร้างไฟล์ใหม่
5. **ไม่สร้างข้อมูลใหม่ในตาราง exports** (`skipLog = true`)
6. **ไม่อัปเดต order_status** (ไม่เรียก `onProcessOrders`)

## resolveDataSource — สูตรแหล่งข้อมูล

ฟังก์ชันใน `ManageOrdersPage.tsx` ที่แปลง `data_source` → ค่าจริง

> **หมายเหตุ:** `resolveDataSource` คืนค่าจริงเสมอ (ไม่มี hardcoded index check)
> การแสดง/ซ่อนถูกจัดการโดย `display_mode` ที่ call site

### รูปแบบที่รองรับ

| รูปแบบ | ตัวอย่าง | ผลลัพธ์ |
|---|---|---|
| Simple field | `product.sku` | `LATM01L001` |
| Expression `{field}` | `{product.sku}-{item.quantity}` | `LATM01L001-5` |
| **Conditional** `{if:}` | `{if:item.quantity=1\|{product.sku}\|{product.sku}-{item.quantity}}` | จำนวน 1: `LATM01L001` / จำนวน 2: `LATM01L001-2` |
| ค่าว่าง + default_value | `""` + default `"ไทย"` | `ไทย` |

#### Conditional Expression Syntax

```
{if:FIELD OPERATOR VALUE|THEN_EXPRESSION|ELSE_EXPRESSION}
```

**Operators:** `=`, `!=`, `>`, `<`, `>=`, `<=` (ตัวเลขจะเปรียบเทียบแบบ numeric อัตโนมัติ)

**ตัวอย่าง:**
```
# แสดง SKU อย่างเดียวถ้าจำนวน 1 ชิ้น, ถ้ามากกว่า 1 แสดง SKU-จำนวน
{if:item.quantity=1|{product.sku}|{product.sku}-{item.quantity}}

# แสดง "ฟรี" ถ้าราคา 0
{if:item.pricePerUnit=0|ฟรี|{item.pricePerUnit}}
```

### Fields ที่ใช้ได้ทั้งหมด

> **สำคัญ:** ใช้ชื่อ **camelCase** (ไม่ใช่ชื่อ column ใน DB)

```
# Order
order.id                    # ID ออเดอร์หลัก
order.onlineOrderId         # หมายเลขออเดอร์ (sub)
order.orderDate             # วันที่สั่งซื้อ (YYYY-MM-DD)
order.deliveryDate          # วันที่จัดส่ง (YYYY-MM-DD)
order.notes                 # หมายเหตุ
order.totalAmount           # ยอดเงิน (⚠️ มีเงื่อนไข ดูด้านล่าง)
order.codFlag               # COD (ใช่/ไม่)
order.paymentMethod         # วิธีชำระเงิน
order.orderStatus           # สถานะ (Pending → "ชำระแล้วรอตรวจสอบ")
order.shippingProvider      # บริษัทขนส่ง
order.trackingNumbers       # หมายเลขขนส่ง (comma separated)
order.shippingCost          # ค่าขนส่ง

# Customer
customer.phone              # เบอร์โทร (จาก customers.phone หรือ address.phone)
customer.email              # อีเมล

# Address
address.recipientFullName   # ชื่อเต็มผู้รับ (+ กล่องที่ N)
address.recipientFirstName  # ชื่อผู้รับ
address.recipientLastName   # นามสกุลผู้รับ
address.recipientPhone      # เบอร์โทรผู้รับ (ดึงจาก recipient_phone)
address.street              # ที่อยู่
address.subdistrict         # แขวง/ตำบล
address.district            # เขต/อำเภอ
address.province            # จังหวัด
address.postalCode          # รหัสไปรษณีย์

# Product
product.shop                # ชื่อร้านค้า
product.sku                 # รหัสสินค้า

# Item (per row)
item.productName            # ชื่อสินค้า
item.quantity               # จำนวน
item.pricePerUnit           # ราคาต่อหน่วย
```

### Logic พิเศษ

#### order.totalAmount
แสดงค่าเมื่อ `codFlag === 'ใช่'` เท่านั้น:
- COD + มี box → `box.codAmount`
- COD + ไม่มี box → `order.codAmount ?? order.totalAmount`
- ไม่ใช่ COD → `''` (ว่าง)

#### order.codFlag
- ยอด = 0 → `'ไม่'`
- paymentMethod = COD → `'ใช่'`
- อื่นๆ → `'ไม่'`

#### customer.phone
ลำดับการหาเบอร์: `customer?.phone || address?.phone` → format เติม `0` ข้างหน้าถ้าไม่ได้ขึ้นต้นด้วย `0` หรือ `+`

## API Endpoints

### Order_DB/export_templates.php

| Method | Params | หน้าที่ |
|---|---|---|
| `GET` | `?companyId=X` | รายการ templates ทั้งหมด |
| `GET` | `?companyId=X&id=Y` | template เดียว |
| `POST` | `?companyId=X` | สร้าง template ใหม่ |
| `PUT` | `?companyId=X&id=Y` | แก้ไข template + columns (รวม display_mode) |
| `DELETE` | `?companyId=X&id=Y` | ลบ template (ไม่ได้ถ้าเป็น default) |
| `POST` | `?companyId=X&action=seed` | Seed default templates |
| `POST` | `?companyId=X&id=Y&action=setDefault` | ตั้งเป็น default (รองรับ `&targetCompanyId=Z` สำหรับ super admin) |
| `GET` | `?companyId=X&action=listDefaults` | ดึง default ทุกบริษัท (สำหรับ super admin) |

### Order_DB/companies.php

| Method | Params | หน้าที่ |
|---|---|---|
| `GET` | (ไม่มี) | รายชื่อบริษัท (id, name) |

### index.php (exports)

| Method | Path | หน้าที่ |
|---|---|---|
| `GET` | `exports?category=X` | รายการ exports (30 วัน) |
| `GET` | `exports/{id}?download` | ดาวน์โหลดไฟล์ |
| `GET` | `exports/{id}?orderItems` | ดึง order IDs ของ export นั้น |
| `POST` | `exports` | บันทึก export ใหม่ (+ templateId, orderIds) |

## การ Setup

1. รัน SQL: `api/Order_DB/create_export_templates.sql`
2. ถ้าตาราง `export_template_columns` มีอยู่แล้ว: `ALTER TABLE export_template_columns ADD COLUMN display_mode VARCHAR(10) NOT NULL DEFAULT 'all'`
3. รัน SQL: `api/Order_DB/seed_export_templates.sql` (สำหรับ company_id = 5)
4. Build: `npm run host:build`
5. Deploy ไฟล์ `host/` ไปยัง server
