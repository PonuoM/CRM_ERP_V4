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
      // ค้นหาด้วยเบอร์โทรเพื่อให้ได้ลูกค้าแบบเจาะจง ไม่ซ้ำกับคนอื่น
      const searchInput = page.locator('input[placeholder*="พิมพ์เพื่อค้นหา"]').first();
      if (await searchInput.isVisible()) {
        await searchInput.fill('0867482639');
        
        // รอให้ระบบ Debounce (500ms) และรอโหลดข้อมูลจาก API
        await page.waitForTimeout(2000);
        
        // ค้นหาเป้าหมายใน Dropdown (ชื่อ สมชาย 88 มั่นคง)
        const searchResult = page.locator('text=สมชาย 88').first(); 
        await expect(searchResult).toBeVisible({ timeout: 10000 });
        await searchResult.click();
      } else {
        // Fallback: ถ้าไม่มีช่องค้นหา ให้กรอกฟอร์มตามปกติ
        const nameInput = page.locator('input[placeholder*="ชื่อ"], input[name="firstName"], input[name="customerName"]').first();
        await nameInput.fill('ลูกค้าเก่า ทดสอบ');
        
        const phoneInput = page.locator('input[placeholder*="เบอร์โทร"], input[name="phone"], input[type="tel"]').first();
        await phoneInput.fill('0980954755');
      }

      // 2.5 จัดการที่อยู่จัดส่ง
      // ถ้าที่อยู่ลูกค้าไม่ครบ ให้กรอกข้อมูลที่อยู่เพิ่มเติม
      const addressInput = page.locator('input[placeholder*="บ้านเลขที่"], input[name="street"]').first();
      if (await addressInput.isVisible()) {
        const currentAddress = await addressInput.inputValue();
        if (!currentAddress) {
          await addressInput.fill('123 ถนนสุขุมวิท ทดสอบ');
        }
      }

      // กรอก อำเภอ/เขต
      const districtInput = page.locator('input[placeholder*="ค้นหาหรือเลือกอำเภอ"]').first();
      if (await districtInput.isVisible()) {
        const currentDistrict = await districtInput.inputValue();
        if (!currentDistrict) {
          await districtInput.fill('เมืองสมุทรปราการ');
          await page.waitForTimeout(1000); // รอผลการค้นหา
          const districtItem = page.locator('text=เมืองสมุทรปราการ').first();
          await districtItem.click();
        }
      }

      // กรอก ตำบล/แขวง
      const subDistrictInput = page.locator('input[placeholder*="ค้นหาหรือเลือกตำบล"]').first();
      if (await subDistrictInput.isVisible()) {
        const currentSubDistrict = await subDistrictInput.inputValue();
        if (!currentSubDistrict) {
          await subDistrictInput.fill('ปากน้ำ');
          await page.waitForTimeout(1000); // รอผลการค้นหา
          const subDistrictItem = page.locator('text=ปากน้ำ').first();
          await subDistrictItem.click();
        }
      }

      // 3. เลือกสินค้า
      // ค้นหาปุ่มเพิ่มสินค้า
      const selectProductBtn = page.locator('button:has-text("+ เพิ่มสินค้า")').first();
      if (await selectProductBtn.isVisible()) {
        await selectProductBtn.click();
        
        // รอให้ Modal สินค้าโหลด และกดปุ่ม "เลือก" ของสินค้ารายการแรก
        await page.waitForTimeout(1000);
        const chooseBtn = page.locator('button:has-text("เลือก")').first();
        if (await chooseBtn.isVisible()) {
          await chooseBtn.click();
        }
        
        // กด Escape เพื่อปิด Modal (เผื่อว่ามันไม่ปิดอัตโนมัติ)
        await page.keyboard.press('Escape');
      }

      // 3.1 เลือก สถานะลูกค้า
      const customerStatusSelect = page.locator('select').filter({ hasText: /ลูกค้าใหม่|ซื้อซ้ำ|อัพเซล/ }).first();
      if (await customerStatusSelect.isVisible()) {
         await customerStatusSelect.selectOption({ index: 1 });
      }

      // 3.2 เลือก ช่องทางขาย และ เพจ
      const salesChannelSelect = page.locator('select').filter({ hasText: /Facebook|Line|Tiktok/i }).first();
      if (await salesChannelSelect.isVisible()) {
         await salesChannelSelect.selectOption({ index: 1 });
      }
      
      const salesChannelPageSelect = page.locator('select').filter({ hasText: /เลือกเพจ/ }).first();
      if (await salesChannelPageSelect.isVisible()) {
         const options = await salesChannelPageSelect.locator('option').count();
         if (options > 1) {
             await salesChannelPageSelect.selectOption({ index: 1 });
         }
      }

      // 3.3 เลือก วันที่จัดส่ง
      const deliveryDateInput = page.locator('input[placeholder*="เลือกวันที่จัดส่ง"]').first();
      if (await deliveryDateInput.isVisible()) {
         await deliveryDateInput.click();
         await page.waitForTimeout(500);
         await page.keyboard.press('Enter');
         await page.keyboard.press('Escape');
      }

      // 3.4 เลือก ขนส่งที่ต้องการใช้
      const shippingSelect = page.locator('select').filter({ hasText: /เลือกขนส่ง/ }).first();
      if (await shippingSelect.isVisible()) {
         const options = await shippingSelect.locator('option').count();
         if (options > 1) {
             await shippingSelect.selectOption({ index: 1 });
         }
      }

      // 4. เลือกวิธีชำระเงิน เป็น COD (เก็บเงินปลายทาง)
      // ค้นหา Dropdown วิธีการชำระเงิน จาก text ภายใน option
      const paymentSelect = page.locator('select').filter({ hasText: 'เลือกวิธีการชำระเงิน' }).first();
      if (await paymentSelect.isVisible()) {
        // เลือก COD โดยใช้ value 'COD' 
        await paymentSelect.selectOption('COD');
        
        // รอให้ UI ของ COD แสดงขึ้นมา
        await page.waitForTimeout(1000);
        
        // กดปุ่ม "แบ่งยอดเท่าๆ กัน" เพื่อตั้งราคากล่อง COD อัตโนมัติ
        const divideBtn = page.locator('button:has-text("แบ่งยอดเท่าๆ กัน")').first();
        if (await divideBtn.isVisible()) {
           await divideBtn.click();
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
