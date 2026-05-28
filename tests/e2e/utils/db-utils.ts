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

export async function seedFinanceData() {
  try {
    execSync(`php "${phpScriptPath}" seed_finance`, { stdio: 'inherit' });
  } catch (error: any) {
    console.error("seedFinanceData failed:", error.message);
    if (error.stdout) console.error("STDOUT:", error.stdout.toString());
    if (error.stderr) console.error("STDERR:", error.stderr.toString());
    throw error;
  }
}

export async function getOrderPaymentStatus(orderId: string): Promise<string> {
  const result = execSync(`php "${phpScriptPath}" get_order_payment_status "${orderId}"`);
  return result.toString().trim();
}

export async function getCodDocumentInfo(docId: string): Promise<{status: string, matched_statement_log_id: string | null}> {
  const result = execSync(`php "${phpScriptPath}" get_cod_document_info "${docId}"`);
  return JSON.parse(result.toString().trim() || '{}');
}

export async function getStatementMatchedOrderId(logId: string): Promise<string | null> {
  const result = execSync(`php "${phpScriptPath}" get_statement_matched_order "${logId}"`);
  const val = result.toString().trim();
  return val ? val : null;
}

export async function getCustomerInfo(customerId: number): Promise<{ first_name: string, last_name: string, grade: string, total_amount: string }> {
  const result = execSync(`php "${phpScriptPath}" get_customer_info ${customerId}`);
  return JSON.parse(result.toString().trim() || '{}');
}
