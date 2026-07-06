---
name: markdown-report-generator
description: Generate standard Telesale and Sales Markdown Reports (.md) using specific rules and columns.
---

# Markdown Report Generation Rules

When asked to generate `.md` reports for sales or call statistics, you must strictly follow these rules:

## 1. 🛑 Mandatory Requirements Gathering
Before writing any SQL or generating a report, verify if the user has provided the following parameters. If any are missing, **STOP** and ask the user to clarify:
- **Date Range**: What is the start and end date for the report? (e.g., June 1 - 30, 2026).
- **Target Audience / Role**: Which user roles should be included? (e.g., Role 6 & 7 only? Specific users?).
- **Company Context**: Which Company ID? (e.g., `company_id = 1`).
- **Additional Exclusions**: Should we exclude free items ("ของแถม") or specific order statuses?

## 2. 🔌 Database Connection (MCP SQL SERVER)
**CRITICAL**: The data used for generating reports **MUST** be queried from the DB server using the MCP SQL SERVER workflow/rules defined in `@[.agents/skills/access-database/MCP SQL SERVER.md]`.
- Do NOT use local dummy databases or assume schemas.
- Adhere to the connection parameters and security guidelines specified in that file (e.g., NEVER use the `primacom_bloguser` account).

## 3. ⚡ Query Performance Constraints
- **Do NOT** use `.fetchAll()` to pull massive amounts of raw data (e.g., pulling all 454K `order_items`) into a PHP array and loop through them.
- **DO** use SQL aggregation (`SUM()`, `COUNT()`, `CASE WHEN`) to process the calculations directly on the database side to prevent memory limits and timeouts.

## 4. 📞 Call Time Calculation (Telesale Stats)
Always use the `call_import_logs` table as the primary source for call duration and statistics.
- For working hours or working days calculations, use the `user_daily_attendance` table via the `attendance_value` column (where `1` = 8 hours). *Caution: Do not count days based on call history.*
- **Format Constraint**: Format "เวลาโทรเฉลี่ยต่อวันทำงาน" as `XX นาที XX วินาที`.

**Required Columns**:
`พนักงาน (ID) | วันทำงาน (วัน) | โทรรวม (สาย) | รับสาย | ไม่รับ | เวลาโทรเฉลี่ยต่อวันทำงาน`

## 5. 💰 Sales Calculation
Always use the `order_items` table as the primary source for sales calculation (`net_total`).
- **Status Filtering**: Verify order status via `orders.order_status`. `Returned` and `Cancelled` orders should be grouped separately or deducted from the net total.
- **Category Separation**: To separate product categories, join with the `products` table and check the `category` column (e.g., `ปุ๋ย` or `ชีวภัณฑ์`).
- **Edge Cases**: Exclude items with the word "แถม" (in `name` or `category`) unless specified otherwise by the user.

**Required Columns**:
`พนักงาน (ID) | ปุ๋ยสุทธิ (บาท) | ออเดอร์ปุ๋ย | ชีวภัณฑ์สุทธิ (บาท) | ออเดอร์ชีวภัณฑ์ | ยอดรวม (Gross) | ยอดยกเลิก | ยอดตีกลับ | ยอดสุทธิ (Net)`

## 6. 🧹 Self-Validation & Report Metadata
- **Self-Check**: Before saving the file, verify mathematically that `Gross - Cancelled - Returned = Net`. If the numbers do not align, recheck your SQL query.
- **Metadata**: Every `.md` report MUST start with a header containing the 'Date Generated', 'Data Period', and a list of applied filters/rules (e.g., *Filters: Company 1, Excluded 'ของแถม', Excluded 'Cancelled/Returned'*).
