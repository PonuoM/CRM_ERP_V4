
<file_path>
C:\AppServ\www\CRM_ERP_V4\scripts\seed-all-tables-new.ts
</file_path>

<content>
#!/usr/bin/env node

/**
 * Comprehensive Database Seeding Script
 * This script seeds all tables in the database with appropriate sample data
 */

import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// Helper function to read Thai address JSON files
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

async function main() {
  console.log("Start comprehensive database seeding...");

  try {
    // ===== CORE ENTITY SEEDING =====

    // 1. Companies
    console.log("Seeding companies...");
    await prisma.companies.createMany({
      data: [
        {
          name: "Alpha Seeds Co.",
          address: "123 Main Street, Bangkok",
          phone: "02-12345678",
          email: "info@alphaseeds.com",
          tax_id: "1234567890",
        },
        {
          name: "Beta Agriculture Ltd.",
          address: "456 Market Road, Chiang Mai",
          phone: "053-98765432",
          email: "contact@betaagri.com",
          tax_id: "0987654321",
        },
      ],
    });
    console.log("Seeded 2 companies");

    // 2. Tags
    console.log("Seeding tags...");
    await prisma.tags.createMany({
      data: [
        { name: "VIP Customer", type: "CUSTOMER" },
        { name: "Lead", type: "CUSTOMER" },
        { name: "Interested in Seeds", type: "CUSTOMER" },
        { name: "Sales Manager", type: "USER" },
        { name: "Sales Rep", type: "USER" },
      ],
    });
    console.log("Seeded 5 tags");

    // 3. Products
    console.log("Seeding products...");
    await prisma.products.createMany({
      data: [
        {
          sku: "SEED001",
          name: "Premium Rice Seed",
          description: "High-quality rice seed suitable for tropical climates",
          category: "Seeds",
          unit: "kg",
          cost: 150.0,
          price: 200.0,
          stock: 500,
          company_id: 1,
          is_active: true,
        },
        {
          sku: "SEED002",
          name: "Hybrid Corn Seed",
          description: "Disease-resistant hybrid corn variety",
          category: "Seeds",
          unit: "kg",
          cost: 120.0,
          price: 180.0,
          stock: 800,
          company_id: 1,
          is_active: true,
        },
      ],
    });
    console.log("Seeded 2 products");

    // 4. Users
    console.log("Seeding users...");
    await prisma.users.createMany({
      data: [
        {
          username: "admin",
          password: "password_hash",
          first_name: "System",
          last_name: "Administrator",
          email: "admin@company.com",
          phone: "081-1111111",
          role: "admin",
          company_id: 1,
          team_id: 1,
          is_active: true,
        },
        {
          username: "sales1",
          password: "password_hash",
          first_name: "Sales",
          last_name: "Representative 1",
          email: "sales1@company.com",
          phone: "082-2222222",
          role: "telesales",
          company_id: 1,
          team_id: 2,
          is_active: true,
        },
      ],
    });
    console.log("Seeded 2 users");

    // ===== CUSTOMER SEEDING =====

    // 5. Customers
    console.log("Seeding customers...");
    await prisma.customers.createMany({
      data: [
        {
          id: "CUS-100000001",
          first_name: "สมชาย",
          last_name: "ใจดี",
          phone: "081-1234567",
          email: "somchai.jaidee@example.com",
          province: "Bangkok",
          company_id: 1,
          assigned_to: 2,
          date_assigned: new Date(),
          date_registered: new Date(),
          lifecycle_status: "active",
        },
        {
          id: "CUS-100000002",
          first_name: "สมศรี",
          last_name: "รักการเกษตร",
          phone: "082-2345678",
          email: "somsri.rak.go.sat@example.com",
          province: "Chiang Mai",
          company_id: 1,
          assigned_to: 2,
          date_assigned: new Date(),
          date_registered: new Date(),
          lifecycle_status: "active",
        },
      ],
    });
    console.log("Seeded 2 customers");

    // 6. Customer Tags
    console.log("Seeding customer tags...");
    await prisma.customer_tags.createMany({
      data: [
        { customer_id: "CUS-100000001", tag_id: 1 },
        { customer_id: "CUS-100000002", tag_id: 2 },
      ],
    });
    console.log("Seeded 2 customer tags");

    // 7. Activities
    console.log("Seeding activities...");
    await prisma.activities.createMany({
      data: [
        {
          customer_id: "CUS-100000001",
          timestamp: new Date(),
          type: "call",
          description: "Initial contact with customer",
          actor_name: "Sales Representative",
        },
        {
          customer_id: "CUS-100000002",
          timestamp: new Date(),
          type: "order",
          description: "Order placed by customer",
          actor_name: "Sales Representative",
        },
      ],
    });
    console.log("Seeded 2 activities");

    // 8. Appointments
    console.log("Seeding appointments...");
    await prisma.appointments.createMany({
      data: [
        {
          customer_id: "CUS-100000001",
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          title: "Product Demonstration",
          status: "scheduled",
          notes: "Demonstrate new seed varieties",
        },
      ],
    });
    console.log("Seeded 1 appointment");

    // 9. Appointments
    console.log("Seeding call history...");
    await prisma.call_history.createMany({
      data: [
        {
          customer_id: "CUS-100000001",
          date: new Date(),
          caller: "Sales Representative",
          status: "completed",
          result: "Order placed",
          crop_type: "Rice",
          area_size: "5 hectares",
          notes: "Customer interested in premium rice seed",
          duration: 15,
        },
      ],
    });
    console.log("Seeded 1 call history entry");

    // ===== SALES SEEDING =====

    // 11. Promotions
    console.log("Seeding promotions...");
    await prisma.promotions.createMany({
      data: [
        {
          sku: "PROMO2023",
          name: "Buy 10 Get 1 Free",
          description: "Special promotion for farmers buying in bulk",
          company_id: 1,
          active: true,
          start_date: new Date("2023-01-01"),
          end_date: new Date("2023-12-31"),
        },
      ],
    });
    console.log("Seeded 1 promotion");

    // 12. Promotion Items
    console.log("Seeding promotion items...");
    await prisma.promotion_items.createMany({
      data: [
        {
          promotion_id: 1,
          product_id: 1,
          quantity: 10,
          is_freebie: true,
        },
      ],
    });
    console.log("Seeded 1 promotion item");

    // 13. Orders
    console.log("Seeding orders...");
    await prisma.orders.createMany({
      data: [
        {
          id: "ORD-100000001",
          customer_id: "CUS-100000001",
          company_id: 1,
          creator_id: 2,
          order_date: new Date(),
          delivery_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          street: "123 Main Street",
          subdistrict: "Suriyawong",
          district: "Bang Rak",
          province: "Bangkok",
          recipient_first_name: "สมชาย",
          recipient_last_name: "ใจดี",
          shipping_cost: 50.0,
          bill_discount: 0.0,
          total_amount: 200.0,
          payment_method: "cod",
          payment_status: "pending",
          order_status: "pending",
          notes: "Pay after delivery order",
        },
      ],
    });
    console.log("Seeded 1 order");

    // 14. Order Items
    console.log("Seeding order items...");
    await prisma.order_items.createMany({
      data: [
        {
          order_id: "ORD-100000001",
          parent_order_id: "ORD-100000001",
          product_id: 1,
          product_name: "Premium Rice Seed",
          quantity: 10,
          price_per_unit: 200.0,
          discount: 0.0,
          is_freebie: false,
          box_number: 1,
        },
      ],
    });
    console.log("Seeded 1 order item");

    // 15. Order Tracking Numbers
    console.log("Seeding order tracking numbers...");
    await prisma.order_tracking_numbers.createMany({
      data: [
        {
          order_id: "ORD-100000001",
          tracking_number: "TH123456789",
        },
      ],
    });
    console.log("Seeded 1 tracking number");

    // ===== INVENTORY SEEDING =====

    // 16. Warehouses
    console.log("Seeding warehouses...");
    await prisma.warehouses.createMany({
      data: [
        {
          name: "Central Warehouse",
          company_id: 1,
          address: "123 Warehouse Road, Bangkok",
          province: "Bangkok",
          district: "Bang Rak",
          subdistrict: "Suriyawong",
          postal_code: "10500",
          phone: "02-12345678",
          email: "warehouse@company.com",
          manager_name: "Warehouse Manager",
          manager_phone: "081-2345678",
          is_active: true,
        },
      ],
    });
    console.log("Seeded 1 warehouse");

    // 17. Product Lots
    console.log("Seeding product lots...");
    await prisma.product_lots.createMany({
      data: [
        {
          lot_number: "LOT20230101",
          product_id: 1,
          warehouse_id: 1,
          purchase_date: new Date("2023-01-01"),
          expiry_date: new Date("2024-12-31"),
          quantity_received: 1000.0,
          quantity_remaining: 700.0,
          unit_cost: 150.0,
        },
      ],
    });
    console.log("Seeded 1 product lot");

    // 18. Warehouse Stocks
    console.log("Seeding warehouse stocks...");
    await prisma.warehouse_stocks.createMany({
      data: [
        {
          warehouse_id: 1,
          product_id: 1,
          lot_number: "LOT20230101",
          quantity: 400,
          reserved_quantity: 50,
          available_quantity: 350,
          expiry_date: new Date("2024-12-31"),
          purchase_price: 150.0,
          selling_price: 200.0,
          location_in_warehouse: "A1-B2",
        },
      ],
    });
    console.log("Seeded 1 warehouse stock record");

    // 19. Stock Movements
    console.log("Seeding stock movements...");
    await prisma.stock_movements.createMany({
      data: [
        {
          warehouse_id: 1,
          product_id: 1,
          movement_type: "IN",
          quantity: 1000,
          lot_number: "LOT20230101",
          reference_type: "PURCHASE",
          reference_id: "PO-2023001",
          reason: "Initial stock purchase",
          notes: "Initial stock for warehouse",
          created_by: 1,
        },
        {
          warehouse_id: 1,
          product_id: 1,
          movement_type: "OUT",
          quantity: 10,
          lot_number: "LOT20230101",
          reference_type: "ORDER",
          reference_id: "ORD-100000001",
          reason: "Customer order fulfillment",
          notes: "Customer order",
          created_by: 2,
        },
      ],
    });
    console.log("Seeded 2 stock movements");

    // ===== MARKETING SEEDING =====

    // 20. Pages
    console.log("Seeding pages...");
    await prisma.pages.createMany({
      data: [
        {
          page_id: "123456789",
          name: "Alpha Seeds Official",
          platform: "Facebook",
          page_type: "business",
          url: "https://facebook.com/alphaseedsofficial",
          company_id: 1,
          active: true,
          still_in_list: true,
          user_count: 1000,
        },
      ],
    });
    console.log("Seeded 1 page");

    // 21. Ad Spend
    console.log("Seeding ad spend...");
    await prisma.ad_spend.createMany({
      data: [
        {
          page_id: 1,
          spend_date: new Date(),
          amount: 500.0,
          notes: "Facebook ad campaign for new seed variety",
        },
      ],
    });
    console.log("Seeded 1 ad spend record");

    // ===== THAI ADDRESS SEEDING =====

    // 22. Geographies
    console.log("Seeding geographies...");
    const geographies = readJsonFile("geographies.json");

    if (geographies.length > 0) {
      await prisma.address_geographies.createMany({
        data: geographies.map((geo, index) => ({
          id: geo.id,
          name: geo.name || null,
        })),
      });
      console.log(`Seeded ${geographies.length} geographies`);
    }

    // 23. Provinces
    console.log("Seeding provinces...");
    const provinces = readJsonFile("provinces.json");

    if (provinces.length > 0) {
      await prisma.address_provinces.createMany({
        data: provinces.map((province, index) => ({
          id: province.id,
          name_th: province.name_th || null,
          name_en: province.name_en || null,
          geography_id: province.geography_id || null,
        })),
      });
      console.log(`Seeded ${provinces.length} provinces`);
    }

    // 24. Districts
    console.log("Seeding districts...");
    const districts = readJsonFile("districts.json");

    if (districts.length > 0) {
      await prisma.address_districts.createMany({
        data: districts.map((district, index) => ({
          id: district.id,
          name_th: district.name_th || null,
          name_en: district.name_en || null,
          province_id: district.province_id || null,
        })),
      });
      console.log(`Seeded ${districts.length} districts`);
    }

    // 25. Sub-districts
    console.log("Seeding sub-districts...");
    const subDistricts = readJsonFile("sub_districts.json");

    if (subDistricts.length > 0) {
      await prisma.address_sub_districts.createMany({
        data: subDistricts.map((subDistrict, index) => ({
          id: subDistrict.id,
          zip_code: String(subDistrict.zip_code || subDistrict.postcode || ""),
          name_th: subDistrict.name_th || null,
          name_en: subDistrict.name_en || null,
          district_id: subDistrict.district_id || null,
        })),
      });
      console.log(`Seeded ${subDistricts.length} sub-districts`);
    }

    // ===== SYSTEM SEEDING =====

    // 26. Environment Variables
    console.log("Seeding environment variables...");
    await prisma.env.createMany({
      data: [
        { key: "app_name", value: "Mini ERP for Sales Teams" },
        { key: "app_version", value: "1.0.0" },
        { key: "default_currency", value: "THB" },
      ],
    });
    console.log("Seeded 3 environment variables");

    console.log("✅ Comprehensive database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
</content>
</file_path>
