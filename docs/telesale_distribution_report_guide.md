# แนวทางการทำรายงานแจกรายชื่อให้ Telesale (Telesale Distribution Report Guide)

เอกสารนี้อธิบายแนวทางและ Logic ที่ถูกต้องในการดึงข้อมูลและทำรายงานสรุปสถิติ **"การแจกรายชื่อลูกค้าให้กับพนักงาน Telesale"** (Distribution Report) เพื่อให้ได้ข้อมูลที่แม่นยำที่สุด และป้องกันปัญหายอดตะกร้าคลาดเคลื่อน

## 🚨 ข้อควรระวังที่สำคัญที่สุด (The "Current Basket" Trap)

ความผิดพลาดที่พบบ่อยที่สุดในการทำรายงานแจกรายชื่อ คือการนำตารางประวัติการแจก (Audit Log) ไป `JOIN` กับตารางลูกค้า (`customers`) แล้วใช้คอลัมน์ `current_basket_key` มาสรุปผล

**ทำไมถึงผิด?**
เมื่อระบบแจกรายชื่อลูกค้า (เช่น ตะกร้า **Upsell**) ไปให้พนักงาน พนักงานจะทำการโทรหาลูกค้าและมักจะ **ย้ายลูกค้าไปตะกร้าอื่น** ทันที (เช่น ย้ายไปตะกร้า **รอคนมาจีบให้ติด**, **ติดต่อไม่ได้**, หรือ **ไม่สนใจ**) 
หากเราดึงข้อมูล `current_basket_key` ณ ปัจจุบัน ยอดของตะกร้า Upsell จะหายไป และไปโป่งที่ตะกร้าอื่นแทน ทำให้เข้าใจผิดว่าระบบไม่ได้แจกตะกร้า Upsell

**✅ วิธีที่ถูกต้อง:**
ต้องดึงชื่อตะกร้า **"ณ วินาทีที่ลูกค้ารายนั้นถูกแจก"** โดยการค้นหาประวัติการเปลี่ยนตะกร้าจากตาราง `customer_audit_log` เท่านั้น

---

## 🛠️ โครงสร้างและการดึงข้อมูลที่ถูกต้อง (Best Practice SQL)

### 1. แหล่งข้อมูลหลัก (Source of Truth)
ใช้ตาราง `customer_audit_log` เป็นหลัก โดยมีเงื่อนไขดังนี้:
- `field_name = 'assigned_to'` (เหตุการณ์การโอนย้าย/แจกรายชื่อ)
- `api_source LIKE '%distribution%'` (กรองเฉพาะการแจกจากระบบ Distribution, หากต้องการดูทั้งหมดอาจจะยกเว้นการดึงคืน `basket_config/reclaim`)
- กรองเฉพาะพนักงาน Telesale (Role ID `6` และ `7`) และ Company ที่ต้องการ (เช่น `company_id = 1`)

### 2. Logic การหาตะกร้า ณ เวลาที่แจก (Basket at Assignment Time)
ใช้ `Subquery` ซ้อนเข้าไปใน `LEFT JOIN` เพื่อหาว่า ณ เวลา `created_at` ที่มีการแจกลูกค้านั้น ลูกค้ามี `current_basket_key` ล่าสุดคืออะไร

**ตัวอย่าง SQL Query:**
```sql
SELECT 
    u.id as user_id,
    u.first_name, 
    IFNULL(b.basket_name, 'Unknown Basket') AS basket_name,
    COUNT(DISTINCT log.customer_id) AS total_customers_assigned
FROM customer_audit_log log
JOIN users u ON log.new_value = u.id

-- [สำคัญ] การ JOIN ตะกร้าด้วย Subquery เพื่อหาตะกร้า "ณ เวลาที่ถูกแจก"
LEFT JOIN basket_config b ON b.id = (
    SELECT b_log.new_value 
    FROM customer_audit_log b_log 
    WHERE b_log.customer_id = log.customer_id 
      AND b_log.field_name = 'current_basket_key' 
      AND b_log.created_at <= log.created_at
    ORDER BY b_log.id DESC 
    LIMIT 1
)

WHERE log.field_name = 'assigned_to'
  AND log.api_source LIKE '%distribution%'
  AND log.created_at >= '2026-07-01 00:00:00' 
  AND log.created_at <= '2026-07-31 23:59:59'
  AND u.company_id = 1
  AND u.role_id IN (6, 7)
  -- (Option) ยกเว้นตะกร้าที่ไม่ต้องการนำมาคำนวณ
  AND IFNULL(b.basket_name, '') NOT IN ('ส่วนตัว 1-2 เดือน', 'ส่วนตัวโอกาสสุดท้าย', 'ลูกค้าบล็อค')
GROUP BY u.id, u.first_name, basket_name
ORDER BY u.first_name ASC, total_customers_assigned DESC;
```

---

## 📊 การแสดงผลรายงาน (Report Presentation)

เพื่อให้ทีมบริหารสามารถวิเคราะห์ข้อมูลได้อย่างมีประสิทธิภาพ แนะนำให้จัดรูปแบบรายงานเป็น **Matrix Table** (แกน Y เป็นพนักงาน, แกน X เป็นตะกร้า) และมีการจัดกลุ่มตาม **Supervisor (หัวหน้าทีม)** โดยมีหลักการจัดเรียงดังนี้:

1. **ดึงทุกตะกร้าที่เป็นไปได้ (Union Baskets):** หากมีการเปรียบเทียบระหว่างช่วงเวลา (เช่น เดือน 6 เทียบกับเดือน 7) ให้ดึงรายชื่อตะกร้าทั้งหมดมารวมกันก่อน เพื่อให้คอลัมน์ของตารางตรงกันทุกเดือน
2. **จัดเรียงตามทีม (Group by Team):** เรียงลำดับแถวตามชื่อทีม
3. **ยกหัวหน้าทีมขึ้นด้านบน (Supervisor First):** ในแต่ละกลุ่มทีม ให้นำชื่อ Supervisor ขึ้นเป็นบรรทัดแรกเสมอ (เพิ่มสัญลักษณ์เช่น 👑) เพื่อให้เห็นภาพรวมว่าหัวหน้าทีมได้รับการแจกเท่าไหร่
4. **ยอดรวม (Totals):** 
   - เพิ่มคอลัมน์ **"รวมทั้งสิ้น"** ด้านขวาสุด สำหรับยอดรวมรายบุคคล
   - เพิ่มบรรทัด **"รวมทุกทีม"** ด้านล่างสุด สำหรับยอดรวมแต่ละตะกร้าของทั้งบริษัท

---

## 📌 สรุป

การทำรายงานระบบ Distribution หัวใจสำคัญคือ **การย้อนเวลา** ไปดูสถานะข้อมูล ณ ตอนนั้น (Point-in-time) การใช้ข้อมูล `current_*` ในตารางหลักมักจะทำให้เกิด Data Discrepancy อย่างรุนแรงในระบบ CRM/ERP ที่มีการเปลี่ยนสถานะลูกค้าอย่างรวดเร็ว (High-velocity state changes) ตาราง `customer_audit_log` จึงเป็นแหล่งอ้างอิงที่เชื่อถือได้มากที่สุด
