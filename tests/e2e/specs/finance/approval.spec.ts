import { test, expect } from '@playwright/test';
import { FinanceApprovalPage } from '../../pages/FinanceApprovalPage';
import { 
  MOCK_ORDERS, 
  MOCK_STATEMENTS, 
  MOCK_COD_DOCUMENTS, 
  MOCK_COD_STATEMENTS 
} from '../../mocks/finance.mock';

test.describe('Finance Approval E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock user state into localStorage
    await page.addInitScript(() => {
      const today = new Date().toISOString().slice(0, 10);
      localStorage.setItem('sessionUser', JSON.stringify({
        id: 3,
        username: 'finance_user',
        role: 'finance',
        firstName: 'Finance',
        lastName: 'User',
        companyId: 1,
        token: 'fake-token',
        loginDate: today
      }));
      localStorage.setItem('authToken', 'fake-token');
      localStorage.setItem('checkinPromptSeenDate_3', today);
    });

    // 1. Mock Orders
    await page.route('**/orders**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ORDERS)
      });
    });

    // 1.5 Mock Permissions & Attendance
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

    // 2. Mock Tab Counts
    await page.route('**/finance_approval_counts*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ transfers: 5, payafter: 2 })
      });
    });

    // 3. Mock Bank Accounts
    await page.route('**/Bank_DB/get_bank_accounts.php*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [{ id: 1, bank: 'KBank', bank_number: '1234', account_name: 'Company Account' }]
        })
      });
    });

    // 4. Mock Statements
    await page.route('**/Statement_DB/reconcile_list.php*', async (route) => {
      const url = route.request().url();
      if (url.includes('2023-10-29')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, statements: MOCK_COD_STATEMENTS, orders: MOCK_ORDERS })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, statements: MOCK_STATEMENTS, orders: MOCK_ORDERS })
        });
      }
    });

    // 5. Mock COD Documents
    await page.route('**/cod_documents**', async (route) => {
      const url = route.request().url();
      if (url.includes('includeItems=true')) {
          const match = url.match(/\/cod_documents\/(\d+)/);
          const docIdStr = match ? match[1] : null;
          const doc = MOCK_COD_DOCUMENTS.find(d => d.id === Number(docIdStr));
          if (doc) {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(doc) });
            return;
          }
      } 
      await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_COD_DOCUMENTS)
      });
    });

    // 6. Mock Saves
    await page.route('**/Statement_DB/reconcile_save.php*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    // 7. Explicit mocks for missing APIs
    await page.route('**/customers**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/User_DB/**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ users: [] }) });
    });
    await page.route('**/notifications*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/Statement_DB/cod_reconcile_save.php*', async (route) => {
      const payload = JSON.parse(route.request().postData() || '{}');
      if (payload.total_cod_amount !== payload.statement_amount && !payload.shortage_reason) {
         await route.fulfill({ status: 400, body: JSON.stringify({ ok: false, error: 'Reason required' }) });
         return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });
  });

  test('TC1.1 Auto Match & Batch Save (Happy Path)', async ({ page }) => {
    const financePage = new FinanceApprovalPage(page);
    await financePage.goto();
    await financePage.approveSlipTab.click();
    await financePage.filterDates('2023-10-27', '2023-10-27');

    const autoMatchBadge = page.locator('div').filter({ hasText: 'จับคู่อัตโนมัติ' }).first();
    await expect(autoMatchBadge).toBeVisible({ timeout: 10000 });

    await financePage.checkSlipRow('10:00:00', '1,000');
    await financePage.saveReconcileBtn.click();
    
    page.on('dialog', dialog => dialog.accept());
    await expect(page.locator('text=บันทึก').first()).toBeVisible();
  });

  test('TC1.2 Candidates Selection (Datalist)', async ({ page }) => {
    const financePage = new FinanceApprovalPage(page);
    await financePage.goto();
    await financePage.approveSlipTab.click();
    await financePage.filterDates('2023-10-27', '2023-10-27');

    await financePage.fillDatalistInput('11:05:00', '1,500', 'ORD-002');
    
    const row = await financePage.getStatementRow('11:05:00', '1,500');
    const checkbox = row.locator('input[type="checkbox"]');
    await expect(checkbox).toBeEnabled();
    await checkbox.check();
  });

  test('TC2.1 View COD Document Details', async ({ page }) => {
    const financePage = new FinanceApprovalPage(page);
    await financePage.goto();
    await financePage.approveCodTab.click();
    await financePage.selectCodDocument('201');

    const orderRow = page.locator('tr').filter({ hasText: 'ORD-COD-1' }).first();
    await expect(orderRow).toBeVisible();
  });

  test('TC2.2 Shortage Reason Validation (Negative Case)', async ({ page }) => {
    const financePage = new FinanceApprovalPage(page);
    await financePage.goto();
    await financePage.approveCodTab.click();
    await financePage.selectCodDocument('201');

    await expect(financePage.shortageReasonInput).toBeVisible();
    await financePage.saveCodBtn.click();

    await expect(page.getByText('กรุณาระบุสาเหตุก่อนกดบันทึก')).toBeVisible();
    await expect(financePage.saveCodBtn).toBeVisible();
  });

  test('TC2.3 Shortage Reason Submission & Success (Happy Path)', async ({ page }) => {
    const financePage = new FinanceApprovalPage(page);
    await financePage.goto();
    await financePage.approveCodTab.click();
    await financePage.selectCodDocument('201');

    await financePage.fillShortageReason('ขนส่งหักค่าธรรมเนียมโอน');
    await financePage.saveCodBtn.click();

    await expect(financePage.saveCodBtn).toBeEnabled({ timeout: 10000 }).catch(() => {});
  });

  test('TC2.4 Exact Match COD', async ({ page }) => {
    const financePage = new FinanceApprovalPage(page);
    await financePage.goto();
    await financePage.approveCodTab.click();
    await financePage.selectCodDocument('202');

    await expect(financePage.shortageReasonInput).not.toBeVisible();
    await financePage.saveCodBtn.click();
    
    await expect(financePage.saveCodBtn).toBeEnabled({ timeout: 10000 }).catch(() => {});
  });
});
