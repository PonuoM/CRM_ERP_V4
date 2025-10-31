export enum UserRole {
  Admin = "Admin Page",
  Telesale = "Telesale",
  Supervisor = "Supervisor Telesale",
  Backoffice = "Backoffice",
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
  status?: string; // 'active' | 'inactive' | 'resigned'
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
  street: string;
  subdistrict: string;
  district: string;
  province: string;
  postalCode: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
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
  isBlocked?: boolean;
  // Order tracking fields
  firstOrderDate?: string; // วันที่ซื้อครั้งแรก
  lastOrderDate?: string; // วันที่ซื้อล่าสุด
  orderCount?: number; // จำนวนครั้งที่ซื้อ
  isNewCustomer?: boolean; // เป็นลูกค้าใหม่หรือไม่
  isRepeatCustomer?: boolean; // เป็นลูกค้ากลับมาซื้อหรือไม่
}

export interface SalesImportRow {
  saleDate?: string;
  orderNumber?: string;
  customerId?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  subdistrict?: string;
  district?: string;
  province?: string;
  postalCode?: string;
  address?: string;
  productCode?: string;
  productName?: string;
  quantity?: number;
  unitPrice?: number;
  discount?: number;
  totalAmount?: number;
  salespersonId?: number;
  caretakerId?: number | string;
  paymentMethod?: string;
  paymentStatus?: string;
  notes?: string;
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
  Confirmed = "Confirmed",
  Picking = "Picking",
  Shipping = "Shipping",
  Delivered = "Delivered",
  Returned = "Returned",
  Cancelled = "Cancelled",
}

export enum PaymentStatus {
  Unpaid = "Unpaid",
  PendingVerification = "PendingVerification",
  Verified = "Verified", // ผ่านการตรวจสอบสลิปแล้ว แต่ยังไม่ได้ Export
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
}

export interface CodBox {
  boxNumber: number;
  codAmount: number;
}

export interface OrderSlip {
  id: number;
  url: string;
  createdAt?: string;
}

export interface Order {
  id: string;
  customerId: string;
  companyId: number;
  creatorId: number;
  orderDate: string;
  deliveryDate: string;
  shippingAddress: Address;
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
  boxes?: CodBox[];
  notes?: string;
  warehouseId?: number;
  salesChannel?: string;
  salesChannelPageId?: number;
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

export enum NotificationCategory {
  SYSTEM = "system",
  SALES = "sales",
  CUSTOMER = "customer",
  ORDER = "order",
  PAYMENT = "payment",
  INVENTORY = "inventory",
  MARKETING = "marketing",
  REPORT = "report",
  TEAM = "team",
  PAGE_PERFORMANCE = "page_performance",
  CONTENT_MANAGEMENT = "content_management",
  CUSTOMER_INTERACTION = "customer_interaction",
}

export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum NotificationType {
  // System notifications
  SystemMaintenance = "system_maintenance",
  SystemUpdate = "system_update",

  // Customer notifications
  NewCustomerAssigned = "new_customer_assigned",
  CustomerOwnershipExpiring = "customer_ownership_expiring",
  CustomerFollowUpDue = "customer_follow_up_due",
  CustomerGradeChanged = "customer_grade_changed",

  // Order notifications
  NewOrderCreated = "new_order_created",
  OrderStatusChanged = "order_status_changed",
  OrderCancelled = "order_cancelled",
  OrderPaymentPending = "order_payment_pending",

  // Payment notifications
  PaymentVerificationRequired = "payment_verification_required",
  PaymentOverdue = "payment_overdue",
  PaymentVerified = "payment_verified",

  // Inventory notifications
  StockLow = "stock_low",
  StockOut = "stock_out",
  NewStockReceived = "new_stock_received",

  // Marketing notifications
  NewPromotionCreated = "new_promotion_created",
  PromotionExpiring = "promotion_expiring",
  CampaignPerformance = "campaign_performance",

  // Team notifications
  TeamTargetAchieved = "team_target_achieved",
  TeamMemberPerformance = "team_member_performance",
  NewTeamMember = "new_team_member",

  // Report notifications
  DailyReportReady = "daily_report_ready",
  WeeklyReportReady = "weekly_report_ready",
  MonthlyReportReady = "monthly_report_ready",

  // Page Performance notifications (for Admin role)
  PageEngagementDrop = "page_engagement_drop",
  PageReachIncrease = "page_reach_increase",
  UnansweredMessages = "unanswered_messages",
  WeeklyPageReport = "weekly_page_report",

  // Content Management notifications (for Admin role)
  HighPerformingPost = "high_performing_post",
  LowPerformingPost = "low_performing_post",
  ScheduledPostReminder = "scheduled_post_reminder",
  FacebookPolicyAlert = "facebook_policy_alert",

  // Customer Interaction notifications (for Admin role)
  NewCustomerFromPage = "new_customer_from_page",
  CustomerInquiryFromPage = "customer_inquiry_from_page",
  CustomerComplaintFromPage = "customer_complaint_from_page",
  CustomerReviewFromPage = "customer_review_from_page",

  // System & Integration notifications (for Admin role)
  PancakeApiConnectionIssue = "pancake_api_connection_issue",
  PageDataSyncSuccess = "page_data_sync_success",
  PageDataSyncFailure = "page_data_sync_failure",
  EnvironmentVariableChange = "environment_variable_change",

  // Legacy notification types (for backward compatibility)
  PendingVerification = "pending_verification",
  OverduePayment = "overdue_payment",
  ExpiringOwnership = "expiring_ownership",
  NewOrderForCustomer = "new_order_for_customer",
}

export interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string; // ISO string
  read: boolean;
  is_read?: boolean; // Raw database flag (legacy)
  priority: NotificationPriority;
  relatedId: string | number; // e.g., order ID or customer ID
  pageId?: number; // For page-related notifications
  pageName?: string; // Name of related page
  platform?: string; // Facebook, TikTok, etc.
  metrics?: {
    // For performance notifications
    previousValue?: number;
    currentValue?: number;
    percentageChange?: number;
  };
  actionUrl?: string; // URL to navigate when clicked
  actionText?: string; // Text for action button
  metadata?: Record<string, any>; // Additional data
  forRoles: UserRole[];
  userId?: number; // optional: target a specific user
}

// Notification Settings
export interface NotificationSetting {
  id: number;
  userId: number;
  notificationType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  businessHoursOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

// Notification Read Status
export interface NotificationReadStatus {
  id: number;
  notificationId: string;
  userId: number;
  readAt: string;
  createdAt: string;
}
