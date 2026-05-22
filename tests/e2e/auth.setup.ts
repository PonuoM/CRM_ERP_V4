import { test as setup, expect } from '@playwright/test';

const users = [
  { role: 'telesale', username: 'telesale_user', password: '1234' },
  { role: 'backoffice', username: 'backoffice_user', password: '1234' },
  { role: 'finance', username: 'finance_user', password: '1234' }
];

for (const user of users) {
  setup(`authenticate as ${user.role}`, async ({ page }) => {
    await page.goto('/');

    // Handle Login
    await page.getByPlaceholder(/sername/i).fill(user.username);
    await page.getByPlaceholder(/assword/i).fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Wait for successful login (nav/sidebar visible)
    await expect(page.locator('nav, .sidebar').first()).toBeVisible({ timeout: 15000 }).catch(() => { });

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

    // Save storage state into the designated file
    await page.context().storageState({ path: `playwright/.auth/${user.role}.json` });
  });
}
