import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Read and parse JSON file
function readJsonFile(filename: string): any[] {
  const filePath = path.join(process.cwd(), "api", "Address_DB", filename);

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return [];
  }

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(fileContent);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error reading or parsing ${filename}:`, error);
    return [];
  }
}

async function seedAddressData() {
  console.log("Seeding Thai address data...");

  try {
    // Import geographies
    console.log("Seeding geographies...");
    const geographies = readJsonFile("geographies.json");

    for (const geo of geographies) {
      await prisma.address_geographies.upsert({
        where: { id: geo.id },
        update: {
          name: geo.name || null,
          created_at: geo.created_at ? new Date(geo.created_at) : null,
          updated_at: geo.updated_at ? new Date(geo.updated_at) : null,
          deleted_at: geo.deleted_at ? new Date(geo.deleted_at) : null,
        },
        create: {
          id: geo.id,
          name: geo.name || null,
          created_at: geo.created_at ? new Date(geo.created_at) : null,
          updated_at: geo.updated_at ? new Date(geo.updated_at) : null,
          deleted_at: geo.deleted_at ? new Date(geo.deleted_at) : null,
        },
      });
    }
    console.log(`Seeded ${geographies.length} geographies`);

    // Import provinces
    console.log("Seeding provinces...");
    const provinces = readJsonFile("provinces.json");

    for (const province of provinces) {
      await prisma.address_provinces.upsert({
        where: { id: province.id },
        update: {
          name_th: province.name_th || null,
          name_en: province.name_en || null,
          geography_id: province.geography_id || null,
          created_at: province.created_at
            ? new Date(province.created_at)
            : null,
          updated_at: province.updated_at
            ? new Date(province.updated_at)
            : null,
          deleted_at: province.deleted_at
            ? new Date(province.deleted_at)
            : null,
        },
        create: {
          id: province.id,
          name_th: province.name_th || null,
          name_en: province.name_en || null,
          geography_id: province.geography_id || null,
          created_at: province.created_at
            ? new Date(province.created_at)
            : null,
          updated_at: province.updated_at
            ? new Date(province.updated_at)
            : null,
          deleted_at: province.deleted_at
            ? new Date(province.deleted_at)
            : null,
        },
      });
    }
    console.log(`Seeded ${provinces.length} provinces`);

    // Import districts
    console.log("Seeding districts...");
    const districts = readJsonFile("districts.json");

    for (const district of districts) {
      await prisma.address_districts.upsert({
        where: { id: district.id },
        update: {
          name_th: district.name_th || null,
          name_en: district.name_en || null,
          province_id: district.province_id || null,
          created_at: district.created_at
            ? new Date(district.created_at)
            : null,
          updated_at: district.updated_at
            ? new Date(district.updated_at)
            : null,
          deleted_at: district.deleted_at
            ? new Date(district.deleted_at)
            : null,
        },
        create: {
          id: district.id,
          name_th: district.name_th || null,
          name_en: district.name_en || null,
          province_id: district.province_id || null,
          created_at: district.created_at
            ? new Date(district.created_at)
            : null,
          updated_at: district.updated_at
            ? new Date(district.updated_at)
            : null,
          deleted_at: district.deleted_at
            ? new Date(district.deleted_at)
            : null,
        },
      });
    }
    console.log(`Seeded ${districts.length} districts`);

    // Import sub-districts
    console.log("Seeding sub-districts...");
    const subDistricts = readJsonFile("sub_districts.json");

    for (const subDistrict of subDistricts) {
      await prisma.address_sub_districts.upsert({
        where: { id: subDistrict.id },
        update: {
          zip_code: String(subDistrict.zip_code || subDistrict.postcode || ""),
          name_th: subDistrict.name_th || null,
          name_en: subDistrict.name_en || null,
          district_id: subDistrict.district_id || null,
          lat: subDistrict.lat || null,
          long: subDistrict.long || null,
          created_at: subDistrict.created_at
            ? new Date(subDistrict.created_at)
            : null,
          updated_at: subDistrict.updated_at
            ? new Date(subDistrict.updated_at)
            : null,
          deleted_at: subDistrict.deleted_at
            ? new Date(subDistrict.deleted_at)
            : null,
        },
        create: {
          id: subDistrict.id,
          zip_code: String(subDistrict.zip_code || subDistrict.postcode || ""),
          name_th: subDistrict.name_th || null,
          name_en: subDistrict.name_en || null,
          district_id: subDistrict.district_id || null,
          lat: subDistrict.lat || null,
          long: subDistrict.long || null,
          created_at: subDistrict.created_at
            ? new Date(subDistrict.created_at)
            : null,
          updated_at: subDistrict.updated_at
            ? new Date(subDistrict.updated_at)
            : null,
          deleted_at: subDistrict.deleted_at
            ? new Date(subDistrict.deleted_at)
            : null,
        },
      });
    }
    console.log(`Seeded ${subDistricts.length} sub-districts`);

    console.log("Thai address data seeding completed!");
  } catch (error) {
    console.error("Error seeding address data:", error);
  }
}

async function main() {
  console.log("Start seeding database...");

  // Companies
  console.log("Seeding companies...");
  const company1 = await prisma.companies.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "Alpha Seeds Co.",
    },
  });

  const company2 = await prisma.companies.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "Company B Ltd.",
    },
  });

  // Users
  console.log("Seeding users...");
  const adminUser = await prisma.users.upsert({
    where: { id: 1 },
    update: {},
    create: {
      username: "admin1",
      password: "admin123",
      first_name: "Somchai",
      last_name: "Admin",
      email: "admin1@example.com",
      phone: "0810000001",
      role: "Admin Page",
      company_id: 1,
    },
  });

  const telesaleUser = await prisma.users.upsert({
    where: { id: 2 },
    update: {},
    create: {
      username: "telesale1",
      password: "telesale123",
      first_name: "Somsri",
      last_name: "Telesale",
      email: "telesale1@example.com",
      phone: "0810000002",
      role: "Telesale",
      company_id: 1,
      team_id: 1,
      supervisor_id: 3,
    },
  });

  const supervisorUser = await prisma.users.upsert({
    where: { id: 3 },
    update: {},
    create: {
      username: "supervisor1",
      password: "supervisor123",
      first_name: "Somying",
      last_name: "Supervisor",
      email: "supervisor1@example.com",
      phone: "0810000003",
      role: "Supervisor Telesale",
      company_id: 1,
      team_id: 1,
    },
  });

  const backofficeUser = await prisma.users.upsert({
    where: { id: 4 },
    update: {},
    create: {
      username: "backoffice1",
      password: "backoffice123",
      first_name: "Sommai",
      last_name: "Backoffice",
      email: "backoffice1@example.com",
      phone: "0810000004",
      role: "Backoffice",
      company_id: 1,
    },
  });

  const ownerUser = await prisma.users.upsert({
    where: { id: 5 },
    update: {},
    create: {
      username: "owner1",
      password: "owner123",
      first_name: "Owner",
      last_name: "Control",
      email: "owner1@example.com",
      phone: "0810000005",
      role: "Admin Control",
      company_id: 1,
    },
  });

  const superadminUser = await prisma.users.upsert({
    where: { id: 6 },
    update: {},
    create: {
      username: "superadmin",
      password: "superadmin123",
      first_name: "Super",
      last_name: "Admin",
      email: "superadmin@example.com",
      phone: "0810000000",
      role: "Super Admin",
      company_id: 1,
    },
  });

  // Tags
  console.log("Seeding tags...");
  const vipTag = await prisma.tags.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: "VIP",
      type: "SYSTEM",
    },
  });

  const leadTag = await prisma.tags.upsert({
    where: { id: 2 },
    update: {},
    create: {
      name: "Lead",
      type: "SYSTEM",
    },
  });

  // Customers
  console.log("Seeding customers...");
  const customer = await prisma.customers.upsert({
    where: { id: "CUS-100000001" },
    update: {},
    create: {
      id: "CUS-100000001",
      first_name: "Mana",
      last_name: "Jaidee",
      phone: "0812345678",
      email: "mana.j@example.com",
      province: "Bangkok",
      company_id: 1,
      assigned_to: 2, // telesale user
      date_assigned: new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      date_registered: new Date(
        new Date().getTime() - 10 * 24 * 60 * 60 * 1000,
      ), // 10 days ago
      follow_up_date: new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      ownership_expires: new Date(
        new Date().getTime() + 80 * 24 * 60 * 60 * 1000,
      ), // 80 days from now
      lifecycle_status: "New", // ลูกค้าใหม่
      behavioral_status: "Hot",
      grade: "B",
      total_purchases: 5850,
      total_calls: 15,
      facebook_name: "Mana Jaidee",
      line_id: "mana.j",
      street: "123 Sukhumvit Rd",
      subdistrict: "Khlong Toei",
      district: "Khlong Toei",
      postal_code: "10110",
    },
  });

  // Customer tags
  console.log("Seeding customer tags...");
  await prisma.customer_tags.upsert({
    where: {
      customer_id_tag_id: {
        customer_id: "CUS-100000001",
        tag_id: 1,
      },
    },
    update: {},
    create: {
      customer_id: "CUS-100000001",
      tag_id: 1,
    },
  });

  // Products
  console.log("Seeding products...");
  const product = await prisma.products.upsert({
    where: { id: 1 },
    update: {},
    create: {
      sku: "SKU-001",
      name: "Seed A",
      description: "High yield seed",
      category: "Seeds",
      unit: "bag",
      cost: 100,
      price: 200,
      stock: 500,
      company_id: 1,
      status: "Active",
    },
  });

  // Promotions
  console.log("Seeding promotions...");
  const promo1 = await prisma.promotions.upsert({
    where: { id: 1 },
    update: {},
    create: {
      sku: "PROMO-001",
      name: "ปุ๋ย แสงราชสีห์ ซื้อ 4 แถม 1",
      description: "ซื้อ 4 แถม 1 เซ็ตปุ๋ยแสงราชสีห์",
      company_id: 1,
      active: true,
    },
  });

  const promo2 = await prisma.promotions.upsert({
    where: { id: 2 },
    update: {},
    create: {
      sku: "PROMO-002",
      name: "ชุดทดลองเมล็ด 3 แถม 1",
      description: "เลือก 3 ซอง แถม 1 ซอง",
      company_id: 1,
      active: true,
    },
  });

  const promo3 = await prisma.promotions.upsert({
    where: { id: 3 },
    update: {},
    create: {
      sku: "PROMO-003",
      name: "โปรแพ็คประหยัด 10%",
      description: "ชุดสินค้ารวม ลด10%",
      company_id: 1,
      active: true,
    },
  });

  // Promotion items
  console.log("Seeding promotion items...");
  await prisma.promotion_items.upsert({
    where: { id: 1 },
    update: {},
    create: {
      promotion_id: promo1.id,
      product_id: product.id,
      quantity: 4,
      is_freebie: false,
    },
  });

  await prisma.promotion_items.upsert({
    where: { id: 2 },
    update: {},
    create: {
      promotion_id: promo1.id,
      product_id: product.id,
      quantity: 1,
      is_freebie: true,
      price_override: 0,
    },
  });

  await prisma.promotion_items.upsert({
    where: { id: 3 },
    update: {},
    create: {
      promotion_id: promo2.id,
      product_id: product.id,
      quantity: 3,
      is_freebie: false,
    },
  });

  await prisma.promotion_items.upsert({
    where: { id: 4 },
    update: {},
    create: {
      promotion_id: promo2.id,
      product_id: product.id,
      quantity: 1,
      is_freebie: true,
      price_override: 0,
    },
  });

  // Orders
  console.log("Seeding orders...");
  const order1 = await prisma.orders.upsert({
    where: { id: "ORD-100000001" },
    update: {},
    create: {
      id: "ORD-100000001",
      customer_id: "CUS-100000001",
      company_id: 1,
      creator_id: 2, // telesale user
      order_date: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      delivery_date: new Date(new Date().getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day from now
      street: "123 Sukhumvit Rd",
      subdistrict: "Khlong Toei",
      district: "Khlong Toei",
      province: "Bangkok",
      postal_code: "10110",
      shipping_cost: 50,
      bill_discount: 0,
      total_amount: 2050,
      payment_method: "COD",
      payment_status: "PendingVerification",
      amount_paid: null,
      cod_amount: null,
      order_status: "Picking",
      notes: "First test order",
    },
  });

  const order2 = await prisma.orders.upsert({
    where: { id: "ORD-100000002" },
    update: {},
    create: {
      id: "ORD-100000002",
      customer_id: "CUS-100000001",
      company_id: 1,
      creator_id: 2, // telesale user
      order_date: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      delivery_date: new Date(new Date().getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      street: "123 Sukhumvit Rd",
      subdistrict: "Khlong Toei",
      district: "Khlong Toei",
      province: "Bangkok",
      postal_code: "10110",
      shipping_cost: 60,
      bill_discount: 0,
      total_amount: 1560,
      payment_method: "Transfer",
      payment_status: "Paid",
      slip_url: "https://example.com/slip1.jpg",
      amount_paid: 1560,
      cod_amount: null,
      order_status: "Delivered",
      notes: "Transfer order",
    },
  });

  const order3 = await prisma.orders.upsert({
    where: { id: "ORD-100000003" },
    update: {},
    create: {
      id: "ORD-100000003",
      customer_id: "CUS-100000001",
      company_id: 1,
      creator_id: 2, // telesale user
      order_date: new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      delivery_date: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      street: "123 Sukhumvit Rd",
      subdistrict: "Khlong Toei",
      district: "Khlong Toei",
      province: "Bangkok",
      postal_code: "10110",
      shipping_cost: 40,
      bill_discount: 0,
      total_amount: 1200,
      payment_method: "Transfer",
      payment_status: "Unpaid",
      amount_paid: null,
      cod_amount: null,
      order_status: "Pending",
      notes: "Unpaid transfer order",
    },
  });

  const order4 = await prisma.orders.upsert({
    where: { id: "ORD-100000004" },
    update: {},
    create: {
      id: "ORD-100000004",
      customer_id: "CUS-100000001",
      company_id: 1,
      creator_id: 2, // telesale user
      order_date: new Date(new Date().getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      delivery_date: new Date(new Date().getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days from now
      street: "123 Sukhumvit Rd",
      subdistrict: "Khlong Toei",
      district: "Khlong Toei",
      province: "Bangkok",
      postal_code: "10110",
      shipping_cost: 70,
      bill_discount: 0,
      total_amount: 1800,
      payment_method: "PayAfter",
      payment_status: "Unpaid",
      amount_paid: null,
      cod_amount: null,
      order_status: "Shipping",
      notes: "Pay after delivery order",
    },
  });

  // Order items
  console.log("Seeding order items...");
  await prisma.order_items.upsert({
    where: { id: 1 },
    update: {},
    create: {
      order_id: "ORD-100000001",
      parent_order_id: "ORD-100000001",
      product_id: 1,
      product_name: "Seed A",
      quantity: 10,
      price_per_unit: 200,
      discount: 0,
      is_freebie: false,
      box_number: 1,
    },
  });

  await prisma.order_items.upsert({
    where: { id: 2 },
    update: {},
    create: {
      order_id: "ORD-100000002",
      parent_order_id: "ORD-100000002",
      product_id: 1,
      product_name: "Seed A",
      quantity: 8,
      price_per_unit: 200,
      discount: 0,
      is_freebie: false,
      box_number: 1,
    },
  });

  await prisma.order_items.upsert({
    where: { id: 3 },
    update: {},
    create: {
      order_id: "ORD-100000003",
      parent_order_id: "ORD-100000003",
      product_id: 1,
      product_name: "Seed A",
      quantity: 6,
      price_per_unit: 200,
      discount: 0,
      is_freebie: false,
      box_number: 1,
    },
  });

  await prisma.order_items.upsert({
    where: { id: 4 },
    update: {},
    create: {
      order_id: "ORD-100000004",
      parent_order_id: "ORD-100000004",
      product_id: 1,
      product_name: "Seed A",
      quantity: 9,
      price_per_unit: 200,
      discount: 0,
      is_freebie: false,
      box_number: 1,
    },
  });

  // Order tracking numbers
  console.log("Seeding order tracking numbers...");
  try {
    const columns = (await prisma.$queryRawUnsafe<
      { COLUMN_NAME: string }[]
    >(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_tracking_numbers'",
    )) as { COLUMN_NAME: string }[];

    const hasParent = columns.some(
      (c) => c.COLUMN_NAME === "parent_order_id",
    );
    const hasBox = columns.some((c) => c.COLUMN_NAME === "box_number");

    if (hasParent && hasBox) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO order_tracking_numbers (id, order_id, parent_order_id, box_number, tracking_number) VALUES
          (1, 'ORD-100000001', 'ORD-100000001', 1, 'TH1234567890'),
          (2, 'ORD-100000002', 'ORD-100000002', 1, 'TH1234567891'),
          (3, 'ORD-100000004', 'ORD-100000004', 1, 'TH1234567892')
        ON DUPLICATE KEY UPDATE tracking_number = VALUES(tracking_number);
      `);
    } else {
      await prisma.$executeRawUnsafe(`
        INSERT INTO order_tracking_numbers (id, order_id, tracking_number) VALUES
          (1, 'ORD-100000001', 'TH1234567890'),
          (2, 'ORD-100000002', 'TH1234567891'),
          (3, 'ORD-100000004', 'TH1234567892')
        ON DUPLICATE KEY UPDATE tracking_number = VALUES(tracking_number);
      `);
    }
  } catch (e) {
    console.error("Warning: failed to seed order_tracking_numbers", e);
  }

  // Call history
  console.log("Seeding call history...");
  await prisma.call_history.upsert({
    where: { id: 1 },
    update: {},
    create: {
      customer_id: "CUS-100000001",
      date: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      caller: "Somsri Telesale",
      status: "connected",
      result: "interested",
      crop_type: "Rice",
      area_size: "10 rai",
      notes: "Good lead",
      duration: 300,
    },
  });

  // Appointments
  console.log("Seeding appointments...");
  await prisma.appointments.upsert({
    where: { id: 1 },
    update: {},
    create: {
      customer_id: "CUS-100000001",
      date: new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      title: "Follow-up Call",
      status: "รอดำเนินการ",
      notes: "Discuss pricing",
    },
  });

  // Thai Address Data
  await seedAddressData();

  // Activities
  console.log("Seeding activities...");
  await prisma.activities.upsert({
    where: { id: BigInt(1) },
    update: {},
    create: {
      customer_id: "CUS-100000001",
      timestamp: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      type: "order_created",
      description: "Created order ORD-100000001",
      actor_name: "Somsri Telesale",
    },
  });

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
