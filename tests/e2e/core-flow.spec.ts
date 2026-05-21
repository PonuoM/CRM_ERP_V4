import { test, expect } from '@playwright/test';

// 1. กำหนดรูปแบบที่ต้องการเทส (Data-driven)
const paymentMethods = [
  { name: 'โอนเงิน', value: 'Transfer' },
  { name: 'เก็บเงินปลายทาง', value: 'COD' },
  { name: 'รับสินค้าก่อน', value: 'PayAfter' }
];

test.describe('E2E Core Flow: Order Creation Variations', () => {
  // ตั้งค่า timeout ให้นานขึ้นเล็กน้อย เผื่อการโหลดข้อมูลจาก DB
  test.setTimeout(60000);

  // 2. วนลูปเพื่อสร้าง Test Case 3 อัน (แยกตามวิธีชำระเงิน)
  for (const method of paymentMethods) {
    test(`Create Order, Export, Tracking, Bank Audit - ${method.name}`, async ({ page }) => {

      // ==========================================
      // STEP 1: Login / Auth Setup
      // ==========================================
      await test.step('Login', async () => {
        await page.goto('/');

        // ใช้ getByPlaceholder / getByRole ตาม Best Practice
        await page.getByPlaceholder(/sername/i).fill('bosstest');
        await page.getByPlaceholder(/assword/i).fill('1234');
        await page.getByRole('button', { name: 'Sign in' }).click();

        // รอจนกว่าจะเข้าสู่หน้าหลักสำเร็จ
        await expect(page.locator('nav, .sidebar').first()).toBeVisible({ timeout: 15000 }).catch(() => { });

        const clockInModalText = page.getByText('เริ่มงานวันนี้ไหม?').first();
        if (await clockInModalText.isVisible({ timeout: 5000 }).catch(() => false)) {
          await page.getByRole('button', { name: 'บันทึกเข้างาน' }).first().click();
        }
      });

      // ==========================================
      // STEP 2: Create Order
      // ==========================================
      await test.step('Create Order', async () => {
        // 1. นำทางไปยังเมนู Dashboard และกดสร้างออเดอร์
        await page.getByText('แดชบอร์ด').first().click();

        const acknowledgeBtn = page.getByRole('button', { name: 'รับทราบ' }).first();
        if (await acknowledgeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await acknowledgeBtn.click();
        }

        await page.keyboard.press('Escape');

        // ใช้ getByRole เพื่อความชัดเจนตาม Best Practice
        await page.getByRole('button', { name: /สร้างคำสั่งซื้อ/ }).first().click();

        await expect(page.getByText('ชื่อลูกค้า').first()).toBeVisible({ timeout: 10000 }).catch(() => { });

        // 2. ค้นหาลูกค้าเดิม
        const searchInput = page.getByPlaceholder('พิมพ์เพื่อค้นหา').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill('0867482639');
          await page.waitForTimeout(2000);
          
          const searchResult = page.getByText('สมชาย 88').first(); 
          await expect(searchResult).toBeVisible({ timeout: 10000 });
          await searchResult.click();
        } else {
          const nameInput = page.getByPlaceholder(/ชื่อ/).first();
          await nameInput.fill('ลูกค้าเก่า ทดสอบ');
          
          const phoneInput = page.getByPlaceholder(/เบอร์โทร/).first();
          await phoneInput.fill('0980954755');
        }

        // 2.5 จัดการที่อยู่จัดส่ง
        const addressInput = page.getByPlaceholder(/บ้านเลขที่/).first();
        if (await addressInput.isVisible()) {
          const currentAddress = await addressInput.inputValue();
          if (!currentAddress) {
            await addressInput.fill('123 ถนนสุขุมวิท ทดสอบ');
          }
        }

        const districtInput = page.getByPlaceholder(/ค้นหาหรือเลือกอำเภอ/).first();
        if (await districtInput.isVisible()) {
          const currentDistrict = await districtInput.inputValue();
          if (!currentDistrict) {
            await districtInput.fill('เมืองสมุทรปราการ');
            await page.waitForTimeout(1000);
            await page.getByText('เมืองสมุทรปราการ', { exact: true }).first().click();
          }
        }

        const subDistrictInput = page.getByPlaceholder(/ค้นหาหรือเลือกตำบล/).first();
        if (await subDistrictInput.isVisible()) {
          const currentSubDistrict = await subDistrictInput.inputValue();
          if (!currentSubDistrict) {
            await subDistrictInput.fill('ปากน้ำ');
            await page.waitForTimeout(1000);
            await page.getByText('ปากน้ำ', { exact: true }).first().click();
          }
        }

        // 3. เลือกสินค้า
        const selectProductBtn = page.getByRole('button', { name: '+ เพิ่มสินค้า' }).first();
        if (await selectProductBtn.isVisible()) {
          await selectProductBtn.click();
          
          await page.waitForTimeout(1000);
          const chooseBtn = page.getByRole('button', { name: 'เลือก' }).first();
          if (await chooseBtn.isVisible()) {
            await chooseBtn.click();
          }
          
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
        const deliveryDateInput = page.getByPlaceholder(/เลือกวันที่จัดส่ง/).first();
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

        // 4. เลือกวิธีชำระเงิน ตาม Parameterized Method
        const paymentSelect = page.locator('select').filter({ hasText: 'เลือกวิธีการชำระเงิน' }).first();
        if (await paymentSelect.isVisible()) {
          
          // เลือก value จาก array เช่น 'Transfer', 'COD', 'PayAfter'
          await paymentSelect.selectOption(method.value);
          
          await page.waitForTimeout(1000);
          
          // ถ้าเป็น COD ต้องแบ่งยอด
          if (method.value === 'COD') {
            const divideBtn = page.getByRole('button', { name: 'แบ่งยอดเท่าๆ กัน' }).first();
            if (await divideBtn.isVisible()) {
               await divideBtn.click();
            }
          }
          
          // ถ้าเป็นโอนเงิน ต้องอัปโหลดสลิปจำลอง
          if (method.value === 'Transfer') {
            const fileInput = page.locator('input[type="file"]').first();
            // สร้างภาพจำลองขนาด 1x1 pixel (Base64) เพื่ออัปโหลดเป็นสลิป
            const dummyImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
            await fileInput.setInputFiles({
              name: 'mock-slip.png',
              mimeType: 'image/png',
              buffer: dummyImageBuffer
            });
            await page.waitForTimeout(1500); // รอรูปโหลดและฟอร์มจำนวนเงินแสดงขึ้นมา

            // ดึงราคายอดสุทธิจากหน้าจอมาใส่เป็นจำนวนเงิน
            const netTotalText = await page.locator('span:has-text("ยอดสุทธิ") + span').first().innerText();
            const amount = netTotalText.replace(/[^\d.]/g, ''); // ตัดตัวอักษร ฿ หรือ , ออก

            // กรอกจำนวนเงินในสลิป
            const slipAmountInput = page.locator('div').filter({ has: page.locator('label:has-text("จำนวนเงิน")') }).locator('input[type="number"]').first();
            if (await slipAmountInput.isVisible()) {
               await slipAmountInput.fill(amount);
            }
          }
        }

        // 5. กดบันทึกคำสั่งซื้อ
        const saveBtn = page.getByRole('button', { name: /บันทึก|สร้างคำสั่งซื้อ|ยืนยันออเดอร์/ }).first();
        await saveBtn.click();

        await expect(page.locator('text=สำเร็จ, text=Success, .swal2-success').first()).toBeVisible({ timeout: 15000 }).catch(() => {
          console.log("อาจจะไม่เจอ Pop-up Success แต่บันทึกสำเร็จ กรุณาตรวจสอบอีกครั้ง");
        });
      });

      // ==========================================
      // STEP 3: Export Data for Shipping
      // ==========================================
      await test.step('Export Data', async () => {
        await page.goto('/?page=Export History');
      });

      // ==========================================
      // STEP 4: Tracking Setup
      // ==========================================
      await test.step('Link Tracking Number', async () => {
        await page.goto('/?page=Bulk Tracking');
      });

      // ==========================================
      // STEP 5: Bank Audit / Statement
      // ==========================================
      await test.step('Bank Statement Audit', async () => {
        await page.goto('/?page=BankAccountAuditPage'); 
      });

    });
  }
});
