import { Page, Locator, expect } from '@playwright/test';

export class CustomerGradePage {
  readonly page: Page;
  
  // Navigation
  readonly manageCustomersNav: Locator;
  readonly gradesTab: Locator;

  // Grade settings locators
  readonly addGradeBtn: Locator;
  readonly saveSettingsBtn: Locator;
  readonly recalculateBtn: Locator;
  readonly confirmRecalculateBtn: Locator;
  
  // Calculation mode locators
  readonly calcModeSelect: Locator;
  readonly relativeRadio: Locator;
  readonly fixedRadio: Locator;
  readonly relativeDaysInput: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Using exact text for navigation based on known UI
    this.manageCustomersNav = page.getByText('คำสั่งซื้อและลูกค้า').first();
    this.gradesTab = page.getByText('ตั้งค่าระดับลูกค้า (Grade)');
    
    // Action buttons
    this.addGradeBtn = page.getByRole('button', { name: 'เพิ่มระดับเกรด' });
    this.saveSettingsBtn = page.getByRole('button', { name: 'บันทึกการตั้งค่า' });
    this.recalculateBtn = page.getByRole('button', { name: 'ประมวลผลเกรดลูกค้าทั้งหมด' });
    this.confirmRecalculateBtn = page.getByRole('button', { name: 'เริ่มประมวลผล' });
    
    // Calc settings
    this.calcModeSelect = page.locator('#calcModeSelect');
    this.fixedRadio = page.getByText('กำหนดวันที่คงที่');
    this.relativeRadio = page.getByText('นับย้อนหลัง x วัน');
    this.relativeDaysInput = page.locator('input[type="number"]').filter({ hasText: '' }).last(); // Since it's near "วัน นับจากปัจจุบัน"
  }

  async goto() {
    await this.page.goto('/');
    
    // Click Manage Customers menu -> Customers
    const manageCustomersGroup = this.page.getByText('คำสั่งซื้อและลูกค้า').first();
    if (await manageCustomersGroup.isVisible()) {
      // It might be a collapsible menu
      await manageCustomersGroup.click();
    }
    await this.page.getByText('ลูกค้า', { exact: true }).first().click();

    // Click on Grades Tab
    await this.gradesTab.click();
    
    // Wait for manager to load
    await expect(this.page.getByText('จัดการเกณฑ์ระดับลูกค้า')).toBeVisible({ timeout: 10000 });
  }

  async setGradeData(index: number, name: string, minAmount: number, colorTheme: string) {
    // The table has rows. We find the specific row inputs.
    // Index is 0-based for the list of grades.
    const rows = this.page.locator('tbody tr').filter({ has: this.page.locator('input[type="text"]') });
    const targetRow = rows.nth(index);
    
    await targetRow.locator('input[type="text"]').fill(name);
    await targetRow.locator('input[type="number"]').fill(minAmount.toString());
    await targetRow.locator('select').selectOption(colorTheme);
  }

  async getGradeRowValues(index: number) {
    const rows = this.page.locator('tbody tr').filter({ has: this.page.locator('input[type="text"]') });
    const targetRow = rows.nth(index);
    
    const name = await targetRow.locator('input[type="text"]').inputValue();
    const amount = await targetRow.locator('input[type="number"]').inputValue();
    return { name, amount: parseFloat(amount) };
  }

  async saveAndExpectSuccess() {
    await this.saveSettingsBtn.click();
    await expect(this.page.getByText('บันทึกข้อมูลเรียบร้อย')).toBeVisible({ timeout: 10000 });
  }

  async recalculateAndExpectSuccess() {
    await this.recalculateBtn.click();
    await this.confirmRecalculateBtn.click();
    await expect(this.page.getByText(/อัปเดตเกรดลูกค้าสำเร็จ|ประมวลผลเสร็จสมบูรณ์/)).toBeVisible({ timeout: 15000 });
  }
}
