export const MOCK_CUSTOMERS = [
  {
    id: 1,
    first_name: "สมชาย",
    last_name: "ใจดี",
    phone: "0891234567",
    address: "123",
    sub_district: "คลองจั่น",
    district: "เขตบางกะปิ",
    province: "กรุงเทพมหานคร",
    zip_code: "10240",
    customer_type: "retail",
    social_id: null,
    is_upsell_eligible: true,
    lifecycle_status: "New"
  }
];

export const MOCK_PRODUCTS = [
  {
    id: 1,
    name: "วิตามิน C 1000mg",
    sku: "VITC-1000",
    price: 500,
    cost: 200,
    category: "Supplement",
    is_active: 1,
    company_id: 1,
  },
  {
    id: 2,
    name: "คอลลาเจน เปปไทด์",
    sku: "COL-PEP",
    price: 1000,
    cost: 400,
    category: "Supplement",
    is_active: 1,
    company_id: 1,
  }
];

export const MOCK_PROMOTIONS = [];

export const MOCK_BANKS = {
  success: true,
  data: [
    {
      id: 1,
      bank: "KBank",
      bank_number: "1234567890",
      account_name: "บจก. บริษัทจำลอง"
    }
  ]
};

export const MOCK_UPSELL_ORDERS = [
  {
    id: "ORD-UPS-001",
    customer_id: 1,
    customer_name: "สมชาย ใจดี",
    total_amount: 1000,
    payment_method: "Transfer",
    payment_status: "Paid",
    order_status: "Completed",
    created_at: "2023-11-01T10:00:00",
    items: [
      { id: 1, product_id: 1, quantity: 2, price: 500 }
    ],
    slips: [
      { id: 1, amount: 1000, transfer_date: "2023-11-01T10:00:00" }
    ]
  }
];

export const MOCK_PLATFORMS = [
  { id: 1, name: "Facebook", active: true, sortOrder: 1 },
  { id: 2, name: "Tiktok", active: true, sortOrder: 2 },
  { id: 3, name: "Line", active: true, sortOrder: 3 }
];
