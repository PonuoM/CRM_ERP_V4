import { Page, Locator, expect } from '@playwright/test';

export class FinanceApprovalPage {
  readonly page: Page;
  
  // Tabs
  readonly approveSlipTab: Locator;
  readonly approveCodTab: Locator;
  
  // Date Filters
  readonly dateInputs: Locator;
  readonly fetchDataBtn: Locator;
  
  // Buttons
  readonly saveReconcileBtn: Locator;
  readonly saveCodBtn: Locator;

  // COD Elements
  readonly codDocSelect: Locator;
  readonly shortageReasonInput: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Locators
    this.approveSlipTab = page.getByText('Approve สลิป').first();
    this.approveCodTab = page.getByText('Approve COD').first();
    this.dateInputs = page.locator('input[type="date"]');
    this.fetchDataBtn = page.getByRole('button', { name: 'ดึงข้อมูล' });
    this.saveReconcileBtn = page.getByRole('button', { name: 'บันทึกการตรวจสอบ' });
    this.saveCodBtn = page.getByRole('button', { name: 'บันทึกตรวจสอบ COD' });
    this.codDocSelect = page.locator('select').filter({ hasText: 'เลือกเลขเอกสาร COD' });
    this.shortageReasonInput = page.getByPlaceholder(/ขนส่งหักค่าธรรมเนียม/);
  }

  async goto() {
    await this.page.goto('/?page=Finance Approval');
  }

  // --- Slips Tab Methods ---

  async filterDates(startDate: string, endDate: string) {
    if (await this.dateInputs.count() >= 2) {
      await this.dateInputs.nth(0).fill(startDate);
      await this.dateInputs.nth(1).fill(endDate);
      const responsePromise = this.page.waitForResponse('**/Statement_DB/reconcile_list.php*');
      await this.fetchDataBtn.click();
      await responsePromise;
    }
  }

  async getStatementRow(timeText: string, amountText: string) {
    return this.page.locator('tr').filter({ hasText: timeText }).filter({ hasText: amountText }).first();
  }

  async uncheckAllSlips() {
    const checkboxes = this.page.locator('tbody input[type="checkbox"]');
    const count = await checkboxes.count();
    for (let i = 0; i < count; i++) {
       if (await checkboxes.nth(i).isChecked()) {
           await checkboxes.nth(i).uncheck();
       }
    }
  }

  async checkSlipRow(timeText: string, amountText: string) {
    const row = await this.getStatementRow(timeText, amountText);
    const checkbox = row.locator('input[type="checkbox"]');
    await expect(checkbox).toBeEnabled();
    if (!(await checkbox.isChecked())) {
        await checkbox.check();
    }
  }

  async fillDatalistInput(timeText: string, amountText: string, orderId: string) {
    const row = await this.getStatementRow(timeText, amountText);
    const orderInput = row.locator('input[list^="order-options-"]');
    await expect(orderInput).toBeVisible();
    await orderInput.fill(orderId);
    await this.page.keyboard.press('Enter');
  }

  // --- COD Tab Methods ---

  async selectCodDocument(docId: string) {
    const responsePromise = this.page.waitForResponse('**/cod_documents**');
    await this.codDocSelect.selectOption(docId);
    await responsePromise;
  }

  async fillShortageReason(reason: string) {
    await this.shortageReasonInput.fill(reason);
  }
}
