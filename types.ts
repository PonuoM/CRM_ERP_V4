export enum UserRole {
  Admin = "Admin Page",
  Telesale = "Telesale",
  Supervisor = "Supervisor Telesale",
  Backoffice = "Backoffice",
  Finance = "Finance",
  AdminControl = "Admin Control",
  SuperAdmin = "Super Admin",
  Marketing = "Marketing",
}

export enum TagType {
  System = "SYSTEM",
  User = "USER",
}

export interface Tag {
  id: number;
  name: string;
  type: TagType;
}

export type UserStatus = 'active' | 'inactive' | 'resigned';

export interface User {
  id: number;
  username: string;
  password?: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  role: UserRole;
  companyId: number;
  teamId?: number;
  supervisorId?: number;
  status?: UserStatus;
  customTags: Tag[];
}

export interface Company {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Warehouse {
  id: number;
  name: string;
  companyId: number;
  companyName: string;
  address: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  managerName?: string;
  managerPhone?: string;
  responsibleProvinces: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WarehouseStock {
  id: number;
  warehouseId: number;
  productId: number;
  lotNumber?: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  expiryDate?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  locationInWarehouse?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Inventory & Purchasing types
export interface Supplier {
  id: number;
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  province?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
  companyId: number;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PurchaseStatus =
  | "Draft"
  | "Ordered"
  | "Partial"
  | "Received"
  | "Cancelled";
export type PurchasePaymentStatus = "Unpaid" | "Partial" | "Paid";

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  receivedQuantity: number;
  lotNumber?: string;
  notes?: string;
}

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierId: number;
  warehouseId: number;
  companyId: number;
  purchaseDate: string; // YYYY-MM-DD
  expectedDeliveryDate?: string;
  receivedDate?: string;
  totalAmount: number;
  status: PurchaseStatus;
  paymentStatus: PurchasePaymentStatus;
  paymentMethod?: string;
  notes?: string;
  createdBy?: number;
  createdAt?: string;
  updatedAt?: string;
  items: PurchaseItem[];
}

export type ProductLotStatus = "Active" | "Depleted" | "Expired";

export interface ProductLot {
  id: number;
  lotNumber: string;
  productId: number;
  warehouseId: number;
  purchaseDate: string; // YYYY-MM-DD
  expiryDate?: string;
  quantityReceived: number;
  quantityRemaining: number;
  unitCost: number;
  supplierId?: number;
  supplierInvoice?: string;
  status: ProductLotStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StockMovement {
  id: number;
  warehouseId: number;
  productId: number;
  movementType: "IN" | "OUT" | "TRANSFER" | "ADJUSTMENT";
  quantity: number;
  lotNumber?: string;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  notes?: string;
  createdBy: number;
  createdAt: string;
}

export enum CustomerLifecycleStatus {
  New = "New",
  Old = "Old",
  FollowUp = "FollowUp",
  Old3Months = "Old3Months",
  DailyDistribution = "DailyDistribution",
}

export enum CustomerBehavioralStatus {
  Hot = "Hot",
  Warm = "Warm",
  Cold = "Cold",
  Frozen = "Frozen",
}

export enum CustomerGrade {
  D = "D",
  C = "C",
  B = "B",
  A = "A",
  APlus = "A+",
}

export interface Address {
  recipientFirstName?: string;
  recipientLastName?: string;
  street: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

export interface Customer {
  id: string;
  customerId?: string; // Public ID (e.g. CUS-xxx). Historically used as primary key in UI.
  customerRefId?: string; // Explicit public ref (customer_ref_id)
  pk?: number; // Internal database ID (customer_id)
  firstName: string;
  lastName: string;
  phone: string;
  backupPhone?: string;
  email?: string;
  address?: Address;
  province: string;
  companyId: number;
  assignedTo: number | null;
  dateAssigned: string;
  dateRegistered?: string;
  followUpDate?: string;
  ownershipExpires: string;
  lifecycleStatus: CustomerLifecycleStatus;
  previousLifecycleStatus?: CustomerLifecycleStatus; // store previous status when entering FollowUp
  behavioralStatus: CustomerBehavioralStatus;
  grade: CustomerGrade;
  tags: Tag[];
  assignmentHistory?: number[];
  totalPurchases: number;
  totalCalls: number;
  facebookName?: string;
  lineId?: string;
  doReason?: string; // Reason why customer is in Do dashboard
  lastCallNote?: string; // Latest call note for display
  // Ownership management fields
  hasSoldBefore?: boolean; // เคยซื้อสินค้ามาก่อนหรือไม่
  followUpCount?: number; // จำนวนครั้งที่ติดตาม
  lastFollowUpDate?: string; // วันที่ติดตามล่าสุด
  lastSaleDate?: string; // วันที่ขายล่าสุด
  isInWaitingBasket?: boolean; // อยู่ในตะกร้ารอ 30 วันหรือไม่
  waitingBasketStartDate?: string; // วันที่เริ่มต้นในตะกร้ารอ
}

export interface SalesImportRow {
  orderNumber?: string;
  customerId?: string;
  customerPhone?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerName?: string;
  customerEmail?: string;
  address?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  caretakerId?: number | string;
  salespersonId?: number | string;
  saleDate?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  productName?: string;
  productCode?: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  totalAmount?: number;
  notes?: string;
  recipientFirstName?: string;
  recipientLastName?: string;
  recipient_first_name?: string;
  recipient_last_name?: string;
}

export interface CustomerImportRow {
  customerId?: string;
  firstName?: string;
  lastName?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  address?: string;
  businessType?: string;
  source?: string;
  caretakerId?: number | string;
  notes?: string;
  dateRegistered?: string;
  ownershipExpires?: string;
  lifecycleStatus?: string;
  behavioralStatus?: string;
  grade?: string;
  totalPurchases?: number;
}

export interface ImportResultSummary {
  totalRows: number;
  createdCustomers: number;
  updatedCustomers: number;
  createdOrders: number;
  updatedOrders: number;
  waitingBasket: number;
  caretakerConflicts: number;
  notes: string[];
}

export interface ImportLogEntry {
  id: string;
  createdAt: string;
  type: "sales" | "customers";
  summary: ImportResultSummary;
}

export enum PaymentMethod {
  COD = "COD",
  Transfer = "Transfer",
  PayAfter = "หลังจากรับสินค้า",
}

export enum OrderStatus {
  Pending = "Pending",
  AwaitingVerification = "AwaitingVerification", // รอตรวจสอบ (หลัง Admin สร้างออเดอร์)
  Confirmed = "Confirmed",
  Preparing = "Preparing", // กำลังจัดเตรียม (หลัง Back office ดึงข้อมูล)
  Picking = "Picking",
  Shipping = "Shipping", // กำลังจัดส่ง (หลังใส่ tracking)
  PreApproved = "PreApproved", // Pre Approve (สำหรับ COD และ PayAfter)
  Delivered = "Delivered",
  Returned = "Returned",
  Cancelled = "Cancelled",
}

export enum PaymentStatus {
  Unpaid = "Unpaid",
  PendingVerification = "PendingVerification",
  Verified = "Verified", // ผ่านการตรวจสอบสลิปแล้ว แต่ยังไม่ได้ Export
  PreApproved = "PreApproved", // Pre Approve (สำหรับ COD และ PayAfter)
  Approved = "Approved", // Approve โดย Finance (ตรวจสอบเงินโอนเข้าจริงแล้ว)
  Paid = "Paid",
}

export interface LineItem {
  id: number;
  productName: string;
  quantity: number;
  pricePerUnit: number;
  discount: number;
  isFreebie: boolean;
  boxNumber: number;
  productId?: number; // Optional product ID to track products from promotions
  promotionId?: number; // NEW: รหัสโปรโมชั่นที่ใช้
  parentItemId?: number; // NEW: รหัสรายการแม่ (สำหรับของแถมที่มาจากโปรโมชั่น)
  isPromotionParent?: boolean; // NEW: เป็นรายการแม่ของโปรโมชั่นหรือไม่
  creatorId?: number; // NEW: รหัสผู้สร้างรายการ (สำหรับ upsell)
}

export interface CodBox {
  boxNumber: number;
  codAmount: number;
  collectionAmount?: number;
  collectedAmount?: number;
  waivedAmount?: number;
  paymentMethod?: PaymentMethod;
  status?: string;
  subOrderId?: string;
  trackingNumber?: string;
}

export interface TrackingEntry {
  orderId: string;
  trackingNumber: string;
  boxNumber?: number | null;
}

export interface OrderSlip {
  id: number;
  url: string;
  createdAt?: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerRefId?: number;
  companyId: number;
  creatorId: number;
  orderDate: string;
  deliveryDate: string;
  shippingAddress: Address;
  shippingProvider?: string;
  items: LineItem[];
  shippingCost: number;
  billDiscount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  slipUrl?: string;
  amountPaid?: number;
  codAmount?: number;
  orderStatus: OrderStatus;
  trackingNumbers: string[];
  trackingEntries?: TrackingEntry[];
  boxes?: CodBox[];
  notes?: string;
  warehouseId?: number;
  salesChannel?: string;
  salesChannelPageId?: number;
  bankAccountId?: number;
  transferDate?: string;
  slips?: OrderSlip[];
  verificationInfo?: {
    verifiedBy: number;
    verifiedByName: string;
    verifiedAt: string;
  };
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  cost: number;
  price: number;
  stock: number;
  companyId: number;
  shop?: string;
  status?: string;
}

export interface Page {
  id: number;
  name: string;
  platform: string; // e.g., Facebook, TikTok
  url?: string;
  companyId: number;
  active: boolean;
}

export interface AdSpend {
  id: number;
  pageId: number;
  spendDate: string; // YYYY-MM-DD
  amount: number;
  notes?: string;
}

export interface PromotionItem {
  id: number;
  promotionId?: number;
  promotion_id?: number; // API field
  productId?: number; // Frontend field
  product_id?: number; // API field
  quantity: number;
  isFreebie?: boolean; // Frontend field
  is_freebie?: boolean; // API field
  priceOverride?: number; // Frontend field
  price_override?: string; // API field
  product?: Product; // joined product data
  product_name?: string; // product name from API
  sku?: string; // product SKU from API
  product_price?: string; // product price from API
}

export interface Promotion {
  id: number;
  sku?: string;
  name: string;
  description?: string;
  companyId: number;
  active: boolean | number; // Support both boolean and number from API
  startDate?: string;
  endDate?: string;
  start_date?: string; // API field
  end_date?: string; // API field
  items: PromotionItem[];
}

export interface CallHistory {
  id: number;
  customerId: string;
  date: string;
  caller: string;
  status: string;
  result: string;
  cropType?: string;
  areaSize?: string;
  notes?: string;
  duration?: number;
}

export interface Appointment {
  id: number;
  customerId: string;
  date: string;
  title: string;
  status: "ใหม่" | "เสร็จสิ้น";
  notes?: string;
}

export enum ActivityType {
  Assignment = "assignment",
  GradeChange = "grade_change",
  StatusChange = "status_change",
  OrderCreated = "order_created",
  AppointmentSet = "appointment_set",
  CallLogged = "call_logged",
  OrderCancelled = "order_cancelled",
  TrackingAdded = "tracking_added",
  PaymentVerified = "payment_verified",
  OrderStatusChanged = "order_status_changed",
  OrderNoteAdded = "order_note_added",
}

export interface Activity {
  id: number;
  customerId: string;
  timestamp: string; // ISO string
  type: ActivityType;
  description: string;
  actorName: string; // Name of the user who performed the action
}

export interface CustomerLog {
  id: number;
  customerId: string;
  actionType: "create" | "update" | "delete";
  bucketType?: string | null;
  lifecycleStatus?: CustomerLifecycleStatus | null;
  assignedTo?: number | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  changedFields?: string[] | null;
  createdBy?: number | null;
  createdByName?: string | null;
  createdAt: string;
}

export type ModalType =
  | "manageOrder"
  | "logCall"
  | "createOrder"
  | "addUser"
  | "editUser"
  | "addProduct"
  | "editProduct"
  | "confirmDelete"
  | "addAppointment"
  | "editCustomer"
  | "manageTags"
  | "viewAllActivities";

export interface ModalState {
  type: ModalType | null;
  data: any; // Can be Customer, Order, or other data for modals
}
