import React, { useState, useMemo, useEffect } from "react";
import {
  UserRole,
  User,
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
  Notification,
  NotificationType,
  PaymentMethod,
  CustomerLifecycleStatus,
  CustomerBehavioralStatus,
  CustomerGrade,
  Tag,
  TagType,
  Activity,
  ActivityType,
  Company,
  Warehouse,
  LineItem,
  SalesImportRow,
  CustomerImportRow,
  ImportResultSummary,
} from "./types";
// Mock data removed - using real database only
import {
  listUsers,
  listCustomers,
  listOrders,
  listProducts,
  listPromotions,
  listPages,
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
  apiFetch,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
  getRolePermissions,
} from "./services/api";
import {
  recordFollowUp,
  getCustomerOwnershipStatus,
  recordSale,
} from "@/ownershipApi";
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
import ProductManagementModal from "./components/ProductManagementModal";
import ConfirmDeleteModal from "./components/ConfirmDeleteModal";
import {
  Bell,
  ChevronsUpDown,
  Menu,
  AlertCircle,
  Clock,
  Check,
} from "lucide-react";
import LogCallModal from "./components/LogCallModal";
import AppointmentModal from "./components/AppointmentModal";
import EditCustomerModal from "./components/EditCustomerModal";
import NotificationPanel from "./components/NotificationPanel";
import BulkTrackingPage from "./pages/BulkTrackingPage";
import ExportHistoryPage from "./pages/ExportHistoryPage";
import AddCustomerPage from "./pages/AddCustomerPage";
import TagManagementModal from "./components/TagManagementModal";
import ActivityLogModal from "./components/ActivityLogModal";
import DataManagementPage from "./pages/DataManagementPage";
import ImportExportPage from "./pages/ImportExportPage";
import CompanyManagementPage from "./pages/CompanyManagementPage";
import WarehouseManagementPage from "./pages/WarehouseManagementPage";
import CreateOrderPage from "./pages/CreateOrderPage";
import MarketingPage from "./pages/MarketingPage";
import SalesDashboard from "./pages/SalesDashboard";
import CallsDashboard from "./pages/CallsDashboard";
import PermissionsPage from "./pages/PermissionsPage";
import PageStatsPage from "./pages/PageStatsPage";
import EngagementStatsPage from "./pages/EngagementStatsPage";
import TeamsManagementPage from "./pages/TeamsManagementPage";
import PagesManagementPage from "./pages/PagesManagementPage";
import TagsManagementPage from "./pages/TagsManagementPage";
import CallHistoryPage from "./pages/CallHistoryPage";
import CallDetailsPage from "./pages/CallDetailsPage";
import ReceiveStockPage from "./pages/ReceiveStockPage";
import WarehouseStockViewPage from "./pages/WarehouseStockViewPage";
import LotTrackingPage from "./pages/LotTrackingPage";
import ManageCustomersPage from "./pages/ManageCustomersPage";
import CustomerPoolsPage from "./pages/CustomerPoolsPage";
import PromotionsPage from "./pages/PromotionsPage";
import OrderAllocationPage from "./pages/OrderAllocationPage";
import NotificationSettingsPage from "./pages/NotificationSettingsPage";
import notificationService from "./services/notificationService";

const App: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(
    UserRole.Telesale,
  );

  // Check URL parameter for initial page and sidebar visibility
  const getInitialPage = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const page = urlParams.get("page");
    if (page === "search") return "Search";
    return "Dashboard";
  };

  const shouldHideSidebar = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("nosidebar") === "true";
  };

  const [activePage, setActivePage] = useState<string>(getInitialPage());
  const [hideSidebar, setHideSidebar] = useState<boolean>(shouldHideSidebar());
  const [modalState, setModalState] = useState<ModalState>({
    type: null,
    data: null,
  });
  const [createOrderInitialData, setCreateOrderInitialData] = useState<
    any | null
  >(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
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
      district: "คลองเตย",
      subdistrict: "คลองเตยเหนือ",
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
      address: "456 ถนนนิมมานเหมินทร์",
      province: "เชียงใหม่",
      district: "เมืองเชียงใหม่",
      subdistrict: "สุเทพ",
      postalCode: "50200",
      phone: "053-123-456",
      email: "chiangmai@alphaseeds.com",
      managerName: "มานี รักษาดี",
      managerPhone: "082-345-6789",
      responsibleProvinces: ["เชียงใหม่", "ลำปาง", "ลำพูน", "แพร่", "น่าน"],
      isActive: true,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  ]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(
    null,
  );
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<Record<
    string,
    { view?: boolean; use?: boolean }
  > | null>(null);

  // Session user from LoginPage
  const [sessionUser, setSessionUser] = useState<any | null>(() => {
    try {
      return JSON.parse(localStorage.getItem("sessionUser") || "null");
    } catch {
      return null;
    }
  });

  // Always use real database - no mock data
  // API/UI enum mappings (global)
  const fromApiOrderStatus = (s: any): OrderStatus => {
    switch (String(s)) {
      case "Pending":
        return OrderStatus.Pending as any;
      case "Picking":
        return OrderStatus.Picking as any;
      case "Shipping":
        return OrderStatus.Shipping as any;
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
      case OrderStatus.Picking:
        return "Picking";
      case OrderStatus.Shipping:
        return "Shipping";
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
      case PaymentStatus.Paid:
        return "Paid";
      default:
        return "Unpaid";
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [
          u,
          c,
          o,
          p,
          promo,
          pg,
          ch,
          ap,
          ctags,
          act,
          tags,
          comps,
          perms,
          whs,
        ] = await Promise.all([
          listUsers(),
          listCustomers(),
          listOrders(),
          listProducts(),
          listPromotions(),
          listPages(),
          listCallHistory(),
          listAppointments(),
          listCustomerTags(),
          listActivities(),
          listTags(),
          apiFetch("companies"),
          getRolePermissions((sessionUser?.role ?? users[0]?.role) as any),
          apiFetch("warehouses"),
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

        // Helpers: map API enums <-> UI enums
        const fromApiOrderStatus = (s: any): OrderStatus => {
          switch (String(s)) {
            case "Pending":
              return OrderStatus.Pending as any;
            case "Picking":
              return OrderStatus.Picking as any;
            case "Shipping":
              return OrderStatus.Shipping as any;
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
            case OrderStatus.Picking:
              return "Picking";
            case OrderStatus.Shipping:
              return "Shipping";
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
          teamId: r.team_id ?? undefined,
          supervisorId: r.supervisor_id ?? undefined,
          status: r.status,
          customTags: [],
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
            };
            const cid = String(row.customer_id);
            (tagsByCustomer[cid] = tagsByCustomer[cid] || []).push(t);
          }
        }

        const mapCustomer = (r: any): Customer => ({
          id: r.id,
          firstName: r.first_name,
          lastName: r.last_name,
          phone: r.phone,
          email: r.email ?? undefined,
          address: {
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
          grade: (r.grade ?? "C") as CustomerGrade,
          tags: tagsByCustomer[r.id] || [],
          assignmentHistory: [],
          totalPurchases: Number(r.total_purchases || 0),
          totalCalls: Number(r.total_calls || 0),
          facebookName: r.facebook_name ?? undefined,
          lineId: r.line_id ?? undefined,
          isInWaitingBasket: Boolean(r.is_in_waiting_basket ?? false),
          waitingBasketStartDate: r.waiting_basket_start_date ?? undefined,
          isBlocked: Boolean(r.is_blocked ?? false),
        });

        const mapOrder = (r: any): Order => ({
          id: r.id,
          customerId: r.customer_id,
          companyId: r.company_id,
          creatorId: r.creator_id,
          orderDate: r.order_date,
          deliveryDate: r.delivery_date ?? "",
          shippingAddress: {
            street: r.street || "",
            subdistrict: r.subdistrict || "",
            district: r.district || "",
            province: r.province || "",
            postalCode: r.postal_code || "",
          },
          items: [],
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
        });

        const mapProduct = (r: any): Product => ({
          id: r.id,
          sku: r.sku,
          name: r.name,
          description: r.description ?? undefined,
          category: r.category,
          unit: r.unit,
          cost: Number(r.cost || 0),
          price: Number(r.price || 0),
          stock: Number(r.stock || 0),
          companyId: r.company_id,
        });

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
        setOrders(Array.isArray(o) ? o.map(mapOrder) : []);
        setProducts(Array.isArray(p) ? p.map(mapProduct) : []);
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
        setPromotions(Array.isArray(promo) ? promo.map(mapPromotion) : []);
        setCallHistory(Array.isArray(ch) ? ch.map(mapCall) : []);
        setAppointments(Array.isArray(ap) ? ap.map(mapAppt) : []);

        // Set system tags and companies from API
        setSystemTags(
          Array.isArray(tags)
            ? tags.map((t) => ({
                id: t.id,
                name: t.name,
                type: t.type === "SYSTEM" ? TagType.System : TagType.User,
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

  const currentUser = useMemo(() => {
    if (sessionUser) {
      const byId = users.find((u) => u.id === sessionUser.id);
      if (byId) return byId;
      // Map session to UI type as fallback
      return {
        id: sessionUser.id,
        username: sessionUser.username,
        firstName: sessionUser.first_name,
        lastName: sessionUser.last_name,
        email: sessionUser.email,
        phone: sessionUser.phone,
        role: sessionUser.role,
        companyId: sessionUser.company_id,
        teamId: sessionUser.team_id,
        supervisorId: sessionUser.supervisor_id,
        customTags: [],
      } as User;
    }
    return users[0];
  }, [sessionUser, users]);

  useEffect(() => {
    const userId = currentUser?.id;
    const userRole = currentUser?.role as UserRole | undefined;

    if (typeof userId !== "number" || !userRole) {
      return;
    }

    let isMounted = true;

    const fetchNotifications = async () => {
      try {
        const userNotifications = await notificationService.fetchNotifications(
          userId,
          userRole,
          50,
        );
        if (isMounted) {
          setNotifications(userNotifications);
        }
      } catch (error) {
        console.error("Error loading notifications:", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentUser?.id, currentUser?.role]);

  const viewingCustomer = useMemo(() => {
    if (!viewingCustomerId) return null;
    return customers.find((c) => c.id === viewingCustomerId);
  }, [viewingCustomerId, customers]);

  const isSuperAdmin = useMemo(
    () => currentUser.role === UserRole.SuperAdmin,
    [currentUser],
  );

  // Load role permissions (from localStorage first for instant UI, then API)
  useEffect(() => {
    const role = currentUser.role as string;
    const key = `role_permissions:${role}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        setRolePermissions(JSON.parse(cached));
      } else if (role === UserRole.Backoffice) {
        setRolePermissions({
          "home.sales_overview": { view: false },
          "home.calls_overview": { view: false },
        });
      } else {
        setRolePermissions({});
      }
    } catch {
      setRolePermissions({});
    }

    getRolePermissions(role)
      .then((res) => {
        const data = (res && (res as any).data) || null;
        if (data) {
          setRolePermissions(data);
          try {
            localStorage.setItem(key, JSON.stringify(data));
          } catch {}
        }
      })
      .catch(() => {});

    const onUpdated = (e: any) => {
      if (!e?.detail || e.detail.role !== role) return;
      try {
        const cached2 = localStorage.getItem(key);
        if (cached2) setRolePermissions(JSON.parse(cached2));
      } catch {}
    };
    window.addEventListener("role-permissions-updated", onUpdated as any);
    return () =>
      window.removeEventListener("role-permissions-updated", onUpdated as any);
  }, [currentUser.role]);

  const companyCustomers = useMemo(
    () =>
      isSuperAdmin
        ? customers
        : customers.filter((c) => c.companyId === currentUser.companyId),
    [customers, currentUser.companyId, isSuperAdmin],
  );
  const companyOrders = useMemo(
    () =>
      isSuperAdmin
        ? orders
        : orders.filter((o) => o.companyId === currentUser.companyId),
    [orders, currentUser.companyId, isSuperAdmin],
  );
  const companyUsers = useMemo(
    () =>
      isSuperAdmin
        ? users
        : users.filter((u) => u.companyId === currentUser.companyId),
    [users, currentUser.companyId, isSuperAdmin],
  );
  const companyProducts = useMemo(
    () =>
      isSuperAdmin
        ? products
        : products.filter((p) => p.companyId === currentUser.companyId),
    [products, currentUser.companyId, isSuperAdmin],
  );

  const visibleNotifications = useMemo(() => {
    return notifications.filter((n) => {
      const roleMatch =
        Array.isArray(n.forRoles) && n.forRoles.includes(currentUser.role);
      const userMatch =
        typeof (n as any).userId === "number" &&
        (n as any).userId === currentUser.id;
      return roleMatch || userMatch;
    });
  }, [notifications, currentUser.role, currentUser.id]);

  const unreadNotificationCount = useMemo(() => {
    return visibleNotifications.filter((n) => !n.read).length;
  }, [visibleNotifications]);

  const handleToggleNotificationPanel = () => {
    setIsNotificationPanelOpen((prev) => !prev);
  };

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));

    try {
      await notificationService.markAsRead(notificationId, currentUser.id);
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) =>
      prev.filter((n) => {
        const matchesRole =
          Array.isArray(n.forRoles) && n.forRoles.includes(currentUser.role);
        const matchesUser =
          typeof (n as any).userId === "number" &&
          (n as any).userId === currentUser.id;
        return !(matchesRole || matchesUser);
      }),
    );

    try {
      await notificationService.markAllAsRead(currentUser.id, currentUser.role);
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  const handleLogout = () => {
    // Clear session data
    localStorage.removeItem("sessionUser");
    setSessionUser(null);

    // Redirect to login page
    const url = new URL(window.location.href);
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
      // รีเฟรชข้อมูลสินค้า
      fetchProducts();
    }
  };

  // Function to fetch products
  const fetchProducts = async () => {
    try {
      const productsData = await listProducts();
      setProducts(productsData);
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  };

  const closeModal = () => setModalState({ type: null, data: null });

  const handleViewCustomer = (customer: Customer) =>
    setViewingCustomerId(customer.id);
  const handleCloseCustomerDetail = () => setViewingCustomerId(null);

  // Clear any transient create-order initial data when leaving the page
  useEffect(() => {
    if (activePage !== "CreateOrder") setCreateOrderInitialData(null);
  }, [activePage]);

  const handleUpdateOrder = async (updatedOrder: Order) => {
    const originalOrder = orders.find((o) => o.id === updatedOrder.id);
    if (!originalOrder) return;

    const activitiesToAdd: Activity[] = [];

    if (originalOrder.orderStatus !== updatedOrder.orderStatus) {
      activitiesToAdd.push({
        id: Date.now() + Math.random(),
        customerId: updatedOrder.customerId,
        timestamp: new Date().toISOString(),
        type: ActivityType.OrderStatusChanged,
        description: `อัปเดตสถานะคำสั่งซื้อ ${updatedOrder.id} จาก '${originalOrder.orderStatus}' เป็น '${updatedOrder.orderStatus}'`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      });
    }

    if (
      originalOrder.paymentStatus !== updatedOrder.paymentStatus &&
      updatedOrder.paymentStatus === PaymentStatus.Paid
    ) {
      activitiesToAdd.push({
        id: Date.now() + Math.random(),
        customerId: updatedOrder.customerId,
        timestamp: new Date().toISOString(),
        type: ActivityType.PaymentVerified,
        description: `ยืนยันการชำระเงินสำเร็จสำหรับคำสั่งซื้อ ${updatedOrder.id}`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      });
    }

    const originalTracking = new Set(originalOrder.trackingNumbers);
    const newTracking = updatedOrder.trackingNumbers.filter(
      (t) => t && !originalTracking.has(t),
    );
    if (newTracking.length > 0) {
      activitiesToAdd.push({
        id: Date.now() + Math.random(),
        customerId: updatedOrder.customerId,
        timestamp: new Date().toISOString(),
        type: ActivityType.TrackingAdded,
        description: `เพิ่ม Tracking [${newTracking.join(", ")}] สำหรับคำสั่งซื้อ ${updatedOrder.id}`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`,
      });
    }

    if (activitiesToAdd.length > 0) {
      setActivities((prev) => [...activitiesToAdd, ...prev]);
    }
    if (true) {
      try {
        const payload: any = {
          paymentStatus: (updatedOrder.paymentStatus as any) ?? undefined,
          amountPaid: (updatedOrder as any).amountPaid ?? null,
          codAmount: (updatedOrder as any).codAmount ?? null,
          notes: updatedOrder.notes ?? null,
        };
        if (typeof (updatedOrder as any).slipUrl !== "undefined")
          payload.slipUrl = (updatedOrder as any).slipUrl;
        if (updatedOrder.orderStatus)
          payload.orderStatus = updatedOrder.orderStatus as any;
        if (updatedOrder.trackingNumbers && updatedOrder.trackingNumbers.length)
          payload.trackingNumbers = updatedOrder.trackingNumbers;
        await apiPatchOrder(updatedOrder.id, {
          ...payload,
          orderStatus: payload.orderStatus
            ? toApiOrderStatus(updatedOrder.orderStatus as any)
            : undefined,
          paymentStatus: payload.paymentStatus
            ? toApiPaymentStatus(updatedOrder.paymentStatus as any)
            : undefined,
        });

        // If order is fully completed (Paid + Delivered), grant sale quota (+90 cap)
        if (
          updatedOrder.paymentStatus === PaymentStatus.Paid &&
          updatedOrder.orderStatus === OrderStatus.Delivered
        ) {
          try {
            await recordSale(updatedOrder.customerId);
            const updated = await getCustomerOwnershipStatus(
              updatedOrder.customerId,
            );
            if (updated && updated.ownership_expires) {
              setCustomers((prev) =>
                prev.map((c) =>
                  c.id === updatedOrder.customerId
                    ? { ...c, ownershipExpires: updated.ownership_expires }
                    : c,
                ),
              );
            }
          } catch (e) {
            console.error("record sale / refresh ownership failed", e);
          }
        }
      } catch (e) {
        console.error("PATCH order failed", e);
      }
    }

    setOrders((prevOrders) =>
      prevOrders.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)),
    );
    closeModal();
  };

  const handleCancelOrder = async (orderId: string) => {
    if (window.confirm("คุณต้องการยกเลิกคำสั่งซื้อนี้ใช่หรือไม่?")) {
      const orderToCancel = orders.find((o) => o.id === orderId);
      if (orderToCancel && orderToCancel.orderStatus === OrderStatus.Pending) {
        const newActivity: Activity = {
          id: Date.now() + Math.random(),
          customerId: orderToCancel.customerId,
          timestamp: new Date().toISOString(),
          type: ActivityType.OrderCancelled,
          description: `ยกเลิกคำสั่งซื้อ ${orderId}`,
          actorName: `${currentUser.firstName} ${currentUser.lastName}`,
        };
        if (true) {
          try {
            await createActivity({
              customerId: newActivity.customerId,
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
        if (true) {
          try {
            await apiPatchOrder(orderId, { orderStatus: "Cancelled" });
          } catch (e) {
            console.error("cancel API", e);
          }
        }
        setOrders((prevOrders) =>
          prevOrders.map((o) =>
            o.id === orderId ? { ...o, orderStatus: OrderStatus.Cancelled } : o,
          ),
        );
      }
    }
  };

  const handleProcessOrders = async (orderIds: string[]) => {
    const activitiesToAdd: Activity[] = [];
    setOrders((prevOrders) => {
      const updated = prevOrders.map((o) => {
        if (orderIds.includes(o.id) && o.orderStatus === OrderStatus.Pending) {
          activitiesToAdd.push({
            id: Date.now() + Math.random(),
            customerId: o.customerId,
            timestamp: new Date().toISOString(),
            type: ActivityType.OrderStatusChanged,
            description: `อัปเดตสถานะคำสั่งซื้อ ${o.id} จาก '${OrderStatus.Pending}' เป็น '${OrderStatus.Picking}'`,
            actorName: `${currentUser.firstName} ${currentUser.lastName}`,
          });
          return { ...o, orderStatus: OrderStatus.Picking };
        }
        return o;
      });
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

  const handleBulkUpdateTracking = async (
    updates: { orderId: string; trackingNumber: string }[],
  ) => {
    const activitiesToAdd: Activity[] = [];
    const patchPromises: Promise<any>[] = [];
    setOrders((prevOrders) => {
      const updatedOrdersMap = new Map(prevOrders.map((o) => [o.id, o]));

      updates.forEach((update) => {
        const orderToUpdate = updatedOrdersMap.get(update.orderId);
        if (orderToUpdate) {
          const existingTrackingNumbers =
            (orderToUpdate as Order).trackingNumbers || [];
          if (!existingTrackingNumbers.includes(update.trackingNumber)) {
            activitiesToAdd.push({
              id: Date.now() + Math.random(),
              customerId: (orderToUpdate as Order).customerId,
              timestamp: new Date().toISOString(),
              type: ActivityType.TrackingAdded,
              description: `เพิ่ม Tracking ${update.trackingNumber} สำหรับคำสั่งซื้อ ${update.orderId}`,
              actorName: `${currentUser.firstName} ${currentUser.lastName}`,
            });

            const newOrderState: Order = {
              ...(orderToUpdate as Order),
              trackingNumbers: [
                ...existingTrackingNumbers,
                update.trackingNumber,
              ],
              orderStatus:
                (orderToUpdate as Order).orderStatus === OrderStatus.Picking
                  ? OrderStatus.Shipping
                  : (orderToUpdate as Order).orderStatus,
            };

            if ((orderToUpdate as Order).orderStatus === OrderStatus.Picking) {
              activitiesToAdd.push({
                id: Date.now() + Math.random(),
                customerId: (orderToUpdate as Order).customerId,
                timestamp: new Date().toISOString(),
                type: ActivityType.OrderStatusChanged,
                description: `อัปเดตสถานะคำสั่งซื้อ ${update.orderId} จาก '${OrderStatus.Picking}' เป็น '${OrderStatus.Shipping}'`,
                actorName: `${currentUser.firstName} ${currentUser.lastName}`,
              });
            }
            updatedOrdersMap.set(update.orderId, newOrderState);
            if (true) {
              const deduped = Array.from(
                new Set(newOrderState.trackingNumbers.filter(Boolean)),
              );
              patchPromises.push(
                apiPatchOrder(update.orderId, { trackingNumbers: deduped }),
              );
            }
          }
        }
      });
      return Array.from(updatedOrdersMap.values());
    });
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
      Pick<Customer, "address" | "facebookName" | "lineId">
    >;
    slipUploads?: string[];
  }): Promise<string | undefined> => {
    const {
      order: newOrderData,
      newCustomer: newCustomerData,
      customerUpdate,
      slipUploads,
    } = payload;
    const slipUploadsArray = Array.isArray(slipUploads)
      ? slipUploads.filter(
          (content) => typeof content === "string" && content.trim() !== "",
        )
      : [];
    let uploadedSlips: OrderSlip[] = [];
    let customerIdForOrder = newOrderData.customerId;

    if (newCustomerData && newCustomerData.phone) {
      const newCustomerId = `CUS-${newCustomerData.phone.substring(1)}`;

      const newCustomer: Customer = {
        ...newCustomerData,
        id: newCustomerId,
        companyId: currentUser.companyId,
        assignedTo:
          currentUser.role === UserRole.Admin ? (null as any) : currentUser.id,
        dateAssigned: new Date().toISOString(),
        totalPurchases: 0,
        totalCalls: 0,
        tags: [],
        assignmentHistory: [],
      };
      try {
        await apiCreateCustomer({
          id: newCustomer.id,
          firstName: newCustomer.firstName,
          lastName: newCustomer.lastName,
          phone: newCustomer.phone,
          email: newCustomer.email,
          province: newCustomer.province,
          companyId: newCustomer.companyId,
          assignedTo:
            currentUser.role === UserRole.Admin ? null : currentUser.id,
          dateAssigned: newCustomer.dateAssigned,
          dateRegistered: new Date().toISOString(),
          followUpDate: null,
          ownershipExpires: new Date(
            Date.now() + 30 * 24 * 3600 * 1000,
          ).toISOString(),
          lifecycleStatus:
            newCustomer.lifecycleStatus ?? CustomerLifecycleStatus.New,
          behavioralStatus:
            newCustomer.behavioralStatus ?? CustomerBehavioralStatus.Cold,
          grade: newCustomer.grade ?? CustomerGrade.D,
          totalPurchases: 0,
          totalCalls: 0,
          facebookName: newCustomer.facebookName ?? null,
          lineId: newCustomer.lineId ?? null,
          address: newCustomer.address ?? {},
        });
        console.log("Customer created successfully:", newCustomer.id);
      } catch (e) {
        console.error("create customer API failed", e);
        alert("ไม่สามารถสร้างลูกค้าได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง");
        return; // Don't proceed with order creation if customer creation fails
      }
      setCustomers((prev) => [newCustomer, ...prev]);
      customerIdForOrder = newCustomerId;
    }

    if (!customerIdForOrder) {
      alert("Customer ID is missing.");
      return;
    }

    const newOrder: Order = {
      id: `ORD-${Date.now()}`,
      orderDate: new Date().toISOString(),
      companyId: currentUser.companyId,
      creatorId: currentUser.id,
      customerId: customerIdForOrder,
      deliveryDate: newOrderData.deliveryDate!,
      shippingAddress: newOrderData.shippingAddress!,
      items: newOrderData.items || [],
      shippingCost: newOrderData.shippingCost || 0,
      billDiscount: newOrderData.billDiscount || 0,
      totalAmount: newOrderData.totalAmount || 0,
      paymentMethod: newOrderData.paymentMethod!,
      paymentStatus: newOrderData.paymentStatus || PaymentStatus.Unpaid,
      orderStatus: newOrderData.orderStatus || OrderStatus.Pending,
      trackingNumbers: newOrderData.trackingNumbers || [],
      slipUrl: undefined,
      slips: [],
      notes: newOrderData.notes,
      boxes: newOrderData.boxes,
      salesChannel: newOrderData.salesChannel,
      salesChannelPageId: newOrderData.salesChannelPageId,
      warehouseId: newOrderData.warehouseId,
    };
    const orderPayload = {
      id: newOrder.id,
      customerId: newOrder.customerId,
      companyId: newOrder.companyId,
      creatorId: newOrder.creatorId,
      orderDate: newOrder.orderDate,
      deliveryDate: newOrder.deliveryDate,
      shippingAddress: newOrder.shippingAddress,
      items: newOrder.items,
      shippingCost: newOrder.shippingCost,
      billDiscount: newOrder.billDiscount,
      totalAmount: newOrder.totalAmount,
      paymentMethod: newOrder.paymentMethod,
      paymentStatus: newOrder.paymentStatus,
      slipUrl: newOrder.slipUrl,
      amountPaid: newOrder.amountPaid,
      codAmount: newOrder.codAmount,
      orderStatus: newOrder.orderStatus,
      trackingNumbers: newOrder.trackingNumbers,
      boxes: newOrder.boxes,
      notes: newOrder.notes,
      salesChannel: newOrderData.salesChannel,
      salesChannelPageId: newOrderData.salesChannelPageId,
      warehouseId: newOrderData.warehouseId,
    };

    console.log("Sending order payload:", orderPayload);

    try {
      const result = await apiCreateOrder(orderPayload);
      console.log(
        "Order created successfully:",
        newOrder.id,
        "API response:",
        result,
      );

      if (slipUploadsArray.length > 0) {
        for (const dataUrl of slipUploadsArray) {
          try {
            const res: any = await createOrderSlip(newOrder.id, dataUrl);
            if (res && res.url) {
              uploadedSlips.push({
                id: Number(res.id ?? Date.now()),
                url: String(res.url),
                createdAt:
                  typeof res.created_at === "string"
                    ? res.created_at
                    : new Date().toISOString(),
              });
            }
          } catch (uploadErr) {
            console.error("order slip upload failed", uploadErr);
            alert("ไม่สามารถอัพโหลดสลิปได้ กรุณาตรวจสอบแล้วลองใหม่อีกครั้ง");
            break;
          }
        }
        if (uploadedSlips.length > 0) {
          newOrder.slipUrl = uploadedSlips[0].url;
          newOrder.slips = uploadedSlips;
          try {
            await apiPatchOrder(newOrder.id, { slipUrl: newOrder.slipUrl });
          } catch (patchErr) {
            console.warn("failed to sync slip url to order", patchErr);
          }
        }
      }

      // Refresh orders from API to get the latest data
      try {
        const freshOrders = await listOrders();

        // Helper functions for mapping API data
        const fromApiOrderStatus = (s: any): OrderStatus => {
          switch (String(s)) {
            case "Pending":
              return OrderStatus.Pending as any;
            case "Picking":
              return OrderStatus.Picking as any;
            case "Shipping":
              return OrderStatus.Shipping as any;
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
            case "Paid":
              return PaymentStatus.Paid as any;
            default:
              return PaymentStatus.Unpaid as any;
          }
        };

        let mappedOrders = Array.isArray(freshOrders)
          ? freshOrders.map((o) => ({
              id: o.id,
              customerId: o.customer_id,
              companyId: o.company_id,
              creatorId: o.creator_id,
              orderDate: o.order_date,
              deliveryDate: o.delivery_date,
              shippingAddress: {
                street: o.street,
                subdistrict: o.subdistrict,
                district: o.district,
                province: o.province,
                postalCode: o.postal_code,
              },
              items: [], // Will be loaded separately if needed
              shippingCost: parseFloat(o.shipping_cost || "0"),
              billDiscount: parseFloat(o.bill_discount || "0"),
              totalAmount: parseFloat(o.total_amount || "0"),
              paymentMethod: o.payment_method as PaymentMethod,
              paymentStatus: fromApiPaymentStatus(o.payment_status),
              orderStatus: fromApiOrderStatus(o.order_status),
              trackingNumbers: o.tracking_numbers
                ? o.tracking_numbers.split(",").filter((t) => t.trim())
                : [],
              notes: o.notes,
              boxes: [], // Will be loaded separately if needed
              warehouseId:
                typeof o.warehouse_id !== "undefined" && o.warehouse_id !== null
                  ? Number(o.warehouse_id)
                  : undefined,
              salesChannel: o.sales_channel,
              salesChannelPageId:
                typeof o.sales_channel_page_id !== "undefined"
                  ? Number(o.sales_channel_page_id)
                  : undefined,
              slipUrl:
                typeof o.slip_url !== "undefined" && o.slip_url !== null
                  ? String(o.slip_url)
                  : undefined,
              slips: Array.isArray(o.slips)
                ? (o.slips as any[]).map((s) => ({
                    id: Number(s.id),
                    url: String(s.url),
                    createdAt: s.created_at,
                  }))
                : undefined,
            }))
          : [];
        if (uploadedSlips.length > 0) {
          mappedOrders = mappedOrders.map((order) =>
            order.id === newOrder.id
              ? {
                  ...order,
                  slipUrl: order.slipUrl ?? uploadedSlips[0].url,
                  slips: uploadedSlips,
                }
              : order,
          );
        }
        setOrders(mappedOrders);
        console.log("Orders refreshed from API");
      } catch (refreshError) {
        console.error("Failed to refresh orders:", refreshError);
        // Fallback to local state update
        setOrders((prevOrders) => [newOrder, ...prevOrders]);
      }
    } catch (e) {
      console.error("create order API failed", e);
      alert("ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง");
      return; // Don't add to local state if API fails
    }

    // Notify assigned telesale or redistribute if needed
    try {
      const theCustomer = customers.find((c) => c.id === customerIdForOrder);
      const assignedUserId = theCustomer?.assignedTo || null;
      const isAdminCreating = currentUser.role === UserRole.Admin;

      if (assignedUserId && assignedUserId !== currentUser.id) {
        const notifId = `notif-neworder-${newOrder.id}`;
        setNotifications((prev) => [
          {
            id: notifId,
            type: NotificationType.NewOrderForCustomer,
            message: `มีคำสั่งซื้อใหม่สำหรับลูกค้าของคุณ: ${newOrder.id}`,
            timestamp: new Date().toISOString(),
            read: false,
            relatedId: newOrder.customerId,
            forRoles: [],
            userId: assignedUserId,
          },
          ...prev,
        ]);
      }

      if (isAdminCreating && !assignedUserId) {
        // Put customer into waiting basket for Admin Control to distribute via "Share"
        try {
          await updateCustomer(customerIdForOrder, {
            // Use backend column names to ensure persistence
            is_in_waiting_basket: 1,
            waiting_basket_start_date: new Date().toISOString(),
            lifecycle_status: "FollowUp",
          });
        } catch (err) {
          console.warn("update waiting basket flags failed", err);
        }
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === customerIdForOrder
              ? {
                  ...c,
                  lifecycleStatus: CustomerLifecycleStatus.FollowUp,
                  isInWaitingBasket: true as any,
                  waitingBasketStartDate: new Date().toISOString() as any,
                }
              : c,
          ),
        );
      }
    } catch (notifyErr) {
      console.warn("post-create notify/redistribute failed", notifyErr);
    }

    const newActivity: Activity = {
      id: Date.now() + Math.random(),
      customerId: newOrder.customerId,
      timestamp: new Date().toISOString(),
      type: ActivityType.OrderCreated,
      description: `สร้างคำสั่งซื้อ ${newOrder.id}`,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`,
    };
    try {
      await createActivity({
        customerId: newActivity.customerId,
        timestamp: newActivity.timestamp,
        type: newActivity.type,
        description: newActivity.description,
        actorName: newActivity.actorName,
      });
      console.log("Activity created successfully");
    } catch (e) {
      console.error("Failed to create activity", e);
      // Don't show alert for activity creation failure as it's not critical
    }
    setActivities((prev) => [newActivity, ...prev]);

    // Update customer lifecycle status when an order is created.
    // Keep FollowUp status as the highest priority so outstanding follow-ups are not hidden.
    const customer = customers.find((c) => c.id === customerIdForOrder);
    const shouldTransitionToOld3Months =
      customer &&
      customer.lifecycleStatus !== CustomerLifecycleStatus.FollowUp &&
      customer.lifecycleStatus !== CustomerLifecycleStatus.Old3Months;

    if (shouldTransitionToOld3Months) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerIdForOrder
            ? {
                ...c,
                lifecycleStatus: CustomerLifecycleStatus.Old3Months,
              }
            : c,
        ),
      );

      if (true) {
        try {
          await updateCustomer(customerIdForOrder, {
            lifecycleStatus: CustomerLifecycleStatus.Old3Months,
          });
        } catch (e) {
          console.error(
            "update customer lifecycle status after order creation",
            e,
          );
        }
      }
    }

    // Note: Do NOT grant sale here. Sale quota (+90) is granted when order is Paid + Delivered.

    if (customerUpdate && customerIdForOrder) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerIdForOrder ? { ...c, ...customerUpdate } : c,
        ),
      );
    }

    closeModal();
    return newOrder.id;
  };

  const handleUpdateCustomer = async (updatedCustomer: Customer) => {
    if (true) {
      try {
        await updateCustomer(updatedCustomer.id, {
          firstName: updatedCustomer.firstName,
          lastName: updatedCustomer.lastName,
          phone: updatedCustomer.phone,
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
          grade: updatedCustomer.grade,
          totalPurchases: updatedCustomer.totalPurchases,
          totalCalls: updatedCustomer.totalCalls,
          facebookName: updatedCustomer.facebookName,
          lineId: updatedCustomer.lineId,
          address: updatedCustomer.address,
        });
      } catch (e) {
        console.error("update customer API failed", e);
      }
    }
    setCustomers((prev) =>
      prev.map((c) => (c.id === updatedCustomer.id ? updatedCustomer : c)),
    );
    closeModal();
  };

  const handleTakeCustomer = (customerToTake: Customer) => {
    if (
      window.confirm(
        `คุณต้องการรับผิดชอบลูกค้า "${customerToTake.firstName} ${customerToTake.lastName}" หรือไม่?`,
      )
    ) {
      setCustomers((prev) =>
        prev.map((c) =>
          c.id === customerToTake.id
            ? {
                ...c,
                assignedTo: currentUser.id,
                previousLifecycleStatus: c.lifecycleStatus,
                lifecycleStatus: CustomerLifecycleStatus.FollowUp,
                dateAssigned: new Date().toISOString(),
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

    const newId = `CUS-${newCustomerData.phone.substring(1)}`;

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
      dateAssigned: new Date().toISOString(),
      ownershipExpires: ownershipExpires.toISOString(),
      behavioralStatus: CustomerBehavioralStatus.Warm,
      grade: CustomerGrade.D,
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
    closeModal();
  };

  const handleDeleteProduct = (productId: number) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    closeModal();
  };

  const handleLogCall = async (
    callLogData: Omit<CallHistory, "id">,
    customerId: string,
    newFollowUpDate?: string,
    newTags?: string[],
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
            const existingTagNames = new Set(
              updatedCustomerTags.map((t) => t.name),
            );
            const tagsToAdd: Tag[] = newTags
              .filter((tagName) => !existingTagNames.has(tagName))
              .map((tagName) => ({
                // Create new USER tags on the fly. This won't be added to user's palette but will appear on customer.
                id: Date.now() + Math.random(),
                name: tagName,
                type: TagType.User,
              }));
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
        status: "รอดำเนินการ",
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
            status: "รอดำเนินการ",
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

    const newActivity: Activity = {
      id: Date.now(),
      customerId: customerId,
      timestamp: new Date().toISOString(),
      type: ActivityType.CallLogged,
      description: `บันทึกการโทร: ${callLogData.result}`,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`,
    };
    if (true) {
      try {
        await createActivity({
          customerId: newActivity.customerId,
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
          status: appointmentData.status,
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
      status: "รอดำเนินการ",
    };
    if (true) {
      try {
        await createAppointment({
          customerId: appointmentData.customerId,
          date: appointmentData.date,
          title: appointmentData.title,
          status: "รอดำเนินการ",
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

    const newActivity: Activity = {
      id: Date.now() + Math.random(),
      customerId: appointmentData.customerId,
      timestamp: new Date().toISOString(),
      type: ActivityType.AppointmentSet,
      description: `นัดหมาย: ${appointmentData.title}`,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`,
    };
    if (true) {
      try {
        await createActivity({
          customerId: newActivity.customerId,
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

    closeModal();
  };

  const handleCompleteAppointment = async (appointmentId: number) => {
    const appointmentToUpdate = appointments.find(
      (a) => a.id === appointmentId,
    );
    if (!appointmentToUpdate) return;

    const updatedAppointment = {
      ...appointmentToUpdate,
      status: "เสร็จสิ้น",
    };

    if (true) {
      try {
        await updateAppointment(appointmentId, { status: "เสร็จสิ้น" });
      } catch (e) {
        console.error("update appointment API failed", e);
        // If API fails, still update local state
        setAppointments((prev) =>
          prev.map((a) => (a.id === appointmentId ? updatedAppointment : a)),
        );
        return;
      }
    }

    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? updatedAppointment : a)),
    );

    // Check if customer has any remaining pending appointments
    const customerAppointments = appointments.filter(
      (a) =>
        a.customerId === appointmentToUpdate.customerId &&
        a.id !== appointmentId,
    );

    const hasPendingAppointments = customerAppointments.some(
      (a) => a.status !== "เสร็จสิ้น",
    );

    // If no pending appointments, update customer lifecycle status
    if (!hasPendingAppointments) {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === appointmentToUpdate.customerId) {
            // Determine the new lifecycle status based on new business rules
            let newLifecycleStatus = c.lifecycleStatus;
            if (c.lifecycleStatus === CustomerLifecycleStatus.FollowUp) {
              // If sold and within 90 days -> Old3Months, else revert to previous status
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - 90);
              const hasRecentOrder = orders.some(
                (o) => o.customerId === c.id && new Date(o.orderDate) >= cutoff,
              );
              if (hasRecentOrder) {
                newLifecycleStatus = CustomerLifecycleStatus.Old3Months;
              } else {
                newLifecycleStatus =
                  c.previousLifecycleStatus ?? newLifecycleStatus;
              }
            }

            return {
              ...c,
              followUpDate: undefined,
              lifecycleStatus: newLifecycleStatus,
              previousLifecycleStatus:
                newLifecycleStatus === CustomerLifecycleStatus.FollowUp
                  ? c.previousLifecycleStatus
                  : undefined,
            };
          }
          return c;
        }),
      );

      if (true) {
        try {
          // Update customer in the database
          const customer = customers.find(
            (c) => c.id === appointmentToUpdate.customerId,
          );
          if (customer) {
            let updateData: any = { followUpDate: null };

            // Mirror local logic for lifecycle status change
            let newLifecycleStatus = customer.lifecycleStatus;
            if (customer.lifecycleStatus === CustomerLifecycleStatus.FollowUp) {
              const cutoff = new Date();
              cutoff.setDate(cutoff.getDate() - 90);
              const hasRecentOrder = orders.some(
                (o) =>
                  o.customerId === customer.id &&
                  new Date(o.orderDate) >= cutoff,
              );
              if (hasRecentOrder) {
                newLifecycleStatus = CustomerLifecycleStatus.Old3Months;
                updateData.lifecycleStatus = newLifecycleStatus;
              } else if (customer.previousLifecycleStatus) {
                updateData.lifecycleStatus = customer.previousLifecycleStatus;
              }
            }

            await updateCustomer(appointmentToUpdate.customerId, updateData);
          }
        } catch (e) {
          console.error("update customer after appointment completion", e);
        }
      }
    }

    const newActivity: Activity = {
      id: Date.now() + Math.random(),
      customerId: appointmentToUpdate.customerId,
      timestamp: new Date().toISOString(),
      type: ActivityType.AppointmentSet,
      description: `นัดหมาย "${appointmentToUpdate.title}" ถูกทำเครื่องหมายว่าเสร็จสิ้นแล้ว`,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`,
    };
    if (true) {
      try {
        await createActivity({
          customerId: newActivity.customerId,
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

  const handleCreateUserTag = (tagName: string): Tag | null => {
    let newTag: Tag | null = null;
    setUsers((prev) => {
      return prev.map((u) => {
        if (u.id === currentUser.id) {
          if (u.customTags.length >= 10) {
            alert("ไม่สามารถเพิ่ม Tag ได้เนื่องจากมีครบ 10 Tag แล้ว");
            return u;
          }
          const existingTag = [...systemTags, ...u.customTags].find(
            (t) => t.name.toLowerCase() === tagName.toLowerCase(),
          );
          if (existingTag) {
            alert("มี Tag นี้อยู่แล้ว");
            return u;
          }

          newTag = {
            id: Date.now(),
            name: tagName,
            type: TagType.User,
          };
          return { ...u, customTags: [...u.customTags, newTag] };
        }
        return u;
      });
    });
    return newTag;
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
          typeof u.username === "string" &&
          u.username.toLowerCase() === lower;
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
      )}` +
      `${sign}${pad(hoursOffset)}:${pad(minutesOffset)}`
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

  const normalizeGradeValue = (
    raw?: string,
  ): CustomerGrade | undefined => {
    const token = sanitizeValue(raw).toUpperCase();
    if (!token) return undefined;
    switch (token) {
      case "A+":
      case "A_PLUS":
      case "A-PLUS":
        return CustomerGrade.APlus;
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
      assignedTo !== null ? dateAssignedIso ?? toThaiIsoString(now) : undefined;
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

    const resolvedGrade =
      input.grade ?? existing?.grade ?? CustomerGrade.C;

    const resolvedTotalPurchases =
      typeof input.totalPurchases === "number" &&
      Number.isFinite(input.totalPurchases)
        ? input.totalPurchases
        : existing?.totalPurchases ?? 0;

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

      const baseCustomer: Customer =
        existing ??
        {
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

      const {
        id: resolvedCaretakerId,
        reference: resolvedCaretakerRef,
      } = normalizeCaretakerIdentifier(first.caretakerId);

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
      const shippingAddress: Address = {
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
          `Order ${orderId}: ผู้ขาย ${salespersonReference} ไม่พบในระบบ ใช้ ${currentUser.username} แทน.`,
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

      setOrders((prev) => [newOrder, ...prev]);
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

      const {
        id: resolvedCaretakerId,
        reference: resolvedCaretakerRef,
      } = normalizeCaretakerIdentifier(row.caretakerId);

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
    if (viewingCustomer) {
      return (
        <CustomerDetailPage
          customer={viewingCustomer}
          orders={companyOrders.filter(
            (o) => o.customerId === viewingCustomer.id,
          )}
          callHistory={callHistory.filter(
            (c) => c.customerId === viewingCustomer.id,
          )}
          appointments={appointments.filter(
            (a) => a.customerId === viewingCustomer.id,
          )}
          activities={activities.filter(
            (a) => a.customerId === viewingCustomer.id,
          )}
          onClose={handleCloseCustomerDetail}
          openModal={openModal}
          user={currentUser}
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
          setActivePage={setActivePage}
        />
      );
    }

    // Global entries: simple, international dashboards for layout-only views
    if (activePage === "Sales Overview") {
      return (
        <SalesDashboard orders={companyOrders} customers={companyCustomers} />
      );
    }
    if (activePage === "Calls Overview") {
      return <CallsDashboard calls={callHistory} user={currentUser} />;
    }
    if (activePage === "Pancake User Mapping") {
      return <PancakeUserIntegrationPage />;
    }

    // Page stats (Super Admin): group default or specific page
    if (
      activePage === "Page Stats" ||
      activePage === "Page Performance" ||
      activePage === "Reports" ||
      activePage === "รายงาน"
    ) {
      return (
        <PageStatsPage
          orders={companyOrders}
          customers={companyCustomers}
          calls={callHistory}
        />
      );
    }
    if (
      activePage === "Engagement Insights" ||
      activePage === "สถิติการมีส่วนร่วม"
    ) {
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
    if (activePage === "Dashboard" || activePage === "แดชบอร์ด") {
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
    const superOnly = new Set([
      "Data Management",
      "Permissions",
      "Teams",
      "Pages",
      "Tags",
      "Users",
      "Products",
    ]);
    if (superOnly.has(activePage) && currentUser.role !== UserRole.SuperAdmin) {
      return <div className="p-6 text-red-600">Not authorized</div>;
    }
    if (activePage === "Users") {
      return (
        <UserManagementPage
          users={companyUsers}
          openModal={openModal}
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
            systemTags={systemTags}
          />
        );
      }
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
    if (activePage === "Share" || activePage === "แจกจ่าย") {
      return (
        <CustomerDistributionPage
          allCustomers={companyCustomers}
          allUsers={companyUsers}
          setCustomers={setCustomers}
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
    if (activePage === "Tags") {
      return (
        <TagsManagementPage systemTags={systemTags} users={companyUsers} />
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
            openModal={openModal}
            onProcessOrders={handleProcessOrders}
          />
        );
      }
      return (
        <TelesaleOrdersPage
          user={currentUser}
          orders={companyOrders}
          customers={companyCustomers}
          openModal={openModal}
          onCancelOrder={handleCancelOrder}
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
      return <ReportsPage orders={companyOrders} />;
    }
    if (
      activePage === "รายงานการขายสินค้า" ||
      activePage === "Product Sales Report"
    ) {
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
          orders={companyOrders}
          onBulkUpdateTracking={handleBulkUpdateTracking}
        />
      );
    }
    if (activePage === "Call Details") {
      return <CallDetailsPage currentUser={currentUser} />;
    }
    if (
      activePage === "Call History" ||
      activePage === "ประวัติการโทร" ||
      activePage === "Dtac Onecall"
    ) {
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
      activePage === "Create Promotion" ||
      activePage === "โปรโมชั่นที่กำลังใช้งาน" ||
      activePage === "ประวัติโปรโมชั่น" ||
      activePage === "สร้างโปรโมชั่น"
    ) {
      return <PromotionsPage />;
    }

    switch (currentUser.role) {
      case UserRole.SuperAdmin:
      case UserRole.AdminControl:
        switch (activePage) {
          case "แดชบอร์ด":
            return (
              <AdminDashboard
                user={currentUser}
                orders={companyOrders}
                customers={companyCustomers}
                openCreateOrderModal={() => setActivePage("CreateOrder")}
              />
            );
          case "CreateOrder":
            return (
              <CreateOrderPage
                customers={companyCustomers}
                products={companyProducts}
                promotions={promotions}
                pages={pages}
                warehouses={warehouses}
                onSave={handleCreateOrder}
                onCancel={() => setActivePage("แดชบอร์ด")}
                initialData={createOrderInitialData}
              />
            );
          case "เพิ่มลูกค้า":
            return (
              <AddCustomerPage
                companyUsers={companyUsers}
                onCancel={() => setActivePage("แดชบอร์ด")}
                onSave={(customerData, andCreateOrder) => {
                  const newCustomer = handleSaveCustomer(customerData);
                  if (andCreateOrder) {
                    setActivePage("CreateOrder");
                  } else {
                    setActivePage("แดชบอร์ด");
                  }
                }}
              />
            );
          case "แจกจ่าย":
            return (
              <CustomerDistributionPage
                allCustomers={companyCustomers}
                allUsers={companyUsers}
                setCustomers={setCustomers}
              />
            );
          case "จัดการผู้ใช้":
            return (
              <UserManagementPage
                users={companyUsers}
                openModal={openModal}
                currentUser={currentUser}
                allCompanies={companies}
              />
            );
          case "จัดการสินค้า":
            return (
              <ProductManagementPage
                products={companyProducts}
                openModal={openModal}
                currentUser={currentUser}
                allCompanies={companies}
              />
            );
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
          case "นำเข้า/ส่งออกข้อมูล":
            return (
              <ImportExportPage
                allUsers={companyUsers}
                allCustomers={companyCustomers}
                allOrders={companyOrders}
                onImportSales={handleImportSales}
                onImportCustomers={handleImportCustomers}
              />
            );
          case "Import Export":
            return (
              <ImportExportPage
                allUsers={companyUsers}
                allCustomers={companyCustomers}
                allOrders={companyOrders}
                onImportSales={handleImportSales}
                onImportCustomers={handleImportCustomers}
              />
            );
          case "Export History":
            return <ExportHistoryPage />;
          case "Customers":
            return (
              <CustomerSearchPage
                customers={companyCustomers}
                orders={companyOrders}
                users={companyUsers}
                currentUser={currentUser}
                onTakeCustomer={handleTakeCustomer}
              />
            );
          case "Manage Customers":
            return (
              <ManageCustomersPage
                allUsers={companyUsers}
                allCustomers={companyCustomers}
                allOrders={companyOrders}
                currentUser={currentUser}
                onTakeCustomer={handleTakeCustomer}
                openModal={openModal}
                onViewCustomer={handleViewCustomer}
              />
            );
          case "Customer Pools":
            return (
              <CustomerPoolsPage
                users={companyUsers}
                customers={companyCustomers}
                currentUser={currentUser}
                onViewCustomer={handleViewCustomer}
                openModal={openModal}
              />
            );
          case "สระว่ายน้ำ":
          case "Customer Pools":
            return (
              <CustomerPoolsPage
                users={companyUsers}
                customers={companyCustomers}
                currentUser={currentUser}
                onViewCustomer={handleViewCustomer}
                openModal={openModal}
              />
            );
          default:
            return (
              <AdminDashboard
                user={currentUser}
                orders={companyOrders}
                customers={companyCustomers}
                openCreateOrderModal={() => setActivePage("CreateOrder")}
              />
            );
        }

      case UserRole.Admin:
        switch (activePage) {
          case "แดชบอร์ด":
            return (
              <AdminDashboard
                user={currentUser}
                orders={companyOrders.filter(
                  (o) => o.creatorId === currentUser.id,
                )}
                customers={companyCustomers.filter(
                  (c) => c.assignedTo === currentUser.id,
                )}
                openCreateOrderModal={() => setActivePage("CreateOrder")}
              />
            );
          case "CreateOrder":
            return (
              <CreateOrderPage
                customers={companyCustomers}
                products={companyProducts}
                promotions={promotions}
                pages={pages}
                warehouses={warehouses}
                onSave={handleCreateOrder}
                onCancel={() => setActivePage("แดชบอร์ด")}
                initialData={createOrderInitialData}
              />
            );
          case "รายการคำสั่งซื้อ":
            return (
              <TelesaleOrdersPage
                user={currentUser}
                orders={companyOrders}
                customers={companyCustomers}
                openModal={openModal}
                title="คำสั่งซื้อ"
                onCancelOrder={handleCancelOrder}
              />
            );
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
          case "notifications":
            return (
              <div className="p-6 bg-[#F5F5F5]">
                <div className="mb-6">
                  <h1 className="text-2xl font-bold text-gray-800 mb-2">
                    การแจ้งเตือน
                  </h1>
                  <p className="text-gray-600">
                    การแจ้งเตือนทั้งหมดที่เกี่ยวข้องกับคุณ
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="p-4 border-b">
                    <div className="flex items-center">
                      <Bell className="w-5 h-5 mr-2 text-gray-600" />
                      <h2 className="text-lg font-semibold text-gray-800">
                        การแจ้งเตือนล่าสุด
                      </h2>
                    </div>
                  </div>

                  <div className="p-4">
                    {visibleNotifications.length > 0 ? (
                      <div className="space-y-4">
                        {visibleNotifications.map((notif) => (
                          <div
                            key={notif.id}
                            className={`flex items-start p-4 border rounded-lg ${
                              !notif.read
                                ? "bg-blue-50 border-blue-200"
                                : "bg-white border-gray-200"
                            }`}
                          >
                            <div className="flex-shrink-0 mt-1 mr-3">
                              {notif.priority === "urgent" && (
                                <AlertCircle className="w-5 h-5 text-red-500" />
                              )}
                              {notif.priority === "high" && (
                                <AlertCircle className="w-5 h-5 text-orange-500" />
                              )}
                              {notif.priority === "medium" && (
                                <Clock className="w-5 h-5 text-yellow-500" />
                              )}
                              {notif.priority === "low" && (
                                <Check className="w-5 h-5 text-green-500" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-800">
                                {notif.title}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {notif.message}
                              </p>
                              {notif.pageName && (
                                <p className="text-xs text-gray-500 mt-1">
                                  หน้า: {notif.pageName}{" "}
                                  {notif.platform && `(${notif.platform})`}
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {new Date(notif.timestamp).toLocaleString(
                                  "th-TH",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  },
                                )}
                              </p>
                              {notif.actionUrl && (
                                <button
                                  className="text-xs text-blue-600 hover:underline mt-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.location.href = notif.actionUrl;
                                  }}
                                >
                                  {notif.actionText || "ดูรายละเอียด"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 text-center text-sm text-gray-500">
                        ไม่มีการแจ้งเตือนในขณะนี้
                      </div>
                    )}
                  </div>

                  {visibleNotifications.length > 0 && (
                    <div className="p-4 border-t">
                      <button
                        onClick={handleMarkAllAsRead}
                        className="w-full text-center text-sm text-blue-600 font-medium hover:bg-blue-50 rounded-md py-2"
                      >
                        ทำเครื่องหมายว่าอ่านทั้งหมด
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          default:
            return (
              <AdminDashboard
                user={currentUser}
                orders={companyOrders.filter(
                  (o) => o.creatorId === currentUser.id,
                )}
                customers={companyCustomers.filter(
                  (c) => c.assignedTo === currentUser.id,
                )}
                openCreateOrderModal={() => setActivePage("CreateOrder")}
              />
            );
        }

      case UserRole.Telesale:
      case UserRole.Supervisor:
        switch (activePage) {
          case "แดชบอร์ด":
            return (
              <TelesaleSummaryDashboard
                user={currentUser}
                customers={companyCustomers}
                orders={companyOrders}
                activities={activities}
                openModal={() => setActivePage("CreateOrder")}
              />
            );
          case "CreateOrder":
            return (
              <CreateOrderPage
                customers={companyCustomers}
                products={companyProducts}
                promotions={promotions}
                pages={pages}
                warehouses={warehouses}
                onSave={handleCreateOrder}
                onCancel={() => setActivePage("แดชบอร์ด")}
                initialData={createOrderInitialData}
              />
            );
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
                systemTags={systemTags}
              />
            );
          case "คำสั่งซื้อของฉัน":
            return (
              <TelesaleOrdersPage
                user={currentUser}
                orders={companyOrders}
                customers={companyCustomers}
                openModal={openModal}
                onCancelOrder={handleCancelOrder}
              />
            );
          case "ค้นหาลูกค้า":
            return (
              <CustomerSearchPage
                customers={companyCustomers}
                orders={companyOrders}
                users={companyUsers}
                currentUser={currentUser}
                onTakeCustomer={handleTakeCustomer}
              />
            );
          case "ทีม":
            return currentUser.role === UserRole.Supervisor ? (
              <SupervisorTeamPage
                user={currentUser}
                allUsers={users}
                allCustomers={companyCustomers}
                allOrders={companyOrders}
              />
            ) : (
              <TelesaleDashboard
                user={currentUser}
                customers={companyCustomers}
                appointments={appointments}
                activities={activities}
                calls={callHistory}
                orders={companyOrders}
                onViewCustomer={handleViewCustomer}
                openModal={openModal}
                systemTags={systemTags}
              />
            );

          default:
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

      case UserRole.Marketing:
        // Dedicated marketing management page
        return <MarketingPage currentUser={currentUser} />;

      case UserRole.Backoffice:
        if (activePage === "Export History") {
          return <ExportHistoryPage />;
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
        if (activePage === "Warehouse Stock") {
          return <WarehouseStockViewPage currentUser={currentUser} />;
        }
        if (activePage === "Lot Tracking") {
          return <LotTrackingPage currentUser={currentUser} />;
        }
        if (activePage === "Warehouse Allocation") {
          return <OrderAllocationPage />;
        }
        switch (activePage) {
          case "แดชบอร์ด":
            return (
              <BackofficeDashboard
                user={currentUser}
                orders={companyOrders}
                customers={companyCustomers}
                openModal={openModal}
              />
            );
          case "รายการคำสั่งซื้อ":
            return (
              <ManageOrdersPage
                user={currentUser}
                orders={companyOrders}
                customers={companyCustomers}
                users={companyUsers}
                openModal={openModal}
                onProcessOrders={handleProcessOrders}
              />
            );
          case "เพิ่ม Tracking":
            return (
              <BulkTrackingPage
                orders={companyOrders}
                onBulkUpdateTracking={handleBulkUpdateTracking}
              />
            );
          case "ติดหนี้":
            return (
              <DebtCollectionPage
                user={currentUser}
                orders={companyOrders}
                customers={companyCustomers}
                users={companyUsers}
                openModal={openModal}
              />
            );
          case "รายงาน":
            return <ReportsPage orders={companyOrders} />;
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
          default:
            return <div className="p-6">หน้านี้ไม่พร้อมใช้งาน</div>;
        }

      default:
        return <div className="p-6">หน้านี้ไม่พร้อมใช้งาน</div>;
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
            onSave={handleLogCall}
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
            onClose={closeModal}
          />
        );
      case "viewAllActivities":
        return (
          <ActivityLogModal
            customer={modalState.data as Customer}
            activities={activities.filter(
              (a) => a.customerId === (modalState.data as Customer).id,
            )}
            onClose={closeModal}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#F5F5F5]">
      {!viewingCustomer && !hideSidebar && (
        <Sidebar
          user={currentUser}
          activePage={activePage}
          setActivePage={setActivePage}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={setIsSidebarCollapsed}
          onLogout={handleLogout}
          permissions={rolePermissions || undefined}
        />
      )}
      <div
        className={`flex-1 flex flex-col overflow-hidden ${hideSidebar ? "w-full" : ""}`}
      >
        {!viewingCustomer && !hideSidebar && (
          <header className="flex justify-between items-center px-6 h-16 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center space-x-4">
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
            <div className="flex items-center space-x-4">
              <div className="relative hidden">
                <select
                  value={currentUserRole}
                  onChange={(e) => {
                    setCurrentUserRole(e.target.value as UserRole);
                    setActivePage("แดชบอร์ด");
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
              <div className="relative">
                <button
                  onClick={handleToggleNotificationPanel}
                  className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500"
                >
                  <Bell size={20} />
                  {unreadNotificationCount > 0 && (
                    <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center ring-2 ring-white">
                      {unreadNotificationCount}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white font-bold">
                  {currentUser.firstName.charAt(0)}
                </div>
                <div className="hidden md:block">
                  <p className="font-semibold text-sm text-gray-800">{`${currentUser.firstName} ${currentUser.lastName}`}</p>
                  <p className="text-xs text-gray-500">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </header>
        )}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F5F5F5] relative">
          {renderPage()}
        </main>
      </div>
      {isNotificationPanelOpen && (
        <NotificationPanel
          notifications={visibleNotifications}
          onClose={() => setIsNotificationPanelOpen(false)}
          onMarkAllAsRead={handleMarkAllAsRead}
          onMarkAsRead={handleMarkNotificationAsRead}
          onNotificationClick={(notification) => {
            // Navigate to notification URL if provided
            if (notification.actionUrl) {
              window.location.href = notification.actionUrl;
            }
          }}
          currentUserRole={currentUserRole as UserRole}
        />
      )}
      {renderModal()}
    </div>
  );
};

export default App;
