
export enum UserRole {
  Admin = 'Admin Page',
  Telesale = 'Telesale',
  Supervisor = 'Supervisor Telesale',
  Backoffice = 'Backoffice',
  AdminControl = 'Admin Control',
  SuperAdmin = 'Super Admin',
  Marketing = 'Marketing',
}

export enum TagType {
  System = 'SYSTEM',
  User = 'USER',
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

export type PurchaseStatus = 'Draft' | 'Ordered' | 'Partial' | 'Received' | 'Cancelled';
export type PurchasePaymentStatus = 'Unpaid' | 'Partial' | 'Paid';

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

export type ProductLotStatus = 'Active' | 'Depleted' | 'Expired';

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
    movementType: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT';
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
  New = 'New',
  Old = 'Old',
  FollowUp = 'FollowUp',
  Old3Months = 'Old3Months',
  DailyDistribution = 'DailyDistribution',
}

export enum CustomerBehavioralStatus {
    Hot = 'Hot',
    Warm = 'Warm',
    Cold = 'Cold',
    Frozen = 'Frozen',
}

export enum CustomerGrade {
    D = 'D',
    C = 'C',
    B = 'B',
    A = 'A',
    APlus = 'A+',
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
  hasSoldBefore?: boolean; // ?????????????????????????????????
  followUpCount?: number; // ???????????????????
  lastFollowUpDate?: string; // ???????????????????????
  lastSaleDate?: string; // ????????????????????
  isInWaitingBasket?: boolean; // ?????????????? 30 ??????????
  waitingBasketStartDate?: string; // ???????????????????????
  isBlocked?: boolean;
  // Order tracking fields
  firstOrderDate?: string; // วันที่ซื้อครั้งแรก
  lastOrderDate?: string; // วันที่ซื้อล่าสุด
  orderCount?: number; // จำนวนครั้งที่ซื้อ
  isNewCustomer?: boolean; // เป็นลูกค้าใหม่หรือไม่
  isRepeatCustomer?: boolean; // เป็นลูกค้ากลับมาซื้อหรือไม่
}

export enum PaymentMethod {
    COD = 'COD',
    Transfer = 'Transfer',
    PayAfter = '???????????',
}

export enum OrderStatus {
    Pending = 'Pending',
    Confirmed = 'Confirmed',
    Picking = 'Picking',
    Shipping = 'Shipping',
    Delivered = 'Delivered',
    Returned = 'Returned',
    Cancelled = 'Cancelled',
}

export enum PaymentStatus {
    Unpaid = 'Unpaid',
    PendingVerification = 'PendingVerification',
    Paid = 'Paid',
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
  promotionId?: number; // NEW: ??????????????????????????????
  parentItemId?: number; // NEW: ????????????? (????????????????????????????)
  isPromotionParent?: boolean; // NEW: ????????????????????????????????
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
  status: '?????????' | '??????????????';
  notes?: string;
}

export enum ActivityType {
    Assignment = 'assignment',
    GradeChange = 'grade_change',
    StatusChange = 'status_change',
    OrderCreated = 'order_created',
    AppointmentSet = 'appointment_set',
    CallLogged = 'call_logged',
    OrderCancelled = 'order_cancelled',
    TrackingAdded = 'tracking_added',
    PaymentVerified = 'payment_verified',
    OrderStatusChanged = 'order_status_changed',
    OrderNoteAdded = 'order_note_added',
}

export interface Activity {
    id: number;
    customerId: string;
    timestamp: string; // ISO string
    type: ActivityType;
    description: string;
    actorName: string; // Name of the user who performed the action
}

export type ModalType = 'manageOrder' | 'logCall' | 'createOrder' | 'addUser' | 'editUser' | 'addProduct' | 'editProduct' | 'confirmDelete' | 'addAppointment' | 'editCustomer' | 'manageTags' | 'viewAllActivities';

export interface ModalState {
    type: ModalType | null;
    data: any; // Can be Customer, Order, or other data for modals
}

export enum NotificationType {
    PendingVerification = 'pending_verification',
    OverduePayment = 'overdue_payment',
    ExpiringOwnership = 'expiring_ownership',
    NewOrderForCustomer = 'new_order_for_customer',
}

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    timestamp: string; // ISO string
    read: boolean;
    relatedId: string | number; // e.g., order ID or customer ID
    forRoles: UserRole[];
    userId?: number; // optional: target a specific user
}
