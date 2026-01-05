import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  UserRole,
  User,
  UserStatus,
  Order,
  OrderSlip,
  ModalState,
  Customer,
  Product,
  Promotion,
  CallHistory,
  Appointment,
  PaymentStatus,
  OrderStatus,
  Address,
  PaymentMethod,
  CustomerLifecycleStatus,
  CustomerBehavioralStatus,
  CustomerGrade,
  Tag,
  TagType,
  Activity,
  ActivityType,
  CustomerLog,
  Company,
  Warehouse,
  WarehouseStock,
  StockMovement,
  LineItem,
  SalesImportRow,
  CustomerImportRow,
  ImportResultSummary,
} from "./types";
// Mock data removed - using real database only
import {
  listUsers,
  listCustomers,
  // listOrders removed - now fetched only in TelesaleOrdersPage
  listProducts,
  listPromotions,
  listPages,
  listPlatforms,
  listWarehouses,
  listCallHistory,
  listAppointments,
  createCustomer as apiCreateCustomer,
  createOrder as apiCreateOrder,
  createOrderSlip,
  patchOrder as apiPatchOrder,
  createCall,
  createAppointment,
  updateAppointment,
  updateCustomer,
  addCustomerTag,
  removeCustomerTag,
  listCustomerTags,
  createTag,
  listActivities,
  createActivity,
  listTags,
  updateTag,
  deleteTag,
  listAttendance,
  checkInAttendance,
  apiFetch,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
  updateOrder,
  apiSyncTrackingNumbers,
} from "./services/api";
import {
  recordFollowUp,
  getCustomerOwnershipStatus,
  recordSale,
  redistributeCustomer,
  retrieveCustomer,
} from "@/ownershipApi";
import { calculateCustomerGrade } from "@/utils/customerGrade";
import Sidebar from "./components/Sidebar";
import AdminDashboard from "./pages/AdminDashboard";
import TelesaleDashboard from "./pages/TelesaleDashboard";
import BackofficeDashboard from "./pages/BackofficeDashboard";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import OrderManagementModal from "./components/OrderManagementModal";
import AllSalesPage from "./pages/AllSalesPage";
import CustomerSearchPage from "./pages/CustomerSearchPage";
import TelesaleOrdersPage from "./pages/TelesaleOrdersPage";
import SupervisorTeamPage from "./pages/SupervisorTeamPage";
import ReportsPage from "./pages/ReportsPage";
import ProductSalesReportPage from "./pages/ProductSalesReportPage";
import CustomerDistributionPage from "./pages/CustomerDistributionPage";
import UserManagementPage from "./pages/UserManagementPage";
import ProductManagementPage from "./pages/ProductManagementPage";
import TelesaleSummaryDashboard from "./pages/TelesaleSummaryDashboard";
import PancakeUserIntegrationPage from "./pages/PancakeUserIntegrationPage";
import ManageOrdersPage from "./pages/ManageOrdersPage";
import DebtCollectionPage from "./pages/DebtCollectionPage";
import UserManagementModal from "./components/UserManagementModal";
import AllOrdersSentPage from "./pages/Accounting/AllOrdersSentPage";
import AccountingReportPage from "./pages/AccountingReportPage";
import { deleteProductWithLots } from "./services/productApi";
import ProductManagementModal from "./components/ProductManagementModal";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";
import {
  Bell,
  ChevronsUpDown,
  Menu,
  AlertCircle,
  Clock,
  Check,
  Key,
  LogOut,
  ChevronDown,
} from "lucide-react";
import { toThaiIsoString } from "./utils/datetime";
import LogCallModal from "./components/LogCallModal";
import AppointmentModal from "./components/AppointmentModal";
import EditCustomerModal from "./components/EditCustomerModal";
import BulkTrackingPage from "./pages/BulkTrackingPage";
import ExportHistoryPage from "./pages/ExportHistoryPage";
import AddCustomerPage from "./pages/AddCustomerPage";
import TagManagementModal from "./components/TagManagementModal";
import ActivityLogModal from "./components/ActivityLogModal";
import DataManagementPage from "./pages/DataManagementPage";
import ImportExportPage from "./pages/ImportExportPage";
import CompanyManagementPage from "./pages/CompanyManagementPage";
import WarehouseManagementPage from "./pages/WarehouseManagementPage";
import { CreateOrderPage } from "./pages/CreateOrderPage";
import UpsellOrderPage from "./pages/UpsellOrderPage";
import MarketingPage from "./pages/MarketingPage";
import SalesDashboard from "./pages/SalesDashboard";
import CallsDashboard from "./pages/CallsDashboard";
import PermissionsPage from "./pages/PermissionsPage";
import RoleManagementPage from "./pages/RoleManagementPage";
import BankAccountAuditPage from "./pages/Accounting/BankAccountAuditPage";
import RevenueRecognitionPage from "./pages/Accounting/RevenueRecognitionPage";
import CommissionPage from "./pages/Finance/CommissionPage";

const HALF_THRESHOLD_SECONDS = 2 * 3600;
const FULL_THRESHOLD_SECONDS = 4 * 3600;
type AttendanceSessionState = {
  userId: number;
  loginHistoryId: number | null;
  loginTime: string;
  date: string;
};

const computeAttendanceValueFromSeconds = (seconds: number): number => {
  if (seconds >= FULL_THRESHOLD_SECONDS) return 1.0;
  if (seconds >= HALF_THRESHOLD_SECONDS) return 0.5;
  if (seconds > 0) return 0.0;
  return 0.0;
};

const formatDurationText = (seconds: number): string => {
  if (seconds <= 0) return "0 นาที";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${hrs} ชม. ${mins} นาที`;
  }
  if (mins > 0) {
    return `${mins} นาที`;
  }
  return `${secs} วินาที`;
};

const formatTimeText = (iso?: string | null): string => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("th-TH", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getTodayIsoString = (): string => new Date().toISOString().slice(0, 10);

const formatCustomerId = (phone: string, companyId?: number | null): string => {
  const digitsOnly = (phone ?? "").replace(/\D/g, "");
  const withoutLeadingZero =
    digitsOnly.length > 0 && digitsOnly.startsWith("0")
      ? digitsOnly.substring(1)
      : digitsOnly;
  const baseId = `CUS-${withoutLeadingZero || digitsOnly || phone || ""}`;
  return typeof companyId === "number" ? `${baseId}-${companyId}` : baseId;
};

const normalizePhoneDigits = (phone?: string | null): string =>
  (phone ?? "").replace(/\D/g, "");
import PageStatsPage from "./pages/PageStatsPage";
import EngagementStatsPage from "./pages/EngagementStatsPage";
import TeamsManagementPage from "./pages/TeamsManagementPage";
import PagesManagementPage from "./pages/PagesManagementPage";
import PlatformsManagementPage from "./pages/PlatformsManagementPage";
import BankAccountsManagementPage from "./pages/BankAccountsManagementPage";
import TagsManagementPage from "./pages/TagsManagementPage";
import CallHistoryPage from "./pages/CallHistoryPage";
import CallDetailsPage from "./pages/CallDetailsPage";
import StockDocumentsPage from "./pages/StockDocumentsPage";
import WarehouseStockViewPage from "./pages/WarehouseStockViewPage";
import LotTrackingPage from "./pages/LotTrackingPage";
import ManageCustomersPage from "./pages/ManageCustomersPage";
import CustomerPoolsPage from "./pages/CustomerPoolsPage";
import PromotionsPage from "./pages/PromotionsPage";
import OrderAllocationPage from "./pages/OrderAllocationPage";
import SlipUpload from "./pages/SlipUpload";
import SlipAll from "./pages/SlipAll";

import FinanceApprovalPage from "./pages/FinanceApprovalPage";
import CODManagementPage from "./pages/CODManagementPage";
import GoogleSheetImportPage from "./pages/GoogleSheetImportPage";
import InventoryReportsPage from "./pages/InventoryReportsPage";
import StatementManagementPage from "./pages/StatementManagementPage";
import usePersistentState from "./utils/usePersistentState";
import { generateMainOrderId } from "./utils/orderIdGenerator";
import resolveApiBasePath from "./utils/apiBasePath";

const SLIP_ALL_LABEL = String.raw`ทั้งหมด,สลิปทั้งหมด,สลิปทั้งหมด,'สลิปทั้งหมด,>สลิปทั้งหมด,-สลิปทั้งหมด,สลิปทั้งหมด1%สลิปทั้งหมด,O.,สลิปทั้งหมด,สลิปทั้งหมด,\\\\"\\`;


const App: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(
    UserRole.Telesale,
  );
  const lastUserIdRef = useRef<number | null>(null);

  const resolvePageFromParam = useCallback((value: string | null) => {
    if (!value || value.length === 0) return "Dashboard";
    if (value === "search") return "Search";
    return value;
  }, []);

  // Check URL parameter for initial page and sidebar visibility
  const getInitialPage = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const pageParam = urlParams.get("page");
    if (pageParam) return resolvePageFromParam(pageParam);

    // Fallback to localStorage if available
    try {
      const saved = localStorage.getItem("ui.activePage");
      if (saved) return JSON.parse(saved);
    } catch { }

    return "Dashboard";
  };

  const shouldHideSidebar = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("nosidebar") === "true";
  };

  const [activePage, setActivePage] = useState<string>(getInitialPage);
  const [hideSidebar, setHideSidebar] = usePersistentState<boolean>(
    "ui.hideSidebar",
    shouldHideSidebar(),
  );
  const [modalState, setModalState] = useState<ModalState>({
    type: null,
    data: null,
  });
  const [createOrderInitialData, setCreateOrderInitialData] = useState<
    any | null
  >(null);
  const [upsellInitialData, setUpsellInitialData] = useState<{
    customer: Customer;
  } | null>(null);
  // Store previous page before navigating to CreateOrder or Upsell
  const [previousPage, setPreviousPage] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [warehouseStocks, setWarehouseStocks] = useState<WarehouseStock[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);
  const [productLots, setProductLots] = useState<any[]>([]);
  const [systemTags, setSystemTags] = useState<Tag[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([
    {
      id: 1,
      name: "สำนักงานใหญ่",
      companyId: 1,
      companyName: "Alpha Seeds Co.",
      address: "123 ถนนสุขุมวิท",
      province: "กรุงเทพมหานคร",
      district: "เขตคลองเตย",
      subdistrict: "แขวงคลองเตย",
      postalCode: "10110",
      phone: "02-123-4567",
      email: "bangkok@alphaseeds.com",
      managerName: "สมชาย ใจดี",
      managerPhone: "081-234-5678",
      responsibleProvinces: [
        "กรุงเทพมหานคร",
        "นนทบุรี",
        "ปทุมธานี",
        "สมุทรปราการ",
        "ชลบุรี",
      ],
      isActive: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    {
      id: 2,
      name: "สำนักงานสาขาเชียงใหม่",
      companyId: 1,
      companyName: "Alpha Seeds Co.",
      address: "456 ถนนเชียงใหม่-ลำปาง",
      province: "เชียงใหม่",
      district: "อำเภอเมืองเชียงใหม่",
      subdistrict: "สันป่าข่อย",
      postalCode: "50200",
      phone: "053-123-456",
      email: "chiangmai@alphaseeds.com",
      managerName: "มานี รักษาดี",
      managerPhone: "082-345-6789",
      responsibleProvinces: [
        "เชียงใหม่",
        "ลำปาง",
        "ลำพูน",
        "แพร่",
        "แม่ฮ่องสอน",
      ],
      isActive: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(
    null,
  );
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] =
    useState(false);
  const [viewingCustomerData, setViewingCustomerData] = useState<Customer | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<Record<
    string,
    { view?: boolean; use?: boolean }
  > | null>(null);
  // Session user from LoginPage (enforce same-day session)
  const [sessionUser, setSessionUser] = useState<any | null>(() => {
    try {
      const raw = localStorage.getItem("sessionUser");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const loginDate = parsed?.loginDate || parsed?.login_date;
      const today = new Date().toISOString().slice(0, 10);
      if (loginDate !== today) {
        localStorage.removeItem("sessionUser");
        return null;
      }
      // Map DB fields (snake_case) to Frontend types (camelCase)
      if (parsed.company_id && !parsed.companyId) {
        parsed.companyId = parsed.company_id;
      }
      if (parsed.user_id && !parsed.id) {
        parsed.id = parsed.user_id;
      }
      return parsed;
    } catch {
      localStorage.removeItem("sessionUser");
      return null;
    }
  });
  const [attendanceSession, setAttendanceSession] =
    usePersistentState<AttendanceSessionState | null>(
      "attendance.session",
      null,
    );
  const [attendanceInfo, setAttendanceInfo] = useState<{
    firstLogin?: string | null;
    lastLogout?: string | null;
    attendanceValue?: number | null;
    attendanceStatus?: string | null;
    effectiveSeconds?: number;
  } | null>(null);
  const [showCheckInPrompt, setShowCheckInPrompt] = useState<boolean>(false);
  const [attendanceDuration, setAttendanceDuration] = useState<number>(0);
  const [attendanceLoading, setAttendanceLoading] = useState<boolean>(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);

    if (params.has("page")) {
      const nextPage = resolvePageFromParam(params.get("page"));
      setActivePage((prev) => (prev === nextPage ? prev : nextPage));
    }

    if (params.has("nosidebar")) {
      const shouldHide = params.get("nosidebar") === "true";
      setHideSidebar((prev) => (prev === shouldHide ? prev : shouldHide));
    }
  }, [resolvePageFromParam, setActivePage, setHideSidebar]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Sync activePage to URL
    if (activePage === 'Dashboard') {
      if (params.has('page')) {
        params.delete('page');
        window.history.replaceState({}, '', url.toString());
      }
    } else {
      if (params.get('page') !== activePage) {
        params.set('page', activePage);
        window.history.replaceState({}, '', url.toString());
      }
    }

    // Sync to localStorage manually since we removed usePersistentState
    try {
      localStorage.setItem("ui.activePage", JSON.stringify(activePage));
    } catch { }

    const nextPageParam =
      !activePage || activePage === "Dashboard" ? null : activePage;
    if (nextPageParam) {
      params.set("page", nextPageParam);
    } else {
      params.delete("page");
    }

    if (hideSidebar) {
      params.set("nosidebar", "true");
    } else {
      params.delete("nosidebar");
    }

    const nextSearch = params.toString();
    const currentSearch = window.location.search.startsWith("?")
      ? window.location.search.slice(1)
      : window.location.search;

    if (nextSearch !== currentSearch) {
      const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ""
        }${url.hash}`;
      window.history.replaceState({}, "", nextUrl);
    }
  }, [activePage, hideSidebar]);

  // Permission check: Redirect to permitted page if user doesn't have access to activePage
  useEffect(() => {
    if (!sessionUser || !rolePermissions) return;

    // SuperAdmin always has access
    if (sessionUser.role === UserRole.SuperAdmin) return;

    // Page to permission key mapping
    const pagePermissionMap: Record<string, string> = {
      'Home': 'home.dashboard',
      'Dashboard': 'home.dashboard',
      'Sales Overview': 'home.sales_overview',
      'Calls Overview': 'calls.overview',
      'Call Details': 'calls.details',
      'Customers': 'nav.customers',
      'Manage Customers': 'nav.manage_customers',
      'Orders': 'nav.orders',
      'Manage Orders': 'nav.manage_orders',
      'Search': 'nav.search',
      'Debt': 'nav.debt',
      'Bulk Tracking': 'nav.bulk_tracking',
      'COD Management': 'nav.cod_management',
      'Warehouses': 'inventory.warehouses',
      'Warehouse Stock': 'inventory.stock',
      'Slip Upload': 'payment_slip.upload',
      'All Slips': 'payment_slip.all',
      'Reports': 'reports.reports',
      'Export History': 'reports.export_history',
      'Users': 'data.users',
      'Products': 'data.products',
      'Pages': 'data.pages',
      'Marketing Dashboard': 'marketing.dashboard',
      'Ads Input': 'marketing.ads_input',
      'Accounting Report': 'accounting.report',
    };

    // Check if current page needs permission check
    const permissionKey = pagePermissionMap[activePage];

    // If page has a permission key and user doesn't have view permission
    if (permissionKey && !rolePermissions[permissionKey]?.view) {
      console.log(`User doesn't have permission for ${activePage}, redirecting...`);

      // Find first allowed page
      const fallbackPages = [
        { page: 'Customers', key: 'nav.customers' },
        { page: 'Orders', key: 'nav.orders' },
        { page: 'Sales Overview', key: 'home.sales_overview' },
        { page: 'Dashboard', key: 'home.dashboard' },
      ];

      for (const fallback of fallbackPages) {
        if (rolePermissions[fallback.key]?.view) {
          setActivePage(fallback.page);
          return;
        }
      }

      // Ultimate fallback
      setActivePage('Customers');
    }
  }, [activePage, sessionUser, rolePermissions]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextPage = resolvePageFromParam(params.get("page"));
      const shouldHide = params.get("nosidebar") === "true";

      setActivePage((prev) => (prev === nextPage ? prev : nextPage));
      setHideSidebar((prev) => (prev === shouldHide ? prev : shouldHide));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [resolvePageFromParam, setActivePage, setHideSidebar]);

  // Always use real database - no mock data
  // API/UI enum mappings (global)
  const fromApiOrderStatus = (s: any): OrderStatus => {
    switch (String(s)) {
      case "Pending":
        return OrderStatus.Pending as any;
      case "AwaitingVerification":
        return OrderStatus.AwaitingVerification as any;
      case "Confirmed":
        return OrderStatus.Confirmed as any;
      case "Preparing":
        return OrderStatus.Preparing as any;
      case "Picking":
        return OrderStatus.Picking as any;
      case "Shipping":
        return OrderStatus.Shipping as any;
      case "PreApproved":
        return OrderStatus.PreApproved as any;
      case "Delivered":
        return OrderStatus.Delivered as any;
      case "Returned":
        return OrderStatus.Returned as any;
      case "Cancelled":
        return OrderStatus.Cancelled as any;
      default:
        return OrderStatus.Pending as any;
    }
  };
  const fromApiPaymentStatus = (s: any): PaymentStatus => {
    switch (String(s)) {
      case "Unpaid":
        return PaymentStatus.Unpaid as any;
      case "PendingVerification":
        return PaymentStatus.PendingVerification as any;
      case "Verified":
        return PaymentStatus.Verified as any;
      case "PreApproved":
        return PaymentStatus.PreApproved as any;
      case "Approved":
        return PaymentStatus.Approved as any;
      case "Paid":
        return PaymentStatus.Paid as any;
      default:
        return PaymentStatus.Unpaid as any;
    }
  };
  const fromApiPaymentMethod = (s: any): PaymentMethod => {
    const raw = String(s ?? "").trim();
    const value = raw.toLowerCase();
    if (value === "cod" || value === "c.o.d" || value === "cash_on_delivery") {
      return PaymentMethod.COD as any;
    }
    if (value === "transfer" || value === "bank_transfer" || value === "โอน" || value === "โอนเงิน") {
      return PaymentMethod.Transfer as any;
    }
    if (value === "payafter" || value === "pay_after" || value === "pay-after" || value === "เก็บเงินปลายทางแบบผ่อน") {
      return PaymentMethod.PayAfter as any;
    }
    if (value === "claim" || value === "ส่งเคลม") {
      return PaymentMethod.Claim as any;
    }
    if (value === "freegift" || value === "free_gift" || value === "ส่งของแถม") {
      return PaymentMethod.FreeGift as any;
    }
    return PaymentMethod.COD as any;
  };
  const mapTrackingDetailsFromApi = (raw: any): any[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((t: any) => {
      const orderId = t.order_id ?? t.orderId ?? undefined;
      const parentOrderId = t.parent_order_id ?? t.parentOrderId ?? undefined;
      const trackingNumber = t.tracking_number ?? t.trackingNumber ?? "";
      const boxNumRaw = t.box_number ?? t.boxNumber;
      const boxNumber =
        boxNumRaw !== undefined &&
          boxNumRaw !== null &&
          !Number.isNaN(Number(boxNumRaw))
          ? Number(boxNumRaw)
          : undefined;

      return {
        orderId,
        parentOrderId,
        trackingNumber,
        boxNumber,
        order_id: orderId,
        parent_order_id: parentOrderId,
        tracking_number: trackingNumber,
        box_number: boxNumber,
      };
    });
  };
  const mapOrderBoxesFromApi = (raw: any, trackingDetails: any[]): any[] => {
    if (!Array.isArray(raw)) return [];
    return raw.map((b: any) => {
      const boxNumRaw = b.box_number ?? b.boxNumber;
      const boxNumber =
        boxNumRaw !== undefined &&
          boxNumRaw !== null &&
          !Number.isNaN(Number(boxNumRaw))
          ? Number(boxNumRaw)
          : undefined;
      const codAmount = Number(
        b.cod_amount ?? b.codAmount ?? b.collection_amount ?? b.collectionAmount ?? 0,
      );
      const collectionAmount = Number(
        b.collection_amount ?? b.collectionAmount ?? codAmount ?? 0,
      );
      const collectedAmount = Number(b.collected_amount ?? b.collectedAmount ?? 0);
      const waivedAmount = Number(b.waived_amount ?? b.waivedAmount ?? 0);
      const paymentMethodRaw = b.payment_method ?? b.paymentMethod;
      const trackingForBox =
        typeof boxNumber === "number"
          ? trackingDetails.find((t: any) => {
            const tBox = t.box_number ?? t.boxNumber;
            return (
              tBox !== undefined &&
              tBox !== null &&
              Number(tBox) === boxNumber
            );
          })
          : undefined;
      const trackingNumber =
        trackingForBox?.tracking_number ??
        trackingForBox?.trackingNumber ??
        b.tracking_number ??
        b.trackingNumber;
      const subOrderId = b.sub_order_id ?? b.subOrderId ?? undefined;

      return {
        subOrderId,
        sub_order_id: subOrderId,
        boxNumber,
        box_number: boxNumber,
        codAmount,
        cod_amount: codAmount,
        collectionAmount,
        collection_amount: collectionAmount,
        collectedAmount,
        collected_amount: collectedAmount,
        waivedAmount,
        waived_amount: waivedAmount,
        paymentMethod: paymentMethodRaw
          ? fromApiPaymentMethod(paymentMethodRaw)
          : undefined,
        payment_method: paymentMethodRaw,
        status: b.status ?? undefined,
        trackingNumber: trackingNumber ? String(trackingNumber) : undefined,
        tracking_number: trackingNumber ? String(trackingNumber) : undefined,
      };
    });
  };
  const toApiOrderStatus = (s: OrderStatus): string => {
    switch (s) {
      case OrderStatus.Pending:
        return "Pending";
      case OrderStatus.AwaitingVerification:
        return "AwaitingVerification";
      case OrderStatus.Confirmed:
        return "Confirmed";
      case OrderStatus.Preparing:
        return "Preparing";
      case OrderStatus.Picking:
        return "Picking";
      case OrderStatus.Shipping:
        return "Shipping";
      case OrderStatus.PreApproved:
        return "PreApproved";
      case OrderStatus.Delivered:
        return "Delivered";
      case OrderStatus.Returned:
        return "Returned";
      case OrderStatus.Cancelled:
        return "Cancelled";
      default:
        return "Pending";
    }
  };
  const toApiPaymentStatus = (s: PaymentStatus): string => {
    switch (s) {
      case PaymentStatus.Unpaid:
        return "Unpaid";
      case PaymentStatus.PendingVerification:
        return "PendingVerification";
      case PaymentStatus.Verified:
        return "Verified";
      case PaymentStatus.PreApproved:
        return "PreApproved";
      case PaymentStatus.Approved:
        return "Approved";
      case PaymentStatus.Paid:
        return "Paid";
      default:
        return "Unpaid";
    }
  };

  const normalizeProductStatus = (rawStatus: unknown): string => {
    if (typeof rawStatus === "string") {
      const trimmed = rawStatus.trim();
      if (!trimmed) return "Active";
      const lower = trimmed.toLowerCase();
      if (lower === "inactive" || lower === "in-active") {
        return "Inactive";
      }
      if (lower === "active") {
        return "Active";
      }
      if (lower === "0" || lower === "false" || lower === "disabled") {
        return "Inactive";
      }
      if (lower === "1" || lower === "true" || lower === "enabled") {
        return "Active";
      }
      return trimmed;
    }
    if (typeof rawStatus === "boolean") {
      return rawStatus ? "Active" : "Inactive";
    }
    if (typeof rawStatus === "number") {
      return rawStatus === 0 ? "Inactive" : "Active";
    }
    return "Active";
  };

  const mapProductFromApi = (r: any): Product => {
    const companyValue =
      typeof r.company_id !== "undefined" && r.company_id !== null
        ? r.company_id
        : typeof r.companyId !== "undefined" && r.companyId !== null
          ? r.companyId
          : 0;
    const companyId =
      typeof companyValue === "number"
        ? companyValue
        : Number(companyValue) || 0;

    return {
      id: r.id,
      sku: r.sku,
      name: r.name,
      description: r.description ?? undefined,
      category: r.category,
      unit: r.unit,
      cost: Number(r.cost || 0),
      price: Number(r.price || 0),
      stock: Number(r.stock || 0),
      companyId,
      shop: r.shop ?? undefined,
      status: normalizeProductStatus(
        typeof r.status !== "undefined" ? r.status : r.active,
      ),
    };
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const isDashboard = activePage === 'Dashboard';
        const isAdmin = sessionUser?.role === UserRole.Admin;
        // Optimized: Skip loading customers global list. ManageCustomersPage handles its own pagination.
        // We only might need it for Search page (if it relies on client-side search), otherwise skip always.
        const shouldSkipCustomers = activePage !== 'Search';

        const [
          u,
          c,
          o,
          p,
          promo,
          pg,
          plats,
          ch,
          ap,
          ctags,
          act,
          tags,
          comps,
          whs,
        ] = await Promise.all([
          listUsers(sessionUser?.company_id),
          shouldSkipCustomers ? Promise.resolve([]) : listCustomers({
            companyId: sessionUser?.company_id,
            pageSize: 10000,
            assignedTo: (sessionUser.role === UserRole.Telesale || sessionUser.role === UserRole.Supervisor) ? sessionUser.id : undefined
          }),
          // Orders are now fetched only in TelesaleOrdersPage
          Promise.resolve({ ok: true, orders: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } }),
          listProducts(sessionUser?.company_id),
          listPromotions(sessionUser?.company_id),
          listPages(sessionUser?.company_id, undefined, undefined, true),
          listPlatforms(sessionUser?.company_id, true, sessionUser?.role),
          listCallHistory(),
          listAppointments({ assignedTo: sessionUser?.id, pageSize: 500 }),
          shouldSkipCustomers ? Promise.resolve([]) : listCustomerTags(),
          listActivities(),
          listTags({ type: "SYSTEM" }),
          apiFetch("companies"),
          listWarehouses(sessionUser?.company_id),
        ]);

        if (cancelled) return;

        // Debug: log raw API responses so we can verify backend data
        try {
          console.debug("API raw responses", {
            users: u,
            customers: c,
            orders: o,
            products: p,
            promotions: promo,
            pages: pg,
            callHistory: ch,
            appointments: ap,
            customerTags: ctags,
            activities: act,
            tags: tags,
            companies: comps,
          });
        } catch (logErr) {
          console.warn("Failed to log API raw responses", logErr);
        }

        // Helper function เพื่อ map customer_id (INT) เป็น customer.id (string)
        const mapActivityCustomerId = (customerIdInt: number | null, customersList: Customer[]): string => {
          if (!customerIdInt) return '';
          const customer = customersList.find(c =>
            c.pk === customerIdInt ||
            (typeof c.id === 'number' && c.id === customerIdInt)
          );
          return customer?.id || String(customerIdInt);
        };

        setActivities(
          Array.isArray(act)
            ? act.map((a) => ({
              id: a.id,
              customerId: mapActivityCustomerId(a.customer_id, customers),
              timestamp: a.timestamp,
              type: a.type,
              description: a.description,
              actorName: a.actor_name,
            }))
            : [],
        );

        // Helpers: map API enums <-> UI enums
        const fromApiOrderStatus = (s: any): OrderStatus => {
          switch (String(s)) {
            case "Pending":
              return OrderStatus.Pending as any;
            case "AwaitingVerification":
              return OrderStatus.AwaitingVerification as any;
            case "Confirmed":
              return OrderStatus.Confirmed as any;
            case "Preparing":
              return OrderStatus.Preparing as any;
            case "Picking":
              return OrderStatus.Picking as any;
            case "Shipping":
              return OrderStatus.Shipping as any;
            case "PreApproved":
              return OrderStatus.PreApproved as any;
            case "Delivered":
              return OrderStatus.Delivered as any;
            case "Returned":
              return OrderStatus.Returned as any;
            case "Cancelled":
              return OrderStatus.Cancelled as any;
            default:
              return OrderStatus.Pending as any;
          }
        };
        const fromApiPaymentStatus = (s: any): PaymentStatus => {
          switch (String(s)) {
            case "Unpaid":
              return PaymentStatus.Unpaid as any;
            case "PendingVerification":
              return PaymentStatus.PendingVerification as any;
            case "Verified":
              return PaymentStatus.Verified as any;
            case "PreApproved":
              return PaymentStatus.PreApproved as any;
            case "Approved":
              return PaymentStatus.Approved as any;
            case "Paid":
              return PaymentStatus.Paid as any;
            default:
              return PaymentStatus.Unpaid as any;
          }
        };
        const fromApiPaymentMethod = (s: any): PaymentMethod => {
          switch (String(s)) {
            case "COD":
              return PaymentMethod.COD as any;
            case "Transfer":
              return PaymentMethod.Transfer as any;
            case "PayAfter":
              return PaymentMethod.PayAfter as any;
            default:
              return PaymentMethod.COD as any;
          }
        };
        const toApiOrderStatus = (s: OrderStatus): string => {
          switch (s) {
            case OrderStatus.Pending:
              return "Pending";
            case OrderStatus.AwaitingVerification:
              return "AwaitingVerification";
            case OrderStatus.Confirmed:
              return "Confirmed";
            case OrderStatus.Preparing:
              return "Preparing";
            case OrderStatus.Picking:
              return "Picking";
            case OrderStatus.Shipping:
              return "Shipping";
            case OrderStatus.PreApproved:
              return "PreApproved";
            case OrderStatus.Delivered:
              return "Delivered";
            case OrderStatus.Returned:
              return "Returned";
            case OrderStatus.Cancelled:
              return "Cancelled";
            default:
              return "Pending";
          }
        };
        const toApiPaymentStatus = (s: PaymentStatus): string => {
          switch (s) {
            case PaymentStatus.Unpaid:
              return "Unpaid";
            case PaymentStatus.PendingVerification:
              return "PendingVerification";
            case PaymentStatus.Verified:
              return "Verified";
            case PaymentStatus.PreApproved:
              return "PreApproved";
            case PaymentStatus.Approved:
              return "Approved";
            case PaymentStatus.Paid:
              return "Paid";
            default:
              return "Unpaid";
          }
        };

        const mapUser = (r: any): User => ({
          id: r.id,
          username: r.username,
          firstName: r.first_name,
          lastName: r.last_name,
          email: r.email,
          phone: r.phone,
          role: r.role as unknown as UserRole,
          companyId: r.company_id,
          teamId:
            typeof r.team_id !== "undefined" && r.team_id !== null
              ? Number(r.team_id)
              : undefined,
          supervisorId:
            typeof r.supervisor_id !== "undefined" && r.supervisor_id !== null
              ? Number(r.supervisor_id)
              : undefined,
          status: r.status,
          customTags: Array.isArray(r.customTags)
            ? r.customTags.map((t: any) => ({
              id: Number(t.id),
              name: t.name,
              type: TagType.User,
              color: t.color ?? undefined,
            }))
            : [],
        });

        const tagsByCustomer: Record<string, Tag[]> = {};
        if (Array.isArray(ctags)) {
          for (const row of ctags as any[]) {
            const t: Tag = {
              id: Number(row.id),
              name: row.name,
              type:
                (row.type as "SYSTEM" | "USER") === "SYSTEM"
                  ? TagType.System
                  : TagType.User,
              color: row.color ?? undefined,
            };
            const cid = String(row.customer_id);
            (tagsByCustomer[cid] = tagsByCustomer[cid] || []).push(t);
          }
        }

        const mapCustomer = (r: any): Customer => {
          const totalPurchases = Number(r.total_purchases || 0);
          const pk = r.customer_id ?? r.id ?? r.pk ?? null;
          const refId =
            r.customer_ref_id ??
            r.customer_ref ??
            r.customer_refid ??
            r.customerId ??
            null;
          const resolvedId =
            pk != null ? String(pk) : refId != null ? String(refId) : "";

          return {
            id: resolvedId,
            pk: pk != null ? Number(pk) : undefined,
            customerId: refId ?? undefined,
            customerRefId: refId ?? undefined,
            firstName: r.first_name,
            lastName: r.last_name,
            phone: r.phone,
            backupPhone: r.backup_phone ?? r.backupPhone ?? "",
            email: r.email ?? undefined,
            address: {
              recipientFirstName: r.recipient_first_name || "",
              recipientLastName: r.recipient_last_name || "",
              street: r.street || "",
              subdistrict: r.subdistrict || "",
              district: r.district || "",
              province: r.province || "",
              postalCode: r.postal_code || "",
            },
            province: r.province || "",
            companyId: r.company_id,
            assignedTo:
              r.assigned_to !== null && typeof r.assigned_to !== "undefined"
                ? Number(r.assigned_to)
                : null,
            dateAssigned: r.date_assigned,
            dateRegistered: r.date_registered ?? undefined,
            followUpDate: r.follow_up_date ?? undefined,
            ownershipExpires: r.ownership_expires ?? "",
            lifecycleStatus:
              r.lifecycle_status === "New"
                ? CustomerLifecycleStatus.New
                : r.lifecycle_status === "Old"
                  ? CustomerLifecycleStatus.Old
                  : r.lifecycle_status === "FollowUp"
                    ? CustomerLifecycleStatus.FollowUp
                    : r.lifecycle_status === "Old3Months"
                      ? CustomerLifecycleStatus.Old3Months
                      : r.lifecycle_status === "DailyDistribution"
                        ? CustomerLifecycleStatus.DailyDistribution
                        : (r.lifecycle_status ?? CustomerLifecycleStatus.New),
            behavioralStatus: (r.behavioral_status ??
              "Cold") as CustomerBehavioralStatus,
            grade: calculateCustomerGrade(totalPurchases),
            tags: tagsByCustomer[resolvedId] || [],
            assignmentHistory: [],
            totalPurchases,
            totalCalls: Number(r.total_calls || 0),
            facebookName: r.facebook_name ?? undefined,
            lineId: r.line_id ?? undefined,
            isInWaitingBasket: Boolean(r.is_in_waiting_basket ?? false),
            waitingBasketStartDate: r.waiting_basket_start_date ?? undefined,
            isBlocked: Boolean(r.is_blocked ?? false),
            isUpsellEligible: Boolean(r.is_upsell_eligible ?? r.isUpsellEligible ?? false),
          };
        };

        const mapOrder = (r: any): Order => {
          const trackingDetails = mapTrackingDetailsFromApi(
            r.tracking_details ?? r.trackingDetails,
          );
          const boxes = mapOrderBoxesFromApi(r.boxes, trackingDetails);
          return {
            id: r.id,
            customerId: r.customer_id,
            companyId: r.company_id,
            creatorId: typeof r.creator_id === 'number' ? r.creator_id : Number(r.creator_id) || 0,
            orderDate: r.order_date,
            deliveryDate: r.delivery_date ?? "",
            shippingAddress: {
              recipientFirstName: r.recipient_first_name || "",
              recipientLastName: r.recipient_last_name || "",
              street: r.street || "",
              subdistrict: r.subdistrict || "",
              district: r.district || "",
              province: r.province || "",
              postalCode: r.postal_code || "",
            },
            shippingProvider: r.shipping_provider ?? r.shippingProvider ?? undefined,
            items: Array.isArray(r.items)
              ? r.items.map((it: any, i: number) => ({
                id: Number(it.id ?? i + 1),
                productId:
                  typeof it.product_id !== "undefined" && it.product_id !== null
                    ? Number(it.product_id)
                    : undefined,
                productName: String(it.product_name ?? ""),
                productSku: it.product_sku || undefined,
                quantity: Number(it.quantity ?? 0),
                pricePerUnit: Number(it.price_per_unit ?? 0),
                discount: Number(it.discount ?? 0),
                isFreebie: !!(it.is_freebie ?? 0),
                boxNumber: Number(it.box_number ?? 0),
                promotionId:
                  typeof it.promotion_id !== "undefined" &&
                    it.promotion_id !== null
                    ? Number(it.promotion_id)
                    : undefined,
                parentItemId:
                  typeof it.parent_item_id !== "undefined" &&
                    it.parent_item_id !== null
                    ? Number(it.parent_item_id)
                    : undefined,
                isPromotionParent: !!(it.is_promotion_parent ?? 0),
                creatorId:
                  typeof it.creator_id !== "undefined" &&
                    it.creator_id !== null
                    ? Number(it.creator_id)
                    : undefined,
              }))
              : [],
            shippingCost: Number(r.shipping_cost ?? 0),
            billDiscount: Number(r.bill_discount ?? 0),
            totalAmount: Number(r.total_amount || 0),
            slipUrl: r.slip_url ?? undefined,
            amountPaid:
              typeof r.amount_paid !== "undefined"
                ? Number(r.amount_paid)
                : undefined,
            codAmount:
              typeof r.cod_amount !== "undefined"
                ? Number(r.cod_amount)
                : undefined,
            paymentMethod: fromApiPaymentMethod(r.payment_method),
            paymentStatus: fromApiPaymentStatus(r.payment_status ?? "Unpaid"),
            orderStatus: fromApiOrderStatus(r.order_status ?? "Pending"),
            trackingNumbers: r.tracking_numbers
              ? String(r.tracking_numbers).split(",").filter(Boolean)
              : Array.isArray(r.trackingNumbers)
                ? r.trackingNumbers
                : [],
            trackingDetails,
            boxes,
            notes: r.notes ?? undefined,
            warehouseId:
              typeof r.warehouse_id !== "undefined" && r.warehouse_id !== null
                ? Number(r.warehouse_id)
                : undefined,
            salesChannel: r.sales_channel ?? undefined,
            salesChannelPageId:
              typeof r.sales_channel_page_id !== "undefined"
                ? Number(r.sales_channel_page_id)
                : undefined,
            slips: Array.isArray(r.slips)
              ? (r.slips as any[]).map((s) => ({
                id: Number(s.id),
                url: s.url,
                createdAt: s.created_at,
              }))
              : undefined,
            reconcileAction: r.reconcile_action || undefined,
          };
        };

        const mapCall = (r: any): CallHistory => ({
          id: r.id,
          customerId: r.customer_id,
          date: r.date,
          caller: r.caller,
          status: r.status,
          result: r.result,
          cropType: r.crop_type ?? undefined,
          areaSize: r.area_size ?? undefined,
          notes: r.notes ?? undefined,
          duration: r.duration ?? undefined,
        });

        const mapAppt = (r: any): Appointment => ({
          id: r.id,
          customerId: r.customer_id,
          date: r.date,
          title: r.title,
          status: r.status,
          notes: r.notes ?? undefined,
        });

        const mapPromotion = (r: any): Promotion => ({
          id: r.id,
          sku: r.sku ?? undefined,
          name: r.name,
          description: r.description ?? undefined,
          companyId: r.company_id,
          active: Boolean(r.active),
          startDate: r.start_date ?? undefined,
          endDate: r.end_date ?? undefined,
          items: Array.isArray(r.items)
            ? r.items.map((item: any) => ({
              id: item.id,
              promotionId: item.promotion_id,
              productId: item.product_id,
              quantity: item.quantity,
              isFreebie: Boolean(item.is_freebie),
              priceOverride: item.price_override ?? undefined,
              product: item.product_name
                ? {
                  id: item.product_id,
                  sku: item.sku ?? "",
                  name: item.product_name,
                  description: undefined,
                  category: "",
                  unit: "",
                  cost: 0,
                  price: item.product_price ?? 0,
                  stock: 0,
                  companyId: r.company_id,
                }
                : undefined,
            }))
            : [],
        });

        setUsers(Array.isArray(u) ? u.map(mapUser) : []);
        setCustomers(Array.isArray(c) ? c.map(mapCustomer) : []);
        // Filter out sub orders (orders with -1, -2, -3, etc. suffix) before mapping
        const mainOrders = Array.isArray(o)
          ? o.filter((order: any) => {
            // Exclude orders where id ends with - followed by digits (sub orders)
            const orderId = String(order.id || "");
            return !/-\d+$/.test(orderId);
          })
          : [];
        setOrders(mainOrders.map(mapOrder));
        setProducts(Array.isArray(p) ? p.map(mapProductFromApi) : []);
        setPages(
          Array.isArray(pg)
            ? pg.map((r: any) => ({
              id: r.id,
              name: r.name,
              platform: r.platform,
              url: r.url ?? undefined,
              companyId: r.company_id,
              active: Boolean(r.active),
            }))
            : [],
        );
        setPlatforms(
          Array.isArray(plats)
            ? plats.map((p: any) => ({
              id: p.id,
              name: p.name,
              displayName: p.display_name,
              description: p.description,
              active: p.active,
              sortOrder: p.sort_order,
              showPagesFrom: p.show_pages_from || null,
            }))
            : [],
        );
        setPromotions(Array.isArray(promo) ? promo.map(mapPromotion) : []);
        const callHistoryData = Array.isArray(ch) ? ch : (ch?.data || []);
        setCallHistory(Array.isArray(callHistoryData) ? callHistoryData.map(mapCall) : []);
        setAppointments(Array.isArray(ap) ? ap.map(mapAppt) : []);

        // Set system tags and companies from API
        setSystemTags(
          Array.isArray(tags)
            ? tags
              .filter((t) => t.type === "SYSTEM")
              .map((t) => ({
                id: t.id,
                name: t.name,
                type: TagType.System,
                color: t.color ?? undefined,
              }))
            : [],
        );

        setCompanies(
          Array.isArray(comps)
            ? comps.map((c) => ({
              id: c.id,
              name: c.name,
              address: c.address,
              phone: c.phone,
              email: c.email,
              taxId: c.tax_id || c.taxId,
            }))
            : [],
        );

        setWarehouses(
          Array.isArray(whs)
            ? whs.map((w) => ({
              id: w.id,
              name: w.name,
              companyId: w.company_id,
              companyName: w.company_name,
              address: w.address,
              province: w.province,
              district: w.district,
              subdistrict: w.subdistrict,
              postalCode: w.postal_code,
              phone: w.phone,
              email: w.email,
              managerName: w.manager_name,
              managerPhone: w.manager_phone,
              responsibleProvinces: Array.isArray(w.responsible_provinces)
                ? w.responsible_provinces
                : [],
              isActive: w.is_active === 1 || w.is_active === true,
            }))
            : [],
        );
      } catch (e) {
        // API failed - show error to user
        console.error("Failed to load data from database:", e);
        if (cancelled) return;
        // Set empty arrays instead of mock data
        setUsers([]);
        setCustomers([]);
        setOrders([]);
        setProducts([]);
        setPromotions([]);
        setCallHistory([]);
        setAppointments([]);
        setActivities([]);
        setSystemTags([]);
        setCompanies([]);
        setWarehouses([]);
      }


    };
    load();
    return () => {
      cancelled = true;
    };
  }, []); // Load once on mount

  // Lazy load customers for Admin when not on Dashboard
  useEffect(() => {
    if (!sessionUser?.company_id) return;

    const hasCustomers = customers.length > 0;

    // Optimized: Only lazy load customers when on the Customers/Search page
    // and if we haven't loaded them yet.
    if ((activePage === 'Search' || activePage === 'Customers') && !hasCustomers) {
      console.log("Lazy loading customers for " + activePage + "...");
      let cancelled = false;

      const lazyLoad = async () => {
        try {
          const [ctags, cData] = await Promise.all([
            listCustomerTags(),
            listCustomers({
              companyId: sessionUser.company_id,
              pageSize: 100, // Reduced from 10000 for pagination support
              page: 1,       // Initial page
              assignedTo: (sessionUser.role === UserRole.Telesale || sessionUser.role === UserRole.Supervisor) ? sessionUser.id : undefined
            }),
          ]);
          const c = cData.data || [];

          if (cancelled) return;

          const tagsByCustomer: Record<string, Tag[]> = {};
          if (Array.isArray(ctags)) {
            for (const row of ctags as any[]) {
              const t: Tag = {
                id: Number(row.id),
                name: row.name,
                type:
                  (row.type as "SYSTEM" | "USER") === "SYSTEM"
                    ? TagType.System
                    : TagType.User,
                color: row.color ?? undefined,
              };
              const cid = String(row.customer_id);
              (tagsByCustomer[cid] = tagsByCustomer[cid] || []).push(t);
            }
          }

          const mapCustomerLocal = (r: any): Customer => {
            const totalPurchases = Number(r.total_purchases || 0);
            const pk = r.customer_id ?? r.id ?? r.pk ?? null;
            const refId =
              r.customer_ref_id ??
              r.customer_ref ??
              r.customer_refid ??
              r.customerId ??
              null;
            const resolvedId =
              pk != null ? String(pk) : refId != null ? String(refId) : "";

            return {
              id: resolvedId,
              pk: pk != null ? Number(pk) : undefined,
              customerId: refId ?? undefined,
              customerRefId: refId ?? undefined,
              firstName: r.first_name,
              lastName: r.last_name,
              phone: r.phone,
              backupPhone: r.backup_phone ?? r.backupPhone ?? "",
              email: r.email ?? undefined,
              address: {
                recipientFirstName: r.recipient_first_name || "",
                recipientLastName: r.recipient_last_name || "",
                street: r.street || "",
                subdistrict: r.subdistrict || "",
                district: r.district || "",
                province: r.province || "",
                postalCode: r.postal_code || "",
              },
              province: r.province || "",
              companyId: r.company_id,
              assignedTo:
                r.assigned_to !== null && typeof r.assigned_to !== "undefined"
                  ? Number(r.assigned_to)
                  : null,
              dateAssigned: r.date_assigned,
              dateRegistered: r.date_registered ?? undefined,
              followUpDate: r.follow_up_date ?? undefined,
              ownershipExpires: r.ownership_expires ?? "",
              lifecycleStatus:
                normalizeLifecycleStatusValue(r.lifecycle_status) ??
                CustomerLifecycleStatus.New,
              behavioralStatus:
                (r.behavioral_status ?? "Cold") as CustomerBehavioralStatus,
              grade: calculateCustomerGrade(totalPurchases),
              tags: tagsByCustomer[resolvedId] || [],
              assignmentHistory: [],
              totalPurchases,
              totalCalls: Number(r.total_calls || 0),
              facebookName: r.facebook_name ?? undefined,
              lineId: r.line_id ?? undefined,
              isInWaitingBasket: Boolean(r.is_in_waiting_basket ?? false),
              waitingBasketStartDate: r.waiting_basket_start_date ?? undefined,
              isBlocked: Boolean(r.is_blocked ?? false),
              isUpsellEligible: Boolean(r.is_upsell_eligible ?? r.isUpsellEligible ?? false),
            };
          };

          const mapped = Array.isArray(c) ? c.map(mapCustomerLocal) : [];
          setCustomers(mapped);
          console.log(`Lazy loaded ${mapped.length} customers.`);
        } catch (e) {
          console.error("Lazy load failed", e);
        }
      };

      lazyLoad();
      return () => {
        cancelled = true;
      };
    }
  }, [sessionUser?.company_id, sessionUser?.role, activePage, customers.length]);

  // Refresh orders when navigating to pages that display orders
  useEffect(() => {
    if (!sessionUser?.company_id) return;

    const pagesNeedingOrders = ['Orders', 'ManageOrders', 'OrderAllocation', 'CODManagement', 'COD'];
    const needsRefresh = pagesNeedingOrders.some(page => activePage.includes(page));

    if (!needsRefresh) return;

    // Orders are now fetched only in TelesaleOrdersPage - skip refresh
    Promise.resolve({ ok: true, orders: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } })
      .then((o) => {
        if (!o || !Array.isArray(o.orders)) return;

        // Filter out sub orders (orders with -1, -2, -3, etc. suffix) before mapping
        const mainOrders = o.orders.filter((order: any) => {
          const orderId = String(order.id || "");
          return !/-\d+$/.test(orderId);
        });

        setOrders(mainOrders.map((r: any) => {
          const trackingDetails = mapTrackingDetailsFromApi(
            r.tracking_details ?? r.trackingDetails,
          );
          const boxes = mapOrderBoxesFromApi(r.boxes, trackingDetails);
          return {
            id: r.id,
            customerId: r.customer_id,
            companyId: r.company_id,
            creatorId: typeof r.creator_id === 'number' ? r.creator_id : Number(r.creator_id) || 0,
            orderDate: r.order_date,
            deliveryDate: r.delivery_date ?? "",
            shippingAddress: {
              recipientFirstName: r.recipient_first_name || "",
              recipientLastName: r.recipient_last_name || "",
              street: r.street || "",
              subdistrict: r.subdistrict || "",
              district: r.district || "",
              province: r.province || "",
              postalCode: r.postal_code || "",
            },
            items: Array.isArray(r.items)
              ? r.items.map((it: any, i: number) => ({
                id: Number(it.id ?? i + 1),
                productId:
                  typeof it.product_id !== "undefined" && it.product_id !== null
                    ? Number(it.product_id)
                    : undefined,
                productName: String(it.product_name ?? ""),
                productSku: it.product_sku || undefined,
                quantity: Number(it.quantity ?? 0),
                pricePerUnit: Number(it.price_per_unit ?? 0),
                discount: Number(it.discount ?? 0),
                isFreebie: !!(it.is_freebie ?? 0),
                boxNumber: Number(it.box_number ?? 0),
                promotionId:
                  typeof it.promotion_id !== "undefined" &&
                    it.promotion_id !== null
                    ? Number(it.promotion_id)
                    : undefined,
                parentItemId:
                  typeof it.parent_item_id !== "undefined" &&
                    it.parent_item_id !== null
                    ? Number(it.parent_item_id)
                    : undefined,
                isPromotionParent: !!(it.is_promotion_parent ?? 0),
                creatorId:
                  typeof it.creator_id !== "undefined" &&
                    it.creator_id !== null
                    ? Number(it.creator_id)
                    : undefined,
              }))
              : [],
            shippingProvider: r.shipping_provider ?? r.shippingProvider ?? undefined,
            shippingCost: Number(r.shipping_cost ?? 0),
            billDiscount: Number(r.bill_discount ?? 0),
            totalAmount: Number(r.total_amount || 0),
            slipUrl: r.slip_url ?? undefined,
            amountPaid:
              typeof r.amount_paid !== "undefined"
                ? Number(r.amount_paid)
                : undefined,
            codAmount:
              typeof r.cod_amount !== "undefined"
                ? Number(r.cod_amount)
                : undefined,
            paymentMethod: fromApiPaymentMethod(r.payment_method),
            paymentStatus: fromApiPaymentStatus(r.payment_status ?? "Unpaid"),
            orderStatus: fromApiOrderStatus(r.order_status ?? "Pending"),
            trackingNumbers: r.tracking_numbers
              ? String(r.tracking_numbers).split(",").filter(Boolean)
              : Array.isArray(r.trackingNumbers)
                ? r.trackingNumbers
                : [],
            trackingDetails,
            boxes,
            notes: r.notes ?? undefined,
            warehouseId:
              typeof r.warehouse_id !== "undefined" && r.warehouse_id !== null
                ? Number(r.warehouse_id)
                : undefined,
            salesChannel: r.sales_channel ?? undefined,
            salesChannelPageId:
              typeof r.sales_channel_page_id !== "undefined"
                ? Number(r.sales_channel_page_id)
                : undefined,
            slips: Array.isArray(r.slips)
              ? (r.slips as any[]).map((s) => ({
                id: Number(s.id),
                url: s.url,
                createdAt: s.created_at,
              }))
              : undefined,
            reconcileAction: r.reconcile_action || undefined,
          };
        }));
      })
      .catch((err) => {
        console.error('Failed to refresh orders:', err);
      });
  }, [activePage, sessionUser?.company_id]);

  const currentUser = useMemo(() => {
    if (sessionUser) {
      const byId = users.find((u) => u.id === sessionUser.id);
      if (byId) return byId;
      // If session user not found in users list, try to find a user from same company
      if (sessionUser.company_id && users.length > 0) {
        const companyUser = users.find(
          (u) => u.companyId === sessionUser.company_id,
        );
        if (companyUser) {
          console.warn(
            `Session user ID ${sessionUser.id} not found in users list, using company user ID ${companyUser.id} instead`,
          );
          return companyUser;
        }
      }
      // Last resort: use first available user
      if (users.length > 0) {
        console.warn(
          `Session user ID ${sessionUser.id} not found, using first available user ID ${users[0].id}`,
        );
        return users[0];
      }
      // If no users available, return null to trigger re-login
      // Only log error if we've actually tried to load users (not during initial load)
      // This will be handled by the useEffect below

      // FALLBACK: If we have a valid sessionUser but users list failed to load,
      // return a minimal user object from sessionUser so pages can still function (e.g. fetch customers)
      if (users.length === 0) {
        console.warn(`Users list empty, falling back to sessionUser for ID ${sessionUser.id}`);
        return {
          id: sessionUser.id,
          username: sessionUser.username,
          role: sessionUser.role,
          companyId: sessionUser.company_id,
          firstName: sessionUser.username, // Fallback
          lastName: '', // Fallback
          email: '',
          phone: '',
          status: sessionUser.status || 'active',
          customTags: [], // Ensure this is initialized to prevent iteration errors
          ...sessionUser // Spread any other props
        } as User;
      }

      return null;
    }
    return users.length > 0 ? users[0] : null;
  }, [sessionUser, users]);

  useEffect(() => {
    const loginDate = sessionUser?.loginDate || sessionUser?.login_date;
    if (!sessionUser || !loginDate || !currentUser?.id) return;
    const today = new Date().toISOString().slice(0, 10);
    if (loginDate !== today) return;

    // Wait for attendance info to be loaded
    if (attendanceLoading) return;

    // If already checked in today (has firstLogin), do not prompt
    if (attendanceInfo?.firstLogin && attendanceInfo.firstLogin.startsWith(today)) {
      return;
    }

    // Check if we've already asked this user today
    const seenKey = `checkinPromptSeenDate_${currentUser.id}`;
    const seenDate = localStorage.getItem(seenKey);

    if (seenDate !== today) {
      setShowCheckInPrompt(true);
    }
  }, [sessionUser?.id, sessionUser?.loginDate, currentUser?.id, attendanceInfo?.firstLogin, attendanceLoading]);

  // Reset landing page to Home when user changes (prevents showing previous role's page)
  useEffect(() => {
    if (!currentUser?.id) return;
    if (lastUserIdRef.current !== currentUser.id) {
      const isFirstLoad = lastUserIdRef.current === null;
      lastUserIdRef.current = currentUser.id;
      // Only reset to Home if this is a subsequent user switch, not the initial load
      if (!isFirstLoad) {
        setActivePage("Home");
      }
    }
  }, [currentUser?.id, setActivePage]);

  // Track if users have been loaded at least once
  const [usersLoaded, setUsersLoaded] = useState(false);

  // Mark users as loaded after first load completes
  useEffect(() => {
    if (users.length > 0 || (sessionUser && users.length === 0)) {
      // Users have been loaded (either we got users, or we have sessionUser but got empty array)
      setUsersLoaded(true);
    }
  }, [users.length, sessionUser]);

  // Handle case when currentUser is null (user not found or no users available)
  useEffect(() => {
    // Don't do anything if users haven't loaded yet
    if (!usersLoaded) {
      return;
    }

    // If users loaded but no currentUser and we have sessionUser, it means user not found
    if (!currentUser && sessionUser && users.length > 0) {
      console.warn(`Session user ID ${sessionUser.id} not found in users list`);
      // Clear invalid session and redirect to login
      localStorage.removeItem("sessionUser");
      setSessionUser(null);
      alert("ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาเข้าสู่ระบบใหม่");
      // Redirect to login page
      const url = new URL(window.location.href);
      url.searchParams.set("login", "1");
      window.location.href = url.toString();
      return;
    }

    // If no users at all in system (after loading)
    if (!currentUser && users.length === 0 && usersLoaded) {
      console.warn("No users available in system");
      // This is a system configuration issue, not a user issue
      // Don't redirect, just show warning
    }
  }, [currentUser, sessionUser, users.length, usersLoaded]);

  useEffect(() => {
    if (!currentUser?.id) {
      setAttendanceSession(null);
      setAttendanceInfo(null);
      setAttendanceDuration(0);
      return;
    }
    if (!attendanceSession) return;
    const today = getTodayIsoString();
    if (
      attendanceSession.userId !== currentUser.id ||
      attendanceSession.date !== today
    ) {
      setAttendanceSession(null);
      setAttendanceInfo(null);
      setAttendanceDuration(0);
    }
  }, [attendanceSession, currentUser?.id, setAttendanceSession]);

  const refreshAttendance = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!currentUser?.id) return;
      const today = getTodayIsoString();
      if (!opts?.silent) {
        setAttendanceLoading(true);
        setAttendanceError(null);
      }
      try {
        const response = await listAttendance({
          userId: currentUser.id,
          date: today,
          roleOnly: "all",
        });
        const row =
          Array.isArray(response) && response.length > 0 ? response[0] : null;
        if (row) {
          const firstLogin = row.first_login ?? row.firstLogin ?? null;
          const lastLogout = row.last_logout ?? row.lastLogout ?? null;
          const attendanceValue =
            row.attendance_value != null
              ? Number(row.attendance_value)
              : row.attendanceValue != null
                ? Number(row.attendanceValue)
                : null;
          const attendanceStatus =
            row.attendance_status ?? row.attendanceStatus ?? null;
          const effectiveSecondsRaw =
            row.effective_seconds ?? row.effectiveSeconds ?? 0;
          const effectiveSeconds =
            typeof effectiveSecondsRaw === "number"
              ? effectiveSecondsRaw
              : Number(effectiveSecondsRaw ?? 0);
          setAttendanceInfo({
            firstLogin,
            lastLogout,
            attendanceValue,
            attendanceStatus,
            effectiveSeconds,
          });
          if (firstLogin) {
            setAttendanceSession((prev) => {
              if (
                prev &&
                prev.userId === currentUser.id &&
                prev.date === today &&
                prev.loginTime === firstLogin
              ) {
                return prev;
              }
              return {
                userId: currentUser.id,
                loginHistoryId:
                  prev && prev.userId === currentUser.id
                    ? prev.loginHistoryId
                    : null,
                loginTime: firstLogin,
                date: today,
              };
            });
            const referenceEnd = lastLogout
              ? Date.parse(lastLogout)
              : Date.now();
            const durationFromTimes = Math.max(
              0,
              Math.floor((referenceEnd - Date.parse(firstLogin)) / 1000),
            );
            const derivedDuration = Math.max(
              effectiveSeconds,
              durationFromTimes,
            );
            setAttendanceDuration(derivedDuration);
          } else {
            setAttendanceSession(null);
            setAttendanceDuration(0);
          }
        } else {
          setAttendanceInfo(null);
          setAttendanceSession(null);
          setAttendanceDuration(0);
        }
        if (!opts?.silent) {
          setAttendanceError(null);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "ไม่สามารถดึงข้อมูลการเข้าเวรได้";
        if (!opts?.silent) {
          setAttendanceError(message);
        }
      } finally {
        if (!opts?.silent) {
          setAttendanceLoading(false);
        }
      }
    },
    [currentUser?.id, setAttendanceSession],
  );

  useEffect(() => {
    if (!currentUser?.id) return;
    refreshAttendance({ silent: true }).catch(() => { });
    const interval = window.setInterval(
      () => {
        refreshAttendance({ silent: true }).catch(() => { });
      },
      5 * 60 * 1000,
    );
    return () => window.clearInterval(interval);
  }, [currentUser?.id, refreshAttendance]);

  const [menuOrder, setMenuOrder] = useState<string[] | undefined>(undefined);

  // Fetch effective permissions
  useEffect(() => {
    let cancelled = false;

    async function loadPermissions() {
      if (!currentUser?.id) {
        setRolePermissions({});
        setMenuOrder(undefined);
        return;
      }

      const cacheKey = `effective_permissions:${currentUser.id}`;
      // Load cached permissions first for instant UI (if available)
      try {
        const cachedRaw = localStorage.getItem(cacheKey);
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (!cancelled) {
            setRolePermissions(cached.permissions || {});
            setMenuOrder(cached.menu_order);
          }
        }
      } catch {
        /* ignore cache errors */
      }

      try {
        const { getUserEffectivePermissions } = await import("./services/roleApi");
        const data = await getUserEffectivePermissions(currentUser.id);
        if (cancelled) return;
        setRolePermissions(data.permissions || {});
        setMenuOrder(data.menu_order);
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              permissions: data.permissions || {},
              menu_order: data.menu_order,
            }),
          );
        } catch {
          /* ignore storage errors */
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to load permissions:", err);
      }
    }

    loadPermissions();

    const handlePermissionsUpdated = () => {
      loadPermissions();
    };

    window.addEventListener('role-permissions-updated', handlePermissionsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('role-permissions-updated', handlePermissionsUpdated);
    };
  }, [currentUser?.id]);



  const handleCheckIn = useCallback(async () => {
    if (!currentUser?.id) return;
    setAttendanceLoading(true);
    setAttendanceError(null);
    const today = getTodayIsoString();
    try {
      const res = await checkInAttendance(currentUser.id);
      const attendance = (res as any)?.attendance ?? null;
      const loginTime =
        attendance?.first_login ??
        (res as any)?.loginTime ??
        new Date().toISOString();
      setAttendanceSession({
        userId: currentUser.id,
        loginHistoryId:
          typeof (res as any)?.loginHistoryId === "number"
            ? (res as any).loginHistoryId
            : null,
        loginTime,
        date: today,
      });
      const effectiveSeconds =
        typeof attendance?.effective_seconds === "number"
          ? attendance.effective_seconds
          : 0;
      setAttendanceInfo(
        attendance
          ? {
            firstLogin: attendance.first_login ?? loginTime,
            lastLogout: attendance.last_logout ?? null,
            attendanceValue:
              attendance.attendance_value != null
                ? Number(attendance.attendance_value)
                : null,
            attendanceStatus: attendance.attendance_status ?? null,
            effectiveSeconds,
          }
          : {
            firstLogin: loginTime,
            lastLogout: null,
            attendanceValue: null,
            attendanceStatus: null,
            effectiveSeconds,
          },
      );
      const derivedDuration = Math.max(
        effectiveSeconds,
        Math.max(0, Math.floor((Date.now() - Date.parse(loginTime)) / 1000)),
      );
      setAttendanceDuration(derivedDuration);
    } catch (error) {
      setAttendanceError(
        error instanceof Error
          ? error.message
          : "ไม่สามารถเช็คอินได้ กรุณาลองใหม่",
      );
    } finally {
      setAttendanceLoading(false);
    }
  }, [currentUser?.id, setAttendanceSession]);

  const handleCheckInPromptConfirm = async () => {
    if (!currentUser?.id) return;
    const today = getTodayIsoString();
    const seenKey = `checkinPromptSeenDate_${currentUser.id}`;
    localStorage.setItem(seenKey, today);
    setShowCheckInPrompt(false);
    await handleCheckIn();
  };

  const handleCheckInPromptSkip = () => {
    if (!currentUser?.id) return;
    const today = getTodayIsoString();
    const seenKey = `checkinPromptSeenDate_${currentUser.id}`;
    localStorage.setItem(seenKey, today);
    setShowCheckInPrompt(false);
  };

  const attendanceStartIso = useMemo(
    () => attendanceInfo?.firstLogin ?? attendanceSession?.loginTime ?? null,
    [attendanceInfo?.firstLogin, attendanceSession?.loginTime],
  );

  const hasCheckedIn = useMemo(
    () => Boolean(attendanceStartIso),
    [attendanceStartIso],
  );

  const computedAttendanceValue = useMemo(() => {
    const liveValue = computeAttendanceValueFromSeconds(attendanceDuration);
    const storedValue =
      attendanceInfo?.attendanceValue != null
        ? Number(attendanceInfo.attendanceValue)
        : null;
    return storedValue != null ? Math.max(storedValue, liveValue) : liveValue;
  }, [attendanceInfo?.attendanceValue, attendanceDuration]);

  useEffect(() => {
    if (!attendanceStartIso || !hasCheckedIn) return;
    const startMs = Date.parse(attendanceStartIso);
    if (Number.isNaN(startMs)) return;

    const updateDuration = () => {
      const endMs = attendanceInfo?.lastLogout
        ? Date.parse(attendanceInfo.lastLogout)
        : Date.now();
      if (Number.isNaN(endMs)) return;
      let seconds = Math.max(0, Math.floor((endMs - startMs) / 1000));
      const effectiveSecondsFromServer =
        attendanceInfo?.effectiveSeconds != null
          ? Number(attendanceInfo.effectiveSeconds)
          : null;
      if (
        effectiveSecondsFromServer != null &&
        effectiveSecondsFromServer > seconds
      ) {
        seconds = effectiveSecondsFromServer;
      }
      setAttendanceDuration((prev) => (prev === seconds ? prev : seconds));
    };

    updateDuration();

    if (attendanceInfo?.lastLogout) {
      return undefined;
    }

    const timer = window.setInterval(updateDuration, 1000);
    return () => window.clearInterval(timer);
  }, [
    attendanceStartIso,
    hasCheckedIn,
    attendanceInfo?.lastLogout,
    attendanceInfo?.effectiveSeconds,
  ]);

  const viewingCustomer = useMemo(() => {
    // Priority 1: Use explicitly set data (prevents lookup failure on lazy-loaded lists)
    if (viewingCustomerData && viewingCustomerData.id === viewingCustomerId) {
      return viewingCustomerData;
    }
    // Priority 2: Fallback to lookup (legacy support)
    if (!viewingCustomerId) return null;
    return customers.find((c) => c.id === viewingCustomerId);
  }, [viewingCustomerId, customers, viewingCustomerData]);

  const isSuperAdmin = useMemo(
    () => currentUser?.role === UserRole.SuperAdmin,
    [currentUser],
  );

  const companyCustomers = useMemo(
    () =>
      !currentUser
        ? []
        : isSuperAdmin
          ? customers
          : customers.filter((c) => c.companyId === currentUser.companyId),
    [customers, currentUser?.companyId, isSuperAdmin],
  );
  const companyOrders = useMemo(
    () =>
      !currentUser
        ? []
        : isSuperAdmin
          ? orders
          : orders.filter((o) => o.companyId === currentUser.companyId),
    [orders, currentUser?.companyId, isSuperAdmin],
  );
  const companyUsers = useMemo(
    () =>
      !currentUser
        ? []
        : isSuperAdmin
          ? users
          : users.filter((u) => u.companyId === currentUser.companyId),
    [users, currentUser?.companyId, isSuperAdmin],
  );
  const userCustomerCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    companyCustomers.forEach((customerItem) => {
      if (customerItem.assignedTo != null) {
        counts[customerItem.assignedTo] =
          (counts[customerItem.assignedTo] || 0) + 1;
      }
    });
    return counts;
  }, [companyCustomers]);
  const companyProducts = useMemo(
    () =>
      !currentUser
        ? []
        : isSuperAdmin
          ? products
          : products.filter((p) => p.companyId === currentUser.companyId),
    [products, currentUser?.companyId, isSuperAdmin],
  );

  const handleChangePassword = async () => {
    setPasswordError("");
    setIsChangingPassword(true);

    try {
      // Validate form
      if (
        !passwordForm.currentPassword ||
        !passwordForm.newPassword ||
        !passwordForm.confirmPassword
      ) {
        setPasswordError("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setPasswordError("รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน");
        return;
      }

      // Password length validation removed - no minimum length requirement

      // Call API to change password
      const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${resolveApiBasePath()}/change_password.php`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: currentUser.id,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        // Success
        alert("เปลี่ยนรหัสผ่านสำเร็จ");
        setIsChangePasswordModalOpen(false);
        setPasswordForm({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        // Error
        setPasswordError(
          result.error ||
          "à¹€à¸à¸´à¸”à¸‚à¹‰à¸­à¸œà¸´à¸”à¸žà¸¥à¸²à¸”à¹ƒà¸™à¸à¸²à¸£เปลี่ยนรหัสผ่าน",
        );
      }
    } catch (error) {
      console.error("Error changing password:", error);
      setPasswordError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const resetPersistentUiState = () => {
    try {
      localStorage.removeItem("ui.activePage");
      localStorage.removeItem("ui.hideSidebar");
      localStorage.removeItem("attendance.session");
    } catch {
      /* ignore storage errors */
    }

    setActivePage("Dashboard");
    setHideSidebar(false);
    setAttendanceSession(null);
  };

  const handleLogout = () => {
    // IMMEDIATELY clear user state to hide menu before any other operation
    setSessionUser(null);
    setRolePermissions(null);

    // Clear session data and any UI state tied to the previous role
    try {
      localStorage.removeItem("sessionUser");
    } catch {
      /* ignore storage errors */
    }
    resetPersistentUiState();

    // Redirect to login page without leftover UI query params
    const url = new URL(window.location.href);
    url.searchParams.delete("page");
    url.searchParams.delete("nosidebar");
    url.searchParams.set("login", "true");
    window.location.replace(url.toString());
  };

  // Handlers for modals and data updates
  const openModal = (type: string, data?: any) => {
    setModalState({ type, data });
    if (type === "addProduct" || type === "editProduct") {
      setModalState({ type, data });
    } else if (type === "confirmDelete") {
      setModalState({ type, data });
    } else if (type === "refreshProducts") {
      // โหลดข้อมูลสินค้า
      fetchProducts();
      fetchWarehouseStocks();
      fetchStockMovements();
      fetchProductLots();
    }
  };

  // Function to fetch products
  const fetchProducts = async () => {
    if (!currentUser?.companyId) return;

    try {
      const productsData = await listProducts(currentUser.companyId);
      const mappedProducts = Array.isArray(productsData)
        ? productsData.map(mapProductFromApi)
        : [];
      setProducts(mappedProducts);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  // Function to fetch warehouse stocks
  const fetchWarehouseStocks = async () => {
    if (!currentUser?.companyId) return;

    try {
      const result = await apiFetch(`warehouse_stocks?company_id=${currentUser.companyId}`);

      if (result.success && Array.isArray(result.data)) {
        setWarehouseStocks(result.data);
      }
    } catch (error) {
      console.error("Error fetching warehouse stocks:", error);
    }
  };

  // Function to fetch stock movements
  const fetchStockMovements = async () => {
    if (!currentUser?.companyId) return;

    try {
      const result = await apiFetch(`stock_movements?company_id=${currentUser.companyId}`);

      if (result.success && Array.isArray(result.data)) {
        setStockMovements(result.data);
      }
    } catch (error) {
      console.error("Error fetching stock movements:", error);
    }
  };

  // Function to fetch product lots
  const fetchProductLots = async () => {
    if (!currentUser?.companyId) return;

    try {
      const result = await apiFetch(`product_lots?company_id=${currentUser.companyId}`);

      if (result.success && Array.isArray(result.data)) {
        setProductLots(result.data);
      }
    } catch (error) {
      console.error("Error fetching product lots:", error);
    }
  };

  const closeModal = (saved: boolean = false) => {
    setModalState({ type: null, data: null });

    // Dispatch custom event to trigger refresh in ManageOrdersPage only if saved
    window.dispatchEvent(new CustomEvent('orderModalClosed', { detail: { saved } }));
  };

  // Fetch warehouse data when currentUser changes
  React.useEffect(() => {
    if (currentUser?.companyId) {
      fetchWarehouseStocks();
      fetchStockMovements();
      fetchProductLots();
    }
  }, [currentUser?.companyId]);

  const handleViewCustomer = (customer: Customer) => {
    setViewingCustomerData(customer);
    setViewingCustomerId(customer.id);
  }
  const handleCloseCustomerDetail = () => {
    setViewingCustomerId(null);
    setViewingCustomerData(null);
  }

  // Clear any transient create-order initial data when leaving the page
  useEffect(() => {
    if (activePage !== "CreateOrder") setCreateOrderInitialData(null);
  }, [activePage]);

  // Helper function เพื่อแปลง customerId (string หรือ INT) เป็น customer_id (INT) สำหรับบันทึก activities
  const getCustomerIdForActivity = (customerId: string | number): number | null => {
    if (typeof customerId === 'number') {
      return customerId;
    }
    // หา customer จาก customers array
    const customer = customers.find(c =>
      c.id === customerId ||
      String(c.id) === String(customerId) ||
      c.pk === customerId ||
      String(c.pk) === String(customerId)
    );
    return customer?.pk || (typeof customer?.id === 'number' ? customer.id : null);
  };

  const handleUpdateOrder = async (updatedOrder: Order) => {
    // Relaxed check: String comparison
    let originalOrder = orders.find((o) => String(o.id) === String(updatedOrder.id));

    if (!originalOrder) {
      // originalOrder not found in local state - proceed without diffing logic
      // Fallback: Proceed without originalOrder diffing logic
      // We can't do detailed activity logs or auto-status updates based on diff, but we can still save the order.
      // Create a dummy originalOrder to prevent crashes, or restructure the code to skip diff blocks.
      // Let's restructure slightly to skip diffs.
    }

    // Logic for auto-status updates based on Payment/Tracking
    if (originalOrder) {
      if (
        originalOrder.paymentStatus !== PaymentStatus.Verified &&
        updatedOrder.paymentStatus === PaymentStatus.Verified &&
        (updatedOrder.paymentMethod === PaymentMethod.Transfer ||
          updatedOrder.paymentMethod === PaymentMethod.PayAfter) &&
        updatedOrder.trackingNumbers &&
        updatedOrder.trackingNumbers.length > 0 &&
        updatedOrder.orderStatus !== OrderStatus.PreApproved &&
        updatedOrder.orderStatus !== OrderStatus.Delivered
      ) {
        updatedOrder.orderStatus = OrderStatus.PreApproved;
      }

      // Check if tracking was added manually
      const originalTracking = new Set(originalOrder.trackingNumbers || []);
      const newTracking = (updatedOrder.trackingNumbers || []).filter(
        (t) => t && !originalTracking.has(t)
      );

      if (newTracking.length > 0) {
        if (
          updatedOrder.paymentMethod === PaymentMethod.Transfer ||
          updatedOrder.paymentMethod === PaymentMethod.PayAfter
        ) {
          updatedOrder.orderStatus = OrderStatus.PreApproved;
        } else if (updatedOrder.paymentMethod === PaymentMethod.COD) {
          if (
            updatedOrder.orderStatus === OrderStatus.Picking ||
            updatedOrder.orderStatus === OrderStatus.Preparing
          ) {
            updatedOrder.orderStatus = OrderStatus.Shipping;
          }
        }
      }
    }

    const activitiesToAdd: Activity[] = [];
    const customerIdForActivity = getCustomerIdForActivity(updatedOrder.customerId);

    // Status Change Activity
    if (originalOrder && originalOrder.orderStatus !== updatedOrder.orderStatus && customerIdForActivity && currentUser) {
      activitiesToAdd.push({
        id: Date.now() + Math.random(),
        customerId: String(customerIdForActivity),
        timestamp: new Date().toISOString(),
        type: ActivityType.OrderStatusChanged,
        description: `อัปเดตสถานะคำสั่งซื้อ ${updatedOrder.id} จาก '${originalOrder.orderStatus}' เป็น '${updatedOrder.orderStatus}'`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      });
    }

    // Payment Status Change Activity
    if (
      originalOrder &&
      originalOrder.paymentStatus !== updatedOrder.paymentStatus &&
      updatedOrder.paymentStatus === PaymentStatus.Verified &&
      customerIdForActivity &&
      currentUser
    ) {
      activitiesToAdd.push({
        id: Date.now() + Math.random() + 1,
        customerId: String(customerIdForActivity),
        timestamp: new Date().toISOString(),
        type: ActivityType.PaymentVerified, // consistent with legacy type
        description: `ยืนยันการชำระเงินสาหรับคำสั่งซื้อ ${updatedOrder.id}`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      });
    }

    try {
      // Construct Payload with snake_case mapping
      const payload: any = {
        paymentStatus: updatedOrder.paymentStatus ?? undefined,
        amountPaid: (updatedOrder as any).amountPaid ?? null,
        codAmount: (updatedOrder as any).codAmount ?? null,
        notes: updatedOrder.notes ?? null,
        deliveryDate: updatedOrder.deliveryDate ?? null,
        totalAmount: updatedOrder.totalAmount ?? null,
        items: updatedOrder.items.map((item) => {
          // Check if item exists in original order
          const isExisting = originalOrder?.items?.some(
            (orig) => orig.id === item.id,
          );
          // If originalOrder is loaded, we can strictly identify new items.
          // If not loaded, we rely on backend to distinguish (SAFE b/c backend ignores ID on insert).
          if (originalOrder && !isExisting) {
            const { id, ...rest } = item;
            return rest;
          }
          return item;
        }),
        boxes: updatedOrder.boxes || [], // CRITICAL: Backend needs boxes to generate sub-order IDs
        sales_channel: updatedOrder.salesChannel,
        sales_channel_page_id: updatedOrder.salesChannelPageId,
        paymentMethod: updatedOrder.paymentMethod,
        payment_method: updatedOrder.paymentMethod,
      };

      // Map Status/Payment Enums if needed (Assuming API accepts string values or needs conversion)
      // The previous code called `toApiOrderStatus`, let's check if we need that.
      // My PHP backend uses raw strings from DB usually?
      // Let's use the values from updatedOrder directly for now, assuming they match.
      if (updatedOrder.orderStatus) payload.order_status = updatedOrder.orderStatus;
      if (updatedOrder.paymentStatus) payload.payment_status = updatedOrder.paymentStatus;


      if (updatedOrder.shippingAddress) {
        payload.recipient_first_name = updatedOrder.shippingAddress.recipientFirstName ?? "";
        payload.recipient_last_name = updatedOrder.shippingAddress.recipientLastName ?? "";
        payload.street = updatedOrder.shippingAddress.street ?? "";
        payload.subdistrict = updatedOrder.shippingAddress.subdistrict ?? "";
        payload.district = updatedOrder.shippingAddress.district ?? "";
        payload.province = updatedOrder.shippingAddress.province ?? "";
        payload.postal_code = updatedOrder.shippingAddress.postalCode ?? "";
      }

      if (updatedOrder.trackingNumbers) {
        payload.trackingNumbers = updatedOrder.trackingNumbers;
      }

      // Call API
      await updateOrder(updatedOrder.id, payload);

      // Create Activities on Backend (Optional but good for consistency)
      // We can rely on frontend state mostly, but previous code was calling createActivity.
      // I'll skip explicit createActivity call for now to simplify, as backend might eventually handle it.
      // But adding to local state is crucial.
      if (activitiesToAdd.length > 0) {
        setActivities((prev) => [...activitiesToAdd, ...prev]);

        // Fire-and-forget activity creation
        activitiesToAdd.forEach(activity => {
          createActivity({
            customerId: Number(activity.customerId),
            timestamp: activity.timestamp,
            type: activity.type,
            description: activity.description,
            actorName: activity.actorName
          }).catch(console.error);
        });
      }

      // Update Local State
      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );

      closeModal(true); // Pass true to indicate successful save
      // Optional: alert("Order updated successfully");
    } catch (e) {
      console.error("Failed to update order", e);
      alert("Failed to update order");
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (
      window.confirm(
        "คุณต้องการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่?",
      )
    ) {
      try {
        // Call API to cancel order directly
        await apiPatchOrder(orderId, { orderStatus: "Cancelled" });

        // Update local state if order exists there
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o.id === orderId ? { ...o, orderStatus: OrderStatus.Cancelled } : o,
          ),
        );

        // Dispatch event to refresh data in pages
        window.dispatchEvent(new CustomEvent('orderModalClosed'));

        alert('ยกเลิกคำสั่งซื้อเรียบร้อยแล้ว');
      } catch (e) {
        console.error("cancel API", e);
        alert('เกิดข้อผิดพลาดในการยกเลิกคำสั่งซื้อ');
      }
    }
  };

  const handleCancelOrdersBulk = async (orderIds: string[]) => {
    const validIds = orderIds.filter((id) => {
      const order = orders.find((o) => o.id === id);
      return order && order.orderStatus === OrderStatus.Pending;
    });
    if (validIds.length === 0) return;

    const activitiesToAdd: Activity[] = [];
    validIds.forEach((orderId) => {
      const orderToCancel = orders.find((o) => o.id === orderId);
      if (!orderToCancel) return;
      const customerIdForActivity = getCustomerIdForActivity(orderToCancel.customerId);
      if (customerIdForActivity) {
        activitiesToAdd.push({
          id: Date.now() + Math.random(),
          customerId: String(customerIdForActivity), // เก็บเป็น string ใน state
          timestamp: new Date().toISOString(),
          type: ActivityType.OrderCancelled,
          description: `ยกเลิกออเดอร์ ${orderId}`,
          actorName: `${currentUser.firstName} ${currentUser.lastName}`,
        });
      }
    });

    setActivities((prev) => [...activitiesToAdd, ...prev]);
    setOrders((prevOrders) =>
      prevOrders.map((o) =>
        validIds.includes(o.id) ? { ...o, orderStatus: OrderStatus.Cancelled } : o,
      ),
    );

    for (const activity of activitiesToAdd) {
      if (true) {
        try {
          // หา customerIdForActivity จาก activity.customerId
          const customerIdForActivity = getCustomerIdForActivity(activity.customerId);
          if (customerIdForActivity) {
            await createActivity({
              customerId: customerIdForActivity, // ส่ง INT ไป API
              timestamp: activity.timestamp,
              type: activity.type,
              description: activity.description,
              actorName: activity.actorName,
            });
          }
        } catch (e) {
          console.error("Failed to create activity", e);
        }
      }
    }

    for (const id of validIds) {
      try {
        await apiPatchOrder(id, { orderStatus: "Cancelled" });
      } catch (e) {
        console.error("cancel API", e);
      }
    }
  };

  const handleProcessOrders = async (orderIds: string[]) => {
    const activitiesToAdd: Activity[] = [];
    setOrders((prevOrders) => {
      const updated = prevOrders.map((o) => {
        if (orderIds.includes(o.id) && o.orderStatus === OrderStatus.Pending) {
          const customerIdForActivity = getCustomerIdForActivity(o.customerId);
          if (customerIdForActivity) {
            activitiesToAdd.push({
              id: Date.now() + Math.random(),
              customerId: String(customerIdForActivity), // เก็บเป็น string ใน state
              timestamp: new Date().toISOString(),
              type: ActivityType.OrderStatusChanged,
              description: `อัปเดตคำสั่งซื้อ ${o.id} เปลี่ยนจาก '${OrderStatus.Pending}' เป็น '${OrderStatus.Picking}'`,
              actorName: `${currentUser.firstName} ${currentUser.lastName}`,
            });
          }
          return { ...o, orderStatus: OrderStatus.Picking };
        }
        return o;
      });
      if (activitiesToAdd.length > 0) {
        if (true) {
          activitiesToAdd.forEach((activity) => {
            const customerIdForActivity = getCustomerIdForActivity(activity.customerId);
            if (customerIdForActivity) {
              createActivity({
                customerId: customerIdForActivity, // ส่ง INT ไป API
                timestamp: activity.timestamp,
                type: activity.type,
                description: activity.description,
                actorName: activity.actorName,
              }).catch((e) => {
                console.error("Failed to create activity", e);
              });
            }
          });
        }
        setActivities((prev) => [...activitiesToAdd, ...prev]);
      }
      return updated;
    });
    if (true) {
      for (const id of orderIds) {
        try {
          await apiPatchOrder(id, { orderStatus: "Picking" });
        } catch (e) {
          console.error("batch patch", e);
        }
      }
    }
  };

  const handleUpdateShippingProvider = async (orderId: string, shippingProvider: string) => {
    const previous = orders.find((o) => o.id === orderId)?.shippingProvider;
    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === orderId ? { ...o, shippingProvider } : o)),
    );
    try {
      await apiPatchOrder(orderId, { shippingProvider });
    } catch (error) {
      console.error('update shipping provider failed', error);
      setOrders((prevOrders) =>
        prevOrders.map((o) => (o.id === orderId ? { ...o, shippingProvider: previous } : o)),
      );
      alert('ไม่สามารถอัปเดตขนส่งได้');
    }
  };

  // Function to detect shipping provider for each tracking number
  const detectShippingProvider = (trackingNumber: string): string => {
    const trimmed = trackingNumber.trim().toUpperCase();
    if (!trimmed) return '-';

    // Flash Express: Starts with TH, followed by at least 10 alphanumerics (Usually 13-16 chars)
    if (/^TH[0-9A-Z]{10,}$/.test(trimmed)) {
      return 'Flash Express';
    }

    // J&T Express: Exactly 12 digits (Common starts: 8, 6, 5)
    if (/^\d{12}$/.test(trimmed)) {
      return 'J&T Express';
    }

    // Kerry Express: Starts with prefix, followed by numbers/alphanumerics
    // Common prefixes: KER, KEA, KEX, JST (from original code), KBK
    if (/^(KER|KEA|KEX|KBK|JST)[0-9A-Z]+$/.test(trimmed)) {
      return 'Kerry Express';
    }

    // Thailand Post: Standard format XX123456789TH
    if (/^[A-Z]{2}\d{9}TH$/.test(trimmed)) {
      return 'Thailand Post';
    }

    return 'Airport';
  };

  const handleBulkUpdateTracking = async (
    updates: { orderId: string; trackingNumber: string; boxNumber: number }[],
  ) => {
    const activitiesToAdd: Activity[] = [];
    const patchPromises: Promise<any>[] = [];

    // Group updates by orderId to prevent race conditions
    const updatesByOrder = new Map<string, { trackingNumber: string; boxNumber: number }[]>();
    updates.forEach(update => {
      // Resolve main order ID (remove -1, -2 suffix if present)
      const mainOrderId = update.orderId.replace(/-\d+$/, '');
      const current = updatesByOrder.get(mainOrderId) || [];
      current.push({ trackingNumber: update.trackingNumber, boxNumber: update.boxNumber });
      updatesByOrder.set(mainOrderId, current);
    });

    setOrders((prevOrders) => {
      const updatedOrdersMap = new Map(prevOrders.map((o) => [o.id, o]));

      updatesByOrder.forEach((newTrackingNumbers, orderId) => {
        const orderToUpdate = updatedOrdersMap.get(orderId);
        if (orderToUpdate) {
          const existingTrackingNumbers = (orderToUpdate as Order).trackingNumbers || [];

          // Filter out duplicates that already exist on the order
          const distinctNewTrackingNumbers = newTrackingNumbers.filter(
            u => !existingTrackingNumbers.includes(u.trackingNumber)
          );

          if (distinctNewTrackingNumbers.length > 0) {
            const customerIdForActivity = getCustomerIdForActivity((orderToUpdate as Order).customerId);
            if (customerIdForActivity) {
              distinctNewTrackingNumbers.forEach(update => {
                activitiesToAdd.push({
                  id: Date.now() + Math.random(),
                  customerId: String(customerIdForActivity),
                  timestamp: new Date().toISOString(),
                  type: ActivityType.TrackingAdded,
                  description: `เพิ่ม Tracking ${update.trackingNumber} (กล่อง ${update.boxNumber}) สำหรับคำสั่งซื้อ ${orderId}`,
                  actorName: `${currentUser.firstName} ${currentUser.lastName}`,
                });
              });
            }

            const newOrderState: Order = {
              ...(orderToUpdate as Order),
              trackingNumbers: [
                ...existingTrackingNumbers,
                ...distinctNewTrackingNumbers.map(u => u.trackingNumber),
              ],
              orderStatus:
                ((orderToUpdate as Order).paymentMethod === PaymentMethod.Transfer &&
                  ((orderToUpdate as Order).orderStatus === OrderStatus.Preparing || (orderToUpdate as Order).orderStatus === OrderStatus.Picking))
                  ? OrderStatus.PreApproved
                  : ((orderToUpdate as Order).orderStatus === OrderStatus.Preparing || (orderToUpdate as Order).orderStatus === OrderStatus.Picking)
                    ? OrderStatus.Shipping
                    : (orderToUpdate as Order).orderStatus,
              paymentStatus:
                ((orderToUpdate as Order).paymentMethod === PaymentMethod.Transfer &&
                  ((orderToUpdate as Order).orderStatus === OrderStatus.Preparing || (orderToUpdate as Order).orderStatus === OrderStatus.Picking))
                  ? PaymentStatus.PreApproved
                  : (orderToUpdate as Order).paymentStatus,
            };

            if (
              (orderToUpdate as Order).orderStatus !== newOrderState.orderStatus
            ) {
              const customerIdForActivity = getCustomerIdForActivity((orderToUpdate as Order).customerId);
              if (customerIdForActivity) {
                activitiesToAdd.push({
                  id: Date.now() + Math.random(),
                  customerId: String(customerIdForActivity),
                  timestamp: new Date().toISOString(),
                  type: ActivityType.OrderStatusChanged,
                  description: `อัปเดตสถานะคำสั่งซื้อ ${orderId} จาก '${(orderToUpdate as Order).orderStatus}' เป็น '${newOrderState.orderStatus}'`,
                  actorName: `${currentUser.firstName} ${currentUser.lastName}`,
                });
              }
            }
            updatedOrdersMap.set(orderId, newOrderState);

            if (true) {
              const dedupedNumbers = Array.from(
                new Set(newOrderState.trackingNumbers.filter(Boolean)),
              );

              // Instead of patching order, we'll collect for bulk sync
              // But for the global state update, we've already done setOrders above
              // So we just need to hit the new sync API with the new records
            }
          }
        }
      });

      return Array.from(updatedOrdersMap.values());
    });

    // Prepare bulk sync payload
    const syncPayload = updates.map(u => ({
      sub_order_id: (u.boxNumber && u.boxNumber > 1 && !u.orderId.match(/-\d+$/)) ? `${u.orderId}-${u.boxNumber}` : u.orderId,
      tracking_number: u.trackingNumber,
      shipping_provider: detectShippingProvider(u.trackingNumber)
    }));

    if (syncPayload.length > 0) {
      patchPromises.push(apiSyncTrackingNumbers(syncPayload));
    }

    if (activitiesToAdd.length > 0) {
      if (true) {
        activitiesToAdd.forEach((activity) => {
          createActivity({
            customerId: activity.customerId,
            timestamp: activity.timestamp,
            type: activity.type,
            description: activity.description,
            actorName: activity.actorName,
          }).catch((e) => {
            console.error("Failed to create activity", e);
          });
        });
      }
      setActivities((prev) => [...activitiesToAdd, ...prev]);
    }

    if (true && patchPromises.length) {
      try {
        await Promise.all(patchPromises);
      } catch (e) {
        console.error("bulk tracking patch", e);
      }
    }
  };




  // Force update
  const handleCreateOrder = async (payload: {
    order: Partial<Omit<Order, "id" | "orderDate" | "companyId" | "creatorId">>;
    newCustomer?: Omit<
      Customer,
      | "id"
      | "companyId"
      | "totalPurchases"
      | "totalCalls"
      | "tags"
      | "assignmentHistory"
    >;
    customerUpdate?: Partial<
      Pick<Customer, "address" | "facebookName" | "lineId" | "backupPhone">
    >;
    updateCustomerInfo?: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      backupPhone?: string | null;
    };
    slipUploads?: string[];
    bankAccountId?: number;
    transferDate?: string;
  }): Promise<string | undefined> => {
    const {
      order: newOrderData,
      newCustomer: newCustomerData,
      customerUpdate,
      updateCustomerInfo,
      slipUploads,
      bankAccountId,
      transferDate,
    } = payload;
    const slipUploadsArray = Array.isArray(slipUploads)
      ? slipUploads
        .map((entry: any) => {
          if (typeof entry === "string") {
            return {
              dataUrl: entry,
              bankAccountId: undefined,
              transferDate: undefined,
              amount: undefined,
            };
          }
          return {
            dataUrl: entry?.dataUrl,
            bankAccountId: entry?.bankAccountId,
            transferDate: entry?.transferDate,
            amount: entry?.amount,
          };
        })
        .filter(
          (content) =>
            typeof content.dataUrl === "string" &&
            content.dataUrl.trim() !== "",
        )
      : [];
    let uploadedSlips: OrderSlip[] = [];
    let customerIdForOrder = newOrderData.customerId;

    if (newCustomerData && newCustomerData.phone) {
      const newCustomerId = formatCustomerId(
        newCustomerData.phone,
        currentUser.companyId,
      );
      const normalizedPhone = normalizePhoneDigits(newCustomerData.phone);
      const existingCustomer = customers.find((c) => {
        const sameId = c.id === newCustomerId;
        const samePhone =
          normalizedPhone !== "" &&
          normalizePhoneDigits(c.phone) === normalizedPhone &&
          (c.companyId ?? null) === currentUser.companyId;
        return sameId || samePhone;
      });

      if (existingCustomer) {
        const fullName =
          [existingCustomer.firstName, existingCustomer.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() || "-";
        const ownerName =
          existingCustomer.assignedTo != null
            ? (() => {
              const owner = users.find(
                (u) => u.id === existingCustomer.assignedTo,
              );
              if (owner) {
                return `${owner.firstName} ${owner.lastName}`.trim();
              }
              return `ID ${existingCustomer.assignedTo}`;
            })()
            : "ยังไม่ได้มอบหมาย";
        alert(
          [
            "ไม่สามารถสร้างออเดอร์ให้ลูกค้าใหม่ได้",
            "เนื่องจากพบลูกค้ารายนี้อยู่ในระบบแล้ว",
            `ชื่อ: ${fullName}`,
            `เบอร์โทรศัพท์: ${existingCustomer.phone || "-"}`,
            `ผู้ดูแลปัจจุบัน: ${ownerName}`,
          ].join("\n"),
        );
        return;
      }

      const newCustomer: Customer = {
        ...newCustomerData,
        id: newCustomerId,
        companyId: currentUser.companyId,
        assignedTo:
          currentUser.role === UserRole.Admin ? (null as any) : currentUser.id,
        dateAssigned: toThaiIsoString(new Date()),
        totalPurchases: 0,
        totalCalls: 0,
        tags: [],
        assignmentHistory: [],
        grade: calculateCustomerGrade(0),
      };
      try {
        console.log("Creating customer payload", {
          id: newCustomer.id,
          phone: newCustomer.phone,
          backupPhone: newCustomer.backupPhone,
          backup_phone: newCustomer.backupPhone,
        });
        const res = await apiCreateCustomer({
          id: newCustomer.id,
          firstName: newCustomer.firstName,
          lastName: newCustomer.lastName,
          phone: newCustomer.phone,
          backupPhone: newCustomer.backupPhone,
          backup_phone: newCustomer.backupPhone, // backend legacy snake_case
          email: newCustomer.email,
          province: newCustomer.province,
          companyId: newCustomer.companyId,
          assignedTo:
            currentUser.role === UserRole.Admin ? null : currentUser.id,
          dateAssigned: newCustomer.dateAssigned,
          dateRegistered: toThaiIsoString(new Date()),
          followUpDate: null,
          ownershipExpires: toThaiIsoString(new Date(Date.now() + 30 * 24 * 3600 * 1000)),
          lifecycleStatus:
            newCustomer.lifecycleStatus ?? CustomerLifecycleStatus.New,
          behavioralStatus:
            newCustomer.behavioralStatus ?? CustomerBehavioralStatus.Cold,
          grade: newCustomer.grade ?? calculateCustomerGrade(0),
          totalPurchases: 0,
          totalCalls: 0,
          facebookName: newCustomer.facebookName ?? null,
          lineId: newCustomer.lineId ?? null,
          address: newCustomer.address ?? {},
        });
        console.log("Create customer response", res);
        console.log("Customer created successfully:", res);
        if (res && res.customer_id) {
          newCustomer.pk = res.customer_id;
          customerIdForOrder = res.customer_id;
        } else {
          console.warn("API did not return customer_id, using string ID fallback");
          customerIdForOrder = newCustomer.id;
        }

      } catch (e) {
        console.error("create customer API failed", e);
        alert("ไม่สามารถสร้างลูกค้าได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง");
        return; // Don't proceed with order creation if customer creation fails
      }
      setCustomers((prev) => [newCustomer, ...prev]);
    }

    if (!customerIdForOrder) {
      alert("Customer ID is missing.");
      return;
    }

    // Validate current user has valid ID and exists in users list
    if (!currentUser?.id) {
      alert(
        "ไม่สามารถสร้างออเดอร์ได้: ไม่พบข้อมูลผู้ใช้งานในระบบ กรุณาล็อกอินใหม่",
      );
      return;
    }

    // Double check user exists in loaded users list to prevent FK errors
    const userExists = users.some((u) => u.id === currentUser.id);
    if (!userExists) {
      console.warn(
        `Current user ID ${currentUser.id} not found in users list, but proceeding with ID from auth state`,
      );
    }

    // If updating existing customer info (name, phone, backupPhone)
    if (updateCustomerInfo && newOrderData.customerId) {
      const existingCus = customers.find(c => c.id === newOrderData.customerId || c.pk === newOrderData.customerId);
      const targetId = existingCus?.pk || newOrderData.customerId;
      try {
        console.log("Updating customer info during order", {
          targetId,
          updateCustomerInfo,
        });
        await updateCustomer(String(targetId), {
          ...updateCustomerInfo,
          backup_phone: updateCustomerInfo.backupPhone, // backend legacy snake_case
        });
        // Update local state
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === newOrderData.customerId || c.pk === newOrderData.customerId
              ? { ...c, ...updateCustomerInfo }
              : c,
          ),
        );
      } catch (e) {
        console.error("Failed to update customer info during order creation", e);
      }
    }

    // If updating existing customer (e.g. address/social)
    if (customerUpdate && newOrderData.customerId) {
      const existingCus = customers.find(c => c.id === newOrderData.customerId || c.pk === newOrderData.customerId);
      const targetId = existingCus?.pk || newOrderData.customerId;
      try {
        console.log("Updating customer during order", {
          targetId,
          backupPhone: customerUpdate.backupPhone,
          backup_phone: customerUpdate.backupPhone,
        });
        await updateCustomer(String(targetId), {
          ...customerUpdate,
          address: customerUpdate.address,
          facebookName: customerUpdate.facebookName,
          lineId: customerUpdate.lineId,
          backupPhone: customerUpdate.backupPhone,
          backup_phone: customerUpdate.backupPhone, // backend legacy snake_case
        });
        // Update local state
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === newOrderData.customerId || c.pk === newOrderData.customerId
              ? { ...c, ...customerUpdate }
              : c,
          ),
        );
      } catch (e) {
        console.error("Failed to update customer info during order creation", e);
      }
    }

    // Generate main order ID
    const mainOrderId = await generateMainOrderId(
      currentUser,
      currentUser.companyId,
    );

    try {
      const orderPayload = {
        ...newOrderData,
        id: mainOrderId,
        customerId: customerIdForOrder,
        companyId: currentUser.companyId,
        creatorId: currentUser.id,
        orderDate: toThaiIsoString(new Date()),
        bankAccountId: bankAccountId,
        transferDate: transferDate,
      };

      // If single slip and no multi-slip support in API yet, use slipUrl for the first one
      if (slipUploadsArray.length === 1) {
        (orderPayload as any).slipUrl = slipUploadsArray[0].dataUrl;
      }

      const res = await apiCreateOrder(orderPayload);

      if (res && res.ok) {
        const createdOrderId = res.id;

        // บันทึกกิจกรรมการสร้างออเดอร์
        const customer = customers.find(c => c.id === customerIdForOrder || c.pk === customerIdForOrder);
        if (customer) {
          // ใช้ customer_id (INT) สำหรับบันทึก activities
          const customerIdForActivity = customer.pk || (typeof customer.id === 'number' ? customer.id : null);

          if (customerIdForActivity) {
            const newActivity: Activity = {
              id: Date.now() + Math.random(),
              customerId: String(customerIdForActivity), // เก็บเป็น string ใน state
              timestamp: toThaiIsoString(new Date()),
              type: ActivityType.OrderCreated,
              description: `สร้างคำสั่งซื้อ ${createdOrderId} สำหรับลูกค้า "${customer.firstName} ${customer.lastName}"`,
              actorName: `${currentUser.firstName} ${currentUser.lastName}`,
            };

            if (true) {
              try {
                await createActivity({
                  customerId: customerIdForActivity, // ส่ง INT ไป API
                  timestamp: newActivity.timestamp,
                  type: newActivity.type,
                  description: newActivity.description,
                  actorName: newActivity.actorName,
                });
              } catch (e) {
                console.error("Failed to create activity for new order", e);
              }
            }
            setActivities((prev) => [newActivity, ...prev]);
          }
        }

        // Handle multiple slips upload
        if (slipUploadsArray.length > 0) {
          for (const slipContent of slipUploadsArray) {
            try {
              await createOrderSlip(createdOrderId, slipContent.dataUrl, {
                bankAccountId:
                  slipContent.bankAccountId !== undefined
                    ? slipContent.bankAccountId
                    : bankAccountId,
                transferDate: slipContent.transferDate ?? transferDate,
                amount: slipContent.amount,
                uploadedBy: currentUser.id,
                uploadedByName: `${currentUser.firstName} ${currentUser.lastName}`,
              });
            } catch (err) {
              console.error("Failed to upload slip", err);
            }
          }
        }

        // Refresh orders, customers, and activities with proper mapping
        const [refreshedOrdersRaw, refreshedCustomersRaw, refreshedActivitiesRaw, refreshedCustomerTagsRaw] = await Promise.all([
          // Orders are now fetched only in TelesaleOrdersPage
          Promise.resolve({ ok: true, orders: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } }),
          activePage === 'Customers' ? listCustomers({
            companyId: currentUser.companyId,
          }) : Promise.resolve({ total: 0, data: [] }),
          listActivities(),
          listCustomerTags(),
        ]);

        // Map orders (filter out sub orders and map)
        const mainOrders = Array.isArray(refreshedOrdersRaw)
          ? refreshedOrdersRaw.filter((order: any) => {
            const orderId = String(order.id || "");
            return !/-\d+$/.test(orderId);
          })
          : [];
        const mappedOrders = mainOrders.map((r: any) => ({
          id: r.id,
          customerId: r.customer_id,
          companyId: r.company_id,
          creatorId: typeof r.creator_id === 'number' ? r.creator_id : Number(r.creator_id) || 0,
          orderDate: r.order_date,
          deliveryDate: r.delivery_date ?? "",
          shippingAddress: {
            recipientFirstName: r.recipient_first_name || "",
            recipientLastName: r.recipient_last_name || "",
            street: r.street || "",
            subdistrict: r.subdistrict || "",
            district: r.district || "",
            province: r.province || "",
            postalCode: r.postal_code || "",
          },
          items: Array.isArray(r.items)
            ? r.items.map((it: any, i: number) => ({
              id: Number(it.id ?? i + 1),
              productId:
                typeof it.product_id !== "undefined" && it.product_id !== null
                  ? Number(it.product_id)
                  : undefined,
              productName: String(it.product_name ?? ""),
              productSku: it.product_sku || undefined,
              quantity: Number(it.quantity ?? 0),
              pricePerUnit: Number(it.price_per_unit ?? 0),
              discount: Number(it.discount ?? 0),
              isFreebie: !!(it.is_freebie ?? 0),
              boxNumber: Number(it.box_number ?? 0),
              promotionId:
                typeof it.promotion_id !== "undefined" &&
                  it.promotion_id !== null
                  ? Number(it.promotion_id)
                  : undefined,
              parentItemId:
                typeof it.parent_item_id !== "undefined" &&
                  it.parent_item_id !== null
                  ? Number(it.parent_item_id)
                  : undefined,
              isPromotionParent: !!(it.is_promotion_parent ?? 0),
              creatorId:
                typeof it.creator_id !== "undefined" &&
                  it.creator_id !== null
                  ? Number(it.creator_id)
                  : undefined,
            }))
            : [],
          shippingCost: Number(r.shipping_cost ?? 0),
          billDiscount: Number(r.bill_discount ?? 0),
          totalAmount: Number(r.total_amount || 0),
          slipUrl: r.slip_url ?? undefined,
          amountPaid:
            typeof r.amount_paid !== "undefined"
              ? Number(r.amount_paid)
              : undefined,
          codAmount:
            typeof r.cod_amount !== "undefined"
              ? Number(r.cod_amount)
              : undefined,
          paymentMethod: (() => {
            switch (String(r.payment_method)) {
              case "COD":
                return PaymentMethod.COD as any;
              case "Transfer":
                return PaymentMethod.Transfer as any;
              case "PayAfter":
                return PaymentMethod.PayAfter as any;
              default:
                return PaymentMethod.COD as any;
            }
          })(),
          paymentStatus: (() => {
            switch (String(r.payment_status ?? "Unpaid")) {
              case "Unpaid":
                return PaymentStatus.Unpaid as any;
              case "PendingVerification":
                return PaymentStatus.PendingVerification as any;
              case "Verified":
                return PaymentStatus.Verified as any;
              case "PreApproved":
                return PaymentStatus.PreApproved as any;
              case "Approved":
                return PaymentStatus.Approved as any;
              case "Paid":
                return PaymentStatus.Paid as any;
              default:
                return PaymentStatus.Unpaid as any;
            }
          })(),
          orderStatus: (() => {
            switch (String(r.order_status ?? "Pending")) {
              case "Pending":
                return OrderStatus.Pending as any;
              case "AwaitingVerification":
                return OrderStatus.AwaitingVerification as any;
              case "Confirmed":
                return OrderStatus.Confirmed as any;
              case "Preparing":
                return OrderStatus.Preparing as any;
              case "Picking":
                return OrderStatus.Picking as any;
              case "Shipping":
                return OrderStatus.Shipping as any;
              case "PreApproved":
                return OrderStatus.PreApproved as any;
              case "Delivered":
                return OrderStatus.Delivered as any;
              case "Returned":
                return OrderStatus.Returned as any;
              case "Cancelled":
                return OrderStatus.Cancelled as any;
              default:
                return OrderStatus.Pending as any;
            }
          })(),
          trackingNumbers: r.tracking_numbers
            ? String(r.tracking_numbers).split(",").filter(Boolean)
            : Array.isArray(r.trackingNumbers)
              ? r.trackingNumbers
              : [],
          notes: r.notes ?? undefined,
          warehouseId:
            typeof r.warehouse_id !== "undefined" && r.warehouse_id !== null
              ? Number(r.warehouse_id)
              : undefined,
          salesChannel: r.sales_channel ?? undefined,
          salesChannelPageId:
            typeof r.sales_channel_page_id !== "undefined"
              ? Number(r.sales_channel_page_id)
              : undefined,
          slips: Array.isArray(r.slips)
            ? (r.slips as any[]).map((s) => ({
              id: Number(s.id),
              url: s.url,
              createdAt: s.created_at,
            }))
            : undefined,
        }));
        setOrders(mappedOrders);

        // Helper function เพื่อ map customer_id (INT) เป็น customer.id (string)
        const mapActivityCustomerId = (customerIdInt: number | null, customersList: Customer[]): string => {
          if (!customerIdInt) return '';
          const customer = customersList.find(c =>
            c.pk === customerIdInt ||
            (typeof c.id === 'number' && c.id === customerIdInt)
          );
          return customer?.id || String(customerIdInt);
        };

        // Build tags map for customers
        const tagsByCustomer: Record<string, Tag[]> = {};
        if (Array.isArray(refreshedCustomerTagsRaw)) {
          for (const ct of refreshedCustomerTagsRaw) {
            const cid = String(ct.customer_id || "");
            if (!tagsByCustomer[cid]) tagsByCustomer[cid] = [];
            tagsByCustomer[cid].push({
              id: ct.id,
              name: ct.name,
              type: ct.type as TagType,
            });
          }
        }

        // Map customers
        const customersData = (refreshedCustomersRaw as any).data || [];
        const mappedCustomers = Array.isArray(customersData)
          ? customersData.map((r: any) => {
            const totalPurchases = Number(r.total_purchases || 0);
            const pk = r.customer_id ?? r.id ?? r.pk ?? null;
            const refId =
              r.customer_ref_id ??
              r.customer_ref ??
              r.customer_refid ??
              r.customerId ??
              null;
            const resolvedId =
              pk != null ? String(pk) : refId != null ? String(refId) : "";

            return {
              id: resolvedId,
              pk: pk != null ? Number(pk) : undefined,
              customerId: refId ?? undefined,
              customerRefId: refId ?? undefined,
              firstName: r.first_name,
              lastName: r.last_name,
              phone: r.phone,
              backupPhone: r.backup_phone ?? r.backupPhone ?? "",
              email: r.email ?? undefined,
              address: {
                recipientFirstName: r.recipient_first_name || "",
                recipientLastName: r.recipient_last_name || "",
                street: r.street || "",
                subdistrict: r.subdistrict || "",
                district: r.district || "",
                province: r.province || "",
                postalCode: r.postal_code || "",
              },
              province: r.province || "",
              companyId: r.company_id,
              assignedTo:
                r.assigned_to !== null && typeof r.assigned_to !== "undefined"
                  ? Number(r.assigned_to)
                  : null,
              dateAssigned: r.date_assigned,
              dateRegistered: r.date_registered ?? undefined,
              followUpDate: r.follow_up_date ?? undefined,
              ownershipExpires: r.ownership_expires ?? "",
              lifecycleStatus:
                r.lifecycle_status === "New"
                  ? CustomerLifecycleStatus.New
                  : r.lifecycle_status === "Old"
                    ? CustomerLifecycleStatus.Old
                    : r.lifecycle_status === "FollowUp"
                      ? CustomerLifecycleStatus.FollowUp
                      : r.lifecycle_status === "Old3Months"
                        ? CustomerLifecycleStatus.Old3Months
                        : r.lifecycle_status === "DailyDistribution"
                          ? CustomerLifecycleStatus.DailyDistribution
                          : (r.lifecycle_status ?? CustomerLifecycleStatus.New),
              behavioralStatus: (r.behavioral_status ??
                "Cold") as CustomerBehavioralStatus,
              grade: calculateCustomerGrade(totalPurchases),
              tags: tagsByCustomer[resolvedId] || [],
              assignmentHistory: [],
              totalPurchases,
              totalCalls: Number(r.total_calls || 0),
              facebookName: r.facebook_name ?? undefined,
              lineId: r.line_id ?? undefined,
              isInWaitingBasket: Boolean(r.is_in_waiting_basket ?? false),
              waitingBasketStartDate: r.waiting_basket_start_date ?? undefined,
            };
          })
          : [];

        // Refresh activities (after we have mappedCustomers, so activity.customerId uses UI ids)
        setActivities(
          Array.isArray(refreshedActivitiesRaw)
            ? refreshedActivitiesRaw.map((a: any) => ({
              id: a.id,
              customerId: mapActivityCustomerId(a.customer_id, mappedCustomers),
              timestamp: a.timestamp,
              type: a.type,
              description: a.description,
              actorName: a.actor_name,
            }))
            : [],
        );
        setCustomers(mappedCustomers);

        return createdOrderId;
      } else {
        throw new Error(res.error || "Order creation failed");
      }
    } catch (e: any) {
      console.error("Create order failed", e);
      alert(`สร้างออเดอร์ไม่สำเร็จ: ${e.message || "Unknown error"}`);
      return undefined;
    }
  };

  const handleUpsellSuccess = async () => {
    // On success, go to Dashboard
    setActivePage("Dashboard");
    setPreviousPage(null);
    setCreateOrderInitialData(null);

    try {
      // Refresh orders, customers, and activities with proper mapping
      const [refreshedOrdersRaw, refreshedCustomersRaw, refreshedActivitiesRaw, refreshedCustomerTagsRaw] = await Promise.all([
        // Orders are now fetched only in TelesaleOrdersPage
        Promise.resolve({ ok: true, orders: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } }),
        activePage === 'Customers' ? listCustomers({
          companyId: currentUser.companyId,
        }) : Promise.resolve({ total: 0, data: [] }),
        listActivities(),
        listCustomerTags(),
      ]);

      const mappedOrders: Order[] = Array.isArray(refreshedOrdersRaw)
        ? refreshedOrdersRaw.map((o) => ({
          id: o.id,
          customerId: o.customer_id,
          items: o.items || [],
          totalAmount: Number(o.total_amount),
          status: o.status,
          paymentMethod: o.payment_method,
          shippingAddress: o.shipping_address,
          shippingProvider: o.shipping_provider ?? o.shippingProvider ?? undefined,
          trackingNumber: o.tracking_number,
          orderDate: o.order_date,
          deliveryDate: o.delivery_date,
          notes: o.notes,
          shippingCost: Number(o.shipping_cost || 0),
          discount: Number(o.discount || 0),
          creatorId: o.creator_id,
          warehouseId: o.warehouse_id,
          salePageId: o.sale_page_id,
          saleChannel: o.sale_channel,
          depositAmount: Number(o.deposit_amount || 0),
          codAmount: Number(o.cod_amount || 0),
          updatedAt: o.updated_at,
          boxCount: o.box_count,
          tags: o.tags || [],
          companyId: o.company_id,
          billDiscount: Number(o.bill_discount || 0),
          paymentStatus: o.payment_status,
          orderStatus: o.order_status,
          trackingNumbers: o.tracking_numbers ? String(o.tracking_numbers).split(",").filter(Boolean) : [],
          slips: o.slips || [],
          amountPaid: Number(o.amount_paid || 0),
          salesChannel: o.sales_channel,
          salesChannelPageId: o.sales_channel_page_id,
        }))
        : [];

      // Helper function เพื่อ map customer_id (INT) เป็น customer.id (string)
      const mapActivityCustomerId = (customerIdInt: number | null, customersList: Customer[]): string => {
        if (!customerIdInt) return '';
        const customer = customersList.find(c =>
          c.pk === customerIdInt ||
          (typeof c.id === 'number' && c.id === customerIdInt)
        );
        return customer?.id || String(customerIdInt);
      };

      const tagsByCustomer: Record<string, Tag[]> = {};
      if (Array.isArray(refreshedCustomerTagsRaw)) {
        refreshedCustomerTagsRaw.forEach((t) => {
          if (!tagsByCustomer[t.customer_id]) {
            tagsByCustomer[t.customer_id] = [];
          }
          tagsByCustomer[t.customer_id].push({
            id: t.id,
            name: t.name,
            type: t.type as TagType,
          });
        });
      }

      const customersData = (refreshedCustomersRaw as any).data || [];
      const mappedCustomers: Customer[] = Array.isArray(customersData)
        ? customersData.map((r) => {
          const resolvedId = String(r.id || r.customer_id);
          const totalPurchasesVal = Number(r.total_purchases || 0);
          return {
            id: resolvedId,
            pk: r.pk, // Keep pk for internal use
            firstName: r.first_name,
            lastName: r.last_name,
            phone: r.phone,
            backupPhone: r.backup_phone,
            email: r.email,
            address: r.address,
            province: r.province,
            companyId: r.company_id,
            assignedTo: r.assigned_to,
            dateAssigned: r.date_assigned,
            dateRegistered: r.date_registered,
            followUpDate: r.follow_up_date,
            ownershipExpires: r.ownership_expires,
            lifecycleStatus:
              r.lifecycle_status === "New" && totalPurchasesVal > 0
                ? CustomerLifecycleStatus.DailyDistribution
                : (r.lifecycle_status ?? CustomerLifecycleStatus.New),
            behavioralStatus: (r.behavioral_status ??
              "Cold") as CustomerBehavioralStatus,
            grade: calculateCustomerGrade(totalPurchasesVal),
            tags: tagsByCustomer[resolvedId] || [],
            assignmentHistory: [],
            totalPurchases: totalPurchasesVal,
            totalCalls: Number(r.total_calls || 0),
            facebookName: r.facebook_name ?? undefined,
            lineId: r.line_id ?? undefined,
            isInWaitingBasket: Boolean(r.is_in_waiting_basket ?? false),
            waitingBasketStartDate: r.waiting_basket_start_date ?? undefined,
          };
        })
        : [];

      const mappedActivities: Activity[] = Array.isArray(refreshedActivitiesRaw)
        ? refreshedActivitiesRaw.map((a) => ({
          id: a.id,
          customerId: mapActivityCustomerId(a.customer_id, mappedCustomers),
          timestamp: a.timestamp,
          type: a.type,
          description: a.description,
          actorName: a.actor_name,
        }))
        : [];

      setOrders(mappedOrders);
      setActivities(mappedActivities);
      setCustomers(mappedCustomers);
      // setCustomerTags is not needed as tags are mapped into customers
    } catch (e) {
      console.error("Failed to refresh data after upsell", e);
    }
  };

  const handleUpdateCustomer = async (updatedCustomer: Customer) => {
    const resolvedGrade = calculateCustomerGrade(
      updatedCustomer.totalPurchases,
    );

    // หาลูกค้าเดิมเพื่อเปรียบเทียบการเปลี่ยนแปลง
    const originalCustomer = customers.find(c => c.id === updatedCustomer.id);

    if (true) {
      try {
        const targetId = updatedCustomer.pk || updatedCustomer.id;
        await updateCustomer(String(targetId), {
          firstName: updatedCustomer.firstName,
          lastName: updatedCustomer.lastName,
          phone: updatedCustomer.phone,
          backupPhone: updatedCustomer.backupPhone,
          email: updatedCustomer.email,
          province: updatedCustomer.province,
          companyId: updatedCustomer.companyId,
          assignedTo: updatedCustomer.assignedTo,
          dateAssigned: updatedCustomer.dateAssigned,
          dateRegistered: updatedCustomer.dateRegistered,
          followUpDate: updatedCustomer.followUpDate,
          ownershipExpires: updatedCustomer.ownershipExpires,
          lifecycleStatus: updatedCustomer.lifecycleStatus,
          behavioralStatus: updatedCustomer.behavioralStatus,
          grade: resolvedGrade,
          totalPurchases: updatedCustomer.totalPurchases,
          totalCalls: updatedCustomer.totalCalls,
          facebookName: updatedCustomer.facebookName,
          lineId: updatedCustomer.lineId,
          address: updatedCustomer.address,
        });

        // แสดง popup แจ้งเตือนเมื่อแก้ไขสำเร็จ
        alert(`แก้ไขข้อมูลลูกค้า "${updatedCustomer.firstName} ${updatedCustomer.lastName}" สำเร็จ`);
      } catch (e) {
        console.error("update customer API failed", e);
        alert("เกิดข้อผิดพลาดในการแก้ไขข้อมูลลูกค้า กรุณาลองใหม่อีกครั้ง");
        return; // ไม่ปิด modal ถ้าเกิด error
      }
    }

    // บันทึกกิจกรรมเมื่อมีการเปลี่ยนแปลง
    const activitiesToAdd: Activity[] = [];

    // ใช้ customer_id (INT) สำหรับบันทึก activities
    const customerIdForActivity = updatedCustomer.pk || (typeof updatedCustomer.id === 'number' ? updatedCustomer.id : null);

    if (originalCustomer && customerIdForActivity) {
      // ตรวจสอบการเปลี่ยนแปลง lifecycle_status
      if (originalCustomer.lifecycleStatus !== updatedCustomer.lifecycleStatus) {
        activitiesToAdd.push({
          id: Date.now() + Math.random(),
          customerId: String(customerIdForActivity), // เก็บเป็น string ใน state แต่ส่ง INT ไป API
          timestamp: new Date().toISOString(),
          type: ActivityType.StatusChange,
          description: `เปลี่ยนสถานะลูกค้า "${updatedCustomer.firstName} ${updatedCustomer.lastName}" จาก '${originalCustomer.lifecycleStatus}' เป็น '${updatedCustomer.lifecycleStatus}'`,
          actorName: `${currentUser.firstName} ${currentUser.lastName}`,
        });
      }

      // ตรวจสอบการเปลี่ยนแปลง behavioral_status
      if (originalCustomer.behavioralStatus !== updatedCustomer.behavioralStatus) {
        activitiesToAdd.push({
          id: Date.now() + Math.random(),
          customerId: String(customerIdForActivity),
          timestamp: new Date().toISOString(),
          type: ActivityType.StatusChange,
          description: `เปลี่ยนสถานะพฤติกรรมลูกค้า "${updatedCustomer.firstName} ${updatedCustomer.lastName}" จาก '${originalCustomer.behavioralStatus}' เป็น '${updatedCustomer.behavioralStatus}'`,
          actorName: `${currentUser.firstName} ${currentUser.lastName}`,
        });
      }

      // ตรวจสอบการเปลี่ยนแปลง grade
      if (originalCustomer.grade !== resolvedGrade) {
        activitiesToAdd.push({
          id: Date.now() + Math.random(),
          customerId: String(customerIdForActivity),
          timestamp: new Date().toISOString(),
          type: ActivityType.GradeChange,
          description: `เปลี่ยนเกรดลูกค้า "${updatedCustomer.firstName} ${updatedCustomer.lastName}" จาก '${originalCustomer.grade}' เป็น '${resolvedGrade}'`,
          actorName: `${currentUser.firstName} ${currentUser.lastName}`,
        });
      }

      // ตรวจสอบการเปลี่ยนแปลง assigned_to
      if (originalCustomer.assignedTo !== updatedCustomer.assignedTo) {
        const oldOwner = users.find(u => u.id === originalCustomer.assignedTo);
        const newOwner = users.find(u => u.id === updatedCustomer.assignedTo);
        const oldOwnerName = oldOwner ? `${oldOwner.firstName} ${oldOwner.lastName}` : 'ยังไม่ได้มอบหมาย';
        const newOwnerName = newOwner ? `${newOwner.firstName} ${newOwner.lastName}` : 'ยังไม่ได้มอบหมาย';

        activitiesToAdd.push({
          id: Date.now() + Math.random(),
          customerId: String(customerIdForActivity),
          timestamp: new Date().toISOString(),
          type: ActivityType.Assignment,
          description: `เปลี่ยนผู้ดูแลลูกค้า "${updatedCustomer.firstName} ${updatedCustomer.lastName}" จาก '${oldOwnerName}' เป็น '${newOwnerName}'`,
          actorName: `${currentUser.firstName} ${currentUser.lastName}`,
        });
      }
    }

    // บันทึกกิจกรรม
    if (activitiesToAdd.length > 0 && customerIdForActivity) {
      if (true) {
        activitiesToAdd.forEach((activity) => {
          createActivity({
            customerId: customerIdForActivity, // ส่ง INT ไป API
            timestamp: activity.timestamp,
            type: activity.type,
            description: activity.description,
            actorName: activity.actorName,
          }).catch((e) => console.error("Failed to create activity", e));
        });
      }
      setActivities((prev) => [...activitiesToAdd, ...prev]);
    }

    setCustomers((prev) =>
      prev.map((c) =>
        c.id === updatedCustomer.id
          ? { ...updatedCustomer, grade: resolvedGrade }
          : c,
      ),
    );
    closeModal();
  };

  const handleChangeCustomerOwner = async (
    customerId: string,
    newOwnerId: number,
  ) => {
    const targetUser = users.find((u) => u.id === newOwnerId);
    if (!targetUser) {
      throw new Error(
        "à¹„à¸¡à¹ˆà¸žà¸šà¸œà¸¹à¹‰à¹ƒà¸Šà¹‰à¸‡à¸²à¸™à¸—à¸µà¹ˆà¹€à¸¥à¸·à¸­à¸",
      );
    }

    const sameCompany =
      isSuperAdmin || targetUser.companyId === currentUser.companyId;

    if (!sameCompany) {
      throw new Error("ไม่สามารถย้ายลูกค้าไปยังบริษัทอื่นได้");
    }

    if (currentUser.role === UserRole.Supervisor) {
      const isTeamMember =
        targetUser.role === UserRole.Telesale &&
        targetUser.supervisorId === currentUser.id;
      const isSupervisorLevel =
        targetUser.role === UserRole.Supervisor ||
        targetUser.id === currentUser.id;

      if (!isTeamMember && !isSupervisorLevel) {
        throw new Error(
          "หัวหน้าสต็อกสามารถโอนย้ายให้ลูกสต็อกของตัวเองหรือหัวหน้าฝ่ายในบริษัทเดียวกันเท่านั้น",
        );
      }
    } else if (currentUser.role === UserRole.Telesale) {
      if (currentUser.supervisorId !== targetUser.id) {
        throw new Error("เกิดข้อผิดพลาดในการอัพเดทข้อมูล กรุณาลองใหม่อีกครั้ง");
      }
    }

    const dateAssigned = new Date().toISOString();
    const customer = customers.find(c => c.id === customerId);
    if (!customer) {
      alert("ไม่พบข้อมูลลูกค้า");
      return;
    }
    const targetId = customer.pk || customer.id;

    try {
      await updateCustomer(String(targetId), {
        assignedTo: newOwnerId,
        assigned_to: newOwnerId, // Send both for compatibility
        dateAssigned,
        date_assigned: dateAssigned,

        // Ensure customer is taken out of waiting basket/blocked state if they were in it
        is_in_waiting_basket: 0,
        isInWaitingBasket: false,
        waiting_basket_start_date: null,
        waitingBasketStartDate: null,
        is_blocked: 0,
        isBlocked: false,
      });

      // Add immediate activity log
      const newActivityId = Date.now();
      const newActivity: Activity = {
        id: newActivityId,
        customerId: String(customer.pk || customer.id),
        timestamp: new Date().toISOString(),
        type: ActivityType.StatusChange,
        description: `เปลี่ยนผู้ดูแลจาก "${companyUsers.find(u => u.id === customer.assignedTo)?.firstName || '-'}" เป็น "${targetUser.firstName}"`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`
      };

      setActivities(prev => [newActivity, ...prev]);

      // Also persisting activity to backend if needed is handled by separate call or let the next refresh handle it?
      // Better to create it:
      if (customer.pk || (typeof customer.id === 'number')) {
        createActivity({
          customerId: customer.pk || customer.id,
          timestamp: newActivity.timestamp,
          type: newActivity.type,
          description: newActivity.description,
          actorName: newActivity.actorName
        }).catch(console.error);
      }

    } catch (error) {
      console.error("update customer owner failed", error);
      alert("ไม่สามารถเปลี่ยนผู้ดูแลได้ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    setCustomers((prev) =>
      prev.map((customerItem) =>
        customerItem.id === customerId || customerItem.pk === targetId
          ? {
            ...customerItem,
            assignedTo: newOwnerId,
            dateAssigned,
            assignmentHistory: [
              ...(customerItem.assignmentHistory || []),
              newOwnerId,
            ],
          }
          : customerItem,
      ),
    );

    // Redistribute ownership (adds 30 days)
    try {
      await redistributeCustomer(customerId);
      const updated = await getCustomerOwnershipStatus(String(targetId));
      if (updated && updated.ownership_expires) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? { ...c, ownershipExpires: updated.ownership_expires }
              : c,
          ),
        );
      }
    } catch (e) {
      console.error("Redistribute customer failed", e);
    }

    setViewingCustomerId((prev) => (prev === customerId ? null : prev));
  };

  const handleTakeCustomer = async (customerToTake: Customer) => {
    if (
      window.confirm(
        `คุณต้องการรับผิดชอบลูกค้า "${customerToTake.firstName} ${customerToTake.lastName}" หรือไม่?`,
      )
    ) {
      const dateAssigned = new Date().toISOString();

      // 1. Update assignment in DB
      try {
        await updateCustomer(customerToTake.id, {
          assignedTo: currentUser.id,
          dateAssigned,
        });
      } catch (e) {
        console.error("Failed to take customer (update assignment)", e);
        alert("เกิดข้อผิดพลาดในการรับลูกค้า");
        return;
      }

      // 2. Trigger Retrieve logic (adds 30 days)
      try {
        await retrieveCustomer(customerToTake.id);
      } catch (e) {
        console.error("Failed to retrieve customer (ownership)", e);
      }

      // 3. Get updated status and update local state
      let newOwnershipExpires = customerToTake.ownershipExpires;
      try {
        const updated = await getCustomerOwnershipStatus(customerToTake.id);
        if (updated && updated.ownership_expires) {
          newOwnershipExpires = updated.ownership_expires;
        }
      } catch (e) {
        console.error("Failed to get updated ownership status", e);
      }

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerToTake.id
            ? {
              ...c,
              assignedTo: currentUser.id,
              previousLifecycleStatus: c.lifecycleStatus,
              lifecycleStatus: CustomerLifecycleStatus.FollowUp,
              dateAssigned,
              ownershipExpires: newOwnershipExpires,
            }
            : c,
        ),
      );
    }
  };

  const handleSaveCustomer = (
    customerData: Omit<
      Customer,
      "id" | "companyId" | "totalPurchases" | "totalCalls" | "tags"
    > & { ownershipDays?: number },
  ): Customer => {
    const { ownershipDays, ...newCustomerData } = customerData;

    const newId = formatCustomerId(
      newCustomerData.phone,
      currentUser.companyId,
    );

    let ownershipExpires = new Date();
    if (ownershipDays) {
      ownershipExpires.setDate(ownershipExpires.getDate() + ownershipDays);
    } else {
      ownershipExpires.setDate(ownershipExpires.getDate() + 30);
    }

    const newCustomer: Customer = {
      ...newCustomerData,
      id: newId,
      companyId: currentUser.companyId,
      totalPurchases: 0,
      totalCalls: 0,
      tags: [],
      dateAssigned: toThaiIsoString(new Date()),
      ownershipExpires: toThaiIsoString(ownershipExpires),
      behavioralStatus: CustomerBehavioralStatus.Warm,
      grade: calculateCustomerGrade(0),
    };

    setCustomers((prev) => [newCustomer, ...prev]);
    return newCustomer;
  };

  const handleSaveUser = async (
    userToSave: Omit<User, "id" | "customTags"> | User,
  ) => {
    try {
      if ("id" in userToSave) {
        const payload = {
          username: userToSave.username,
          password: userToSave.password ?? undefined,
          firstName: userToSave.firstName,
          lastName: userToSave.lastName,
          email: userToSave.email,
          phone: userToSave.phone,
          role: userToSave.role,
          companyId: userToSave.companyId,
          teamId: userToSave.teamId,
          supervisorId: userToSave.supervisorId,
        } as any;
        // Remove undefined keys to avoid overwriting with null
        Object.keys(payload).forEach(
          (k) =>
            (payload as any)[k] === undefined && delete (payload as any)[k],
        );
        const updated = await apiUpdateUser(userToSave.id, payload);
        const mapped: User = {
          id: updated.id,
          username: updated.username,
          firstName: updated.first_name,
          lastName: updated.last_name,
          email: updated.email ?? undefined,
          phone: updated.phone ?? undefined,
          role: updated.role,
          companyId: updated.company_id,
          teamId:
            typeof updated.team_id !== "undefined" && updated.team_id !== null
              ? Number(updated.team_id)
              : undefined,
          supervisorId:
            typeof updated.supervisor_id !== "undefined" &&
              updated.supervisor_id !== null
              ? Number(updated.supervisor_id)
              : undefined,
          status: updated.status,
          customTags: [],
        } as any;
        setUsers((prev) => prev.map((u) => (u.id === mapped.id ? mapped : u)));
      } else {
        const created = await apiCreateUser({
          username: userToSave.username,
          password: userToSave.password || "",
          firstName: userToSave.firstName,
          lastName: userToSave.lastName,
          email: userToSave.email,
          phone: userToSave.phone,
          role: userToSave.role,
          companyId: userToSave.companyId,
          teamId: userToSave.teamId,
          supervisorId: userToSave.supervisorId,
        });
        const mapped: User = {
          id: created.id,
          username: created.username,
          firstName: created.first_name,
          lastName: created.last_name,
          email: created.email ?? undefined,
          phone: created.phone ?? undefined,
          role: created.role,
          companyId: created.company_id,
          teamId:
            typeof created.team_id !== "undefined" && created.team_id !== null
              ? Number(created.team_id)
              : undefined,
          supervisorId:
            typeof created.supervisor_id !== "undefined" &&
              created.supervisor_id !== null
              ? Number(created.supervisor_id)
              : undefined,
          status: created.status,
          customTags: [],
        } as any;
        setUsers((prev) => [...prev, mapped]);
      }
      closeModal();
    } catch (e) {
      console.error("Failed to save user via API", e);
      alert("ไม่สามารถบันทึกข้อมูลผู้ใช้ได้ (API)");
    }
  };

  const handleToggleUserStatus = async (
    userId: number,
    nextStatus: Exclude<UserStatus, "resigned">,
  ) => {
    try {
      const updated: any = await apiUpdateUser(userId, { status: nextStatus });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
              ...u,
              username: updated.username,
              firstName: updated.first_name,
              lastName: updated.last_name,
              email: updated.email ?? undefined,
              phone: updated.phone ?? undefined,
              role: updated.role,
              companyId: updated.company_id,
              teamId:
                typeof updated.team_id !== "undefined" &&
                  updated.team_id !== null
                  ? Number(updated.team_id)
                  : undefined,
              supervisorId:
                typeof updated.supervisor_id !== "undefined" &&
                  updated.supervisor_id !== null
                  ? Number(updated.supervisor_id)
                  : undefined,
              status:
                (updated.status as UserStatus | undefined) ?? nextStatus,
            }
            : u,
        ),
      );
    } catch (e) {
      console.error("Failed to toggle user status via API", e);
      throw e;
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await apiDeleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      closeModal();
    } catch (e) {
      console.error("Failed to delete user via API", e);
      alert("ไม่สามารถลบผู้ใช้ได้ (อาจมีข้อมูลที่เกี่ยวข้อง)");
    }
  };

  const handleSaveProduct = (productToSave: Omit<Product, "id"> | Product) => {
    // Check if product has lots and create them
    if (
      "lots" in productToSave &&
      Array.isArray(productToSave.lots) &&
      productToSave.lots.length > 0
    ) {
      // Here we would normally create product lots in the database
      // For now, we'll just log them
      console.log("Product lots to save:", productToSave.lots);

      // In a real implementation, you would:
      // 1. Create the product
      // 2. For each lot, create a product lot record
      // 3. Update warehouse_stocks with the lot information
    }

    setProducts((prev) => {
      if ("id" in productToSave) {
        return prev.map((p) => (p.id === productToSave.id ? productToSave : p));
      } else {
        const newId = Math.max(...prev.map((p) => p.id), 0) + 1;
        return [...prev, { ...productToSave, id: newId }];
      }
    });
    // Refresh data from server to be sure
    fetchProducts();
    closeModal();
  };

  const handleDeleteProduct = async (productId: number) => {
    try {
      const result = await deleteProductWithLots(productId);
      if (result.success) {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        fetchProducts(); // Refresh full list
      } else {
        alert("Failed to delete product: " + (result.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("Error deleting product");
    }
    closeModal();
  };

  const handleLogCall = async (
    callLogData: Omit<CallHistory, "id">,
    customerId: string,
    newFollowUpDate?: string,
    newTags?: Tag[],
  ) => {
    const newCallLog: CallHistory = {
      ...callLogData,
      id: Math.max(...callHistory.map((c) => c.id), 0) + 1,
    };
    if (true) {
      try {
        await createCall({
          customerId,
          date: callLogData.date,
          caller: callLogData.caller,
          status: callLogData.status,
          result: callLogData.result,
          cropType: callLogData.cropType,
          areaSize: callLogData.areaSize,
          notes: callLogData.notes,
          duration: callLogData.duration ?? undefined,
        });
      } catch (e) {
        console.error("create call API failed", e);
      }
    }
    setCallHistory((prev) => [newCallLog, ...prev]);

    // Determine the new lifecycle status based on the business rules
    // New logic: Do NOT auto-convert New -> Old after the first call.
    // Only set FollowUp when a follow-up date is created here.
    let newLifecycleStatus: CustomerLifecycleStatus | undefined;

    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      // If there's a follow-up date, set status to FollowUp
      if (newFollowUpDate) {
        newLifecycleStatus = CustomerLifecycleStatus.FollowUp;
      }
    }

    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          let updatedCustomerTags: Tag[] = [...c.tags];
          if (newTags && newTags.length > 0) {
            const existingTagIds = new Set(
              updatedCustomerTags.map((t) => t.id),
            );
            const tagsToAdd: Tag[] = newTags.filter(
              (tag) => !existingTagIds.has(tag.id),
            );
            updatedCustomerTags = [...updatedCustomerTags, ...tagsToAdd];
          }

          const updatedCustomer = {
            ...c,
            totalCalls: c.totalCalls + 1,
            followUpDate: newFollowUpDate || c.followUpDate,
            previousLifecycleStatus: newFollowUpDate
              ? (c.previousLifecycleStatus ?? c.lifecycleStatus)
              : c.previousLifecycleStatus,
            tags: updatedCustomerTags,
          };

          // Update lifecycle status if needed
          if (newLifecycleStatus) {
            updatedCustomer.lifecycleStatus = newLifecycleStatus;
          }

          return updatedCustomer;
        }
        return c;
      }),
    );

    if (true) {
      try {
        const updateData: any = {
          totalCalls: customer ? customer.totalCalls + 1 : 1,
        };

        if (newFollowUpDate) {
          updateData.followUpDate = newFollowUpDate;
        }

        if (newLifecycleStatus) {
          updateData.lifecycleStatus = newLifecycleStatus;
        }

        await updateCustomer(customerId, updateData);

        // Add tags to customer if provided
        if (newTags && newTags.length > 0 && customer) {
          const existingTagNames = new Set(customer.tags.map((t) => t.name));
          for (const newTagObj of newTags) {
            if (!existingTagNames.has(newTagObj.name)) {
              try {
                // Create a temporary tag object
                const tempTag: Tag = {
                  id: Date.now() + Math.random(),
                  name: newTagObj.name,
                  type: TagType.User,
                };
                await handleAddTagToCustomer(customerId, tempTag);
              } catch (e) {
                console.error(`Failed to add tag "${newTagObj.name}" to customer`, e);
              }
            }
          }
        }
      } catch (e) {
        console.error("update customer call data", e);
      }
    }

    if (newFollowUpDate) {
      const newAppointment: Appointment = {
        id: Math.max(...appointments.map((a) => a.id), 0) + 1,
        customerId: customerId,
        date: newFollowUpDate,
        title: `ติดตามลูกค้า (${callLogData.result})`,
        status: "ใหม่",
        notes:
          callLogData.notes ||
          `ติดตามลูกค้าจากการโทรที่มีผลลัพธ์ ${callLogData.result}`,
      };
      if (true) {
        try {
          await createAppointment({
            customerId,
            date: newFollowUpDate,
            title: newAppointment.title,
            status: "ใหม่",
            notes: newAppointment.notes,
          });
        } catch (e) {
          console.error("create appointment API failed", e);
        }
      }
      setAppointments((prev) => [newAppointment, ...prev]);
      try {
        await recordFollowUp(customerId);
        const updated = await getCustomerOwnershipStatus(customerId);
        if (updated && updated.ownership_expires) {
          setCustomers((prev) =>
            prev.map((c) =>
              c.id === customerId
                ? { ...c, ownershipExpires: updated.ownership_expires }
                : c,
            ),
          );
        }
      } catch (e) {
        console.error("record follow-up / refresh ownership failed", e);
      }
    }

    const customerIdForActivity = getCustomerIdForActivity(customerId);
    if (customerIdForActivity) {
      const newActivity: Activity = {
        id: Date.now(),
        customerId: String(customerIdForActivity), // เก็บเป็น string ใน state
        timestamp: new Date().toISOString(),
        type: ActivityType.CallLogged,
        description: `บันทึกการโทร: ${callLogData.result}`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      };
      if (true) {
        try {
          await createActivity({
            customerId: customerIdForActivity, // ส่ง INT ไป API
            timestamp: newActivity.timestamp,
            type: newActivity.type,
            description: newActivity.description,
            actorName: newActivity.actorName,
          });
        } catch (e) {
          console.error("Failed to create activity", e);
        }
      }
      setActivities((prev) => [newActivity, ...prev]);
    }

    closeModal();
  };

  const handleCreateAppointment = async (
    appointmentData: Omit<Appointment, "id">,
  ) => {
    const newAppointment: Appointment = {
      ...appointmentData,
      id: Math.max(...appointments.map((a) => a.id), 0) + 1,
    };
    if (true) {
      try {
        await createAppointment({
          customerId: appointmentData.customerId,
          date: appointmentData.date,
          title: appointmentData.title,
          status: "ใหม่",
          notes: appointmentData.notes,
        });
      } catch (e) {
        console.error("create appointment API failed", e);
      }
    }
    setAppointments((prev) => [newAppointment, ...prev]);
  };

  const handleUpdateAppointment = async (updatedAppointment: Appointment) => {
    if (true) {
      try {
        await updateAppointment(updatedAppointment.id, {
          date: updatedAppointment.date,
          title: updatedAppointment.title,
          status: updatedAppointment.status,
          notes: updatedAppointment.notes,
        });
      } catch (e) {
        console.error("update appointment API failed", e);
      }
    }
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === updatedAppointment.id ? updatedAppointment : a,
      ),
    );
  };

  const handleAddCustomerTag = async (customerId: string, tagName: string) => {
    const newTag: Tag = {
      id: Date.now() + Math.random(),
      name: tagName,
      type: TagType.User,
    };
    if (true) {
      try {
        await addCustomerTag(customerId, newTag.id);
      } catch (e) {
        console.error("add customer tag API failed", e);
      }
    }
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId ? { ...c, tags: [...c.tags, newTag] } : c,
      ),
    );
  };

  const handleRemoveCustomerTag = async (customerId: string, tagId: number) => {
    if (true) {
      try {
        await removeCustomerTag(customerId, tagId);
      } catch (e) {
        console.error("remove customer tag API failed", e);
      }
    }
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === customerId
          ? { ...c, tags: c.tags.filter((t) => t.id !== tagId) }
          : c,
      ),
    );
  };

  const handleCreateTag = async (tagName: string) => {
    const newTag: Tag = {
      id: Date.now() + Math.random(),
      name: tagName,
      type: TagType.User,
    };
    if (true) {
      try {
        await createTag(tagName);
      } catch (e) {
        console.error("create tag API failed", e);
      }
    }
    return newTag;
  };

  const handleCreateActivity = async (activityData: Omit<Activity, "id">) => {
    const newActivity: Activity = {
      ...activityData,
      id: Date.now() + Math.random(),
    };
    if (true) {
      try {
        await createActivity({
          customerId: activityData.customerId,
          timestamp: activityData.timestamp,
          type: activityData.type,
          description: activityData.description,
          actorName: activityData.actorName,
        });
      } catch (e) {
        console.error("create activity API failed", e);
      }
    }
    setActivities((prev) => [newActivity, ...prev]);
  };

  const handleAddAppointment = async (
    appointmentData: Omit<Appointment, "id" | "status">,
  ) => {
    const newAppointment: Appointment = {
      ...appointmentData,
      id: Math.max(...appointments.map((a) => a.id), 0) + 1,
      status: "ใหม่",
    };
    if (true) {
      try {
        await createAppointment({
          customerId: appointmentData.customerId,
          date: appointmentData.date,
          title: appointmentData.title,
          status: "ใหม่",
          notes: appointmentData.notes,
        });
      } catch (e) {
        console.error("create appt API failed", e);
      }
    }
    setAppointments((prev) =>
      [newAppointment, ...prev].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    );

    // Update customer lifecycle status to FollowUp when creating an appointment
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === appointmentData.customerId) {
          return {
            ...c,
            followUpDate: appointmentData.date,
            previousLifecycleStatus:
              c.previousLifecycleStatus ?? c.lifecycleStatus,
            lifecycleStatus: CustomerLifecycleStatus.FollowUp,
          };
        }
        return c;
      }),
    );

    if (true) {
      try {
        await updateCustomer(appointmentData.customerId, {
          followUpDate: appointmentData.date,
          lifecycleStatus: CustomerLifecycleStatus.FollowUp,
        });

        // Record follow-up to update ownership days
        await recordFollowUp(appointmentData.customerId);
        try {
          const updated = await getCustomerOwnershipStatus(
            appointmentData.customerId,
          );
          if (updated && updated.ownership_expires) {
            setCustomers((prev) =>
              prev.map((c) =>
                c.id === appointmentData.customerId
                  ? { ...c, ownershipExpires: updated.ownership_expires }
                  : c,
              ),
            );
          }
        } catch (e) {
          console.error("refresh ownership after follow-up", e);
        }
      } catch (e) {
        console.error("update customer followUp", e);
      }
    }

    const customerIdForActivity = getCustomerIdForActivity(appointmentData.customerId);
    if (customerIdForActivity) {
      const newActivity: Activity = {
        id: Date.now() + Math.random(),
        customerId: String(customerIdForActivity), // เก็บเป็น string ใน state
        timestamp: new Date().toISOString(),
        type: ActivityType.AppointmentSet,
        description: `นัดหมาย: ${appointmentData.title}`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      };
      if (true) {
        try {
          await createActivity({
            customerId: customerIdForActivity, // ส่ง INT ไป API
            timestamp: newActivity.timestamp,
            type: newActivity.type,
            description: newActivity.description,
            actorName: newActivity.actorName,
          });
        } catch (e) {
          console.error("Failed to create activity", e);
        }
      }
      setActivities((prev) => [newActivity, ...prev]);
    }

    closeModal();
  };

  const handleCompleteAppointment = async (appointmentId: number) => {
    // Call API directly - the appointment may be from localAppointments (per-customer fetch)
    // and not exist in the global appointments state
    try {
      await updateAppointment(appointmentId, { status: "เสร็จสิ้น" });
      // Update global state if the appointment exists there
      setAppointments((prev) =>
        prev.map((a) => (a.id === appointmentId ? { ...a, status: "เสร็จสิ้น" } : a)),
      );
    } catch (e) {
      console.error("update appointment API failed", e);
    }
  };

  const handleAddTagToCustomer = async (customerId: string, tag: Tag) => {
    let persistedTag: Tag = tag;
    if (true) {
      try {
        const created = await createTag({
          name: tag.name,
          type: tag.type || TagType.User,
        });
        if (created && created.id) {
          persistedTag = { ...tag, id: Number(created.id) };
        }
      } catch (e) {
        console.error("create tag", e);
      }
      try {
        await addCustomerTag(customerId, persistedTag.id);
      } catch (e) {
        console.error("add tag", e);
      }
    }
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId && !c.tags.some((t) => t.id === tag.id)) {
          return { ...c, tags: [...c.tags, persistedTag] };
        }
        return c;
      }),
    );
  };

  const handleRemoveTagFromCustomer = async (
    customerId: string,
    tagId: number,
  ) => {
    if (true) {
      try {
        await removeCustomerTag(customerId, tagId);
      } catch (e) {
        console.error("remove tag", e);
      }
    }
    setCustomers((prev) =>
      prev.map((c) => {
        if (c.id === customerId) {
          return { ...c, tags: c.tags.filter((t) => t.id !== tagId) };
        }
        return c;
      }),
    );
  };

  const handleUpdateUserTag = async (
    tagId: number,
    payload: { name?: string; color?: string },
  ) => {
    try {
      await updateTag(tagId, payload);
    } catch (e) {
      console.error("update tag", e);
      throw e;
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== currentUser.id) return u;
        const updated = (u.customTags || []).map((t) =>
          t.id === tagId ? { ...t, ...payload } : t,
        );
        return { ...u, customTags: updated };
      }),
    );

    setCustomers((prev) =>
      prev.map((c) => {
        if (!c.tags || c.tags.length === 0) return c;
        const updatedTags = c.tags.map((t) =>
          t.id === tagId ? { ...t, ...payload } : t,
        );
        return { ...c, tags: updatedTags };
      }),
    );
  };

  // Function to remove tag from all customers after tag deletion (for both System and User tags)
  const handleTagDeleted = (tagId: number) => {
    setCustomers((prev) =>
      prev.map((c) => ({
        ...c,
        tags: (c.tags || []).filter((t) => t.id !== tagId),
      })),
    );
  };

  const handleDeleteUserTag = async (tagId: number) => {
    const affectedCustomers = customers.filter((c) =>
      (c.tags || []).some((t) => t.id === tagId),
    );

    try {
      await deleteTag(tagId);

      // Ensure mappings on server are removed (in case deleteTag does not cascade)
      await Promise.allSettled(
        affectedCustomers.map((c) => removeCustomerTag(c.id, tagId)),
      );
    } catch (e: any) {
      const message =
        (e?.data && (e?.data?.message || e?.data?.error)) ||
        e?.message ||
        "ไม่สามารถลบ Tag ได้";
      console.error("delete tag", e);
      alert(message);
      throw e;
    }

    setUsers((prev) =>
      prev.map((u) => {
        if (u.id !== currentUser.id) return u;
        return {
          ...u,
          customTags: (u.customTags || []).filter((t) => t.id !== tagId),
        };
      }),
    );

    // Remove tag from all customers
    handleTagDeleted(tagId);
  };

  const handleCreateUserTag = async (tagName: string): Promise<Tag | null> => {
    // Check limit first
    const currentUserData = users.find(u => u.id === currentUser.id);
    if (currentUserData && currentUserData.customTags.length >= 10) {
      alert("ไม่สามารถเพิ่ม Tag ได้เนื่องจากมีครบ 10 Tag แล้ว");
      return null;
    }

    // Check if tag name already exists
    const existingTag = [...systemTags, ...(currentUserData?.customTags || [])].find(
      (t) => t.name.toLowerCase() === tagName.toLowerCase(),
    );
    if (existingTag) {
      alert("มี Tag นี้อยู่แล้ว");
      return null;
    }

    try {
      // Create tag via API (this will also link it to the user in user_tags table)
      const result = await createTag({
        name: tagName,
        type: 'USER',
        color: '#9333EA', // Default color
        userId: currentUser.id,
      });

      const tagId = Number((result && (result.id ?? result.ID)) || 0);
      if (!tagId) {
        alert("ไม่สามารถสร้าง Tag ได้");
        return null;
      }

      const newTag: Tag = {
        id: tagId,
        name: tagName,
        type: TagType.User,
        color: '#9333EA',
      };

      // Update local state
      setUsers((prev) => {
        return prev.map((u) => {
          if (u.id === currentUser.id) {
            return { ...u, customTags: [...u.customTags, newTag] };
          }
          return u;
        });
      });

      // Refresh tags list
      const tagsData = await listTags({ type: "SYSTEM" });
      setSystemTags(tagsData.filter((t: Tag) => t.type === TagType.System));

      return newTag;
    } catch (error: any) {
      const errorMsg = error?.data?.message || error?.message || "ไม่สามารถสร้าง Tag ได้";
      if (error?.data?.error === 'TAG_LIMIT_REACHED') {
        alert("ไม่สามารถเพิ่ม Tag ได้เนื่องจากมีครบ 10 Tag แล้ว");
      } else {
        alert(errorMsg);
      }
      return null;
    }
  };

  const sanitizeValue = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value).trim();
    }
    if (typeof value === "string") {
      return value.trim();
    }
    return "";
  };

  const normalizeCaretakerIdentifier = (
    raw: unknown,
  ): { id: number | null; reference: string | null } => {
    if (raw == null) {
      return { id: null, reference: null };
    }
    if (typeof raw === "number" && Number.isFinite(raw)) {
      return { id: raw, reference: String(raw) };
    }
    const reference = sanitizeValue(raw);
    if (!reference) {
      return { id: null, reference: null };
    }
    if (/^-?\d+$/.test(reference)) {
      const parsed = Number.parseInt(reference, 10);
      if (Number.isFinite(parsed)) {
        return { id: parsed, reference };
      }
    }
    const matchedUser = companyUsers.find(
      (u) => u.username.toLowerCase() === reference.toLowerCase(),
    );
    if (matchedUser) {
      return { id: matchedUser.id, reference };
    }
    return { id: null, reference };
  };

  const resolveSalespersonForImport = (
    raw: unknown,
  ): { id: number; matched: boolean; reference?: string } => {
    const reference = sanitizeValue(raw);
    if (!reference) {
      return { id: currentUser.id, matched: false };
    }

    let matchedUser: User | undefined;

    if (/^-?\d+$/.test(reference)) {
      const parsed = Number.parseInt(reference, 10);
      if (Number.isFinite(parsed)) {
        matchedUser = companyUsers.find((u) => u.id === parsed);
      }
    }

    if (!matchedUser) {
      const lower = reference.toLowerCase();
      matchedUser = companyUsers.find((u) => {
        const usernameMatch =
          typeof u.username === "string" && u.username.toLowerCase() === lower;
        if (usernameMatch) return true;

        const fullName = `${u.firstName ?? ""} ${u.lastName ?? ""}`
          .trim()
          .toLowerCase();
        if (fullName && fullName === lower) return true;

        const reversedName = `${u.lastName ?? ""} ${u.firstName ?? ""}`
          .trim()
          .toLowerCase();
        return !!reversedName && reversedName === lower;
      });
    }

    if (matchedUser) {
      return { id: matchedUser.id, matched: true, reference };
    }

    return { id: currentUser.id, matched: false, reference };
  };

  const normalizePhone = (value: string) => value.replace(/\D+/g, "");

  const THAI_OFFSET_MINUTES = 7 * 60;

  const toThaiIsoString = (date: Date) => {
    const offsetMinutes = THAI_OFFSET_MINUTES;
    const adjusted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
    const pad = (num: number) => String(num).padStart(2, "0");
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absOffset = Math.abs(offsetMinutes);
    const hoursOffset = Math.floor(absOffset / 60);
    const minutesOffset = absOffset % 60;

    return (
      `${adjusted.getUTCFullYear()}-${pad(adjusted.getUTCMonth() + 1)}-${pad(
        adjusted.getUTCDate(),
      )}T${pad(adjusted.getUTCHours())}:${pad(adjusted.getUTCMinutes())}:${pad(
        adjusted.getUTCSeconds(),
      )}` + `${sign}${pad(hoursOffset)}:${pad(minutesOffset)}`
    );
  };

  const parseDateToIso = (value?: string) => {
    const trimmed = sanitizeValue(value);
    if (!trimmed) return undefined;
    const direct = new Date(trimmed);
    if (Number.isFinite(direct.getTime())) {
      return toThaiIsoString(direct);
    }
    const asDateOnly = new Date(`${trimmed}T00:00:00`);
    if (Number.isFinite(asDateOnly.getTime())) {
      return toThaiIsoString(asDateOnly);
    }
    return undefined;
  };

  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };

  const determineLifecycleStatusForImport = (
    hasAssignedCaretaker: boolean,
    dateRegisteredIso?: string,
  ): CustomerLifecycleStatus => {
    if (hasAssignedCaretaker && dateRegisteredIso) {
      const registeredAt = new Date(dateRegisteredIso);
      const now = new Date();
      const diffMs = now.getTime() - registeredAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays >= 90) {
        return CustomerLifecycleStatus.Old3Months;
      }
    }
    return CustomerLifecycleStatus.New;
  };

  const normalizeLifecycleStatusValue = (
    raw?: string,
  ): CustomerLifecycleStatus | undefined => {
    const token = sanitizeValue(raw).toLowerCase();
    if (!token) return undefined;
    switch (token) {
      case "new":
        return CustomerLifecycleStatus.New;
      case "old":
        return CustomerLifecycleStatus.Old;
      case "followup":
      case "follow-up":
      case "follow up":
        return CustomerLifecycleStatus.FollowUp;
      case "old3months":
      case "old3month":
      case "old_3months":
      case "old_3_months":
      case "old-3-months":
      case "old90days":
      case "old90":
      case "90days":
        return CustomerLifecycleStatus.Old3Months;
      case "dailydistribution":
      case "daily_distribution":
      case "daily-distribution":
      case "daily":
        return CustomerLifecycleStatus.DailyDistribution;
      default:
        return undefined;
    }
  };

  const normalizeBehavioralStatusValue = (
    raw?: string,
  ): CustomerBehavioralStatus | undefined => {
    const token = sanitizeValue(raw).toLowerCase();
    if (!token) return undefined;
    switch (token) {
      case "hot":
        return CustomerBehavioralStatus.Hot;
      case "warm":
        return CustomerBehavioralStatus.Warm;
      case "cold":
        return CustomerBehavioralStatus.Cold;
      case "frozen":
      case "freeze":
        return CustomerBehavioralStatus.Frozen;
      default:
        return undefined;
    }
  };

  const normalizeGradeValue = (raw?: string): CustomerGrade | undefined => {
    const token = sanitizeValue(raw).toUpperCase();
    if (!token) return undefined;
    switch (token) {
      case "A+":
      case "A_PLUS":
      case "A-PLUS":
        return CustomerGrade.A;
      case "A":
        return CustomerGrade.A;
      case "B":
        return CustomerGrade.B;
      case "C":
        return CustomerGrade.C;
      case "D":
        return CustomerGrade.D;
      default:
        return undefined;
    }
  };

  const normalizePaymentMethodValue = (raw?: string): PaymentMethod => {
    const token = sanitizeValue(raw).toLowerCase();
    if (token === "cod" || token === "cash on delivery") {
      return PaymentMethod.COD;
    }
    if (token === "payafter" || token === "pay after") {
      return PaymentMethod.PayAfter;
    }
    return PaymentMethod.Transfer;
  };

  const normalizePaymentStatusValue = (raw?: string): PaymentStatus => {
    const token = sanitizeValue(raw).toLowerCase();
    if (token === "paid" || token === "success") {
      return PaymentStatus.Paid;
    }
    if (
      token === "pending" ||
      token === "pendingverification" ||
      token === "pending verification"
    ) {
      return PaymentStatus.PendingVerification;
    }
    return PaymentStatus.Unpaid;
  };

  const calculateLineTotal = (row: SalesImportRow) => {
    const quantity =
      typeof row.quantity === "number" && Number.isFinite(row.quantity)
        ? row.quantity
        : 1;
    const unitPrice =
      typeof row.unitPrice === "number" && Number.isFinite(row.unitPrice)
        ? row.unitPrice
        : 0;
    const discount =
      typeof row.discount === "number" && Number.isFinite(row.discount)
        ? row.discount
        : 0;
    if (
      typeof row.totalAmount === "number" &&
      Number.isFinite(row.totalAmount)
    ) {
      return row.totalAmount;
    }
    return quantity * unitPrice - discount;
  };

  const ensureCustomerForImport = async (
    input: {
      id: string;
      firstName: string;
      lastName: string;
      phone: string;
      email?: string;
      address?: string;
      subdistrict?: string;
      district?: string;
      province?: string;
      postalCode?: string;
      caretakerId?: number | null;
      caretakerRef?: string | null;
      dateRegistered?: string;
      ownershipExpires?: string;
      lifecycleStatus?: CustomerLifecycleStatus;
      behavioralStatus?: CustomerBehavioralStatus;
      grade?: CustomerGrade;
      totalPurchases?: number;
    },
    summary: ImportResultSummary,
    notes: string[],
    processed: Map<string, Customer>,
  ): Promise<Customer | null> => {
    const cached = processed.get(input.id);
    if (cached) return cached;

    const email = sanitizeValue(input.email) || undefined;
    const firstName = sanitizeValue(input.firstName) || "Customer";
    const lastName = sanitizeValue(input.lastName);
    const phone = normalizePhone(input.phone);
    const street = sanitizeValue(input.address);
    const subdistrict = sanitizeValue(input.subdistrict);
    const district = sanitizeValue(input.district);
    const province = sanitizeValue(input.province);
    const postalCode = sanitizeValue(input.postalCode);

    const now = new Date();

    let assignedTo: number | null = null;
    let caretakerMatched = false;
    if (
      typeof input.caretakerId === "number" &&
      Number.isFinite(input.caretakerId)
    ) {
      const exists = companyUsers.some((u) => u.id === input.caretakerId);
      if (exists) {
        assignedTo = input.caretakerId;
        caretakerMatched = true;
      } else {
        summary.caretakerConflicts += 1;
        const ref =
          sanitizeValue(input.caretakerRef ?? input.caretakerId) ||
          String(input.caretakerId);
        notes.push(`Caretaker ${ref} not found for customer ${input.id}`);
      }
    } else if (input.caretakerRef) {
      summary.caretakerConflicts += 1;
      notes.push(
        `Caretaker ${input.caretakerRef} not found for customer ${input.id}`,
      );
    }

    let existing: Customer | undefined = customers.find(
      (c) => c.id === input.id,
    );
    let recordExists = false;
    try {
      await apiFetch(`customers/${encodeURIComponent(input.id)}`);
      recordExists = true;
    } catch (error) {
      if ((error as any)?.status !== 404) {
        notes.push(
          `Failed to check customer ${input.id}: ${(error as Error).message}`,
        );
        return existing ?? null;
      }
    }

    const dateAssignedIso =
      assignedTo !== null ? toThaiIsoString(now) : undefined;
    const defaultDateRegistered =
      assignedTo !== null
        ? (dateAssignedIso ?? toThaiIsoString(now))
        : undefined;
    const resolvedDateRegistered =
      input.dateRegistered ?? existing?.dateRegistered ?? defaultDateRegistered;

    const defaultOwnershipExpires =
      assignedTo !== null ? toThaiIsoString(addDays(now, 90)) : "";
    const resolvedOwnershipExpires =
      input.ownershipExpires ??
      existing?.ownershipExpires ??
      defaultOwnershipExpires;

    const resolvedLifecycleStatus =
      input.lifecycleStatus ??
      existing?.lifecycleStatus ??
      determineLifecycleStatusForImport(
        caretakerMatched,
        resolvedDateRegistered,
      );

    const resolvedBehavioralStatus =
      input.behavioralStatus ??
      existing?.behavioralStatus ??
      CustomerBehavioralStatus.Cold;

    const resolvedTotalPurchases =
      typeof input.totalPurchases === "number" &&
        Number.isFinite(input.totalPurchases)
        ? input.totalPurchases
        : (existing?.totalPurchases ?? 0);

    const resolvedGrade = calculateCustomerGrade(resolvedTotalPurchases);

    const address = {
      street,
      subdistrict,
      district,
      province,
      postalCode,
    };

    if (recordExists) {
      const updatePayload: any = {
        firstName,
        lastName,
        phone,
        email,
        province: province || undefined,
        address: {
          street: street || undefined,
          subdistrict: subdistrict || undefined,
          district: district || undefined,
          province: province || undefined,
          postalCode: postalCode || undefined,
        },
      };

      if (assignedTo !== null) {
        updatePayload.assignedTo = assignedTo;
        if (dateAssignedIso) {
          updatePayload.dateAssigned = dateAssignedIso;
        }
      }

      if (input.dateRegistered) {
        updatePayload.dateRegistered = resolvedDateRegistered;
      } else if (!existing?.dateRegistered && resolvedDateRegistered) {
        updatePayload.dateRegistered = resolvedDateRegistered;
      }

      if (input.ownershipExpires) {
        updatePayload.ownershipExpires = resolvedOwnershipExpires;
      } else if (!existing?.ownershipExpires && assignedTo !== null) {
        updatePayload.ownershipExpires = resolvedOwnershipExpires;
      }

      if (input.lifecycleStatus) {
        updatePayload.lifecycleStatus = resolvedLifecycleStatus;
      }

      if (input.behavioralStatus) {
        updatePayload.behavioralStatus = resolvedBehavioralStatus;
      } else if (!existing?.behavioralStatus) {
        updatePayload.behavioralStatus = resolvedBehavioralStatus;
      }

      if (input.grade) {
        updatePayload.grade = resolvedGrade;
      } else if (!existing?.grade) {
        updatePayload.grade = resolvedGrade;
      }

      if (
        typeof input.totalPurchases === "number" &&
        Number.isFinite(input.totalPurchases)
      ) {
        updatePayload.totalPurchases = resolvedTotalPurchases;
      }

      try {
        await updateCustomer(input.id, updatePayload);
      } catch (error) {
        notes.push(
          `Failed to update customer ${input.id}: ${(error as Error).message}`,
        );
        return existing ?? null;
      }

      const baseCustomer: Customer = existing ?? {
        id: input.id,
        firstName,
        lastName,
        phone,
        email,
        address,
        province,
        companyId: currentUser.companyId,
        assignedTo,
        dateAssigned: dateAssignedIso ?? toThaiIsoString(now),
        dateRegistered: resolvedDateRegistered,
        ownershipExpires: resolvedOwnershipExpires,
        lifecycleStatus: resolvedLifecycleStatus,
        behavioralStatus: resolvedBehavioralStatus,
        grade: resolvedGrade,
        tags: [],
        totalPurchases: resolvedTotalPurchases,
        totalCalls: 0,
      };

      const mergedCustomer: Customer = {
        ...baseCustomer,
        firstName,
        lastName,
        phone,
        email,
        address,
        province,
        assignedTo,
        dateAssigned: dateAssignedIso ?? baseCustomer.dateAssigned,
        dateRegistered: resolvedDateRegistered ?? baseCustomer.dateRegistered,
        ownershipExpires:
          resolvedOwnershipExpires || baseCustomer.ownershipExpires,
        lifecycleStatus: resolvedLifecycleStatus,
        behavioralStatus: resolvedBehavioralStatus,
        grade: resolvedGrade,
        totalPurchases: resolvedTotalPurchases,
      };

      setCustomers((prev) => {
        if (prev.some((c) => c.id === input.id)) {
          return prev.map((c) =>
            c.id === input.id ? { ...c, ...mergedCustomer } : c,
          );
        }
        return [mergedCustomer, ...prev];
      });

      summary.updatedCustomers += 1;
      processed.set(input.id, mergedCustomer);
      return mergedCustomer;
    }

    const createPayload: any = {
      id: input.id,
      firstName,
      lastName,
      phone,
      email,
      province,
      companyId: currentUser.companyId,
      assignedTo,
      address: {
        street: street || undefined,
        subdistrict: subdistrict || undefined,
        district: district || undefined,
        province: province || undefined,
        postalCode: postalCode || undefined,
      },
    };

    if (assignedTo !== null && dateAssignedIso) {
      createPayload.dateAssigned = dateAssignedIso;
    }
    if (resolvedDateRegistered) {
      createPayload.dateRegistered = resolvedDateRegistered;
    }
    if (resolvedOwnershipExpires) {
      createPayload.ownershipExpires = resolvedOwnershipExpires;
    }
    createPayload.lifecycleStatus = resolvedLifecycleStatus;
    createPayload.behavioralStatus = resolvedBehavioralStatus;
    createPayload.grade = resolvedGrade;
    createPayload.totalPurchases = resolvedTotalPurchases;

    try {
      await apiCreateCustomer(createPayload);
    } catch (error) {
      notes.push(
        `Failed to create customer ${input.id}: ${(error as Error).message}`,
      );
      return null;
    }

    const newCustomer: Customer = {
      id: input.id,
      firstName,
      lastName,
      phone,
      email,
      address,
      province,
      companyId: currentUser.companyId,
      assignedTo,
      dateAssigned: dateAssignedIso ?? toThaiIsoString(now),
      dateRegistered: resolvedDateRegistered,
      ownershipExpires: resolvedOwnershipExpires,
      lifecycleStatus: resolvedLifecycleStatus,
      behavioralStatus: resolvedBehavioralStatus,
      grade: resolvedGrade,
      tags: [],
      totalPurchases: resolvedTotalPurchases,
      totalCalls: 0,
    };

    setCustomers((prev) => {
      if (prev.some((c) => c.id === input.id)) {
        return prev.map((c) => (c.id === input.id ? newCustomer : c));
      }
      return [newCustomer, ...prev];
    });

    summary.createdCustomers += 1;
    processed.set(input.id, newCustomer);
    return newCustomer;
  };

  const handleImportSales = async (
    rows: SalesImportRow[],
  ): Promise<ImportResultSummary> => {
    const summary: ImportResultSummary = {
      totalRows: rows.length,
      createdCustomers: 0,
      updatedCustomers: 0,
      createdOrders: 0,
      updatedOrders: 0,
      waitingBasket: 0,
      caretakerConflicts: 0,
      notes: [],
    };

    const processedCustomers = new Map<string, Customer>();
    const grouped = new Map<
      string,
      { rows: SalesImportRow[]; firstIndex: number }
    >();

    rows.forEach((row, index) => {
      const orderId = sanitizeValue(row.orderNumber);
      if (!orderId) {
        summary.notes.push(`Row ${index + 2}: missing order number, skipped.`);
        return;
      }
      const entry = grouped.get(orderId);
      if (entry) {
        entry.rows.push(row);
      } else {
        grouped.set(orderId, { rows: [row], firstIndex: index });
      }
    });

    for (const [orderId, group] of grouped.entries()) {
      const { rows: orderRows, firstIndex } = group;
      const first = orderRows[0];
      if (!first) continue;

      const rawCustomerId = sanitizeValue(first.customerId);
      let customerId = rawCustomerId;
      if (!customerId) {
        const phoneSeed = normalizePhone(sanitizeValue(first.customerPhone));
        if (phoneSeed) {
          customerId = `CUST-${phoneSeed}`;
        } else {
          customerId = `CUST-${Date.now()}-${firstIndex}`;
        }
      }

      const firstName =
        sanitizeValue(first.customerFirstName) ||
        sanitizeValue(first.customerName).split(/\s+/)[0] ||
        "Customer";
      const lastName =
        sanitizeValue(first.customerLastName) ||
        sanitizeValue(first.customerName).split(/\s+/).slice(1).join(" ");

      const phone = normalizePhone(sanitizeValue(first.customerPhone));
      if (!phone) {
        summary.notes.push(
          `Order ${orderId}: customer phone missing, skipped.`,
        );
        continue;
      }

      const { id: resolvedCaretakerId, reference: resolvedCaretakerRef } =
        normalizeCaretakerIdentifier(first.caretakerId);

      const customer = await ensureCustomerForImport(
        {
          id: customerId,
          firstName,
          lastName,
          phone,
          email: sanitizeValue(first.customerEmail),
          address: sanitizeValue(first.address),
          subdistrict: sanitizeValue(first.subdistrict),
          district: sanitizeValue(first.district),
          province: sanitizeValue(first.province),
          postalCode: sanitizeValue(first.postalCode),
          caretakerId: resolvedCaretakerId ?? undefined,
          caretakerRef: resolvedCaretakerRef ?? undefined,
        },
        summary,
        summary.notes,
        processedCustomers,
      );

      if (!customer) {
        summary.notes.push(
          `Order ${orderId}: failed to upsert customer ${customerId}.`,
        );
        continue;
      }

      let orderExists = orders.some((o) => o.id === orderId);
      if (!orderExists) {
        try {
          await apiFetch(`orders/${encodeURIComponent(orderId)}`);
          orderExists = true;
        } catch (error) {
          if ((error as any)?.status !== 404) {
            summary.notes.push(
              `Order ${orderId}: lookup failed - ${(error as Error).message}`,
            );
            continue;
          }
        }
      }

      if (orderExists) {
        summary.notes.push(`Order ${orderId} already exists, skipped.`);
        continue;
      }

      const orderDateIso =
        parseDateToIso(first.saleDate) ?? toThaiIsoString(new Date());
      const paymentMethod = normalizePaymentMethodValue(first.paymentMethod);
      const paymentStatus = normalizePaymentStatusValue(first.paymentStatus);
      const recipientFirstName = sanitizeValue(
        (first as any).recipientFirstName ??
        (first as any).recipient_first_name ??
        customer.firstName ??
        "",
      );
      const recipientLastName = sanitizeValue(
        (first as any).recipientLastName ??
        (first as any).recipient_last_name ??
        customer.lastName ??
        "",
      );
      const shippingAddress: Address = {
        recipientFirstName,
        recipientLastName,
        street: sanitizeValue(first.address),
        subdistrict: sanitizeValue(first.subdistrict),
        district: sanitizeValue(first.district),
        province: sanitizeValue(first.province),
        postalCode: sanitizeValue(first.postalCode),
      };

      const {
        id: resolvedCreatorId,
        matched: salespersonMatched,
        reference: salespersonReference,
      } = resolveSalespersonForImport(first.salespersonId);

      if (!salespersonMatched && salespersonReference) {
        summary.notes.push(
          `Order ${orderId}: เจ้าของ ${salespersonReference} ไม่สามารถเปลี่ยนเป็น ${currentUser.username} แทน.`,
        );
      }

      const lineItems = orderRows.map((line, index) => {
        const productName =
          sanitizeValue(line.productName) ||
          sanitizeValue(line.productCode) ||
          `Item ${index + 1}`;
        return {
          id: index + 1,
          productName,
          quantity:
            typeof line.quantity === "number" && Number.isFinite(line.quantity)
              ? line.quantity
              : 1,
          pricePerUnit:
            typeof line.unitPrice === "number" &&
              Number.isFinite(line.unitPrice)
              ? line.unitPrice
              : 0,
          discount:
            typeof line.discount === "number" && Number.isFinite(line.discount)
              ? line.discount
              : 0,
          isFreebie: false,
          boxNumber: 0,
          productId: undefined,
          promotionId: undefined,
          parentItemId: undefined,
          isPromotionParent: false,
        } as LineItem;
      });

      const payloadItems = lineItems.map((item) => ({
        id: item.id,
        productId: item.productId ?? null,
        productName: item.productName,
        quantity: item.quantity,
        pricePerUnit: item.pricePerUnit,
        discount: item.discount,
        isFreebie: item.isFreebie,
        boxNumber: item.boxNumber,
        promotionId: item.promotionId ?? null,
        parentItemId: item.parentItemId ?? null,
        isPromotionParent: item.isPromotionParent ?? false,
      }));

      const totalAmount = orderRows
        .map(calculateLineTotal)
        .reduce((sum, value) => sum + value, 0);

      const orderPayload = {
        id: orderId,
        customerId: customer.id,
        companyId: currentUser.companyId,
        creatorId: resolvedCreatorId,
        orderDate: orderDateIso,
        deliveryDate: orderDateIso,
        shippingAddress,
        shippingProvider: undefined,
        items: payloadItems,
        shippingCost: 0,
        billDiscount: 0,
        totalAmount,
        paymentMethod,
        paymentStatus,
        slipUrl: null,
        amountPaid:
          paymentStatus === PaymentStatus.Paid ? totalAmount : undefined,
        codAmount:
          paymentMethod === PaymentMethod.COD ? totalAmount : undefined,
        orderStatus: OrderStatus.Pending,
        trackingNumbers: [],
        boxes: [],
        notes: sanitizeValue(first.notes) || undefined,
        salesChannel: undefined,
        salesChannelPageId: undefined,
        warehouseId: undefined,
      };

      try {
        await apiCreateOrder(orderPayload);
      } catch (error) {
        summary.notes.push(
          `Order ${orderId}: creation failed - ${(error as Error).message}`,
        );
        continue;
      }

      const newOrder: Order = {
        id: orderId,
        customerId: customer.id,
        companyId: currentUser.companyId,
        creatorId: resolvedCreatorId,
        orderDate: orderDateIso,
        deliveryDate: orderDateIso,
        shippingAddress,
        shippingProvider: undefined,
        items: lineItems,
        shippingCost: 0,
        billDiscount: 0,
        totalAmount,
        paymentMethod,
        paymentStatus,
        slipUrl: undefined,
        amountPaid:
          paymentStatus === PaymentStatus.Paid ? totalAmount : undefined,
        codAmount:
          paymentMethod === PaymentMethod.COD ? totalAmount : undefined,
        orderStatus: OrderStatus.Pending,
        trackingNumbers: [],
        boxes: [],
        notes: sanitizeValue(first.notes) || undefined,
        warehouseId: undefined,
        salesChannel: undefined,
        salesChannelPageId: undefined,
        slips: [],
      };

      // Filter out sub orders before adding new order
      setOrders((prev) => {
        const filteredPrev = prev.filter((order: Order) => {
          const orderId = String(order.id || "");
          return !/-\d+$/.test(orderId);
        });
        // Also check if newOrder is a sub order
        const newOrderId = String(newOrder.id || "");
        const isSubOrder = /-\d+$/.test(newOrderId);
        return isSubOrder ? filteredPrev : [newOrder, ...filteredPrev];
      });
      summary.createdOrders += 1;
    }

    return summary;
  };

  const handleImportCustomers = async (
    rows: CustomerImportRow[],
  ): Promise<ImportResultSummary> => {
    const summary: ImportResultSummary = {
      totalRows: rows.length,
      createdCustomers: 0,
      updatedCustomers: 0,
      createdOrders: 0,
      updatedOrders: 0,
      waitingBasket: 0,
      caretakerConflicts: 0,
      notes: [],
    };

    const processedCustomers = new Map<string, Customer>();
    let counter = 0;
    const timestamp = Date.now();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const rowNumber = index + 2;

      let customerId = sanitizeValue(row.customerId);
      const rawPhone = sanitizeValue(row.phone);
      const phone = normalizePhone(rawPhone);

      if (!customerId) {
        if (phone) {
          customerId = `CUST-${phone}`;
        } else {
          customerId = `CUST-IMP-${timestamp}-${counter++}`;
        }
      }

      const firstName =
        sanitizeValue(row.firstName) ||
        sanitizeValue(row.customerName).split(/\s+/)[0];
      const lastName =
        sanitizeValue(row.lastName) ||
        sanitizeValue(row.customerName).split(/\s+/).slice(1).join(" ");

      if (!firstName) {
        summary.notes.push(`Row ${rowNumber}: missing first name, skipped.`);
        continue;
      }

      if (!phone) {
        summary.notes.push(`Row ${rowNumber}: missing phone, skipped.`);
        continue;
      }

      const { id: resolvedCaretakerId, reference: resolvedCaretakerRef } =
        normalizeCaretakerIdentifier(row.caretakerId);

      const dateRegisteredIso = parseDateToIso(row.dateRegistered);
      const ownershipExpiresIso = parseDateToIso(row.ownershipExpires);
      const lifecycleStatus = normalizeLifecycleStatusValue(
        row.lifecycleStatus,
      );
      const behavioralStatus = normalizeBehavioralStatusValue(
        row.behavioralStatus,
      );
      const grade = normalizeGradeValue(row.grade);
      const totalPurchases =
        typeof row.totalPurchases === "number" &&
          Number.isFinite(row.totalPurchases)
          ? row.totalPurchases
          : undefined;

      const customer = await ensureCustomerForImport(
        {
          id: customerId,
          firstName,
          lastName,
          phone,
          email: sanitizeValue(row.email),
          address: sanitizeValue(row.address),
          subdistrict: sanitizeValue(row.subdistrict),
          district: sanitizeValue(row.district),
          province: sanitizeValue(row.province),
          postalCode: sanitizeValue(row.postalCode),
          caretakerId: resolvedCaretakerId ?? undefined,
          caretakerRef: resolvedCaretakerRef ?? undefined,
          dateRegistered: dateRegisteredIso,
          ownershipExpires: ownershipExpiresIso,
          lifecycleStatus,
          behavioralStatus,
          grade,
          totalPurchases,
        },
        summary,
        summary.notes,
        processedCustomers,
      );

      if (!customer) {
        summary.notes.push(
          `Row ${rowNumber}: failed to upsert customer ${customerId}.`,
        );
      }
    }

    return summary;
  };
  const renderPage = () => {
    // If activePage is a main menu (group), show the first child's page or a default
    if (activePage === "Home") {
      // Default to first available child in Home group
      if (currentUser.role === UserRole.Backoffice) {
        return (
          <BackofficeDashboard
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            activities={activities}
            openModal={openModal}
          />
        );
      }
      if (
        currentUser.role === UserRole.Telesale ||
        currentUser.role === UserRole.Supervisor
      ) {
        return (
          <TelesaleSummaryDashboard
            user={currentUser}
            customers={companyCustomers}
            orders={companyOrders}
            activities={activities}
            openModal={() => setActivePage("CreateOrder")}
          />
        );
      }
      return (
        <AdminDashboard
          user={currentUser}
          orders={companyOrders}
          customers={companyCustomers}
          openCreateOrderModal={() => setActivePage("CreateOrder")}
        />
      );
    }
    if (activePage === "Data Management") {
      // Default to first available page in Data Management
      return (
        <UserManagementPage
          users={companyUsers}
          openModal={openModal}
          onToggleStatus={handleToggleUserStatus}
          currentUser={currentUser}
          allCompanies={companies}
        />
      );
    }

    if (
      (currentUser.role === UserRole.Backoffice ||
        currentUser.role === UserRole.AdminControl ||
        currentUser.role === UserRole.SuperAdmin) &&
      activePage === "Export History"
    ) {
      return <ExportHistoryPage />;
    }
    // CustomerDetailPage is now rendered as overlay in main return JSX, not here

    // Global entries: simple, international dashboards for layout-only views
    if (activePage === "Sales Overview") {
      return (
        <SalesDashboard
          user={currentUser}
          orders={companyOrders}
          customers={companyCustomers}
          openCreateOrderModal={() => setActivePage("CreateOrder")}
        />
      );
    }
    if (activePage === "Calls Overview") {
      return <CallsDashboard calls={callHistory} user={currentUser} />;
    }
    if (activePage === "Pancake User Mapping") {
      return <PancakeUserIntegrationPage currentUser={currentUser} />;
    }

    // Page stats (Super Admin): group default or specific page
    if (activePage === "Page Stats" || activePage === "Page Performance") {
      return (
        <PageStatsPage
          orders={companyOrders}
          customers={companyCustomers}
          calls={callHistory}
        />
      );
    }
    if (activePage === "Engagement Insights") {
      return (
        <EngagementStatsPage
          orders={companyOrders}
          customers={companyCustomers}
          calls={callHistory}
          pages={pages}
          users={companyUsers}
        />
      );
    }

    // New, neutral sidebar labels mapping with role guard
    if (activePage === "Dashboard" || activePage === "Home") {
      if (currentUser.role === UserRole.Backoffice) {
        return (
          <BackofficeDashboard
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            activities={activities}
            openModal={openModal}
          />
        );
      }
      if (
        currentUser.role === UserRole.Telesale ||
        currentUser.role === UserRole.Supervisor
      ) {
        return (
          <TelesaleSummaryDashboard
            user={currentUser}
            customers={companyCustomers}
            orders={companyOrders}
            activities={activities}
            openModal={() => setActivePage("CreateOrder")}
          />
        );
      }
      return (
        <AdminDashboard
          user={currentUser}
          orders={companyOrders}
          customers={companyCustomers}
          openCreateOrderModal={() => setActivePage("CreateOrder")}
        />
      );
    }
    const pageRoleLimits: Record<string, UserRole[]> = {
      Permissions: [UserRole.SuperAdmin],
      Teams: [UserRole.SuperAdmin],
      Products: [UserRole.SuperAdmin, UserRole.AdminControl],
      Users: [UserRole.SuperAdmin, UserRole.AdminControl],
      Pages: [UserRole.SuperAdmin, UserRole.AdminControl],
      Tags: [UserRole.SuperAdmin, UserRole.AdminControl],
    };
    const allowedRoles = pageRoleLimits[activePage];
    if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
      return <div className="p-6 text-red-600">Not authorized</div>;
    }
    if (activePage === "Users") {
      return (
        <UserManagementPage
          users={companyUsers}
          openModal={openModal}
          onToggleStatus={handleToggleUserStatus}
          currentUser={currentUser}
          allCompanies={companies}
        />
      );
    }
    if (activePage === "Products") {
      return (
        <ProductManagementPage
          products={companyProducts}
          openModal={openModal}
          currentUser={currentUser}
          allCompanies={companies}
        />
      );
    }
    if (activePage === "Customers") {
      if (
        currentUser.role === UserRole.Telesale ||
        currentUser.role === UserRole.Supervisor
      ) {
        return (
          <TelesaleDashboard
            user={currentUser}
            customers={companyCustomers}
            appointments={appointments}
            activities={activities}
            calls={callHistory}
            orders={companyOrders}
            onViewCustomer={handleViewCustomer}
            openModal={openModal}
            setActivePage={setActivePage}
            onUpsellClick={(customer) => {
              setPreviousPage(activePage);
              setCreateOrderInitialData({ customer, upsell: true });
              setActivePage("CreateOrder");
            }}
            onChangeOwner={handleChangeCustomerOwner}
            systemTags={systemTags}
          />
        );
      }

      // If Admin clicks "Customers", they see ManageCustomersPage (List View)
      return (
        <ManageCustomersPage
          allUsers={companyUsers}
          allCustomers={companyCustomers}
          allOrders={companyOrders}
          currentUser={currentUser}
          onViewCustomer={handleViewCustomer}
          openModal={openModal}
          onChangeOwner={handleChangeCustomerOwner}
          onUpsellClick={(customer) => {
            setPreviousPage(activePage);
            setCreateOrderInitialData({ customer, upsell: true });
            setActivePage("CreateOrder");
          }}
        />
      );
    }

    // "Manage Customers" -> CustomerDistributionPage (Distribute List)
    if (activePage === "Manage Customers") {
      return (
        <CustomerDistributionPage
          allCustomers={companyCustomers}
          allUsers={companyUsers}
          setCustomers={setCustomers}
          currentUser={currentUser}
        />
      );
    }
    if (activePage === "Search") {
      return (
        <CustomerSearchPage
          customers={companyCustomers}
          orders={companyOrders}
          users={companyUsers}
          currentUser={currentUser}
          onTakeCustomer={handleTakeCustomer}
        />
      );
    }
    if (activePage === "Share") {
      return (
        <CustomerDistributionPage
          allCustomers={companyCustomers}
          allUsers={companyUsers}
          setCustomers={setCustomers}
          currentUser={currentUser}
        />
      );
    }
    if (activePage === "Data") {
      return (
        <DataManagementPage
          allUsers={companyUsers}
          allCustomers={companyCustomers}
          allOrders={companyOrders}
          onImportSales={handleImportSales}
          onImportCustomers={handleImportCustomers}
        />
      );
    }
    if (activePage === "Data Management") {
      return (
        <DataManagementPage
          allUsers={companyUsers}
          allCustomers={companyCustomers}
          allOrders={companyOrders}
          onImportSales={handleImportSales}
          onImportCustomers={handleImportCustomers}
        />
      );
    }
    if (activePage === "Permissions") {
      return <PermissionsPage />;
    }
    if (activePage === "Settings") {
      return <PermissionsPage />;
    }
    if (activePage === "Teams") {
      return <TeamsManagementPage users={companyUsers} />;
    }
    if (activePage === "Pages") {
      return <PagesManagementPage pages={pages} currentUser={currentUser} />;
    }
    if (activePage === "Platforms") {
      return (
        <PlatformsManagementPage
          currentUser={currentUser}
          companies={companies}
        />
      );
    }
    if (activePage === "Bank Accounts") {
      return (
        <BankAccountsManagementPage
          currentUser={currentUser}
          companies={companies}
        />
      );
    }
    if (activePage === "Tags") {
      return (
        <TagsManagementPage systemTags={systemTags} users={companyUsers} currentUser={currentUser} onTagDeleted={handleTagDeleted} />
      );
    }
    if (activePage === "Companies") {
      return (
        <CompanyManagementPage
          companies={companies}
          currentUser={currentUser}
          onCompanyChange={setCompanies}
        />
      );
    }
    if (activePage === "Warehouses") {
      return (
        <WarehouseManagementPage
          warehouses={warehouses}
          companies={companies}
          currentUser={currentUser}
          onWarehouseChange={setWarehouses}
        />
      );
    }
    if (activePage === "Receive Stock") {
      return (
        <WarehouseStockViewPage
          currentUser={currentUser}
          warehouses={warehouses}
        />
      );
    }
    if (activePage === "Warehouse Stock") {
      return <WarehouseStockViewPage currentUser={currentUser} />;
    }
    if (activePage === "Lot Tracking") {
      return <LotTrackingPage currentUser={currentUser} />;
    }
    if (activePage === "Warehouse Allocation") {
      return <OrderAllocationPage />;
    }
    if (activePage === "Team") {
      if (currentUser.role === UserRole.Supervisor) {
        return (
          <SupervisorTeamPage
            user={currentUser}
            allUsers={users}
            allCustomers={companyCustomers}
            allOrders={companyOrders}
          />
        );
      }
      return (
        <TelesaleSummaryDashboard
          user={currentUser}
          customers={companyCustomers}
          orders={companyOrders}
          activities={activities}
          openModal={() => setActivePage("CreateOrder")}
        />
      );
    }
    if (activePage === "Orders" || activePage === "Manage Orders") {
      if (
        currentUser.role === UserRole.Backoffice ||
        activePage === "Manage Orders"
      ) {
        return (
          <ManageOrdersPage
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            users={companyUsers}
            products={companyProducts}
            openModal={openModal}
            onProcessOrders={handleProcessOrders}
            onCancelOrders={handleCancelOrdersBulk}
            onUpdateShippingProvider={handleUpdateShippingProvider}
          />
        );
      }
      return (
        <TelesaleOrdersPage
          user={currentUser}
          users={companyUsers}
          orders={companyOrders}
          customers={companyCustomers}
          openModal={openModal}
          onCancelOrder={handleCancelOrder}
          openCreateOrderModal={() => setActivePage("CreateOrder")}
        />
      );
    }
    if (activePage === "Debt") {
      return (
        <DebtCollectionPage
          user={currentUser}
          orders={companyOrders}
          customers={companyCustomers}
          users={companyUsers}
          openModal={openModal}
        />
      );
    }
    if (activePage === "Reports") {
      return (
        <ReportsPage
          orders={companyOrders}
          customers={companyCustomers}
          products={products}
          warehouseStock={warehouseStocks}
          stockMovements={stockMovements}
          productLots={productLots}
        />
      );
    }
    if (activePage === "Product Sales Report") {
      return (
        <ProductSalesReportPage
          orders={companyOrders}
          products={products}
          promotions={promotions}
        />
      );
    }
    if (activePage === "Bulk Tracking") {
      return (
        <BulkTrackingPage
          currentUser={currentUser}
          onBulkUpdateTracking={handleBulkUpdateTracking}
        />
      );
    }
    if (activePage === "Call Details") {
      return <CallDetailsPage currentUser={currentUser} />;
    }
    if (activePage === "Call History" || activePage === "Dtac Onecall") {
      return (
        <CallHistoryPage
          currentUser={currentUser}
          calls={callHistory}
          customers={companyCustomers}
          users={companyUsers}
        />
      );
    }
    if (
      activePage === "Active Promotions" ||
      activePage === "Promotion History" ||
      activePage === "Create Promotion"
    ) {
      return <PromotionsPage />;
    }

    if (activePage === "UpsellOrder") {
      return upsellInitialData ? (
        <UpsellOrderPage
          customer={upsellInitialData.customer}
          products={companyProducts}
          users={companyUsers}
          currentUser={currentUser}
          onCancel={() => {
            setUpsellInitialData(null);
            setActivePage(previousPage || "Dashboard");
            setPreviousPage(null);
          }}
          onSuccess={async () => {
            setUpsellInitialData(null);
            setActivePage("Dashboard");
            setPreviousPage(null);
            // Refresh activities and customers to update Do dashboard
            try {
              const [act, c, ctags] = await Promise.all([
                listActivities(),
                activePage === 'Customers' ? listCustomers({ companyId: sessionUser?.company_id }) : Promise.resolve({ total: 0, data: [] }),
                listCustomerTags(),
              ]);
              setActivities(
                Array.isArray(act)
                  ? act.map((a) => ({
                    id: a.id,
                    customerId: a.customer_id,
                    timestamp: a.timestamp,
                    type: a.type,
                    description: a.description,
                    actorName: a.actor_name,
                  }))
                  : [],
              );
              // Build tags map like in load()
              const tagsByCustomer: Record<string, Tag[]> = {};
              if (Array.isArray(ctags)) {
                for (const ct of ctags) {
                  const cid = String(ct.customer_id || "");
                  if (!tagsByCustomer[cid]) tagsByCustomer[cid] = [];
                  tagsByCustomer[cid].push({
                    id: ct.id,
                    name: ct.name,
                    type: ct.type as TagType,
                  });
                }
              }
              // Use the same mapCustomer logic from load()
              const cArray = (c as any).data || [];
              setCustomers(Array.isArray(cArray) ? cArray.map((r: any) => {
                const totalPurchasesVal = Number(r.total_purchases || 0);
                const pk = r.customer_id ?? r.id ?? r.pk ?? null;
                const refId =
                  r.customer_ref_id ??
                  r.customer_ref ??
                  r.customer_refid ??
                  r.customerId ??
                  null;
                const resolvedId =
                  pk != null ? String(pk) : refId != null ? String(refId) : "";

                return {
                  id: resolvedId,
                  pk: pk != null ? Number(pk) : undefined,
                  customerId: refId ?? undefined,
                  customerRefId: refId ?? undefined,
                  firstName: r.first_name,
                  lastName: r.last_name,
                  phone: r.phone,
                  backupPhone: r.backup_phone ?? r.backupPhone ?? "",
                  email: r.email ?? undefined,
                  address: {
                    recipientFirstName: r.recipient_first_name || "",
                    recipientLastName: r.recipient_last_name || "",
                    street: r.street || "",
                    subdistrict: r.subdistrict || "",
                    district: r.district || "",
                    province: r.province || "",
                    postalCode: r.postal_code || "",
                  },
                  province: r.province || "",
                  companyId: r.company_id,
                  assignedTo:
                    r.assigned_to !== null && typeof r.assigned_to !== "undefined"
                      ? Number(r.assigned_to)
                      : null,
                  dateAssigned: r.date_assigned,
                  dateRegistered: r.date_registered ?? undefined,
                  followUpDate: r.follow_up_date ?? undefined,
                  ownershipExpires: r.ownership_expires ?? "",
                  lifecycleStatus:
                    r.lifecycle_status === "New"
                      ? CustomerLifecycleStatus.New
                      : r.lifecycle_status === "Old"
                        ? CustomerLifecycleStatus.Old
                        : r.lifecycle_status === "FollowUp"
                          ? CustomerLifecycleStatus.FollowUp
                          : r.lifecycle_status === "Old3Months"
                            ? CustomerLifecycleStatus.Old3Months
                            : r.lifecycle_status === "DailyDistribution"
                              ? CustomerLifecycleStatus.DailyDistribution
                              : (r.lifecycle_status ?? CustomerLifecycleStatus.New),
                  behavioralStatus: (r.behavioral_status ??
                    "Cold") as CustomerBehavioralStatus,
                  grade: calculateCustomerGrade(totalPurchasesVal),
                  tags: tagsByCustomer[resolvedId] || [],
                  assignmentHistory: [],
                  totalPurchases: totalPurchasesVal,
                  totalCalls: Number(r.total_calls || 0),
                  facebookName: r.facebook_name ?? undefined,
                  lineId: r.line_id ?? undefined,
                  isInWaitingBasket: Boolean(r.is_in_waiting_basket ?? false),
                  waitingBasketStartDate: r.waiting_basket_start_date ?? undefined,
                };
              }) : []);
            } catch (e) {
              console.error("Failed to refresh activities and customers after upsell", e);
            }
          }}
        />
      ) : null;
    }

    // Unified Routing - Switch by Page Name instead of Role
    switch (activePage) {
      // PROCESSED: Dashboard (Role-Dependent)
      case "Dashboard":
      case "แดชบอร์ด":
        // Admin
        if (currentUser.role === UserRole.SuperAdmin || currentUser.role === UserRole.AdminControl) {
          return (
            <AdminDashboard
              user={currentUser}
              orders={companyOrders} // SuperAdmin sees all
              customers={companyCustomers}
              openCreateOrderModal={() => setActivePage("CreateOrder")}
            />
          );
        }
        if (currentUser.role === UserRole.Admin) {
          return (
            <AdminDashboard
              user={currentUser}
              orders={companyOrders.filter(o => o.creatorId === currentUser.id)}
              customers={companyCustomers.filter(c => c.assignedTo === currentUser.id)}
              openCreateOrderModal={() => setActivePage("CreateOrder")}
            />
          );
        }
        // Telesale / Supervisor
        if (currentUser.role === UserRole.Telesale || currentUser.role === UserRole.Supervisor) {
          return (
            <TelesaleSummaryDashboard
              user={currentUser}
              customers={companyCustomers}
              orders={companyOrders}
              activities={activities}
              openModal={() => setActivePage("CreateOrder")}
            />
          );
        }
        // Backoffice
        if (currentUser.role === UserRole.Backoffice) {
          return (
            <BackofficeDashboard
              user={currentUser}
              orders={companyOrders}
              customers={companyCustomers}
              openModal={openModal}
            />
          );
        }
        // Finance / Default
        return (
          <AdminDashboard
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            openCreateOrderModal={() => setActivePage("CreateOrder")}
          />
        );

      // PROCESSED: Sales Dashboard
      case "Sales Overview":
      case "แดชบอร์ดการขาย":
        return (
          <TelesaleDashboard
            user={currentUser}
            customers={companyCustomers}
            appointments={appointments}
            activities={activities}
            calls={callHistory}
            orders={companyOrders}
            onViewCustomer={handleViewCustomer}
            openModal={openModal}
            setActivePage={setActivePage}
            onUpsellClick={(customer) => {
              setPreviousPage(activePage);
              setCreateOrderInitialData({ customer, upsell: true });
              setActivePage("CreateOrder");
            }}
            systemTags={systemTags}
            onChangeOwner={handleChangeCustomerOwner}
            allUsers={companyUsers}
          />
        );

      // PROCESSED: Orders
      case "CreateOrder":
        return (
          <CreateOrderPage
            products={companyProducts}
            promotions={promotions}
            pages={pages}
            platforms={platforms}
            warehouses={warehouses}
            currentUser={currentUser}
            users={companyUsers}
            onSave={handleCreateOrder}
            onCancel={() => {
              setActivePage(previousPage || "Dashboard");
              setPreviousPage(null);
              setCreateOrderInitialData(null);
            }}
            onSuccess={() => {
              setActivePage("Dashboard");
              setPreviousPage(null);
              setCreateOrderInitialData(null);
            }}
            onUpsellSuccess={handleUpsellSuccess}
            initialData={createOrderInitialData}
          />
        );

      // PROCESSED: Order Lists
      case "Orders":
      case "รายการคำสั่งซื้อ":
      case "คำสั่งซื้อทั้งหมด":
        if (currentUser.role === UserRole.Backoffice) {
          // Backoffice View
          return (
            <ManageOrdersPage
              user={currentUser}
              orders={companyOrders}
              customers={companyCustomers}
              users={companyUsers}
              products={companyProducts}
              openModal={openModal}
              onProcessOrders={handleProcessOrders}
              onCancelOrders={handleCancelOrdersBulk}
              onUpdateShippingProvider={handleUpdateShippingProvider}
            />
          );
        }
        // Default / Telesale View
        return (
          <TelesaleOrdersPage
            users={companyUsers}
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            openModal={openModal}
            onCancelOrder={handleCancelOrder}
            title="รายการคำสั่งซื้อ"
          />
        );

      case "Manage Orders":
      case "จัดการคำสั่งซื้อ":
        return (
          <ManageOrdersPage
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            users={companyUsers}
            products={companyProducts}
            openModal={openModal}
            onProcessOrders={handleProcessOrders}
            onCancelOrders={handleCancelOrdersBulk}
            onUpdateShippingProvider={handleUpdateShippingProvider}
          />
        );

      // PROCESSED: Customers
      case "Add Customer":
      case "เพิ่มลูกค้า":
        return (
          <AddCustomerPage
            companyUsers={companyUsers}
            onCancel={() => setActivePage("Dashboard")}
            onSave={(customerData, andCreateOrder) => {
              const newCustomer = handleSaveCustomer(customerData);
              if (andCreateOrder) {
                setActivePage("CreateOrder");
              } else {
                setActivePage("Dashboard");
              }
            }}
          />
        );

      case "Distribute":
      case "แจกจ่าย":
        return (
          <CustomerDistributionPage
            allCustomers={companyCustomers}
            allUsers={companyUsers}
            setCustomers={setCustomers}
            currentUser={currentUser}
          />
        );

      case "Search":
      case "ค้นหาลูกค้า":
        return (
          <CustomerSearchPage
            customers={companyCustomers}
            orders={companyOrders}
            users={users}
            currentUser={currentUser}
            onTakeCustomer={handleTakeCustomer}
          />
        );

      case "Customers":
      case "Manage Customers":
      case "จัดการลูกค้า":
        return (
          <ManageCustomersPage
            allUsers={companyUsers}
            allCustomers={companyCustomers}
            allOrders={companyOrders}
            currentUser={currentUser}
            onTakeCustomer={handleTakeCustomer}
            openModal={openModal}
            onViewCustomer={handleViewCustomer}
            onChangeOwner={handleChangeCustomerOwner}
            onUpsellClick={(customer) => {
              setPreviousPage(activePage);
              setCreateOrderInitialData({ customer, upsell: true });
              setActivePage("CreateOrder");
            }}
          />
        );

      case "Customer Pools":
      case "กลุ่มลูกค้า":
        return (
          <CustomerPoolsPage
            users={companyUsers}
            customers={companyCustomers}
            currentUser={currentUser}
            onViewCustomer={handleViewCustomer}
            openModal={openModal}
          />
        );

      // PROCESSED: Management Pages
      case "Users":
      case "จัดการผู้ใช้":
        return (
          <UserManagementPage
            users={companyUsers}
            openModal={openModal}
            onToggleStatus={handleToggleUserStatus}
            currentUser={currentUser}
            allCompanies={companies}
          />
        );

      case "Products":
      case "จัดการสินค้า":
        return (
          <ProductManagementPage
            products={companyProducts}
            openModal={openModal}
            currentUser={currentUser}
            allCompanies={companies}
          />
        );

      case "Teams":
      case "Team":
      case "สต็อก": // Legacy mapping for Supervisor
        // If it's Supervisor clicking "Stock", show Team Page
        if (activePage === "สต็อก" && currentUser.role === UserRole.Supervisor) {
          return (
            <SupervisorTeamPage
              user={currentUser}
              allUsers={users}
              allCustomers={companyCustomers}
              allOrders={companyOrders}
            />
          );
        }
        // Else default to Telesale Dashboard? Or just SupervisorPage? 
        // Let's assume standard "Teams" page for now if exists, or SupervisorPage logic
        return (
          <SupervisorTeamPage
            user={currentUser}
            allUsers={users}
            allCustomers={companyCustomers}
            allOrders={companyOrders}
          />
        );


      // PROCESSED: Inventory
      case "Warehouses":
      case "คลังสินค้า":
        return (
          <WarehouseManagementPage
            companies={companies}
            currentUser={currentUser}
            onWarehouseChange={setWarehouses}
          />
        );
      case "Warehouse Stock":
      case "สต็อกคลัง":
        return <WarehouseStockViewPage currentUser={currentUser} />;
      case "รับเข้า/ปรับปรุง":
      case "Stock Documents (รับเข้า/ปรับปรุง)":
        return <StockDocumentsPage currentUser={currentUser} />;
      case "Lot Tracking":
      case "ติดตามล๊อต":
        return <LotTrackingPage currentUser={currentUser} />;

      case "ส่งออกรายงานสต๊อค":
      case "inventory.reports":
        return (
          <InventoryReportsPage
            currentUser={currentUser}
            companyId={currentUser.companyId!}
          />
        );

      // PROCESSED: Finance
      case "nav.finance_approval":
      case "payment_slip.manage":
      case "Finance Approval":
      case "ตรวจสอบยอดเงิน":
        return (
          <FinanceApprovalPage
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            users={companyUsers}
            openModal={openModal}
          />
        );

      case "nav.statement_management":
      case "statement.management":
      case "Accounting Report":
      case "accounting.report":
        return <AccountingReportPage />;

      case "All Orders (Sent/Billed)":
      case "accounting.audit.all_orders_sent":
        return <AllOrdersSentPage />;

      case "Statement Management":
      case "จัดการ Statement":
        return (
          <StatementManagementPage
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            users={companyUsers}
          />
        );

      case "finance-commission":
      case "Calculate Commission":
      case "คำนวณค่าคอมมิชชัน":
        return <CommissionPage currentUser={currentUser} />;
        return (
          <StatementManagementPage
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            users={companyUsers}
          />
        );

      // PROCESSED: Accounting Audit
      case "Bank Account Audit":
      case "ตรวจสอบบัญชีธนาคาร":
      case "accounting.audit.bank":
        return <BankAccountAuditPage currentUser={currentUser} />;

      case "Revenue Recognition":
      case "รับรู้รายได้":
      case "revenue_recognition":
        return <RevenueRecognitionPage />;

      case "Slip Upload":
      case "Upload":
      case "อัปโหลดสลิป":
        return <SlipUpload />;

      // PROCESSED: Promotions
      case "Active Promotions":
      case "โปรโมชั่นที่กำลังใช้งาน":
      case "Promo Active":
      case "promo.active":
        return <PromotionsPage key="active" view="active" />;
      case "Promotion History":
      case "ประวัติโปรโมชั่น":
      case "Promo History":
      case "promo.history":
        return <PromotionsPage key="history" view="history" />;
      case "Create Promotion":
      case "สร้างโปรโมชั่นใหม่":
      case "Promo Create":
      case "promo.create":
        return <PromotionsPage key="create" view="create" />;

      case "All Slips":
      case SLIP_ALL_LABEL:
      case "สลิปทั้งหมด":
        return <SlipAll />;

      case "COD Management":
      case "COD Record":
      case "จัดการยอด COD":
        return (
          <CODManagementPage
            user={currentUser}
            // orders={companyOrders} // Removed dependency
            customers={companyCustomers}
            users={companyUsers}
          />
        );

      case "Google Sheet Import":
      case "นำเข้าจาก Google Sheet":
        return (
          <GoogleSheetImportPage
            apiBaseUrl={resolveApiBasePath()}
            authToken={sessionUser?.token || localStorage.getItem('authToken') || ''}
          />
        );
      case "Debt":
      case "ติดตามหนี้":
      case "โปรโมชั่น": // Fix legacy mapping where 'โปรโมชั่น' pointed to DebtCollectionPage in Backoffice
        return (
          <DebtCollectionPage
            user={currentUser}
            orders={companyOrders}
            customers={companyCustomers}
            users={companyUsers}
            openModal={openModal}
          />
        );


      // PROCESSED: Reports / Import Export
      case "Reports":
      case "รายงาน":
      case "ยกเลิกออเดอร์": // Legacy mapping?
        return (
          <ReportsPage
            orders={companyOrders}
            customers={companyCustomers}
            products={products}
            warehouseStock={warehouseStocks}
            stockMovements={stockMovements}
            productLots={productLots}
          />
        );
      case "Export History":
      case "ประวัติการส่งออก":
        return <ExportHistoryPage />;
      case "Import Export":
      case "Import":
      case "นำเข้า/ส่งออก":
        return (
          <ImportExportPage
            allUsers={companyUsers}
            allCustomers={companyCustomers}
            allOrders={companyOrders}
            onImportSales={handleImportSales}
            onImportCustomers={handleImportCustomers}
          />
        );
      case "Bulk Tracking":
      case "เพิ่ม Tracking":
        return (
          <BulkTrackingPage
            currentUser={currentUser}
            onBulkUpdateTracking={handleBulkUpdateTracking}
          />
        );

      // PROCESSED: System / Roles
      case "Role Management":
      case "จัดการ Roles":
        return (
          <RoleManagementPage
            onClose={() => setActivePage("Dashboard")}
          />
        );
      case "Marketing Dashboard":
      case "แดชบอร์ด (มาร์เก็ตติ้ง)":
        return <MarketingPage currentUser={currentUser} view="dashboard" />;
      case "Ads Input":
      case "กรอกค่า Ads":
        return <MarketingPage currentUser={currentUser} view="adsInput" />;
      case "Ads History":
      case "ประวัติการกรอก Ads":
        return <MarketingPage currentUser={currentUser} view="adsHistory" />;
      case "Marketing User Management":
      case "จัดการผู้ใช้การตลาด-เพจ":
        return <MarketingPage currentUser={currentUser} view="userManagement" />;
      case "Companies":
      case "บริษัท":
        return <CompanyManagementPage />; // Assuming existence or similar
      case "Tags":
      case "แท็ก":
        return <DataManagementPage />; // Or dedicated Tag page? Revert to DataManagementPage if no dedicated
      case "Pages":
      case "หน้า":
      case "Platforms":
      case "แพลตฟอร์ม":
      case "Bank Accounts":
      case "จัดการธนาคาร":
        return <DataManagementPage />; // Consolidated Data Mgmt

      case "UpsellOrder":
        return null;

      default:
        // Fallback or 404
        return (
          <div className="flex h-full items-center justify-center text-gray-400">
            <div className="text-center">
              <p className="text-xl font-semibold">Page Not Found</p>
              <p className="text-sm">Cannot find page: {activePage}</p>
            </div>
          </div>
        );
    }
  };

  const renderModal = () => {
    if (!modalState.type) return null;

    switch (modalState.type) {
      case "manageOrder":
        return (
          <OrderManagementModal
            order={modalState.data as Order}
            customers={customers}
            activities={activities.filter(
              (a) => a.customerId === (modalState.data as Order).customerId,
            )}
            onSave={handleUpdateOrder}
            onClose={closeModal}
            currentUser={currentUser}
            users={users}
            onEditCustomer={(customer) => openModal("editCustomer", customer)}
            products={products}
          />
        );
      case "createOrder":
        // Instead of opening as modal, navigate to the page
        setActivePage("CreateOrder");
        setCreateOrderInitialData(modalState.data);
        closeModal();
        return null;
      case "logCall":
        return (
          <LogCallModal
            customer={modalState.data as Customer}
            user={currentUser}
            systemTags={systemTags}
            onSave={handleLogCall}
            onCreateUserTag={handleCreateUserTag}
            onClose={closeModal}
          />
        );
      case "addAppointment":
        return (
          <AppointmentModal
            customer={modalState.data as Customer}
            onSave={handleAddAppointment}
            onClose={closeModal}
          />
        );
      case "addUser":
      case "editUser":
        return (
          <UserManagementModal
            user={modalState.data as User | undefined}
            onSave={handleSaveUser}
            onClose={closeModal}
            currentUser={currentUser}
            allUsers={users}
            allCompanies={companies}
          />
        );
      case "addProduct":
      case "editProduct":
        return (
          <ProductManagementModal
            product={modalState.data as Product | undefined}
            onSave={handleSaveProduct}
            onClose={closeModal}
            companyId={currentUser.companyId}
            warehouses={warehouses}
            products={companyProducts}
          />
        );
      case "editCustomer":
        return (
          <EditCustomerModal
            customer={modalState.data as Customer}
            onSave={handleUpdateCustomer}
            onClose={closeModal}
          />
        );
      case "confirmDelete":
        return (
          <ConfirmDeleteModal
            itemName={modalState.data.name}
            onConfirm={() =>
              modalState.data.type === "user"
                ? handleDeleteUser(modalState.data.id)
                : handleDeleteProduct(modalState.data.id)
            }
            onClose={closeModal}
          />
        );
      case "manageTags":
        const currentCustomerState = customers.find(
          (c) => c.id === (modalState.data as Customer).id,
        );
        if (!currentCustomerState) return null;

        return (
          <TagManagementModal
            customer={currentCustomerState}
            user={currentUser}
            systemTags={systemTags}
            onAddTag={handleAddTagToCustomer}
            onRemoveTag={handleRemoveTagFromCustomer}
            onCreateUserTag={handleCreateUserTag}
            onUpdateUserTag={handleUpdateUserTag}
            onDeleteUserTag={handleDeleteUserTag}
            onClose={closeModal}
          />
        );
      case "viewAllActivities": {
        const modalData = modalState.data as
          | { customer: Customer; logs?: CustomerLog[] }
          | Customer;
        const customer =
          (modalData as { customer?: Customer }).customer ??
          (modalData as Customer);
        const logs = (modalData as { logs?: CustomerLog[] }).logs ?? undefined;
        return (
          <ActivityLogModal
            customer={customer}
            initialLogs={logs}
            allUsers={companyUsers}
            onClose={closeModal}
          />
        );
      }
      default:
        return null;
    }
  };

  const renderAttendanceWidget = () => {
    if (!currentUser?.id) return null;
    if (!hasCheckedIn) {
      return (
        <div className="flex flex-col items-center space-y-1">
          {attendanceError && !attendanceLoading && (
            <span className="text-xs text-red-500">{attendanceError}</span>
          )}
          <button
            type="button"
            onClick={handleCheckIn}
            className="px-6 py-2 rounded-full bg-green-600 text-white font-semibold shadow hover:bg-green-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={attendanceLoading}
          >
            {attendanceLoading ? "กำลังเข้างาน..." : "เข้างาน"}
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center space-y-1">
        <div className="flex items-center space-x-5 rounded-full border border-green-200 bg-white px-4 py-2 shadow-sm">
          <Clock className="w-5 h-5 text-green-600" />
          <div className="flex items-center space-x-4">
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] text-gray-500">เข้าสู่ระบบ</span>
              <span className="text-sm font-semibold text-gray-800">
                {formatTimeText(attendanceStartIso)}
              </span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] text-gray-500">ออกจากระบบ</span>
              <span className="text-sm font-semibold text-gray-800">
                {formatDurationText(attendanceDuration)}
              </span>
            </div>
          </div>
          {computedAttendanceValue >= 1 && (
            <div className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100">
              <Check className="w-4 h-4 text-green-600" />
            </div>
          )}
        </div>
        {attendanceError && !attendanceLoading && (
          <span className="text-xs text-red-500">{attendanceError}</span>
        )}
      </div>
    );
  };

  // Show loading/error message if currentUser is not available
  if (!currentUser) {
    return (
      <div className="flex h-screen bg-[#F5F5F5] items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-700 mb-2">กำลังโหลดข้อมูลผู้ใช้...</p>
          <p className="text-sm text-gray-500">กรุณารอสักครู่</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#F5F5F5] relative">
      {showCheckInPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">เริ่มงานวันนี้ไหม?</h3>
            <p className="text-sm text-gray-600 mb-4">ต้องการบันทึกเข้างานตอนนี้เลยหรือไม่</p>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded-md border text-sm"
                onClick={handleCheckInPromptSkip}
              >
                ไม่ใช่ตอนนี้
              </button>
              <button
                className="px-4 py-2 rounded-md bg-green-600 text-white text-sm"
                onClick={handleCheckInPromptConfirm}
                disabled={attendanceLoading}
              >
                {attendanceLoading ? "กำลังบันทึก..." : "บันทึกเข้างาน"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Fixed Sidebar */}
      {!viewingCustomer && !hideSidebar && (
        <div className="fixed left-0 top-0 h-screen z-10">
          <Sidebar
            user={currentUser}
            activePage={activePage}
            setActivePage={setActivePage}
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
            onLogout={handleLogout}
            permissions={{
              ...(rolePermissions || {}),
              onChangePassword: () => setIsChangePasswordModalOpen(true),
            }}
            menuOrder={menuOrder}
          />
        </div>
      )}
      {/* Main Content with proper margin */}
      <div
        className={`h-screen flex flex-col transition-all duration-300 ${hideSidebar || viewingCustomer
          ? ""
          : isSidebarCollapsed
            ? "ml-20"
            : "ml-64"
          }`}
      >
        {!viewingCustomer && !hideSidebar && (
          <header className="flex items-center px-6 h-16 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center space-x-4 flex-shrink-0">
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="text-gray-600 lg:hidden"
              >
                <Menu size={24} />
              </button>
              <h1 className="text-xl font-semibold text-gray-800">
                {activePage}
              </h1>
            </div>
            <div className="flex-1 flex justify-center px-2">
              {renderAttendanceWidget()}
            </div>
            <div className="flex items-center space-x-4 flex-shrink-0">
              <div className="relative hidden">
                <select
                  value={currentUserRole}
                  onChange={(e) => {
                    setCurrentUserRole(e.target.value as UserRole);
                    setActivePage("Dashboard");
                    handleCloseCustomerDetail();
                  }}
                  className="appearance-none cursor-pointer bg-gray-100 border border-gray-200 text-gray-700 text-sm rounded-md focus:ring-green-500 focus:border-green-500 block w-full py-2 pl-3 pr-8"
                >
                  <option value={UserRole.SuperAdmin}>Super Admin</option>
                  <option value={UserRole.AdminControl}>Admin Control</option>
                  <option value={UserRole.Admin}>Admin Page</option>
                  <option value={UserRole.Telesale}>Telesale</option>
                  <option value={UserRole.Supervisor}>
                    Supervisor Telesale
                  </option>
                  <option value={UserRole.Backoffice}>Backoffice</option>
                  <option value={UserRole.Marketing}>Marketing</option>
                </select>
                <ChevronsUpDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </header>
        )}
        <main className="flex-1 overflow-x-auto overflow-y-auto bg-[#F5F5F5] relative">
          <div className="max-w-full min-h-full">
            {renderPage()}
          </div>
        </main>
      </div>

      {renderModal()}

      {/* CustomerDetailPage Overlay - renders ON TOP of current page without unmounting it */}
      {viewingCustomer && (
        <div className="fixed inset-0 z-50 bg-white overflow-auto">
          <CustomerDetailPage
            activities={activities}
            customer={viewingCustomer}
            orders={companyOrders.filter(
              (o) => {
                return String(o.customerId) === String(viewingCustomer.id) ||
                  String(o.customerId) === String(viewingCustomer.pk);
              },
            )}
            callHistory={callHistory.filter(
              (c) => {
                return String(c.customerId) === String(viewingCustomer.id) ||
                  String(c.customerId) === String(viewingCustomer.pk);
              },
            )}
            appointments={appointments.filter(
              (a) => {
                return String(a.customerId) === String(viewingCustomer.id) ||
                  String(a.customerId) === String(viewingCustomer.pk);
              },
            )}
            onClose={handleCloseCustomerDetail}
            openModal={openModal}
            user={currentUser}
            allUsers={companyUsers}
            systemTags={systemTags}
            ownerName={(function () {
              const u = companyUsers.find(
                (x) => x.id === (viewingCustomer as any).assignedTo,
              );
              return u ? `${u.firstName} ${u.lastName}` : undefined;
            })()}
            onAddTag={handleAddTagToCustomer}
            onRemoveTag={handleRemoveTagFromCustomer}
            onCreateUserTag={handleCreateUserTag}
            onCompleteAppointment={handleCompleteAppointment}
            onChangeOwner={handleChangeCustomerOwner}
            customerCounts={userCustomerCounts}
            onStartCreateOrder={(customer) => {
              setPreviousPage(activePage);
              setCreateOrderInitialData({ customer });
              handleCloseCustomerDetail();
              setActivePage("CreateOrder");
            }}
            onUpsellClick={(customer) => {
              setPreviousPage(activePage);
              setCreateOrderInitialData({ customer, upsell: true });
              handleCloseCustomerDetail();
              setActivePage("CreateOrder");
            }}
          />
        </div>
      )}

      {/* Change Password Modal */}
      {
        isChangePasswordModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black bg-opacity-50"
              onClick={() => setIsChangePasswordModalOpen(false)}
            />
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">
                  เปลี่ยนรหัสผ่าน
                </h3>
                <button
                  onClick={() => setIsChangePasswordModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleChangePassword();
                  }}
                >
                  {passwordError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                      {passwordError}
                    </div>
                  )}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        รหัสผ่านปัจจุบัน
                      </label>
                      <input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            currentPassword: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        รหัสผ่านใหม่
                      </label>
                      <input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            newPassword: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        ยืนยันรหัสผ่านใหม่
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) =>
                          setPasswordForm((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangePasswordModalOpen(false);
                        setPasswordError("");
                        setPasswordForm({
                          currentPassword: "",
                          newPassword: "",
                          confirmPassword: "",
                        });
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                      disabled={isChangingPassword}
                    >
                      ยกเลิก
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={isChangingPassword}
                    >
                      {isChangingPassword
                        ? "กำลังเปลี่ยนรหัสผ่าน..."
                        : "เปลี่ยนรหัสผ่าน"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default App;
