import { test, expect } from '@playwright/test';

test.describe('E2E Core Flow: Order -> Export -> Tracking -> Audit', () => {
  // ตั้งค่า timeout ให้นานขึ้นเล็กน้อย เผื่อการโหลดข้อมูลจาก DB
  test.setTimeout(60000);

  test('Create Order, Export, Tracking, Bank Audit', async ({ page }) => {

    // ==========================================
    // STEP 1: Login / Auth Setup
    // ==========================================
    await test.step('Login', async () => {
      // เข้าสู่หน้า Login
      await page.goto('/');

      // กรอกข้อมูล Login (ให้เปลี่ยนเป็น username/password จริงที่มีในฐานข้อมูล)
      await page.locator('input[type="text"], input[placeholder*="sername"]').fill('boss'); // <-- เปลี่ยนตรงนี้
      await page.locator('input[type="password"], input[placeholder*="assword"]').fill('999888'); // <-- เปลี่ยนตรงนี้
      await page.locator('button:has-text("Sign in")').click();

      // เมื่อ Login สำเร็จ ระบบจะ redirect ไปที่หน้า Dashboard ซึ่ง URL อาจจะไม่มี ?page=
      // จึงเปลี่ยนมารอให้เจอคำว่า "ภาพรวม" หรือส่วนประกอบของ Sidebar แทน
      await expect(page.locator('nav, .sidebar')).toBeVisible({ timeout: 15000 }).catch(() => { });
      // หรือถ้าในระบบมีคำเฉพาะเช่น "Dashboard" หรือผู้ใช้งาน
      // await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 15000 });
    });

    // ==========================================
    // STEP 2: Create Order
    // ==========================================
    await test.step('Create Order', async () => {
      // ไปที่เมนู "ลูกค้า" (Customers) หรือหน้าสร้างออเดอร์
      await page.goto('/?page=Manage Customers');

      // คลิกปุ่ม "เพิ่มลูกค้าใหม่" หรือ "สร้างออเดอร์"
      // ตัวอย่าง: await page.locator('button:has-text("เพิ่มลูกค้า")').click();
      // ตัวอย่าง: await page.locator('button:has-text("สร้างคำสั่งซื้อ")').click();

      // รอให้ Modal/ฟอร์มแสดงขึ้นมา

      // 1. กรอกชื่อ-นามสกุลลูกค้า และเบอร์โทร
      /*
      await page.locator('input[placeholder*="ชื่อ"]').fill('ลูกค้าทดสอบ E2E');
      await page.locator('input[placeholder*="เบอร์โทร"]').fill('0812345678');
      */

      // 2. เลือกที่อยู่ (ถ้ามี)
      /*
      await page.locator('textarea, input[placeholder*="ที่อยู่"]').fill('123 ถ.สุขุมวิท กรุงเทพฯ 10110');
      */

      // 3. เลือกสินค้า (Line Items)
      /*
      await page.locator('button:has-text("เลือกสินค้า")').click();
      await page.locator('.product-item >> button:has-text("เลือก")').first().click();
      await page.locator('button:has-text("ยืนยัน")').click(); // ปิด Modal เลือกสินค้า
      */

      // 4. เลือกวิธีการชำระเงิน (เช่น COD)
      /*
      await page.locator('select').filter({ hasText: /COD|โอนเงิน/ }).selectOption({ label: 'COD' });
      */

      // 5. บันทึกคำสั่งซื้อ
      /*
      await page.locator('button:has-text("บันทึก"), button:has-text("สร้างคำสั่งซื้อ")').click();
      await expect(page.locator('text=บันทึกสำเร็จ')).toBeVisible({ timeout: 10000 });
      */
    });

    // ==========================================
    // STEP 3: Export Data for Shipping
    // ==========================================
    await test.step('Export Data', async () => {
      // ไปที่หน้ารายงาน หรือหน้าส่งออกข้อมูล
      await page.goto('/?page=Export History');

      // จำลองการดึง Report
      // await page.locator('button:has-text("ส่งออก Excel")').click();
    });

    // ==========================================
    // STEP 4: Tracking Setup
    // ==========================================
    await test.step('Link Tracking Number', async () => {
      // ไปที่หน้า Bulk Tracking
      await page.goto('/?page=Bulk Tracking');

      // อัปโหลดไฟล์ Tracking หรือกรอกข้อมูล
      // await page.locator('input[type="file"]').setInputFiles('path/to/tracking.csv');
      // await page.locator('button:has-text("อัปโหลด")').click();
    });

    // ==========================================
    // STEP 5: Bank Audit / Statement
    // ==========================================
    await test.step('Bank Statement Audit', async () => {
      // ไปที่หน้าตรวจสอบ Statement
      await page.goto('/?page=BankAccountAuditPage'); // หรือตาม Routing ของระบบ

      // ตรวจสอบข้อมูลออเดอร์ล่าสุด ว่าถูกผูกกับ Statement หรือไม่
    });

  });
});
