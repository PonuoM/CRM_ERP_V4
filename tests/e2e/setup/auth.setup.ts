import { test as setup, expect } from '@playwright/test';
import { wipeCustomerGradeTestData, seedBasicCustomersAndOrders } from '../utils/db-utils';

const users = [
  { role: 'Telesale', fileName: 'telesale.json', username: 'telesale1', password: 'telesale123' },
  { role: 'Backoffice', fileName: 'backoffice.json', username: 'admin', password: 'Kapoala02' },
  { role: 'Admin', fileName: 'finance.json', username: 'admin', password: 'Kapoala02' }
];
for (const user of users) {
  setup(`authenticate as ${user.role}`, async ({ page }) => {
    await page.goto('/');

    // Handle Login
    await page.getByPlaceholder(/sername/i).fill(user.username);
    await page.getByPlaceholder(/assword/i).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for successful login (nav/sidebar visible)
    await expect(page.locator('nav, .sidebar').first()).toBeVisible({ timeout: 15000 });

    // Handle Clock In Modal if it appears
    const clockInModalText = page.getByText('เริ่มงานวันนี้ไหม?').first();
    if (await clockInModalText.isVisible({ timeout: 5000 }).catch(() => false)) {
      await page.getByRole('button', { name: 'บันทึกเข้างาน' }).first().click();
    }

    // Handle Acknowledge Modal if it appears (common on dashboard)
    const acknowledgeBtn = page.getByRole('button', { name: 'รับทราบ' }).first();
    if (await acknowledgeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await acknowledgeBtn.click();
    }

    // Wait a bit for attendance APIs to finish and localStorage to be updated
    await page.waitForTimeout(3000);

    // Save storage state into the designated file
    await page.context().storageState({ path: `playwright/.auth/${user.fileName}` });
  });
}
