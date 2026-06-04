import { wipeCustomerGradeTestData, seedBasicCustomersAndOrders } from '../utils/db-utils';

async function globalSetup() {
  console.log('--- GLOBAL SETUP: Wiping and seeding DB ---');
  await wipeCustomerGradeTestData();
  await seedBasicCustomersAndOrders();
}

export default globalSetup;
