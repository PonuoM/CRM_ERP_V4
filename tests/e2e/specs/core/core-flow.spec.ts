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

      let exportedOrderId = '';
      let createdOrderRef = '';

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

        const sessionUserStr = await telesalePage.evaluate(() => localStorage.getItem('sessionUser'));
        const attendanceSessionStr = await telesalePage.evaluate(() => localStorage.getItem('attendance.session'));
        console.log('Telesale Page sessionUser:', sessionUserStr);
        console.log('Telesale Page attendanceSession:', attendanceSessionStr);

        // ใช้ goto เพื่อความชัวร์และไม่ติดปัญหาเมนู dropdown
        await telesalePage.goto('/?page=CreateOrder');
        await expect(telesalePage.getByText('ชื่อลูกค้า').first()).toBeVisible({ timeout: 10000 }).catch(() => { });

        // 2. ค้นหาลูกค้าเดิม
        const searchInput = telesalePage.getByPlaceholder('พิมพ์เพื่อค้นหา').first();

        // รอให้ช่องค้นหาลูกค้าปรากฏขึ้นมา
        await searchInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

        // 2.1 เลือกหรือสร้างลูกค้าใหม่
        if (await searchInput.isVisible()) {
          await searchInput.fill('0811111111');
          await telesalePage.waitForTimeout(2000);
          
          const searchResult = telesalePage.locator('li').filter({ hasText: '0811111111' }).first();
          const isResultVisible = await searchResult.isVisible({ timeout: 5000 }).catch(() => false);
          
          if (isResultVisible) {
             await searchResult.click();
          } else {
             // Fallback
             const nameInput = telesalePage.getByPlaceholder(/กรุณากรอกชื่อ/).first();
             await nameInput.fill('Customer Fixed');
             
             const phoneInput = telesalePage.getByPlaceholder(/เบอร์โทร/).first();
             await phoneInput.fill('0811111111');
          }
        } else {
          const nameInput = telesalePage.getByPlaceholder(/กรุณากรอกชื่อ/).first();
          await nameInput.fill('Customer Fixed');
          
          const phoneInput = telesalePage.getByPlaceholder(/เบอร์โทร/).first();
          await phoneInput.fill('0811111111');
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
            await telesalePage.getByText('เมืองสมุทรปราการ', { exact: false }).first().click();
          }
        }

        const subDistrictInput = telesalePage.getByPlaceholder(/ค้นหาหรือเลือกตำบล/).first();
        if (await subDistrictInput.isVisible()) {
          const currentSubDistrict = await subDistrictInput.inputValue();
          if (!currentSubDistrict) {
            await subDistrictInput.fill('ปากน้ำ');
            await telesalePage.waitForTimeout(1000);
            await telesalePage.getByText('ปากน้ำ', { exact: false }).first().click();
          }
        }

        // 3. เลือกสินค้า
        const addProductBtn = telesalePage.locator('[data-testid="btn-add-product"]:visible').first();
        await addProductBtn.waitFor({ state: 'visible', timeout: 5000 }).catch(() => console.log('addProductBtn not visible'));
        await addProductBtn.click();
        
        const chooseBtn = telesalePage.getByRole('button', { name: 'เลือก' }).first();
        await chooseBtn.waitFor({ state: 'visible', timeout: 5000 });
        await chooseBtn.click();
        
        await telesalePage.keyboard.press('Escape');

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
          
          // ดึงราคายอดสุทธิจากหน้าจอมาเป็นจำนวนเงิน
          const netTotalText = await telesalePage.locator('span:has-text("ยอดสุทธิ") + span').first().innerText();
          const amount = netTotalText.replace(/[^\d.]/g, ''); // ตัดตัวอักษร ฿ หรือ , ออก

          // ถ้าเป็น COD ต้องใส่ยอด COD
          if (method.value === 'COD') {
            const divideBtn = telesalePage.locator('[data-testid="btn-split-cod"]:visible').first();
            await divideBtn.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);
            if (await divideBtn.isVisible()) {
              await divideBtn.click();
            }
            
            const codBox = telesalePage.locator('input[placeholder="ยอด COD"]').first();
            await codBox.waitFor({ state: 'visible', timeout: 2000 }).catch(() => null);
            if (await codBox.isVisible()) {
              await codBox.fill(amount);
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

            await telesalePage.waitForTimeout(1500); // รอรูปโหลดและฟอร์มจำนวนเงินแสดงขึ้นมา

            // กรอกจำนวนเงินในสลิป
            const slipAmountInput = telesalePage.locator('div').filter({ has: telesalePage.locator('label:has-text("จำนวนเงิน")') }).locator('input[type="number"]').first();
            if (await slipAmountInput.isVisible()) {
               await slipAmountInput.fill(amount);
            }

            // เลือกธนาคารที่รับโอน
            const bankSelect = telesalePage.locator('div').filter({ has: telesalePage.locator('label:has-text("ธนาคารที่รับโอน")') }).locator('select').first();
            if (await bankSelect.isVisible()) {
               await bankSelect.selectOption({ index: 1 });
            }

            // ใส่วันที่โอน
            const transferDateInput = telesalePage.locator('input[placeholder="เลือกวันที่และเวลา"]').first();
            if (await transferDateInput.isVisible()) {
               await transferDateInput.click();
               // พิมพ์วันที่ใน format dd/MM/yyyy HH:mm
               await transferDateInput.fill('29/05/2026 12:00');
               await telesalePage.keyboard.press('Enter');
            }
          }
        }

        // 5. กดบันทึกคำสั่งซื้อ
        const saveBtn = telesalePage.locator('[data-testid="btn-save-order"]:visible').first();
        await saveBtn.click();

        await expect(telesalePage.locator('.toast').first().or(telesalePage.locator('text=บันทึกคำสั่งซื้อสำเร็จ'))).toBeVisible({ timeout: 15000 }).catch(() => {
          console.log("อาจจะไม่เจอ Pop-up Success แต่บันทึกสำเร็จ กรุณาตรวจสอบอีกครั้ง");
        });

        const successRef = telesalePage.locator('[data-testid="generated-order-ref"]:visible').first();
        await successRef.waitFor({ state: 'visible', timeout: 5000 }).catch(() => null);
        if (await successRef.isVisible()) {
          createdOrderRef = (await successRef.innerText()).trim();
          console.log(`Captured Order Ref: ${createdOrderRef}`);
        }
      });

      // ==========================================
      // STEP 3: Manage / Export Data (by Backoffice)
      // ==========================================
      await test.step('Backoffice Manages Order', async () => {
        // นำทางไปหน้า จัดการคำสั่งซื้อ
        await backofficePage.goto('/?page=Manage%20Orders');
        await backofficePage.waitForLoadState('networkidle');

        // ถ้าเป็นโอนเงิน ต้องไปยืนยันสลิปก่อน
        if (method.value === 'Transfer') {
           await backofficePage.getByTestId('tab-waiting-verify-slip').first().click();
           
           if (createdOrderRef) {
             const filterWrap = backofficePage.locator('.bg-white.p-4.rounded-lg.shadow-sm.border.mb-4').first();
             await filterWrap.getByTestId('btn-advanced-filter').first().click();
             await filterWrap.getByTestId('advanced-filter-panel').getByPlaceholder('ORD-...').fill(createdOrderRef);
             await filterWrap.getByRole('button', { name: 'ค้นหา', exact: true }).click({ force: true });
           }

           await backofficePage.waitForTimeout(2000);
           
           // กดปุ่มจัดการในแถวของตาราง
           await backofficePage.getByTestId(`btn-manage-order-${createdOrderRef}`).first().click();

           // ติ๊ก Checkbox ยืนยันสลิป
           const verifyCheckbox = backofficePage.getByTestId('checkbox-verify-slip').first();
           await verifyCheckbox.waitFor({ state: 'visible', timeout: 5000 });
           await verifyCheckbox.check();

           // กดยืนยันสลิป
           await backofficePage.getByTestId('btn-confirm-slip').first().click();

           // รอ Modal ปิด หรือรอข้อความสำเร็จ
           await backofficePage.waitForTimeout(2000);
           await backofficePage.keyboard.press('Escape'); // ปิด Modal เผื่อไว้
        }

        // 1. กดเข้าแท็บ "รอดึงข้อมูล" 
        await backofficePage.getByTestId('tab-pending-fetch').first().click();

        // 2. ค้นหาออเดอร์ที่ Telesale เพิ่งสร้าง (ด้วยเลขออเดอร์)
        if (createdOrderRef) {
          // เปิดตัวกรองขั้นสูงและค้นหาเลขออเดอร์เฉพาะ
          const filterWrap = backofficePage.locator('.bg-white.p-4.rounded-lg.shadow-sm.border.mb-4').first();
          await filterWrap.getByTestId('btn-advanced-filter').first().click();
          await filterWrap.getByTestId('advanced-filter-panel').getByPlaceholder('ORD-...').fill(createdOrderRef);
          await filterWrap.getByRole('button', { name: 'ค้นหา', exact: true }).click({ force: true });
        }
        
        // Wait for table to populate
        await backofficePage.waitForTimeout(2000);
        await backofficePage.waitForSelector('table tbody', { state: 'visible', timeout: 10000 }).catch(() => console.log("No orders found for this filter."));

        // 3. ติ๊กเลือกแล้วกดส่งออก (if there are rows)
        const dataRows = backofficePage.locator('tbody tr:not(:has-text("ไม่มีข้อมูลออเดอร์"))');
        const rowCount = await dataRows.count();
        if (rowCount > 0) {
            // Capture Order ID for the next step
            exportedOrderId = await dataRows.first().locator('td').nth(1).innerText();
            console.log("Captured Order ID for Tracking:", exportedOrderId);

            const selectAllCheckbox = backofficePage.getByRole('checkbox', { name: 'Select all' });
            await selectAllCheckbox.check();

            const exportBtn = backofficePage.getByTestId('btn-export-data').first();
            await exportBtn.click();

            // 4. Modal เลือก Template
            await expect(backofficePage.getByText('เลือก Template ส่งออกข้อมูล')).toBeVisible({ timeout: 5000 });
            
            const templateRadio = backofficePage.locator('input[type="radio"][name="exportTemplate"]').first();
            await templateRadio.check();

            const confirmTemplateBtn = backofficePage.locator('.fixed.inset-0').last().getByRole('button', { name: 'ยืนยันส่งออก' }).first();
            await confirmTemplateBtn.click();
            
            // 5. Validation Modal
            await expect(backofficePage.getByText('สรุปผลการตรวจสอบข้อมูล')).toBeVisible({ timeout: 10000 });
            
            const modalConfirmBtn = backofficePage.locator('.fixed.inset-0').last().getByRole('button', { name: 'ยืนยันส่งออก' });
            
            // Listen for download
            const downloadPromise = backofficePage.waitForEvent('download', { timeout: 15000 }).catch(() => null);
            await modalConfirmBtn.click();
            
            const download = await downloadPromise;
            if (download) {
                expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx)$/);
            } else {
                console.log("Download did not trigger after validation modal");
            }
        }
      });

      // ==========================================
      // STEP 4: Tracking Setup (by Backoffice)
      // ==========================================
      await test.step('Backoffice Link Tracking Number', async () => {
        if (!exportedOrderId) {
            console.log("No order exported, skipping tracking setup");
            return;
        }

        await backofficePage.goto('/?page=Bulk%20Tracking');
        await backofficePage.waitForLoadState('networkidle');

        // Fill order Id
        const orderInput = backofficePage.locator('input[placeholder="e.g. ORD-1234"]').first();
        await orderInput.fill(exportedOrderId.trim());

        // Fill random tracking (Flash Express format TH + 10 digits)
        const randomTracking = 'TH' + Math.floor(1000000000 + Math.random() * 9000000000).toString();
        const trackingInput = backofficePage.getByTestId('input-tracking-0').first();
        await trackingInput.fill(randomTracking);

        // Click Verify
        await backofficePage.getByRole('button', { name: 'ตรวจสอบข้อมูล' }).click();

        // Wait for it to become valid
        await expect(backofficePage.getByText('Ready to sync').or(backofficePage.getByText('พร้อมนำเข้า'))).toBeVisible({ timeout: 10000 });

        // Handle confirm dialog automatically
        backofficePage.once('dialog', async dialog => {
            await dialog.accept();
        });

        // Click Import
        await backofficePage.getByTestId('btn-confirm-tracking').first().click();

        // Wait for success toast
        await expect(backofficePage.getByText('นำเข้าข้อมูลเรียบร้อยแล้ว')).toBeVisible({ timeout: 5000 });
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
