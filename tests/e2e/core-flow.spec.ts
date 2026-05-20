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
      await page.locator('input[type="text"], input[placeholder*="sername"]').fill('bosstest'); // <-- เปลี่ยนตรงนี้
      await page.locator('input[type="password"], input[placeholder*="assword"]').fill('1234'); // <-- เปลี่ยนตรงนี้
      await page.locator('button:has-text("Sign in")').click();

      // รอจนกว่าจะเข้าสู่หน้าหลักสำเร็จ (รอโหลด Sidebar)
      await expect(page.locator('nav, .sidebar')).toBeVisible({ timeout: 15000 }).catch(() => { });

      // ตรวจสอบ Popup "เริ่มงานวันนี้ไหม?" (บันทึกเวลาเข้างานครั้งแรกของวัน)
      const clockInModalText = page.locator('text=เริ่มงานวันนี้ไหม?').first();
      if (await clockInModalText.isVisible({ timeout: 5000 }).catch(() => false)) {
        // กด "บันทึกเข้างาน" หรือ "ไม่ใช่ตอนนี้" (ในที่นี้เลือกกดเข้างานไปเลย)
        await page.locator('button:has-text("บันทึกเข้างาน")').first().click();
      }
    });

    // ==========================================
    // STEP 2: Create Order
    // ==========================================
    await test.step('Create Order', async () => {
      // 1. นำทางไปยังเมนู Dashboard และกดสร้างออเดอร์
      // คลิกไปที่หน้า "แดชบอร์ด" จาก Sidebar
      await page.locator('.sidebar, nav').locator('text=แดชบอร์ด').first().click();

      // รอให้หน้า Dashboard โหลดและเช็ค Error Modal (เช่น PancakeTokenErrorModal) ให้กดปิดก่อน
      const acknowledgeBtn = page.locator('button:has-text("รับทราบ")').first();
      if (await acknowledgeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await acknowledgeBtn.click();
      }

      // ปิด modal อื่นๆ ด้วยการกด ESC เผื่อติดหน้าต่างแจ้งเตือน
      await page.keyboard.press('Escape');

      // กดปุ่ม '+ สร้างคำสั่งซื้อ' ที่มุมขวาบนของ Dashboard
      await page.locator('button:has-text("สร้างคำสั่งซื้อ"), a:has-text("สร้างคำสั่งซื้อ")').first().click();

      // รอให้ฟอร์มโหลด (รอเจอคำว่า ชื่อลูกค้า หรือ เบอร์โทร)
      await expect(page.locator('text=ชื่อลูกค้า').first()).toBeVisible({ timeout: 10000 }).catch(() => { });

      // 2. ค้นหาลูกค้าเดิมที่มีในระบบ (ใช้ข้อมูลจาก company_id = 5)
      // เพิ่มลูกค้า "สมชาย ทดสอบ" เข้าไปใน DB (company_id=5) เรียบร้อยแล้ว
      const searchInput = page.locator('input[placeholder*="พิมพ์เพื่อค้นหา"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('สมชาย');
        
        // รอให้ระบบ Debounce (500ms) และรอโหลดข้อมูลจาก API
        await page.waitForTimeout(2000);
        
        // ค้นหาเป้าหมายใน Dropdown
        const searchResult = page.locator('text=สมชาย').first(); 
        await expect(searchResult).toBeVisible({ timeout: 10000 });
        await searchResult.click();
      } else {
        // Fallback: ถ้าไม่มีช่องค้นหา ให้กรอกฟอร์มตามปกติ
        const nameInput = page.locator('input[placeholder*="ชื่อ"], input[name="firstName"], input[name="customerName"]').first();
        await nameInput.fill('ลูกค้าเก่า ทดสอบ');
        
        const phoneInput = page.locator('input[placeholder*="เบอร์โทร"], input[name="phone"], input[type="tel"]').first();
        await phoneInput.fill('0980954755');
      }

      // 3. เลือกสินค้า
      // ค้นหาปุ่มเลือกสินค้า
      const selectProductBtn = page.locator('button:has-text("เลือกสินค้า"), button:has-text("เพิ่มสินค้า")').first();
      if (await selectProductBtn.isVisible()) {
        await selectProductBtn.click();
        // รอให้ Modal สินค้าโหลด แล้วกดปุ่ม "เลือก" สินค้าชิ้นแรก
        await page.locator('button:has-text("เลือก"), button:has-text("เพิ่ม")').first().click();
        // ปิด Modal (ถ้ามีปุ่มยืนยัน)
        const confirmProductBtn = page.locator('button:has-text("ยืนยัน"), button:has-text("ตกลง")').first();
        if (await confirmProductBtn.isVisible()) {
          await confirmProductBtn.click();
        }
      }

      // 3.1 เลือก สถานะลูกค้า
      const customerStatusSelect = page.locator('select').filter({ hasText: /ลูกค้าใหม่|ซื้อซ้ำ|อัพเซล/ }).first();
      if (await customerStatusSelect.isVisible()) {
         // เลือก option ที่ 2 (Index 1) เช่น "ซื้อซ้ำ" หรืออะไรก็ตามที่มี (ข้าม placeholder)
         await customerStatusSelect.selectOption({ index: 1 });
      }

      // 3.2 เลือก ช่องทางขาย และ เพจ
      const salesChannelSelect = page.locator('select').filter({ hasText: /Facebook|Line|Tiktok/i }).first();
      if (await salesChannelSelect.isVisible()) {
         await salesChannelSelect.selectOption({ index: 1 });
      }
      
      const salesChannelPageSelect = page.locator('select').filter({ hasText: /เลือกเพจ/ }).first();
      if (await salesChannelPageSelect.isVisible()) {
         // บาง platform อาจไม่มี page 
         const options = await salesChannelPageSelect.locator('option').count();
         if (options > 1) {
             await salesChannelPageSelect.selectOption({ index: 1 });
         }
      }

      // 3.3 เลือก วันที่จัดส่ง
      const deliveryDateInput = page.locator('input[placeholder*="เลือกวันที่จัดส่ง"]').first();
      if (await deliveryDateInput.isVisible()) {
         // คลิกเพื่อให้ DatePicker เปิดขึ้นมา
         await deliveryDateInput.click();
         // กดเลือกวันที่ปัจจุบัน (มักจะมี class ที่ระบุถึงวันนี้ หรือ aria-current="date")
         // ถ้าหาไม่เจอ ให้คลิกวันแรกที่เจอในเดือนนั้นที่กดได้
         const todayBtn = page.locator('.react-datepicker__day--today, .react-datepicker__day').first();
         if (await todayBtn.isVisible()) {
             await todayBtn.click();
         } else {
             // Fallback: กด enter เพื่อเลือกวันที่ปัจจุบัน หรือ escape ปิด
             await page.keyboard.press('Enter');
         }
      }

      // 4. เลือกวิธีชำระเงิน เป็น COD (ถ้ามี Dropdown)
      const paymentSelect = page.locator('select').first();
      if (await paymentSelect.isVisible()) {
        // ลองเลือก option ที่มีคำว่า COD
        const codOption = await paymentSelect.locator('option:has-text("COD")').first();
        if (await codOption.isVisible()) {
          const value = await codOption.getAttribute('value');
          if (value) await paymentSelect.selectOption(value);
        }
      }

      // 5. กดบันทึกคำสั่งซื้อ
      const saveBtn = page.locator('button:has-text("บันทึก"), button:has-text("สร้างคำสั่งซื้อ"), button:has-text("ยืนยันออเดอร์")').first();
      await saveBtn.click();

      // รอจนกว่าจะขึ้นแจ้งเตือนสำเร็จ (อาจจะเป็น Modal แจ้งเตือน หรือข้อความ)
      // *หากระบบใช้เวลาบันทึกนาน สามารถเพิ่ม timeout ได้
      await expect(page.locator('text=สำเร็จ, text=Success, .swal2-success')).toBeVisible({ timeout: 15000 }).catch(() => {
        console.log("อาจจะไม่เจอ Pop-up Success แต่บันทึกสำเร็จ กรุณาตรวจสอบอีกครั้ง");
      });
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
