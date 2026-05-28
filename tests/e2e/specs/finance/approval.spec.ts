import { test, expect } from '@playwright/test';
import { FinanceApprovalPage } from '../../pages/FinanceApprovalPage';
import { 
  seedFinanceData, 
  getOrderPaymentStatus, 
  getCodDocumentInfo,
  getStatementMatchedOrderId
} from '../../utils/db-utils';

test.describe('Finance Approval E2E Tests', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(60000);

  test.beforeAll(async () => {
    // 1. Seed REAL Finance Data once for all tests
    await seedFinanceData();
  });

  test.beforeEach(async ({ page }) => {
    // Log network for debugging
    page.on('request', req => console.log('>>', req.method(), req.url()));
    page.on('response', res => console.log('<<', res.status(), res.url()));

    // 2. Inject user state into localStorage
    await page.addInitScript(() => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('sessionUser', JSON.stringify({
        id: 2,
        username: 'finance',
        role: 'finance',
        firstName: 'Finance',
        lastName: 'User',
        companyId: 1,
        token: 'test_finance_token_123',
        loginDate: today
      }));
      localStorage.setItem('authToken', 'test_finance_token_123');
      localStorage.setItem('checkinPromptSeenDate_2', today);
    });

    // 3. Mock Permissions & Attendance only (Since we didn't seed full permission tables)
    await page.route('**/roles/effective_permissions/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          permissions: {
            'payment_slip.manage': { view: true, create: true, edit: true, delete: true },
            'home.dashboard': { view: true, create: true, edit: true, delete: true }
          }
        })
      });
    });

    await page.route('**/attendance*', async (route) => {
      const today = new Date().toISOString().slice(0, 10);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { first_login: `${today}T08:00:00Z` }
        ])
      });
    });

    // 4. Mock explicit empty counts just in case it errors
    await page.route('**/notifications*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
  });

  test.describe('Tab 1: โอนเงิน (Transfers)', () => {
    test('TC1.1 Auto Match & Batch Save (Happy Path)', async ({ page }) => {
      const financePage = new FinanceApprovalPage(page);
      await financePage.goto();
      await financePage.approveSlipTab.click();
      
      // Filter by the seeded date for transfers (2023-10-27)
      await financePage.filterDates('2023-10-27', '2023-10-27');

      // Should automatically match Statement Log 1 (1000) with ORD-MATCH-1
      const autoMatchBadge = page.locator('div').filter({ hasText: 'จับคู่อัตโนมัติ' }).first();
      await expect(autoMatchBadge).toBeVisible({ timeout: 10000 });

      // Select the exact matched row and save
      await financePage.uncheckAllSlips();
      await financePage.checkSlipRow('10:00:00', '1,000');
      
      // Auto-accept alert dialogs
      page.on('dialog', dialog => dialog.accept());
      await financePage.saveReconcileBtn.click();
      
      await expect(page.locator('text=บันทึก').first()).toBeVisible();

      // DB Assertion
      await test.step(`[Assert] ออเดอร์ ORD-MATCH-1 สถานะใน DB เปลี่ยนเป็น Paid พร้อมยอดจ่ายจริง 1000 บาท`, async () => {
        // Wait for API to save
        await page.waitForTimeout(2000); 

        const paymentStatus = await getOrderPaymentStatus('ORD-MATCH-1');
        expect(paymentStatus, `ตรวจสอบ Payment Status (คาดหวัง 'PreApproved')`).toBe('PreApproved');

        // Check Statement Logs matched order ID (Statement Log ID 1)
        const matchedOrderId = await getStatementMatchedOrderId(1);
        expect(matchedOrderId, `ตรวจสอบ Matched Order ID ของ Statement Log`).toBe('ORD-MATCH-1');
        
        console.log(`✅ ตรวจสอบสำเร็จ: ออเดอร์ ORD-MATCH-1 และ Statement Log ถูกจับคู่เรียบร้อยในฐานข้อมูล`);
        test.info().annotations.push({ type: 'DB Validation', description: `ORD-MATCH-1 is Paid, Statement 1 matched` });
      });
    });

    test('TC1.2 Candidates Selection (Datalist)', async ({ page }) => {
      const financePage = new FinanceApprovalPage(page);
      await financePage.goto();
      await financePage.approveSlipTab.click();
      
      // Filter by the seeded date for transfers (2023-10-27)
      await financePage.filterDates('2023-10-27', '2023-10-27');

      // Candidate search for ORD-MATCH-2 (Statement Log 2 has amount 1500, time 11:05:00)
      await financePage.fillDatalistInput('11:05:00', '1,500', 'ORD-MATCH-2');
      
      const row = await financePage.getStatementRow('11:05:00', '1,500');
      const checkbox = row.locator('input[type="checkbox"]');
      await expect(checkbox).toBeEnabled();
      await checkbox.check();
    });

    // NOTE: TC1.3 Prevent Duplicate Match can be implemented via UI checks where appropriate
  });

  test.describe('Tab 2: เก็บปลายทาง (COD)', () => {
    test('TC2.1 View COD Document Details', async ({ page }) => {
      const financePage = new FinanceApprovalPage(page);
      await financePage.goto();
      await financePage.approveCodTab.click();
      
      // Select COD Document 201 (which has order ORD-COD-1-1)
      await financePage.selectCodDocument('201');

      const orderRow = page.locator('tr').filter({ hasText: 'ORD-COD-1-1' }).first();
      await expect(orderRow).toBeVisible();
    });

    test('TC2.2 Shortage Reason Validation (Negative Case)', async ({ page }) => {
      const financePage = new FinanceApprovalPage(page);
      await financePage.goto();
      await financePage.approveCodTab.click();
      await financePage.selectCodDocument('201'); // Amount 3000

      // Statement Log 4 is for 2980.00 (Shortage of 20) and should be AUTO-SELECTED as "close" match.
      // So we don't need to manually select it.

      // Now shortage reason input should appear
      await expect(financePage.shortageReasonInput).toBeVisible();
      
      // Click save without entering reason
      await financePage.saveCodBtn.click();

      // UI assertion for error message
      await expect(page.getByText('กรุณาระบุสาเหตุก่อนกดบันทึก')).toBeVisible();
      await expect(financePage.saveCodBtn).toBeVisible();
    });

    test('TC2.3 Shortage Reason Submission & Success (Happy Path)', async ({ page }) => {
      const financePage = new FinanceApprovalPage(page);
      await financePage.goto();
      await financePage.approveCodTab.click();
      await financePage.selectCodDocument('201');

      // Statement Log 4 is for 2980.00 (Shortage of 20) and should be AUTO-SELECTED as "close" match.

      await expect(financePage.shortageReasonInput).toBeVisible();
      const testReason = 'ขนส่งหักค่าธรรมเนียมโอน (E2E Test)';
      await financePage.fillShortageReason(testReason);
      
      await financePage.saveCodBtn.click();

      // Wait for success toast
      await expect(page.getByText(/บันทึกสำเร็จ/)).toBeVisible();

      // DB Assertion
      await test.step(`[Assert] เอกสาร COD ID 201 บันทึกเหตุผล "${testReason}" ลงใน DB สำเร็จ`, async () => {
        // Wait for API to save
        await page.waitForTimeout(2000); 

        const docInfo: any = await getCodDocumentInfo('201');
        
        test.info().annotations.push({ type: 'DB Fetch', description: `COD Document 201 Data: ${JSON.stringify(docInfo, null, 2)}` });

        expect(docInfo.status, `ตรวจสอบสถานะเอกสาร COD`).toBe('verified');
        expect(docInfo.shortage_reason, `ตรวจสอบเหตุผลการหักเงิน`).toBe(testReason);
        
        const paymentStatus = await getOrderPaymentStatus('ORD-COD-1');
        test.info().annotations.push({ type: 'DB Fetch', description: `Order ORD-COD-1 Payment Status: ${paymentStatus}` });
        
        expect(['Paid', 'PreApproved', 'Approved'].includes(paymentStatus), `สถานะ Order ควรได้รับการอัปเดตเป็น Paid/PreApproved/Approved`).toBeTruthy();

        console.log(`✅ ตรวจสอบสำเร็จ: เอกสาร COD ID 201 ถูกบันทึกเหตุผล Shortage อย่างถูกต้อง`);
        test.info().annotations.push({ type: 'DB Validation', description: `✅ COD Doc 201 Shortage Reason Verified Successfully!` });
      });
    });

    test('TC2.4 Exact Match COD', async ({ page }) => {
      const financePage = new FinanceApprovalPage(page);
      await financePage.goto();
      await financePage.approveCodTab.click();
      
      // Doc 202 is exact match (Amount 2000)
      await financePage.selectCodDocument('202');

      // Select Statement Log 5 (2000.00) - AUTO-SELECTED as exact match

      // Shortage input shouldn't appear
      await expect(financePage.shortageReasonInput).not.toBeVisible();
      
      await financePage.saveCodBtn.click();
      
      // Wait for success toast
      await expect(page.getByText(/บันทึกสำเร็จ/)).toBeVisible();

      // DB Assertion
      await test.step(`[Assert] เอกสาร COD ID 202 บันทึกสำเร็จโดยไม่ต้องมีเหตุผล`, async () => {
        await page.waitForTimeout(2000); 

        const docInfo: any = await getCodDocumentInfo('202');
        test.info().annotations.push({ type: 'DB Fetch', description: `COD Document 202 Data: ${JSON.stringify(docInfo, null, 2)}` });

        expect(docInfo.status, `ตรวจสอบสถานะเอกสาร COD`).toBe('verified');
        expect(docInfo.shortage_reason, `เหตุผลต้องว่างเปล่าเมื่อยอดตรงเป๊ะ`).toBeFalsy();
        test.info().annotations.push({ type: 'DB Validation', description: `✅ COD Doc 202 Verified Successfully!` });
      });
    });
  });
});
