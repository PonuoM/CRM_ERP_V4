import { execSync } from 'child_process';
import path from 'path';

const phpScriptPath = path.join(process.cwd(), 'tests', 'e2e', 'utils', 'db-setup.php');

export async function wipeCustomerGradeTestData() {
  execSync(`php "${phpScriptPath}" wipe`, { stdio: 'inherit' });
}

export async function seedBasicCustomersAndOrders() {
  execSync(`php "${phpScriptPath}" seed`, { stdio: 'inherit' });
}

export async function getCustomerGrade(customerId: number): Promise<string> {
  const result = execSync(`php "${phpScriptPath}" get_grade ${customerId}`);
  return result.toString().trim();
}

export async function getCo2Grades(): Promise<any[]> {
  const result = execSync(`php "${phpScriptPath}" get_co2_grades`);
  return JSON.parse(result.toString().trim() || '[]');
}

export async function getCustomerInfo(customerId: number): Promise<{ first_name: string, last_name: string, grade: string, total_amount: string }> {
  const result = execSync(`php "${phpScriptPath}" get_customer_info ${customerId}`);
  return JSON.parse(result.toString().trim() || '{}');
}
