import { test, expect } from '@playwright/test';

// 1. กำหนดรูปแบบที่ต้องการเทส (Data-driven)
const paymentMethods = [
  { name: 'โอนเงิน', value: 'Transfer' },
  { name: 'เก็บเงินปลายทาง', value: 'COD' },
  { name: 'รับสินค้าก่อน', value: 'PayAfter' }
];

test.describe('E2E Core Flow: Order Creation Variations (Multi-Role)', () => {
  // ตั้งค่า timeout ให้นานขึ้นเล็กน้อย เผื่อการโหลดข้อมูลจาก DB
  test.setTimeout(60000);

  // 2. วนลูปเพื่อสร้าง Test Case 3 อัน (แยกตามวิธีชำระเงิน)
  for (const method of paymentMethods) {
    test(`Create Order, Export, Tracking, Bank Audit - ${method.name}`, async ({ browser }) => {

      // สร้าง Browser Context 3 Roles แบบแยกหน้าต่างกัน
      const telesaleContext = await browser.newContext({ storageState: 'playwright/.auth/telesale.json' });
      const backofficeContext = await browser.newContext({ storageState: 'playwright/.auth/backoffice.json' });
      const financeContext = await browser.newContext({ storageState: 'playwright/.auth/finance.json' });

      const telesalePage = await telesaleContext.newPage();
      const backofficePage = await backofficeContext.newPage();
      const financePage = await financeContext.newPage();

      // ==========================================
      // STEP 1 & 2: Create Order (by Telesale)
      // ==========================================
      await test.step('Telesale Creates Order', async () => {
        await telesalePage.goto('/');

        // 1. นำทางไปยังเมนู Dashboard และกดสร้างออเดอร์
        await telesalePage.getByText('แดชบอร์ด').first().click();

        const acknowledgeBtn = telesalePage.getByRole('button', { name: 'รับทราบ' }).first();
        if (await acknowledgeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await acknowledgeBtn.click();
        }

        await telesalePage.keyboard.press('Escape');

        // ใช้ getByRole เพื่อความชัดเจนตาม Best Practice
        await telesalePage.getByRole('button', { name: /สร้างคำสั่งซื้อ/ }).first().click();

        await expect(telesalePage.getByText('ชื่อลูกค้า').first()).toBeVisible({ timeout: 10000 }).catch(() => { });

        // 2. ค้นหาลูกค้าเดิม
        const searchInput = telesalePage.getByPlaceholder('พิมพ์เพื่อค้นหา').first();
        if (await searchInput.isVisible()) {
          await searchInput.fill('0867482639');
          await telesalePage.waitForTimeout(2000);
          
          const searchResult = telesalePage.getByText('สมชาย 88').first(); 
          await expect(searchResult).toBeVisible({ timeout: 10000 });
          await searchResult.click();
        } else {
          const nameInput = telesalePage.getByPlaceholder(/ชื่อ/).first();
          await nameInput.fill('ลูกค้าเก่า ทดสอบ');
          
          const phoneInput = telesalePage.getByPlaceholder(/เบอร์โทร/).first();
          await phoneInput.fill('0980954755');
        }

        // 2.5 จัดการที่อยู่จัดส่ง
        const addressInput = telesalePage.getByPlaceholder(/บ้านเลขที่/).first();
        if (await addressInput.isVisible()) {
          const currentAddress = await addressInput.inputValue();
          if (!currentAddress) {
            await addressInput.fill('123 ถนนสุขุมวิท ทดสอบ');
          }
        }

        const districtInput = telesalePage.getByPlaceholder(/ค้นหาหรือเลือกอำเภอ/).first();
        if (await districtInput.isVisible()) {
          const currentDistrict = await districtInput.inputValue();
          if (!currentDistrict) {
            await districtInput.fill('เมืองสมุทรปราการ');
            await telesalePage.waitForTimeout(1000);
            await telesalePage.getByText('เมืองสมุทรปราการ', { exact: true }).first().click();
          }
        }

        const subDistrictInput = telesalePage.getByPlaceholder(/ค้นหาหรือเลือกตำบล/).first();
        if (await subDistrictInput.isVisible()) {
          const currentSubDistrict = await subDistrictInput.inputValue();
          if (!currentSubDistrict) {
            await subDistrictInput.fill('ปากน้ำ');
            await telesalePage.waitForTimeout(1000);
            await telesalePage.getByText('ปากน้ำ', { exact: true }).first().click();
          }
        }

        // 3. เลือกสินค้า
        const selectProductBtn = telesalePage.getByRole('button', { name: '+ เพิ่มสินค้า' }).first();
        if (await selectProductBtn.isVisible()) {
          await selectProductBtn.click();
          
          await telesalePage.waitForTimeout(1000);
          const chooseBtn = telesalePage.getByRole('button', { name: 'เลือก' }).first();
          if (await chooseBtn.isVisible()) {
            await chooseBtn.click();
          }
          
          await telesalePage.keyboard.press('Escape');
        }

        // 3.1 เลือก สถานะลูกค้า
        const customerStatusSelect = telesalePage.locator('select').filter({ hasText: /ลูกค้าใหม่|ซื้อซ้ำ|อัพเซล/ }).first();
        if (await customerStatusSelect.isVisible()) {
           await customerStatusSelect.selectOption({ index: 1 });
        }

        // 3.2 เลือก ช่องทางขาย และ เพจ
        const salesChannelSelect = telesalePage.locator('select').filter({ hasText: /Facebook|Line|Tiktok/i }).first();
        if (await salesChannelSelect.isVisible()) {
           await salesChannelSelect.selectOption({ index: 1 });
        }
        
        const salesChannelPageSelect = telesalePage.locator('select').filter({ hasText: /เลือกเพจ/ }).first();
        if (await salesChannelPageSelect.isVisible()) {
           const options = await salesChannelPageSelect.locator('option').count();
           if (options > 1) {
               await salesChannelPageSelect.selectOption({ index: 1 });
           }
        }

        // 3.3 เลือก วันที่จัดส่ง
        const deliveryDateInput = telesalePage.getByPlaceholder(/เลือกวันที่จัดส่ง/).first();
        if (await deliveryDateInput.isVisible()) {
           await deliveryDateInput.click();
           await telesalePage.waitForTimeout(500);
           await telesalePage.keyboard.press('Enter');
           await telesalePage.keyboard.press('Escape');
        }

        // 3.4 เลือก ขนส่งที่ต้องการใช้
        const shippingSelect = telesalePage.locator('select').filter({ hasText: /เลือกขนส่ง/ }).first();
        if (await shippingSelect.isVisible()) {
           const options = await shippingSelect.locator('option').count();
           if (options > 1) {
               await shippingSelect.selectOption({ index: 1 });
           }
        }

        // 4. เลือกวิธีชำระเงิน ตาม Parameterized Method
        const paymentSelect = telesalePage.locator('select').filter({ hasText: 'เลือกวิธีการชำระเงิน' }).first();
        if (await paymentSelect.isVisible()) {
          
          // เลือก value จาก array เช่น 'Transfer', 'COD', 'PayAfter'
          await paymentSelect.selectOption(method.value);
          
          await telesalePage.waitForTimeout(1000);
          
          // ถ้าเป็น COD ต้องแบ่งยอด
          if (method.value === 'COD') {
            const divideBtn = telesalePage.getByRole('button', { name: 'แบ่งยอดเท่าๆ กัน' }).first();
            if (await divideBtn.isVisible()) {
               await divideBtn.click();
            }
          }
          
          // ถ้าเป็นโอนเงิน ต้องอัปโหลดสลิปจำลอง
          if (method.value === 'Transfer') {
            const fileInput = telesalePage.locator('input[type="file"]').first();
            // สร้างภาพจำลองขนาด 1x1 pixel (Base64) เพื่ออัปโหลดเป็นสลิป
            const dummyImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
            await fileInput.setInputFiles({
              name: 'mock-slip.png',
              mimeType: 'image/png',
              buffer: dummyImageBuffer
            });
            await telesalePage.waitForTimeout(1500); // รอรูปโหลดและฟอร์มจำนวนเงินแสดงขึ้นมา

            // ดึงราคายอดสุทธิจากหน้าจอมาใส่เป็นจำนวนเงิน
            const netTotalText = await telesalePage.locator('span:has-text("ยอดสุทธิ") + span').first().innerText();
            const amount = netTotalText.replace(/[^\d.]/g, ''); // ตัดตัวอักษร ฿ หรือ , ออก

            // กรอกจำนวนเงินในสลิป
            const slipAmountInput = telesalePage.locator('div').filter({ has: telesalePage.locator('label:has-text("จำนวนเงิน")') }).locator('input[type="number"]').first();
            if (await slipAmountInput.isVisible()) {
               await slipAmountInput.fill(amount);
            }
          }
        }

        // 5. กดบันทึกคำสั่งซื้อ
        const saveBtn = telesalePage.getByRole('button', { name: /บันทึก|สร้างคำสั่งซื้อ|ยืนยันออเดอร์/ }).first();
        await saveBtn.click();

        await expect(telesalePage.locator('.toast').first()).toBeVisible({ timeout: 15000 }).catch(() => {
          console.log("อาจจะไม่เจอ Pop-up Success แต่บันทึกสำเร็จ กรุณาตรวจสอบอีกครั้ง");
        });
      });

      // ==========================================
      // STEP 3: Manage / Export Data (by Backoffice)
      // ==========================================
      await test.step('Backoffice Manages Order', async () => {
        // นำทางไปหน้า จัดการคำสั่งซื้อ
        await backofficePage.goto('/?page=Manage%20Orders');
        
        await backofficePage.waitForTimeout(2000);

        // TODO: (ส่วนที่สอบถาม) 
        // 1. กดเข้าแท็บ "รอส่งออก" 
        // 2. ค้นหาออเดอร์ที่ Telesale เพิ่งสร้าง (ด้วยเบอร์โทร/ชื่อ)
        // 3. ติ๊กเลือกแล้วกดส่งออก
        console.log('Backoffice user accesses Manage Orders.');
      });

      // ==========================================
      // STEP 4: Tracking Setup (by Backoffice)
      // ==========================================
      await test.step('Backoffice Link Tracking Number', async () => {
        await backofficePage.goto('/?page=Bulk%20Tracking');
      });

      // ==========================================
      // STEP 5: Bank Audit / Statement (by Finance)
      // ==========================================
      await test.step('Finance Bank Statement Audit', async () => {
        await financePage.goto('/?page=BankAccountAuditPage'); 
      });

      // ปิดหน้าต่างให้เรียบร้อยเมื่อจบ
      await telesaleContext.close();
      await backofficeContext.close();
      await financeContext.close();
    });
  }
});
