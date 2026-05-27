import { Page, Locator, expect } from '@playwright/test';

export class CreateOrderPage {
  readonly page: Page;

  // General Buttons
  readonly saveBtn: Locator;
  readonly saveUpsellBtn: Locator;
  readonly upsellToggleBtn: Locator;
  readonly successModal: Locator;
  readonly successUpsellModal: Locator;

  // Customer Form
  readonly customerSearchInput: Locator;
  readonly customerPhoneInput: Locator;
  readonly editPhoneInput: Locator;
  readonly customerCreateBtn: Locator;
  
  // Products
  readonly addProductBtn: Locator;
  readonly productModalChooseBtn: Locator;
  
  // Payment
  readonly paymentMethodSelect: Locator;
  readonly fileInput: Locator;
  readonly addAnotherSlipBtn: Locator;
  
  // Slip Form
  readonly slipBankSelect: Locator;
  readonly slipDateInput: Locator;
  readonly slipAmountInput: Locator;
  readonly mismatchReasonInput: Locator;

  constructor(page: Page) {
    this.page = page;

    this.saveBtn = page.getByRole('button', { name: /บันทึก|สร้างคำสั่งซื้อ|ยืนยันออเดอร์/ }).first();
    this.saveUpsellBtn = page.getByRole('button', { name: 'บันทึกเพิ่มสินค้า' }).first();
    this.upsellToggleBtn = page.getByRole('button', { name: 'อัปเซล' }).first();
    this.successModal = page.getByText('สร้างคำสั่งซื้อสำเร็จ');
    this.successUpsellModal = page.getByText('สร้างคำสั่งซื้อเพิ่มเติมสำเร็จ');

    this.customerSearchInput = page.getByPlaceholder(/พิมพ์เพื่อค้นหา/).first();
    this.customerPhoneInput = page.getByPlaceholder(/เบอร์โทร/).first();
    this.editPhoneInput = page.getByPlaceholder('กรุณากรอกเบอร์โทรศัพท์').first();
    this.customerCreateBtn = page.getByText(/สร้างรายชื่อใหม่|ไม่พบลูกค้านี้ในระบบ/).first();

    this.addProductBtn = page.getByRole('button', { name: '+ เพิ่มสินค้า' }).first();
    this.productModalChooseBtn = page.getByRole('button', { name: 'เลือก' }).first();

    this.paymentMethodSelect = page.locator('select').filter({ hasText: 'เลือกวิธีการชำระเงิน' }).first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.addAnotherSlipBtn = page.getByRole('button', { name: '+ อัปโหลดสลิปเพิ่ม' }).first();

    this.slipBankSelect = page.locator('select').filter({ hasText: 'เลือกธนาคาร' });
    this.slipDateInput = page.getByPlaceholder('เลือกวันที่และเวลา');
    this.slipAmountInput = page.locator('div').filter({ has: page.locator('label:has-text("จำนวนเงิน")') }).locator('input[type="number"]');
    
    this.mismatchReasonInput = page.getByPlaceholder('เช่น โอนเกิน 2 บิล');
  }

  async goto() {
    await this.page.goto('/?page=CreateOrder');
    
    // Dismiss any acknowledge popups if they exist
    const acknowledgeBtn = this.page.getByRole('button', { name: 'รับทราบ' }).first();
    if (await acknowledgeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acknowledgeBtn.click();
      await this.page.waitForTimeout(500);
    }
    await this.page.keyboard.press('Escape');

    // Wait for the form to appear
    await expect(this.customerSearchInput).toBeVisible({ timeout: 15000 });
  }

  async searchCustomer(phone: string) {
    await this.customerSearchInput.fill(phone);
    await this.page.waitForTimeout(2000); // Wait for debounced search and DB response
    
    // Fallback if not found: create new
    const result = this.page.locator('li').filter({ hasText: phone }).first();
    if (await result.isVisible({ timeout: 5000 }).catch(() => false)) {
      await result.click({ force: true });
      await this.page.waitForTimeout(1000); 
    } else {
      // For Full-Stack, if 0867482639 is missing, we just type it in manually
      const nameInput = this.page.getByPlaceholder(/ชื่อ/).first();
      await nameInput.fill('ลูกค้าเก่า ทดสอบ');
      const phoneInput = this.page.getByPlaceholder(/เบอร์โทร/).first();
      await phoneInput.fill(phone);
      
      const addressInput = this.page.getByPlaceholder(/บ้านเลขที่/).first();
      await addressInput.fill('123 ถนนสุขุมวิท ทดสอบ');
      
      const districtInput = this.page.getByPlaceholder(/ค้นหาหรือเลือกอำเภอ/).first();
      await districtInput.fill('เมืองสมุทรปราการ');
      await this.page.waitForTimeout(1000);
      await this.page.getByText('เมืองสมุทรปราการ', { exact: true }).first().click();

      const subDistrictInput = this.page.getByPlaceholder(/ค้นหาหรือเลือกตำบล/).first();
      await subDistrictInput.fill('ปากน้ำ');
      await this.page.waitForTimeout(1000);
      await this.page.getByText('ปากน้ำ', { exact: true }).first().click();
      
      // Select birthday if visible
      const dobInput = this.page.locator('.react-datepicker__input-container input').first();
      if (await dobInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dobInput.fill('01/01/2530');
        await dobInput.press('Enter');
      }
    }
  }

  async addRealProduct() {
    await this.addProductBtn.click();
    await this.page.waitForTimeout(1000);
    
    const chooseBtn = this.page.getByRole('button', { name: 'เลือก' }).first();
    await expect(chooseBtn).toBeVisible({ timeout: 10000 });
    await chooseBtn.click();
    
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(1000); 
  }

  async getNetTotalAmount(): Promise<string> {
    const netTotalText = await this.page.locator('span:has-text("ยอดสุทธิ") + span').first().innerText();
    return netTotalText.replace(/[^\d.]/g, ''); // Extract numerical amount
  }

  async selectPaymentMethod(method: string) {
    await this.paymentMethodSelect.selectOption(method);
    await this.page.waitForTimeout(1000); 
  }

  async uploadSlip(index: number = 0) {
    const dummyImageBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    
    await this.page.locator('input[type="file"]').nth(index).setInputFiles({
      name: `mock-slip-${index}.png`,
      mimeType: 'image/png',
      buffer: dummyImageBuffer
    });
    await this.page.waitForTimeout(1500); // Wait for upload UI to update
  }

  async fillSlipDetails(index: number, bankId: string, amount: string) {
    // Wait for bank select options to load
    await expect(this.slipBankSelect.nth(index).locator('option').nth(1)).toBeAttached({ timeout: 10000 });
    
    // We select by index 1 to grab the first valid bank instead of hardcoding an ID that might not exist
    await this.slipBankSelect.nth(index).selectOption({ index: 1 });
    
    await this.slipAmountInput.nth(index).fill(amount);
    
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    await this.slipDateInput.nth(index).fill(`${dd}/${mm}/${yyyy} 12:00`);
    await this.slipDateInput.nth(index).press('Enter');
  }

  async fillRequiredOrderFields() {
    // Select Sales Channel
    const salesChannelSelect = this.page.locator('select').filter({ hasText: /เลือกช่องทางการขาย|Facebook|Line|Tiktok/i }).first();
    if (await salesChannelSelect.isVisible()) {
       await salesChannelSelect.selectOption({ index: 1 });
       await this.page.waitForTimeout(500);
    }
    
    // Select Page (if appears)
    const salesChannelPageSelect = this.page.locator('select').filter({ hasText: /เลือกเพจ/ }).first();
    if (await salesChannelPageSelect.isVisible()) {
       await expect(salesChannelPageSelect.locator('option').nth(1)).toBeAttached({ timeout: 10000 });
       const options = await salesChannelPageSelect.locator('option').count();
       if (options > 1) {
           await salesChannelPageSelect.selectOption({ index: 1 });
       }
    }

    const shippingSelect = this.page.locator('select').filter({ hasText: /เลือกขนส่ง/ }).first();
    if (await shippingSelect.isVisible()) {
       const options = await shippingSelect.locator('option').count();
       if (options > 1) {
           await shippingSelect.selectOption({ index: 1 });
       }
    }
  }

  async fillUpsellSlipDetails(index: number, amount: string) {
    const input = this.slipAmountInput.nth(index);
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.clear();
    await input.fill(amount);
    await input.blur();
  }

  async gotoUpsell(customerId: string) {
    await this.page.goto(`/?customerId=${customerId}`);
    const upsellBtn = this.page.getByRole('button', { name: /UPSELL ด่วน!/i }).first();
    await expect(upsellBtn).toBeVisible();
    await upsellBtn.click({ force: true });
    await this.page.waitForTimeout(1000);
  }

  async selectUpsellOrder(orderId: string) {
    const selectElement = this.page.locator('select').filter({ hasText: 'เลือกออเดอร' }).first();
    await expect(selectElement).toBeVisible();
    await selectElement.selectOption(orderId);
    await this.page.waitForTimeout(1000); 
  }
}
