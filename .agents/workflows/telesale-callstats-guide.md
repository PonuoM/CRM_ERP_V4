---
name: /telesale-callstats-guide
description: คู่มืออธิบายการทำงานระบบติดตามการโทรและประเมินผลงาน (Telesale Call Stats) — อธิบาย Cohort Analysis และ Realtime
---

# 📊 คู่มือระบบติดตามการโทร (Telesale Call Stats)

**เป้าหมาย:** หน้าจอนี้ถูกออกแบบมาเพื่อให้หัวหน้า (Supervisor) หรือผู้บริหาร สามารถติดตามปริมาณงาน (Workload) และประสิทธิภาพการปิดการขาย (Conversion Rate) ของพนักงาน Telesale แต่ละคน แยกตาม "ตะกร้า (Basket)" ได้อย่างแม่นยำ

**ไฟล์ที่เกี่ยวข้อง:**
- **Frontend:** `pages/TelesaleCallstatsPage.tsx`
- **Backend:** `api/Monitor/telesale_callstats.php`

---

## 🔍 โหมดการทำงาน (2 View Modes)

หน้าต่างนี้แบ่งการดูข้อมูลออกเป็น 2 มุมมองหลัก เพื่อตอบโจทย์ทั้งการดูผลงานย้อนหลัง และการบริหารงานแบบ Realtime

### 1. 📈 โหมดประเมินผลงาน (Performance Mode)
ใช้สำหรับประเมินความสามารถของพนักงานตามช่วงเวลาที่กำหนด (วันนี้, สัปดาห์นี้, เดือนนี้)
ตัวเลขจะแสดงผลแบบ **Funnel Conversion**:
1. 📥 **รับแจก (Assigned Total):** จำนวนลูกค้าที่ถูกแจกให้พนักงานคนนี้ "ในช่วงเวลานั้น"
2. 📞 **โทรแล้ว (Called):** ในบรรดาคนที่เพิ่งรับแจกมา พนักงานได้โทรหาแล้วกี่คน
3. 📅 **นัดหมาย (Appointments):** ในบรรดาคนที่เพิ่งรับแจกมา พนักงานสามารถสร้างนัดหมายได้กี่คน

> [!IMPORTANT]
> **ระบบ Cohort Analysis (ป้องกันปัญหาตะกร้าเลื่อน):**
> สมมติว่าพนักงานได้ลีดจากตะกร้า `Upsell` ➔ โทรไปขายได้ ➔ คำสั่งซื้อถูกดึงเข้าตะกร้า `1-2 เดือน` 
> หากใช้ฐานข้อมูลปกติ ผลงานจะไปโผล่ที่ตะกร้า 1-2 เดือนแทน ซึ่ง **ผิด!** 
> 
> **วิธีแก้ที่ใช้ในระบบ:** ระบบจะคิวรีข้อมูลจาก `customer_audit_log` เพื่อหาว่า **"ณ วินาทีที่พนักงานได้รับลูกค้าคนนี้ (assigned_to)"** ลูกค้าคนนั้นอยู่ในตะกร้าไหน (Historical Basket) แล้วระบบจะล็อคผลงานของลูกค้านั้นไว้กับตะกร้าดั้งเดิมเสมอ ทำให้ตัวเลขสะท้อนความสามารถจริง 100%

### 2. ⏱️ โหมดลูกค้าในมือ (Realtime Mode)
ใช้สำหรับดู "ภาระงานที่ค้างอยู่ ณ ปัจจุบัน" ไม่สนใจตัวกรองวันที่ (Date Filter)
1. 📥 **ในมือ (Assigned Current):** จำนวนลูกค้าที่ "กำลังอยู่ในตะกร้าพนักงานคนนี้ ณ วินาทีนี้" 
2. 📞 **โทรแล้ว (Called Current):** จากลูกค้าในมือกลุ่มนี้ พนักงานเคลียร์โทรไปแล้วกี่คน
3. 📅 **นัดหมาย (Appt Current):** จากลูกค้าในมือกลุ่มนี้ ปิดนัดได้กี่คน

> [!TIP]
> โหมด Realtime จะมีแถบ Progress Bar สีฟ้า ช่วยให้หัวหน้ามองปราดเดียวรู้ว่า พนักงานคนไหนเคลียร์งานในกระเป๋าตัวเองไปแล้วกี่เปอร์เซ็นต์ หากแถบยังโล่งๆ แสดงว่าดองงานไว้เยอะ

---

## 🎨 UI Design (Microcopy)
เพื่อป้องกันความสับสนของผู้ใช้ เราได้ปรับ UI โดยใช้เทคนิค **Microcopy** (ตัวหนังสือขนาดเล็ก) กำกับไว้ใต้ตัวเลขและไอคอนเสมอ เพื่อให้ผู้ใช้อ่านแล้วเข้าใจทันทีโดยไม่ต้องเอาเมาส์ชี้ (Hover) ซึ่งรองรับการใช้งานบน Tablet ได้เป็นอย่างดี

```text
    [ 138 ]         [ 138 ]         [ 89 ]
    รับแจก           โทรแล้ว          นัดหมาย
```

---

## ⚙️ โครงสร้าง Query หลักของ Backend (PHP)

ฟังก์ชันสำคัญอยู่ใน CTE (Common Table Expression) ของไฟล์ `telesale_callstats.php`

```sql
WITH Cohort AS (
    SELECT DISTINCT 
        a.customer_id, 
        a.new_value as assigned_to, 
        a.created_at as assignment_date, -- บันทึกเวลาที่ได้รับมอบหมายเพื่อใช้กรองข้อมูล

        -- ใช้ Correlated Subquery หาตะกร้า "ณ ตอนที่โดนแจก" โดยเผื่อเวลาไว้ 5 วินาที
        COALESCE(
            (
                SELECT new_value 
                FROM customer_audit_log b 
                WHERE b.customer_id = a.customer_id 
                  AND b.field_name = 'current_basket_key' 
                  AND b.created_at <= a.created_at + INTERVAL 5 SECOND
                ORDER BY b.created_at DESC, b.id DESC 
                LIMIT 1
            ),
            c.current_basket_key
        ) as current_basket_key
    FROM customer_audit_log a
    JOIN customers c ON a.customer_id = c.customer_id
    WHERE a.field_name = 'assigned_to'
      AND a.new_value IN ($userIdsStr)
      AND a.created_at BETWEEN ? AND ?
)
```
หลังจากได้ `Cohort` แล้ว จะนำไป `LEFT JOIN` กับ `call_history` และ `appointments` เพื่อหา Conversion ในลำดับต่อไป

> [!WARNING]
> **สำคัญมาก:** ในการทำ `LEFT JOIN` ทั้งโหมด *Performance* และ *Realtime* ระบบจะดักจับ **ช่วงเวลา (Time Boundary)** ด้วยเสมอ เพื่อป้องกันไม่ให้ประวัติการทำงานในอดีต (ที่พนักงานคนเดียวกันอาจเคยรับผิดชอบลูกค้าคนนี้มาก่อนหน้านั้น) ถูกนำมานับซ้ำในรอบปัจจุบัน
> 
> ตัวอย่างเช่น:
> ```sql
> LEFT JOIN call_history CH 
>     ON C.customer_id = CH.customer_id 
>    AND C.assigned_to = CH.caller_id 
>    AND CH.date >= C.assignment_date
> ```
