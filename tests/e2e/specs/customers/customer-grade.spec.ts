import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { wipeCustomerGradeTestData, seedBasicCustomersAndOrders, getCustomerGrade, getCustomerInfo } from '../../utils/db-utils';
import { CustomerGradePage } from '../../pages/CustomerGradePage';
import { CreateOrderPage } from '../../pages/CreateOrderPage';

test.describe('Customer Grade E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });

  // Use admin auth state for all tests in this suite to manage grades
  test.use({ storageState: 'playwright/.auth/Backoffice.json' });

  test.setTimeout(60000);

  test.beforeAll(async () => {
    // Setup isolated DB environment
    await wipeCustomerGradeTestData();
    await seedBasicCustomersAndOrders();
  });

  test.afterAll(async () => {
    // Clean up if needed, though beforeAll already wipes it
  });

  test.describe('1. UI & Validation (Customer Grade Manager)', () => {
    test('TC-UI-01: Create Grade', async ({ page }) => {
      const gradePage = new CustomerGradePage(page);
      await gradePage.goto();

      // Clear existing grades if any
      while (await page.locator('tbody tr button[title="ลบ"]').count() > 0) {
        await page.locator('tbody tr button[title="ลบ"]').first().click();
      }

      await gradePage.addGradeBtn.click();
      await gradePage.setGradeData(0, 'VIP', 100000, 'bg-yellow-100 text-yellow-800');
      
      await gradePage.saveAndExpectSuccess();

      // Check it persists (UI)
      const values = await gradePage.getGradeRowValues(0);
      expect(values.name).toBe('VIP');
      expect(values.amount).toBe(100000);
    });

    test('TC-UI-02: Auto-Sort on Save', async ({ page }) => {
      const gradePage = new CustomerGradePage(page);
      await gradePage.goto();

        // Add two grades out of order
        // Row 0 already exists (from previous test or default)
        await gradePage.setGradeData(0, 'Silver', 5000, 'bg-gray-100 text-gray-800');
        
        await gradePage.addGradeBtn.click();
        await gradePage.setGradeData(1, 'Gold', 150000, 'bg-yellow-100 text-yellow-800');

      await gradePage.saveAndExpectSuccess();

      // It should auto-sort, Gold (150,000) should be first
      const row0 = await gradePage.getGradeRowValues(0);
      const row1 = await gradePage.getGradeRowValues(1);

      expect(row0.name).toBe('Gold');
      expect(row0.amount).toBe(150000);
      
      expect(row1.name).toBe('Silver');
      expect(row1.amount).toBe(5000);
    });
  });

  test.describe('2. Calculation Logic', () => {
    test('TC-CALC-01: Fixed Date', async ({ page }) => {
      const gradePage = new CustomerGradePage(page);
      await gradePage.goto();

      // Set calculation mode to delivery_date, fixed range (2026-01-01 to 2026-12-31)
      await gradePage.calcModeSelect.selectOption('delivery_date');
      await gradePage.fixedRadio.check();
      await page.locator('input[type="date"]').nth(0).fill('2026-01-01');
      await page.locator('input[type="date"]').nth(1).fill('2026-12-31');

      // Clear existing grades and create test grades
      while (await page.locator('tbody tr button[title="ลบ"]').count() > 0) {
        await page.locator('tbody tr button[title="ลบ"]').first().click();
      }
      
      await gradePage.addGradeBtn.click();
      // Total in 2026 for Customer 1 is 20,000. It shouldn't include 2025's 10,000.
      await gradePage.setGradeData(0, 'Yearly VIP', 15000, 'bg-yellow-100 text-yellow-800'); 
      await gradePage.addGradeBtn.click();
      await gradePage.setGradeData(1, 'Yearly VVIP', 25000, 'bg-purple-100 text-purple-800');

      await gradePage.saveAndExpectSuccess();
      
      // Trigger recalculation
      await gradePage.recalculateAndExpectSuccess();

      // Verify DB directly
      const customer = await getCustomerInfo(1);
      
      test.info().annotations.push({
        type: 'Condition Context',
        description: `ลูกค้า: ${customer.first_name} ${customer.last_name}\nยอดซื้อสะสม: ${Number(customer.total_amount).toLocaleString()} บาท\nเกรดปัจจุบัน: ${customer.grade}`
      });

      await test.step(`[Assert] ลูกค้า ID 1 มียอด ${Number(customer.total_amount).toLocaleString()} บาท ต้องถูกปรับเป็น 'Yearly VIP'`, async () => {
        // 20,000 > 15,000 (Yearly VIP), but < 25,000 (Yearly VVIP)
        expect(customer.grade, `ตรวจสอบเกรดใน DB (คาดหวัง 'Yearly VIP')`).toBe('Yearly VIP');
        console.log(`✅ ตรวจสอบสำเร็จ: ลูกค้า ID 1 อยู่ในเกรด '${customer.grade}' ตรงตามเงื่อนไข (ยอด ${customer.total_amount} บาท)`);
      });
    });

    test('TC-CALC-02: Relative Days', async ({ page }) => {
      const gradePage = new CustomerGradePage(page);
      await gradePage.goto();

      // Set calculation mode to delivery_date, relative 30 days
      await gradePage.calcModeSelect.selectOption('delivery_date');
      await gradePage.relativeRadio.check();
      await page.locator('input[type="number"]').last().fill('30');

      // Clear existing grades and create test grades
      while (await page.locator('tbody tr button[title="ลบ"]').count() > 0) {
        await page.locator('tbody tr button[title="ลบ"]').first().click();
      }
      
      await gradePage.addGradeBtn.click();
      // Total last 30 days for Customer 2 is 10,000. Total 40 days ago is 20,000. 
      // It should only count 10,000.
      await gradePage.setGradeData(0, 'Active Bronze', 5000, 'bg-gray-100 text-gray-800'); 
      await gradePage.addGradeBtn.click();
      await gradePage.setGradeData(1, 'Active Silver', 15000, 'bg-gray-100 text-gray-800');

      await gradePage.saveAndExpectSuccess();
      
      // Trigger recalculation
      await gradePage.recalculateAndExpectSuccess();

      // Verify DB directly
      const customer = await getCustomerInfo(2);

      test.info().annotations.push({
        type: 'Condition Context',
        description: `ลูกค้า: ${customer.first_name} ${customer.last_name}\nยอดซื้อสะสม: ${Number(customer.total_amount).toLocaleString()} บาท\nเกรดปัจจุบัน: ${customer.grade}`
      });

      await test.step(`[Assert] ลูกค้า ID 2 มียอด ${Number(customer.total_amount).toLocaleString()} บาท ต้องถูกปรับเป็น 'Active Bronze'`, async () => {
        // 10,000 > 5,000 (Active Bronze), but < 15,000 (Active Silver)
        expect(customer.grade, `ตรวจสอบเกรดใน DB (คาดหวัง 'Active Bronze')`).toBe('Active Bronze');
        console.log(`✅ ตรวจสอบสำเร็จ: ลูกค้า ID 2 อยู่ในเกรด '${customer.grade}' ตรงตามเงื่อนไข (ยอด ${customer.total_amount} บาท)`);
      });
    });
  });

  test.describe('3. Real-time Updates', () => {
    // For creating an order we need Telesale auth context
    test('TC-RT-01: Update instantly on order creation', async ({ browser }) => {
      // First, set up the grade as admin
      const adminContext = await browser.newContext({ storageState: 'playwright/.auth/Backoffice.json' });
      const adminPage = await adminContext.newPage();
      const gradePage = new CustomerGradePage(adminPage);
      await gradePage.goto();

      await gradePage.calcModeSelect.selectOption('all');

      while (await adminPage.locator('tbody tr button[title="ลบ"]').count() > 0) {
        await adminPage.locator('tbody tr button[title="ลบ"]').first().click();
      }
      await gradePage.addGradeBtn.click();
      await gradePage.setGradeData(0, 'Super VIP', 0, 'bg-purple-100 text-purple-800');
      await gradePage.saveAndExpectSuccess();
      await adminContext.close();

      // Now create an order as Admin (Backoffice)
      const telesaleContext = await browser.newContext({ storageState: 'playwright/.auth/Backoffice.json' });
      const telesalePage = await telesaleContext.newPage();
      const createOrderPage = new CreateOrderPage(telesalePage);
      
      await createOrderPage.goto();
        // Customer A (Phone: 0811111111)
        await createOrderPage.searchCustomer('0811111111');
        
        // Add product
        await createOrderPage.addRealProduct();
        
        await createOrderPage.selectPaymentMethod('Transfer');
        await createOrderPage.uploadSlip(0);
        
        // Fill required fields like channel, status, delivery date
        const netTotal = await createOrderPage.getNetTotalAmount();
        await createOrderPage.fillSlipDetails(0, '1', netTotal);
        
        const statusSelect = telesalePage.locator('select').filter({ has: telesalePage.locator('option', { hasText: /ลูกค้าใหม่|ซื้อซ้ำ|อัพเซล/ }) }).first();
        await statusSelect.selectOption({ index: 1 });
        const deliveryInput = telesalePage.getByPlaceholder('เลือกวันที่จัดส่ง').first();
        await deliveryInput.click();
        await telesalePage.waitForTimeout(500);
        const today = new Date();
        const dd = String(today.getDate()).padStart(2, '0');
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const yyyy = today.getFullYear();
        await deliveryInput.fill(`${dd}/${mm}/${yyyy}`);
        await deliveryInput.press('Enter');
        await telesalePage.keyboard.press('Escape');
        
        await createOrderPage.fillRequiredOrderFields();

      await createOrderPage.saveBtn.click();
      await expect(createOrderPage.successModal.or(telesalePage.locator('.toast').first())).toBeVisible({ timeout: 15000 });

      // Verify DB immediately
      const customer = await getCustomerInfo(1);

      test.info().annotations.push({
        type: 'Condition Context',
        description: `ลูกค้า: ${customer.first_name} ${customer.last_name}\nยอดซื้อสะสม: ${Number(customer.total_amount).toLocaleString()} บาท\nเกรดปัจจุบัน: ${customer.grade}`
      });

      await test.step(`[Assert] ลูกค้า ID 1 มียอด ${Number(customer.total_amount).toLocaleString()} บาท ต้องถูกเลื่อนขั้นเป็น 'Super VIP' แบบ Real-time`, async () => {
        expect(customer.grade, `ตรวจสอบเกรดใน DB (คาดหวัง 'Super VIP')`).toBe('Super VIP');
        console.log(`✅ ตรวจสอบสำเร็จ (Real-time): ลูกค้า ID 1 ถูกเลื่อนขั้นเป็นเกรด '${customer.grade}' ทันทีหลังสร้างออเดอร์ (ยอด ${customer.total_amount} บาท)`);
      });

      await telesaleContext.close();
    });
  });

  test.describe('4. Multi-tenant', () => {
    test('TC-MULTI-01: Isolation across companies', async ({ page }) => {
      // Create grade for company 1 (current admin)
      const gradePage = new CustomerGradePage(page);
      await gradePage.goto();

      while (await page.locator('tbody tr button[title="ลบ"]').count() > 0) {
        await page.locator('tbody tr button[title="ลบ"]').first().click();
      }
      await gradePage.addGradeBtn.click();
      await gradePage.setGradeData(0, 'A-Grade', 100, 'bg-red-100 text-red-800');
      await gradePage.saveAndExpectSuccess();

      // Read DB using another auth (admin_co2) which belongs to company 2
      // We don't have a login spec for admin_co2 easily, so we will use the DB directly to verify config
      const { getCo2Grades } = await import('../../utils/db-utils');
      
      const co2Grades = await getCo2Grades();
      
      // It should be empty or default, NOT "A-Grade"
      const hasAGrade = co2Grades.some(g => g.grade_name === 'A-Grade');
      expect(hasAGrade).toBeFalsy();
    });
  });
  test.describe('5. Cron Job', () => {
    test('TC-CRON-01: Auto-update grades via Cron Script', async ({ page }) => {
      // First, we set up a condition where customer 1 should be downgraded
      const gradePage = new CustomerGradePage(page);
      await gradePage.goto();
      
      // Set to relative 30 days
      await gradePage.calcModeSelect.selectOption('delivery_date');
      await gradePage.relativeRadio.check();
      await page.locator('input[type="number"]').last().fill('30');
      
      while (await page.locator('tbody tr button[title="ลบ"]').count() > 0) {
        await page.locator('tbody tr button[title="ลบ"]').first().click();
      }
      
      // Customer 1 has order from today (created in Real-time test) of 150k + older orders.
      // Wait, in previous tests we added order for Customer 1. 
      // Let's set high threshold so they fall back to normal.
      await gradePage.addGradeBtn.click();
      await gradePage.setGradeData(0, 'Normal', 0, 'bg-gray-100 text-gray-800');
      await gradePage.addGradeBtn.click();
      await gradePage.setGradeData(1, 'Mega VIP', 9999999, 'bg-red-100 text-red-800');
      await gradePage.saveAndExpectSuccess();
      
      // Let's manually set Customer 1's grade to 'Old VIP' in DB to simulate old data
      execSync('php tests/e2e/utils/db-setup.php set_customer_grade 1 "Old VIP"');
      
      let preCustomer = await getCustomerInfo(1);
      expect(preCustomer.grade).toBe('Old VIP');

      // Execute Cron Script
      let output = '';
      await test.step('Run CLI command: php api/cron/recalculate_all_grades.php', async () => {
        output = execSync('php api/cron/recalculate_all_grades.php').toString();
        test.info().annotations.push({ type: 'CLI Output', description: output });
      });

      // Verify output
      expect(output).toContain('Successfully updated');

      // Verify DB
      const postCustomer = await getCustomerInfo(1);
      test.info().annotations.push({
        type: 'Condition Context',
        description: `ลูกค้า: ${postCustomer.first_name} ${postCustomer.last_name}\nยอดซื้อสะสม (30วัน): ${Number(postCustomer.total_amount).toLocaleString()} บาท\nเกรดปัจจุบัน: ${postCustomer.grade}`
      });

      await test.step(`[Assert] เกรดของลูกค้า ID 1 ต้องถูกปรับลดลงจาก 'Old VIP' เพราะไม่ถึง 9,999,999 บาท`, async () => {
        expect(postCustomer.grade).not.toBe('Old VIP');
        expect(postCustomer.grade).toBe('Normal'); // Default fallback
      });
    });

    test('TC-CRON-02: Dry Run Mode', async () => {
      // Manually set Customer 1's grade to 'Fake Grade' in DB to guarantee a change
      execSync('php tests/e2e/utils/db-setup.php set_customer_grade 1 "Fake Grade"');
      
      let preCustomer = await getCustomerInfo(1);
      expect(preCustomer.grade).toBe('Fake Grade');

      // Execute Cron Script in Dry Run mode
      let output = '';
      await test.step('Run CLI command: php api/cron/recalculate_all_grades.php --dry-run', async () => {
        output = execSync('php api/cron/recalculate_all_grades.php --dry-run').toString();
        test.info().annotations.push({ type: 'CLI Output', description: output });
      });

      // Verify output
      expect(output).toContain('[DRY-RUN]');
      expect(output).toContain('Fake Grade ->');
      expect(output).toContain('Dry Run Complete!');

      // Verify DB remains unchanged
      const postCustomer = await getCustomerInfo(1);
      await test.step(`[Assert] เกรดของลูกค้า ID 1 ต้องไม่ถูกเปลี่ยนแปลง (ยังคงเป็น 'Fake Grade')`, async () => {
        expect(postCustomer.grade).toBe('Fake Grade');
      });
    });
  });
});
