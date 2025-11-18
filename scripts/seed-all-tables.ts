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

// Helper function to generate random ID
function generateRandomId(prefix: string, length = 9): string {
  const numbers = Array.from({ length }, () =>
    Math.floor(Math.random() * 10),
  ).join("");
  return `${prefix}-${numbers}`;
}

// Helper function to generate random future date
function getRandomFutureDate(daysFromNow = 30): Date {
  const now = new Date();
  return new Date(
    now.getTime() + Math.random() * daysFromNow * 24 * 60 * 60 * 1000,
  );
}

// Helper function to generate random past date
function getRandomPastDate(daysFromNow = 365): Date {
  const now = new Date();
  return new Date(
    now.getTime() - Math.random() * daysFromNow * 24 * 60 * 60 * 1000,
  );
}

async function main() {
  console.log("Start seeding complete database...");

  try {
    // ==== CORE ENTITY SEEDING ====

    // 1. Companies
    console.log("Seeding companies...");
    await prisma.companies.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: "Alpha Seeds Co.",
        address: "123 Main Street, Bangkok",
        phone: "02-12345678",
        email: "info@alphaseeds.com",
        tax_id: "1234567890",
      },
    });

    await prisma.companies.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: "Beta Agriculture Ltd.",
        address: "456 Market Road, Chiang Mai",
        phone: "053-98765432",
        email: "contact@betaagri.com",
        tax_id: "0987654321",
      },
    });

    // 2. Bank Accounts
    console.log("Seeding bank accounts...");
    await prisma.bank_account.upsert({
      where: { id: 1 },
      update: {},
      create: {
        company_id: 1,
        bank: "Kasikorn Bank",
        bank_number: "1234567890",
        is_active: true,
      },
    });

    await prisma.bank_account.upsert({
      where: { id: 2 },
      update: {},
      create: {
        company_id: 2,
        bank: "Bangkok Bank",
        bank_number: "0987654321",
        is_active: true,
      },
    });

    // 3. Platforms
    console.log("Seeding platforms...");
    await prisma.platforms.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: "Facebook",
        display_name: "Facebook",
        description: "Social Media Platform",
        active: true,
        sort_order: 1,
      },
    });

    await prisma.platforms.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: "LINE",
        display_name: "LINE Official Account",
        description: "Messaging Platform",
        active: true,
        sort_order: 2,
      },
    });

    // 4. Tags
    console.log("Seeding tags...");
    await prisma.tags.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: "VIP Customer",
        type: "CUSTOMER",
      },
    });

    await prisma.tags.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: "Lead",
        type: "CUSTOMER",
      },
    });

    await prisma.tags.upsert({
      where: { id: 3 },
      update: {},
      create: {
        name: "Interested in Seeds",
        type: "CUSTOMER",
      },
    });

    await prisma.tags.upsert({
      where: { id: 4 },
      update: {},
      create: {
        name: "Sales Manager",
        type: "USER",
      },
    });

    await prisma.tags.upsert({
      where: { id: 5 },
      update: {},
      create: {
        name: "Sales Rep",
        type: "USER",
      },
    });
    console.log("Seeded 5 tags");

    // 5. Warehouses
    console.log("Seeding warehouses...");
    await prisma.warehouses.upsert({
      where: { id: 1 },
      update: {},
      create: {
        name: "Central Warehouse",
        company_id: 1,
        address: "123 Warehouse Road, Bangkok",
        province: "Bangkok",
        district: "Bang Rak",
        subdistrict: "Suriyawong",
        postal_code: "10500",
        phone: "02-12345678",
        email: "warehouse@alphaseeds.com",
        manager_name: "John Smith",
        manager_phone: "081-2345678",
        responsible_provinces: "Bangkok, Samut Prakan, Nonthaburi",
        is_active: true,
      },
    });

    await prisma.warehouses.upsert({
      where: { id: 2 },
      update: {},
      create: {
        name: "Northern Warehouse",
        company_id: 1,
        address: "456 Storage Avenue, Chiang Mai",
        province: "Chiang Mai",
        district: "Mueang",
        subdistrict: "Chang Moi",
        postal_code: "50000",
        phone: "053-987654",
        email: "northern@alphaseeds.com",
        manager_name: "Jane Doe",
        manager_phone: "082-3456789",
        responsible_provinces: "Chiang Mai, Lamphun, Lampang",
        is_active: true,
      },
    });

    // 6. Products
    console.log("Seeding products...");
    const product1 = await prisma.products.upsert({
      where: { id: 1 },
      update: {},
      create: {
        sku: "SEED001",
        name: "Premium Rice Seed",
        description: "High-quality rice seed suitable for tropical climates",
        category: "Seeds",
        unit: "kg",
        cost: 150.0,
        price: 200.0,
        stock: 500,
        company_id: 1,
      },
    });

    const product2 = await prisma.products.upsert({
      where: { id: 2 },
      update: {},
      create: {
        sku: "SEED002",
        name: "Hybrid Corn Seed",
        description: "Disease-resistant hybrid corn variety",
        category: "Seeds",
        unit: "kg",
        cost: 120.0,
        price: 180.0,
        stock: 800,
        company_id: 1,
      },
    });

    const product3 = await prisma.products.upsert({
      where: { id: 3 },
      update: {},
      create: {
        sku: "SEED003",
        name: "Organic Vegetable Seeds Mix",
        description: "Certified organic vegetable seed mix",
        category: "Seeds",
        unit: "kg",
        cost: 200.0,
        price: 300.0,
        stock: 200,
        company_id: 1,
      },
    });

    // 7. Product Lots
    console.log("Seeding product lots...");
    await prisma.product_lots.upsert({
      where: { id: 1 },
      update: {},
      create: {
        lot_number: "LOT20230101",
        product_id: 1,
        warehouse_id: 1,
        purchase_date: new Date("2023-01-01"),
        expiry_date: new Date("2024-12-31"),
        quantity_received: 1000.0,
        quantity_remaining: 700.0,
        unit_cost: 150.0,
        supplier_id: 1,
      },
    });

    await prisma.product_lots.upsert({
      where: { id: 2 },
      update: {},
      create: {
        lot_number: "LOT20230215",
        product_id: 2,
        warehouse_id: 2,
        purchase_date: new Date("2023-02-15"),
        expiry_date: new Date("2024-12-31"),
        quantity_received: 800.0,
        quantity_remaining: 500.0,
        unit_cost: 120.0,
        supplier_id: 2,
      },
    });

    // 8. Users
    console.log("Seeding users...");
    await prisma.users.upsert({
      where: { id: 1 },
      update: {},
      create: {
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
    });

    await prisma.users.upsert({
      where: { id: 2 },
      update: {},
      create: {
        username: "telesale1",
        password: "password_hash",
        first_name: "John",
        last_name: "Telesale",
        email: "john@company.com",
        phone: "081-2222222",
        role: "telesales",
        company_id: 1,
        team_id: 2,
        is_active: true,
      },
    });

    await prisma.users.upsert({
      where: { id: 3 },
      update: {},
      create: {
        username: "supervisor1",
        password: "password_hash",
        first_name: "Jane",
        last_name: "Supervisor",
        email: "jane@company.com",
        phone: "081-3333333",
        role: "supervisor",
        company_id: 1,
        team_id: 1,
        is_active: true,
      },
    });

    await prisma.users.upsert({
      where: { id: 4 },
      update: {},
      create: {
        username: "backoffice1",
        password: "password_hash",
        first_name: "Mike",
        last_name: "Backoffice",
        email: "mike@company.com",
        phone: "081-4444444",
        role: "backoffice",
        company_id: 1,
        team_id: 4,
        is_active: true,
      },
    });

    await prisma.users.upsert({
      where: { id: 5 },
      update: {},
      create: {
        username: "owner1",
        password: "password_hash",
        first_name: "Peter",
        last_name: "Owner",
        email: "peter@company.com",
        phone: "081-5555555",
        role: "owner",
        company_id: 1,
        team_id: 1,
        is_active: true,
      },
    });

    await prisma.users.upsert({
      where: { id: 6 },
      update: {},
      create: {
        username: "superadmin",
        password: "password_hash",
        first_name: "Super",
        last_name: "Admin",
        email: "superadmin@system.com",
        phone: "081-6666666",
        role: "superadmin",
        company_id: 1,
        team_id: 1,
        is_active: true,
      },
    });

    // 9. User Tags
    console.log("Seeding user tags...");
    await prisma.user_tags.upsert({
      where: {
        user_id_tag_id: {
          user_id: 1,
          tag_id: 1,
        },
      },
      update: {},
      create: {
        user_id: 1,
        tag_id: 1,
      },
    });

    await prisma.user_tags.upsert({
      where: {
        user_id_tag_id: {
          user_id: 2,
          tag_id: 2,
        },
      },
      update: {},
      create: {
        user_id: 2,
        tag_id: 2,
      },
    });

    // ==== CUSTOMER SEEDING ====

    // 10. Customers
    console.log("Seeding customers...");
    await prisma.customers.upsert({
      where: { id: "CUS-100000001" },
      update: {},
      create: {
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
        lead_source: "Facebook",
        lifecycle_status: "active",
        grade: "A",
        area_size: "5 hectares",
        plant_type: "Rice",
        subdistrict: "Suriyawong",
        district: "Bang Rak",
        postal_code: "10500",
        address: "123 Main Street",
        is_active: true,
      },
    });

    await prisma.customers.upsert({
      where: { id: "CUS-100000002" },
      update: {},
      create: {
        id: "CUS-100000002",
        first_name: "สมศรี",
        last_name: "รักการเกษตร",
        phone: "082-2345678",
        email: "somsri.rak.go.sat@example.com",
        province: "Chiang Mai",
        company_id: 1,
        assigned_to: 3,
        date_assigned: new Date(),
        date_registered: new Date(),
        lead_source: "LINE",
        lifecycle_status: "active",
        grade: "A",
        area_size: "10 hectares",
        plant_type: "Corn",
        subdistrict: "Chang Moi",
        district: "Mueang",
        postal_code: "50000",
        address: "456 Farm Road",
        is_active: true,
      },
    });

    await prisma.customers.upsert({
      where: { id: "CUS-100000003" },
      update: {},
      create: {
        id: "CUS-100000003",
        first_name: "มานี",
        last_name: "มีน้ำใจ",
        phone: "083-3456789",
        email: "mani.meenamjai@example.com",
        province: "Khon Kaen",
        company_id: 1,
        assigned_to: 2,
        date_assigned: new Date(),
        date_registered: new Date(),
        lead_source: "Referral",
        lifecycle_status: "lead",
        grade: "B",
        area_size: "3 hectares",
        plant_type: "Vegetables",
        subdistrict: "Mueang",
        district: "Mueang",
        postal_code: "40000",
        address: "789 Garden Street",
        is_active: true,
      },
    });

    // 11. Customer Tags
    // Customer tags
    console.log("Seeding customer tags...");
    await prisma.customer_tags.create({
      data: {
        customer_id: "CUS-100000001",
        tag_id: 1,
      },
    });

    await prisma.customer_tags.create({
      data: {
        customer_id: "CUS-100000002",
        tag_id: 2,
      },
    });

    await prisma.customer_tags.create({
      data: {
        customer_id: "CUS-100000002",
        tag_id: 3,
      },
    });
    console.log("Seeded 3 customer tags");

    // 12. Customer Address
    console.log("Seeding customer addresses...");
    await prisma.customer_address.upsert({
      where: { id: 1 },
      update: {},
      create: {
        customer_id: "CUS-100000001",
        address: "123 Main Street",
        recipient_first_name: "สมชาย",
        recipient_last_name: "ใจดี",
        province: "Bangkok",
        district: "Bang Rak",
        subdistrict: "Suriyawong",
        zip_code: "10500",
        created_at: new Date(),
      },
    });

    await prisma.customer_address.upsert({
      where: { id: 2 },
      update: {},
      create: {
        customer_id: "CUS-100000002",
        address: "456 Farm Road",
        recipient_first_name: "สมศรี",
        recipient_last_name: "รักการเกษตร",
        province: "Chiang Mai",
        district: "Mueang",
        subdistrict: "Chang Moi",
        zip_code: "50000",
        created_at: new Date(),
      },
    });

    // 13. Customer Assignment History
    console.log("Seeding customer assignment history...");
    await prisma.customer_assignment_history.upsert({
      where: {
        customer_id_user_id: {
          customer_id: "CUS-100000001",
          user_id: 2,
        },
      },
      update: {},
      create: {
        customer_id: "CUS-100000001",
        user_id: 2,
        assigned_at: new Date(),
      },
    });

    await prisma.customer_assignment_history.upsert({
      where: {
        customer_id_user_id: {
          customer_id: "CUS-100000002",
          user_id: 3,
        },
      },
      update: {},
      create: {
        customer_id: "CUS-100000002",
        user_id: 3,
        assigned_at: new Date(),
      },
    });

    // 14. Customer Logs
    console.log("Seeding customer logs...");
    await prisma.customer_logs.upsert({
      where: { id: 1 },
      update: {},
      create: {
        customer_id: "CUS-100000001",
        lifecycle_status: "ACTIVE",
        action_type: "INSERT",
        new_values: {
          grade: "A",
          assigned_to: 2,
        },
        changed_fields: ["grade", "assigned_to"],
        created_by: 1,
        created_at: new Date(),
      },
    });

    // 15. Customer Blocks
    console.log("Seeding customer blocks...");
    await prisma.customer_blocks.upsert({
      where: { id: 1 },
      update: {},
      create: {
        customer_id: "CUS-100000004",
        reason: "Unresponsive to calls for 3 months",
        blocked_by: 3,
        blocked_at: new Date(),
        active: true,
      },
    });

    // ==== SALES SEEDING ====

    // 16. Promotions
    console.log("Seeding promotions...");
    await prisma.promotions.upsert({
      where: { id: 1 },
      update: {},
      create: {
        sku: "PROMO2023",
        name: "Buy 10 Get 1 Free",
        description: "Special promotion for farmers buying in bulk",
        company_id: 1,
        active: true,
        start_date: new Date("2023-01-01"),
        end_date: new Date("2023-12-31"),
      },
    });

    await prisma.promotions.upsert({
      where: { id: 2 },
      update: {},
      create: {
        sku: "WELCOME2023",
        name: "New Customer Discount",
        description: "15% discount for new customers",
        company_id: 1,
        active: true,
        start_date: new Date("2023-01-01"),
        end_date: new Date("2023-12-31"),
      },
    });

    // 17. Promotion Items
    console.log("Seeding promotion items...");
    await prisma.promotion_items.upsert({
      where: { id: 1 },
      update: {},
      create: {
        promotion_id: 1,
        product_id: 1,
        quantity: 10,
        is_freebie: true,
        price_override: null,
      },
    });

    await prisma.promotion_items.upsert({
      where: { id: 2 },
      update: {},
      create: {
        promotion_id: 1,
        product_id: 2,
        quantity: 1,
        is_freebie: false,
        price_override: 150,
      },
    });

    // 18. Order Sequences
    console.log("Seeding order sequences...");
    await prisma.order_sequences.upsert({
      where: {
        company_id_period_prefix: {
          company_id: 1,
          period: "day",
          prefix: "ORD",
        },
      },
      update: {},
      create: {
        company_id: 1,
        period: "day",
        prefix: "ORD",
        last_sequence: 5,
        updated_at: new Date(),
      },
    });

    // 19. Orders
    console.log("Seeding orders...");
    await prisma.orders.upsert({
      where: { id: "ORD-100000001" },
      update: {},
      create: {
        id: "ORD-100000001",
        customer_id: "CUS-100000001",
        company_id: 1,
        creator_id: 2,
        order_date: new Date(),
        delivery_date: getRandomFutureDate(14),
        street: "123 Main Street",
        subdistrict: "Suriyawong",
        district: "Bang Rak",
        province: "Bangkok",
        postal_code: "10500",
        recipient_first_name: "สมชาย",
        recipient_last_name: "ใจดี",
        shipping_cost: 50,
        bill_discount: 0,
        total_amount: 2050,
        payment_method: "cod",
        payment_status: "pending",
        amount_paid: null,
        cod_amount: 2050,
        order_status: "pending",
        notes: "Pay after delivery order",
        sales_channel: "Facebook",
        sales_channel_page_id: 1,
        warehouse_id: 1,
      },
    });

    await prisma.orders.upsert({
      where: { id: "ORD-100000002" },
      update: {},
      create: {
        id: "ORD-100000002",
        customer_id: "CUS-100000002",
        company_id: 1,
        creator_id: 3,
        order_date: new Date(),
        delivery_date: getRandomFutureDate(14),
        street: "456 Farm Road",
        subdistrict: "Chang Moi",
        district: "Mueang",
        province: "Chiang Mai",
        postal_code: "50000",
        recipient_first_name: "สมศรี",
        recipient_last_name: "รักการเกษตร",
        shipping_cost: 75,
        bill_discount: 100,
        total_amount: 1450,
        payment_method: "cod",
        payment_status: "pending",
        amount_paid: null,
        cod_amount: 1450,
        order_status: "pending",
        notes: "Regular customer order",
        warehouse_id: 2,
      },
    });

    // 20. Order Items
    console.log("Seeding order items...");
    await prisma.order_items.upsert({
      where: { id: 1 },
      update: {},
      create: {
        order_id: "ORD-100000001",
        parent_order_id: "ORD-100000001",
        product_id: 1,
        product_name: "Premium Rice Seed",
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
        order_id: "ORD-100000001",
        parent_order_id: "ORD-100000001",
        product_id: 1,
        product_name: "Premium Rice Seed",
        quantity: 1,
        price_per_unit: 0,
        discount: 0,
        is_freebie: true,
        box_number: 1,
        is_promotion_parent: true,
        promotion_id: 1,
      },
    });

    await prisma.order_items.upsert({
      where: { id: 3 },
      update: {},
      create: {
        order_id: "ORD-100000002",
        parent_order_id: "ORD-100000002",
        product_id: 2,
        product_name: "Hybrid Corn Seed",
        quantity: 8,
        price_per_unit: 180,
        discount: 0,
        is_freebie: false,
        box_number: 1,
      },
    });

    // 21. Order Boxes
    console.log("Seeding order boxes...");
    await prisma.order_boxes.upsert({
      where: { id: 1 },
      update: {},
      create: {
        order_id: "ORD-100000001",
        box_number: 1,
        cod_amount: 2050,
      },
    });

    await prisma.order_boxes.upsert({
      where: { id: 2 },
      update: {},
      create: {
        order_id: "ORD-100000002",
        box_number: 1,
        cod_amount: 1450,
      },
    });

    // 22. Order Tracking Numbers
    console.log("Seeding order tracking numbers...");
    await prisma.order_tracking_numbers.upsert({
      where: { id: 1 },
      update: {},
      create: {
        order_id: "ORD-100000001",
        tracking_number: "TH123456789",
      },
    });

    await prisma.order_tracking_numbers.upsert({
      where: { id: 2 },
      update: {},
      create: {
        order_id: "ORD-100000002",
        tracking_number: "TH987654321",
      },
    });

    // 23. Order Slips
    console.log("Seeding order slips...");
    await prisma.order_slips.upsert({
      where: { id: 1 },
      update: {},
      create: {
        amount: 2050,
        bank_account_id: 1,
        transfer_date: getRandomFutureDate(7),
        order_id: "ORD-100000001",
        url: "/uploads/slips/ORD-100000001.jpg",
      },
    });

    // 24. Order Item Allocations
    console.log("Seeding order item allocations...");
    await prisma.order_item_allocations.upsert({
      where: { id: 1 },
      update: {},
      create: {
        order_id: "ORD-100000001",
        order_item_id: 1,
        product_id: 1,
        promotion_id: null,
        is_freebie: false,
        required_quantity: 10,
        allocated_quantity: 10,
        warehouse_id: 1,
        lot_number: "LOT20230101",
        status: "ALLOCATED",
      },
    });

    await prisma.order_item_allocations.upsert({
      where: { id: 2 },
      update: {},
      create: {
        order_id: "ORD-100000001",
        order_item_id: 2,
        product_id: 1,
        promotion_id: 1,
        is_freebie: true,
        required_quantity: 1,
        allocated_quantity: 1,
        warehouse_id: 1,
        lot_number: "LOT20230101",
        status: "ALLOCATED",
      },
    });

    // ==== INVENTORY SEEDING ====

    // 25. Warehouse Stocks
    console.log("Seeding warehouse stocks...");
    await prisma.warehouse_stocks.upsert({
      where: { id: 1 },
      update: {},
      create: {
        warehouse_id: 1,
        product_id: 1,
        lot_number: "LOT20230101",
        product_lot_id: 1,
        quantity: 300,
        reserved_quantity: 20,
        available_quantity: 280,
        expiry_date: new Date("2024-12-31"),
        purchase_price: 150,
        selling_price: 200,
        location_in_warehouse: "A1-B2",
        notes: "Main stock location",
      },
    });

    await prisma.warehouse_stocks.upsert({
      where: { id: 2 },
      update: {},
      create: {
        warehouse_id: 2,
        product_id: 2,
        lot_number: "LOT20230215",
        product_lot_id: 2,
        quantity: 300,
        reserved_quantity: 10,
        available_quantity: 290,
        expiry_date: new Date("2024-12-31"),
        purchase_price: 120,
        selling_price: 180,
        location_in_warehouse: "B3-C4",
        notes: "Secondary stock location",
      },
    });

    // 26. Stock Movements
    console.log("Seeding stock movements...");
    await prisma.stock_movements.upsert({
      where: { id: 1 },
      update: {},
      create: {
        warehouse_id: 1,
        product_id: 1,
        movement_type: "IN",
        quantity: 1000,
        lot_number: "LOT20230101",
        reference_type: "PURCHASE",
        reference_id: "PO-2023001",
        reason: "Initial stock purchase",
        notes: "Initial stock for warehouse",
        created_by: 4,
        created_at: new Date("2023-01-01"),
      },
    });

    await prisma.stock_movements.upsert({
      where: { id: 2 },
      update: {},
      create: {
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
        created_at: new Date(),
      },
    });

    // 27. Stock Reservations
    console.log("Seeding stock reservations...");
    await prisma.stock_reservations.upsert({
      where: { id: 1 },
      update: {},
      create: {
        warehouse_id: 1,
        product_id: 1,
        order_id: "ORD-100000001",
        quantity: 10,
        lot_number: "LOT20230101",
        reserved_at: new Date(),
        expires_at: getRandomFutureDate(3),
        status: "ACTIVE",
        created_by: 2,
      },
    });

    // ==== COMMUNICATION SEEDING ====

    // 28. Call History
    console.log("Seeding call history...");
    await prisma.call_history.upsert({
      where: { id: 1 },
      update: {},
      create: {
        customer_id: "CUS-100000001",
        date: new Date(),
        caller: "John Telesale",
        status: "completed",
        result: "Order placed",
        crop_type: "Rice",
        area_size: "5 hectares",
        notes: "Customer interested in premium rice seed",
        duration: 15,
      },
    });

    await prisma.call_history.upsert({
      where: { id: 2 },
      update: {},
      create: {
        customer_id: "CUS-100000002",
        date: getRandomPastDate(30),
        caller: "Jane Supervisor",
        status: "completed",
        result: "Follow-up call",
        crop_type: "Corn",
        area_size: "10 hectares",
        notes: "Checking on delivery satisfaction",
        duration: 12,
      },
    });

    // 29. Appointments
    console.log("Seeding appointments...");
    await prisma.appointments.upsert({
      where: { id: 1 },
      update: {},
      create: {
        customer_id: "CUS-100000001",
        date: getRandomFutureDate(7),
        title: "Product Demonstration",
        status: "scheduled",
        notes: "Demonstrate new seed varieties",
      },
    });

    await prisma.appointments.upsert({
      where: { id: 2 },
      update: {},
      create: {
        customer_id: "CUS-100000002",
        date: getRandomFutureDate(14),
        title: "Farm Visit",
        status: "completed",
        notes: "Customer satisfaction follow-up",
      },
    });

    // 30. Activities
    console.log("Seeding activities...");
    await prisma.activities.upsert({
      where: { id: BigInt(1) },
      update: {},
      create: {
        id: BigInt(1),
        customer_id: "CUS-100000001",
        timestamp: new Date(),
        type: "call",
        description: "Initial contact with customer",
        actor_name: "John Telesale",
      },
    });

    await prisma.activities.upsert({
      where: { id: BigInt(2) },
      update: {},
      create: {
        id: BigInt(2),
        customer_id: "CUS-100000002",
        timestamp: new Date(),
        type: "order",
        description: "Order placed by customer",
        actor_name: "Jane Supervisor",
      },
    });

    // ==== MARKETING SEEDING ====

    // 31. Pages
    console.log("Seeding pages...");
    await prisma.pages.upsert({
      where: { id: 1 },
      update: {},
      create: {
        page_id: "123456789",
        name: "Alpha Seeds Official",
        platform: "Facebook",
        page_type: "Business",
        url: "https://facebook.com/alphaseeds",
        company_id: 1,
        active: true,
        still_in_list: true,
        user_count: 1500,
        customer_count: 75,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await prisma.pages.upsert({
      where: { id: 2 },
      update: {},
      create: {
        page_id: "987654321",
        name: "Beta Agriculture",
        platform: "LINE",
        page_type: "Official Account",
        url: "https://line.me/ti/p/@betaagri",
        company_id: 2,
        active: true,
        still_in_list: true,
        user_count: 500,
        customer_count: 25,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // 32. Page Users
    console.log("Seeding page users...");
    await prisma.page_user.upsert({
      where: { page_user_id: "FB001" },
      update: {},
      create: {
        user_id: 1,
        page_user_id: "FB001",
        page_user_name: "สมชาย ใจดี",
        page_count: 15,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    await prisma.page_user.upsert({
      where: { page_user_id: "FB002" },
      update: {},
      create: {
        user_id: 2,
        page_user_id: "FB002",
        page_user_name: "สมศรี รักการเกษตร",
        page_count: 8,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // 33. Page List Users
    console.log("Seeding page list users...");
    await prisma.page_list_user.upsert({
      where: {
        page_id_page_user_id: {
          page_id: "123456789",
          page_user_id: "FB001",
        },
      },
      update: {},
      create: {
        page_id: "123456789",
        page_user_id: "FB001",
        status: "active",
        still_in_list: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // 34. Marketing User Pages
    console.log("Seeding marketing user pages...");
    await prisma.marketing_user_page.upsert({
      where: {
        page_id_user_id: {
          page_id: 1,
          user_id: 2,
        },
      },
      update: {},
      create: {
        page_id: 1,
        user_id: 2,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // 35. Ad Spend
    console.log("Seeding ad spend...");
    await prisma.ad_spend.upsert({
      where: {
        page_id_spend_date: {
          page_id: 1,
          spend_date: new Date(),
        },
      },
      update: {},
      create: {
        page_id: 1,
        spend_date: new Date(),
        amount: 1500,
        notes: "Monthly Facebook ad campaign",
      },
    });

    // 36. Marketing Ads Log
    console.log("Seeding marketing ads log...");
    await prisma.marketing_ads_log.upsert({
      where: { id: 1 },
      update: {},
      create: {
        page_id: 1,
        user_id: 2,
        date: new Date(),
        ads_cost: 1000,
        impressions: 15000,
        reach: 8000,
        clicks: 350,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // 37. Page Stats Batch
    console.log("Seeding page stats batch...");
    await prisma.page_stats_batch.upsert({
      where: { id: 1 },
      update: {},
      create: {
        date_range: "2023-11",
        created_at: new Date(),
      },
    });

    // 38. Page Stats Log
    console.log("Seeding page stats log...");
    await prisma.page_stats_log.upsert({
      where: { id: 1 },
      update: {},
      create: {
        batch_id: 1,
        page_id: "123456789",
        time_column: "date",
        new_customers: 12,
        total_phones: 15,
        new_phones: 8,
        total_comments: 45,
        total_chats: 20,
        total_page_comments: 15,
        order_count: 3,
        created_at: new Date(),
      },
    });

    // 39. Page Engagement Batch
    console.log("Seeding page engagement batch...");
    await prisma.page_engagement_batch.upsert({
      where: { id: 1 },
      update: {},
      create: {
        date_range: "2023-11",
        created_at: new Date(),
        status: "completed",
        records_count: 50,
        user_id: 2,
      },
    });

    // 40. Page Engagement Log
    console.log("Seeding page engagement log...");
    await prisma.page_engagement_log.upsert({
      where: { id: 1 },
      update: {},
      create: {
        batch_id: 1,
        page_id: "123456789",
        date: new Date(),
        inbox: 25,
        comment: 15,
        total: 40,
        new_customer_replied: 3,
        customer_engagement_new_inbox: 12,
        order_count: 5,
        created_at: new Date(),
      },
    });

    // ==== SYSTEM SEEDING ====

    // 41. Environment Variables
    console.log("Seeding environment variables...");
    await prisma.env.upsert({
      where: { key: "app_version" },
      update: { value: "1.0.0" },
      create: {
        key: "app_version",
        value: "1.0.0",
      },
    });

    // 42. Role Permissions
    console.log("Seeding role permissions...");
    await prisma.role_permissions.upsert({
      where: { role: "admin" },
      update: {},
      create: {
        role: "admin",
        data: JSON.stringify({
          customers: ["read", "write", "delete"],
          orders: ["read", "write", "delete"],
          products: ["read", "write", "delete"],
          inventory: ["read", "write", "delete"],
          reports: ["read", "write"],
        }),
      },
    });

    // 43. Notifications
    console.log("Seeding notifications...");
    await prisma.notifications.upsert({
      where: { id: "NOTIF00001" },
      update: {},
      create: {
        id: "NOTIF00001",
        type: "NEW_ORDER",
        category: "SALES",
        title: "New Order Received",
        message:
          "Order ORD-100000001 has been received and requires processing",
        timestamp: new Date(),
        is_read: false,
        priority: "HIGH",
        related_id: "ORD-100000001",
        page_id: 1,
      },
    });

    // 44. Notification Users
    console.log("Seeding notification users...");
    await prisma.notification_users.upsert({
      where: {
        notification_id_user_id: {
          notification_id: "NOTIF00001",
          user_id: 4,
        },
      },
      update: {},
      create: {
        notification_id: "NOTIF00001",
        user_id: 4,
        created_at: new Date(),
      },
    });

    // 45. Notification Settings
    console.log("Seeding notification settings...");
    await prisma.notification_settings.upsert({
      where: {
        user_id_notification_type: {
          user_id: 4,
          notification_type: "NEW_ORDER",
        },
      },
      update: {},
      create: {
        user_id: 4,
        notification_type: "NEW_ORDER",
        in_app_enabled: true,
        email_enabled: true,
        sms_enabled: false,
        business_hours_only: false,
      },
    });

    // 46. User Daily Attendance
    console.log("Seeding user daily attendance...");
    await prisma.user_daily_attendance.upsert({
      where: {
        user_id_work_date: {
          user_id: 2,
          work_date: new Date(),
        },
      },
      update: {},
      create: {
        user_id: 2,
        work_date: new Date(),
        first_login: new Date(new Date().setHours(8, 30, 0)),
        last_logout: new Date(new Date().setHours(17, 30, 0)),
        login_sessions: 2,
        effective_seconds: 32400,
        percent_of_workday: 100,
        attendance_value: 1.0,
        attendance_status: "PRESENT",
      },
    });

    // 47. User Login History
    console.log("Seeding user login history...");
    await prisma.user_login_history.upsert({
      where: { id: BigInt(1) },
      update: {},
      create: {
        id: BigInt(1),
        user_id: 2,
        login_time: new Date(),
        ip_address: "192.168.1.100",
        user_agent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        logout_time: null,
        session_duration: null,
      },
    });

    // 48. User Pancake Mapping
    console.log("Seeding user pancake mapping...");
    await prisma.user_pancake_mapping.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id_user: 2,
        id_panake: "pancake_12345",
        created_at: new Date(),
      },
    });

    // 49. Exports
    console.log("Seeding exports...");
    await prisma.exports.upsert({
      where: { id: 1 },
      update: {},
      create: {
        filename: "orders_20231118.xlsx",
        file_path: "/exports/orders_20231118.xlsx",
        orders_count: 25,
        user_id: 4,
        exported_by: "Mike Backoffice",
      },
    });

    // 50. OneCall Batch
    console.log("Seeding one call batch...");
    await prisma.onecall_batch.upsert({
      where: { id: 1 },
      update: {},
      create: {
        startdate: new Date(),
        enddate: new Date(new Date().setHours(17, 0, 0)),
        amount_record: 50,
        created_at: new Date(),
      },
    });

    // 51. OneCall Log
    console.log("Seeding one call log...");
    await prisma.onecall_log.upsert({
      where: { id: 1 },
      update: {},
      create: {
        timestamp: new Date(),
        duration: 45,
        localParty: "0811234567",
        remoteParty: "0827654321",
        direction: "outbound",
        phone_telesale: "0827654321",
        batch_id: 1,
      },
    });

    // 52. COD Records
    console.log("Seeding COD records...");
    await prisma.cod_records.upsert({
      where: { id: 1 },
      update: {},
      create: {
        tracking_number: "TH123456789",
        delivery_start_date: new Date(),
        delivery_end_date: getRandomFutureDate(3),
        cod_amount: 2050,
        received_amount: 2050,
        difference: 0,
        status: "RECEIVED",
        company_id: 1,
        created_by: 4,
        created_at: new Date(),
        updated_at: new Date(),
        bank_account_id: 1,
      },
    });

    // ==== THAI ADDRESS SEEDING ====

    // 53. Address Geographies
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

    // 54. Address Provinces
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

    // 55. Address Districts
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

    // 56. Address Sub Districts
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

    console.log("✅ Complete database seeding successful!");
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
