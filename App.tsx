import React, { useState, useMemo, useEffect } from 'react';
import { UserRole, User, Order, ModalState, Customer, Product, Promotion, CallHistory, Appointment, PaymentStatus, OrderStatus, Address, Notification, NotificationType, PaymentMethod, CustomerLifecycleStatus, CustomerBehavioralStatus, CustomerGrade, Tag, TagType, Activity, ActivityType, Company } from './types';
// Mock data removed - using real database only
import { listUsers, listCustomers, listOrders, listProducts, listPromotions, listPages, listCallHistory, listAppointments, createCustomer as apiCreateCustomer, createOrder as apiCreateOrder, patchOrder as apiPatchOrder, createCall, createAppointment, updateAppointment, updateCustomer, addCustomerTag, removeCustomerTag, listCustomerTags, createTag, listActivities, createActivity, listTags, apiFetch, createUser as apiCreateUser, updateUser as apiUpdateUser, deleteUser as apiDeleteUser, getRolePermissions } from './services/api';
import { recordFollowUp, getCustomerOwnershipStatus, recordSale } from '@/ownershipApi';
import Sidebar from './components/Sidebar';
import AdminDashboard from './pages/AdminDashboard';
import TelesaleDashboard from './pages/TelesaleDashboard';
import BackofficeDashboard from './pages/BackofficeDashboard';
import CustomerDetailPage from './pages/CustomerDetailPage';
import OrderManagementModal from './components/OrderManagementModal';
import CreateOrderModal from './components/CreateOrderModal';
import AllSalesPage from './pages/AllSalesPage';
import CustomerSearchPage from './pages/CustomerSearchPage';
import TelesaleOrdersPage from './pages/TelesaleOrdersPage';
import SupervisorTeamPage from './pages/SupervisorTeamPage';
import ReportsPage from './pages/ReportsPage';
import CustomerDistributionPage from './pages/CustomerDistributionPage';
import UserManagementPage from './pages/UserManagementPage';
import ProductManagementPage from './pages/ProductManagementPage';
import TelesaleSummaryDashboard from './pages/TelesaleSummaryDashboard';
import ManageOrdersPage from './pages/ManageOrdersPage';
import DebtCollectionPage from './pages/DebtCollectionPage';
import UserManagementModal from './components/UserManagementModal';
import ProductManagementModal from './components/ProductManagementModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';
import { Bell, ChevronsUpDown, Menu } from 'lucide-react';
import LogCallModal from './components/LogCallModal';
import AppointmentModal from './components/AppointmentModal';
import EditCustomerModal from './components/EditCustomerModal';
import NotificationPanel from './components/NotificationPanel';
import BulkTrackingPage from './pages/BulkTrackingPage';
import ExportHistoryPage from './pages/ExportHistoryPage';
import AddCustomerPage from './pages/AddCustomerPage';
import TagManagementModal from './components/TagManagementModal';
import ActivityLogModal from './components/ActivityLogModal';
import DataManagementPage from './pages/DataManagementPage';
import CreateOrderPage from './pages/CreateOrderPage';
import MarketingPage from './pages/MarketingPage';
import SalesDashboard from './pages/SalesDashboard';
import CallsDashboard from './pages/CallsDashboard';
import PermissionsPage from './pages/PermissionsPage';
import TeamsManagementPage from './pages/TeamsManagementPage';
import PagesManagementPage from './pages/PagesManagementPage';
import TagsManagementPage from './pages/TagsManagementPage';
import CallHistoryPage from './pages/CallHistoryPage';


const App: React.FC = () => {
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>(UserRole.Telesale);
  const [activePage, setActivePage] = useState<string>('แดชบอร์ด');
  const [modalState, setModalState] = useState<ModalState>({ type: null, data: null });
  const [createOrderInitialData, setCreateOrderInitialData] = useState<any | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [callHistory, setCallHistory] = useState<CallHistory[]>([]);
  const [pages, setPages] = useState<Page[]>([] as any);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [systemTags, setSystemTags] = useState<Tag[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [viewingCustomerId, setViewingCustomerId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [rolePermissions, setRolePermissions] = useState<Record<string, { view?: boolean; use?: boolean }> | null>(null);

  // Session user from LoginPage
  const [sessionUser, setSessionUser] = useState<any | null>(() => {
    try { return JSON.parse(localStorage.getItem('sessionUser') || 'null'); } catch { return null; }
  });

  // Always use real database - no mock data
  // API/UI enum mappings (global)
  const fromApiOrderStatus = (s: any): OrderStatus => {
    switch (String(s)) {
      case 'Pending': return OrderStatus.Pending as any;
      case 'Picking': return OrderStatus.Picking as any;
      case 'Shipping': return OrderStatus.Shipping as any;
      case 'Delivered': return OrderStatus.Delivered as any;
      case 'Returned': return OrderStatus.Returned as any;
      case 'Cancelled': return OrderStatus.Cancelled as any;
      default: return OrderStatus.Pending as any;
    }
  };
  const fromApiPaymentStatus = (s: any): PaymentStatus => {
    switch (String(s)) {
      case 'Unpaid': return PaymentStatus.Unpaid as any;
      case 'PendingVerification': return PaymentStatus.PendingVerification as any;
      case 'Paid': return PaymentStatus.Paid as any;
      default: return PaymentStatus.Unpaid as any;
    }
  };
  const fromApiPaymentMethod = (s: any): PaymentMethod => {
    switch (String(s)) {
      case 'COD': return PaymentMethod.COD as any;
      case 'Transfer': return PaymentMethod.Transfer as any;
      case 'PayAfter': return PaymentMethod.PayAfter as any;
      default: return PaymentMethod.COD as any;
    }
  };
  const toApiOrderStatus = (s: OrderStatus): string => {
    switch (s) {
      case OrderStatus.Pending: return 'Pending';
      case OrderStatus.Picking: return 'Picking';
      case OrderStatus.Shipping: return 'Shipping';
      case OrderStatus.Delivered: return 'Delivered';
      case OrderStatus.Returned: return 'Returned';
      case OrderStatus.Cancelled: return 'Cancelled';
      default: return 'Pending';
    }
  };
  const toApiPaymentStatus = (s: PaymentStatus): string => {
    switch (s) {
      case PaymentStatus.Unpaid: return 'Unpaid';
      case PaymentStatus.PendingVerification: return 'PendingVerification';
      case PaymentStatus.Paid: return 'Paid';
      default: return 'Unpaid';
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [u, c, o, p, promo, pg, ch, ap, ctags, act, tags, comps] = await Promise.all([
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
          apiFetch('companies'),
          getRolePermissions((sessionUser?.role ?? users[0]?.role) as any),
        ]);

        if (cancelled) return;

        // Debug: log raw API responses so we can verify backend data
        try {
          console.debug('API raw responses', {
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
          console.warn('Failed to log API raw responses', logErr);
        }

        setActivities(Array.isArray(act) ? act.map(a => ({
          id: a.id,
          customerId: a.customer_id,
          timestamp: a.timestamp,
          type: a.type,
          description: a.description,
          actorName: a.actor_name,
        })) : []);

        // Helpers: map API enums <-> UI enums
        const fromApiOrderStatus = (s: any): OrderStatus => {
          switch (String(s)) {
            case 'Pending': return OrderStatus.Pending as any;
            case 'Picking': return OrderStatus.Picking as any;
            case 'Shipping': return OrderStatus.Shipping as any;
            case 'Delivered': return OrderStatus.Delivered as any;
            case 'Returned': return OrderStatus.Returned as any;
            case 'Cancelled': return OrderStatus.Cancelled as any;
            default: return OrderStatus.Pending as any;
          }
        };
        const fromApiPaymentStatus = (s: any): PaymentStatus => {
          switch (String(s)) {
            case 'Unpaid': return PaymentStatus.Unpaid as any;
            case 'PendingVerification': return PaymentStatus.PendingVerification as any;
            case 'Paid': return PaymentStatus.Paid as any;
            default: return PaymentStatus.Unpaid as any;
          }
        };
        const fromApiPaymentMethod = (s: any): PaymentMethod => {
          switch (String(s)) {
            case 'COD': return PaymentMethod.COD as any;
            case 'Transfer': return PaymentMethod.Transfer as any;
            case 'PayAfter': return PaymentMethod.PayAfter as any;
            default: return PaymentMethod.COD as any;
          }
        };
        const toApiOrderStatus = (s: OrderStatus): string => {
          switch (s) {
            case OrderStatus.Pending: return 'Pending';
            case OrderStatus.Picking: return 'Picking';
            case OrderStatus.Shipping: return 'Shipping';
            case OrderStatus.Delivered: return 'Delivered';
            case OrderStatus.Returned: return 'Returned';
            case OrderStatus.Cancelled: return 'Cancelled';
            default: return 'Pending';
          }
        };
        const toApiPaymentStatus = (s: PaymentStatus): string => {
          switch (s) {
            case PaymentStatus.Unpaid: return 'Unpaid';
            case PaymentStatus.PendingVerification: return 'PendingVerification';
            case PaymentStatus.Paid: return 'Paid';
            default: return 'Unpaid';
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
          customTags: [],
        });

        const tagsByCustomer: Record<string, Tag[]> = {};
        if (Array.isArray(ctags)) {
          for (const row of ctags as any[]) {
            const t: Tag = { id: Number(row.id), name: row.name, type: (row.type as 'SYSTEM'|'USER') === 'SYSTEM' ? TagType.System : TagType.User };
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
            street: r.street || '',
            subdistrict: r.subdistrict || '',
            district: r.district || '',
            province: r.province || '',
            postalCode: r.postal_code || '',
          },
          province: r.province || '',
          companyId: r.company_id,
          assignedTo: r.assigned_to,
          dateAssigned: r.date_assigned,
          dateRegistered: r.date_registered ?? undefined,
          followUpDate: r.follow_up_date ?? undefined,
          ownershipExpires: r.ownership_expires ?? '',
          lifecycleStatus: r.lifecycle_status === 'New' ? CustomerLifecycleStatus.New : 
                         r.lifecycle_status === 'Old' ? CustomerLifecycleStatus.Old : 
                         r.lifecycle_status === 'FollowUp' ? CustomerLifecycleStatus.FollowUp : 
                         r.lifecycle_status === 'Old3Months' ? CustomerLifecycleStatus.Old3Months : 
                         r.lifecycle_status === 'DailyDistribution' ? CustomerLifecycleStatus.DailyDistribution : 
                         r.lifecycle_status ?? CustomerLifecycleStatus.New,
          behavioralStatus: (r.behavioral_status ?? 'Cold') as CustomerBehavioralStatus,
          grade: (r.grade ?? 'C') as CustomerGrade,
          tags: tagsByCustomer[r.id] || [],
          assignmentHistory: [],
          totalPurchases: Number(r.total_purchases || 0),
          totalCalls: Number(r.total_calls || 0),
          facebookName: r.facebook_name ?? undefined,
          lineId: r.line_id ?? undefined,
        });

        const mapOrder = (r: any): Order => ({
          id: r.id,
          customerId: r.customer_id,
          companyId: r.company_id,
          creatorId: r.creator_id,
          orderDate: r.order_date,
          deliveryDate: r.delivery_date ?? '',
          shippingAddress: { street: r.street || '', subdistrict: r.subdistrict || '', district: r.district || '', province: r.province || '', postalCode: r.postal_code || '' },
          items: [],
          shippingCost: Number(r.shipping_cost ?? 0),
          billDiscount: Number(r.bill_discount ?? 0),
          totalAmount: Number(r.total_amount || 0),
          slipUrl: r.slip_url ?? undefined,
          amountPaid: typeof r.amount_paid !== 'undefined' ? Number(r.amount_paid) : undefined,
          codAmount: typeof r.cod_amount !== 'undefined' ? Number(r.cod_amount) : undefined,
          paymentMethod: fromApiPaymentMethod(r.payment_method),
          paymentStatus: fromApiPaymentStatus(r.payment_status ?? 'Unpaid'),
          orderStatus: fromApiOrderStatus(r.order_status ?? 'Pending'),
          trackingNumbers: r.tracking_numbers ? String(r.tracking_numbers).split(',').filter(Boolean) : (Array.isArray(r.trackingNumbers) ? r.trackingNumbers : []),
          notes: r.notes ?? undefined,
          salesChannel: r.sales_channel ?? undefined,
          salesChannelPageId: typeof r.sales_channel_page_id !== 'undefined' ? Number(r.sales_channel_page_id) : undefined,
          slips: Array.isArray(r.slips) ? (r.slips as any[]).map(s => ({ id: Number(s.id), url: s.url, createdAt: s.created_at })) : undefined,
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
          items: Array.isArray(r.items) ? r.items.map((item: any) => ({
            id: item.id,
            promotionId: item.promotion_id,
            productId: item.product_id,
            quantity: item.quantity,
            isFreebie: Boolean(item.is_freebie),
            priceOverride: item.price_override ?? undefined,
            product: item.product_name ? {
              id: item.product_id,
              sku: item.sku ?? '',
              name: item.product_name,
              description: undefined,
              category: '',
              unit: '',
              cost: 0,
              price: item.product_price ?? 0,
              stock: 0,
              companyId: r.company_id,
            } : undefined,
          })) : [],
        });

        setUsers(Array.isArray(u) ? u.map(mapUser) : []);
        setCustomers(Array.isArray(c) ? c.map(mapCustomer) : []);
        setOrders(Array.isArray(o) ? o.map(mapOrder) : []);
        setProducts(Array.isArray(p) ? p.map(mapProduct) : []);
        setPages(Array.isArray(pg) ? pg.map((r: any) => ({ id: r.id, name: r.name, platform: r.platform, url: r.url ?? undefined, companyId: r.company_id, active: Boolean(r.active) })) : []);
        setPromotions(Array.isArray(promo) ? promo.map(mapPromotion) : []);
        setCallHistory(Array.isArray(ch) ? ch.map(mapCall) : []);
        setAppointments(Array.isArray(ap) ? ap.map(mapAppt) : []);
        
        // Set system tags and companies from API
        setSystemTags(Array.isArray(tags) ? tags.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type === 'SYSTEM' ? TagType.System : TagType.User,
        })) : []);
        
        setCompanies(Array.isArray(comps) ? comps.map(c => ({
          id: c.id,
          name: c.name,
        })) : []);
      } catch (e) {
        // API failed - show error to user
        console.error('Failed to load data from database:', e);
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
      }
    };
    load();
    return () => { cancelled = true; };
  }, []); // Load once on mount


  useEffect(() => {
    const now = new Date();
    
    setNotifications(prevNotifications => {
        const existingIds = new Set(prevNotifications.map(n => n.id));
        const generatedNotifications: Notification[] = [];

        // 1. Pending Verification (for Backoffice)
        orders.forEach(order => {
            if (order.paymentStatus === PaymentStatus.PendingVerification) {
                const id = `notif-pv-${order.id}`;
                if (!existingIds.has(id)) {
                    generatedNotifications.push({
                        id, type: NotificationType.PendingVerification, message: `Order ${order.id} needs payment verification.`,
                        timestamp: new Date().toISOString(), read: false, relatedId: order.id, forRoles: [UserRole.Backoffice],
                    });
                }
            }
        });

        // 2. Overdue Payments (for Backoffice)
        orders.forEach(order => {
            const isOverdue = new Date(order.deliveryDate) < now && (
                (order.paymentMethod === PaymentMethod.PayAfter && order.paymentStatus !== PaymentStatus.Paid) ||
                (order.paymentMethod === PaymentMethod.Transfer && order.paymentStatus === PaymentStatus.Unpaid)
            );
            if (isOverdue) {
                 const id = `notif-od-${order.id}`;
                 if (!existingIds.has(id)) {
                     generatedNotifications.push({
                        id, type: NotificationType.OverduePayment, message: `Payment for order ${order.id} is overdue.`,
                        timestamp: new Date().toISOString(), read: false, relatedId: order.id, forRoles: [UserRole.Backoffice],
                     });
                 }
            }
        });

        // 3. Expiring Customer Ownership (for Telesale, Supervisor)
        customers.forEach(customer => {
            if (customer.assignedTo) {
                const expiryDate = new Date(customer.ownershipExpires);
                const diffDays = (expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24);
                if (diffDays > 0 && diffDays <= 7) {
                    const id = `notif-exp-${customer.id}`;
                    if (!existingIds.has(id)) {
                        generatedNotifications.push({
                            id, type: NotificationType.ExpiringOwnership, message: `${customer.firstName}'s ownership expires in ${Math.ceil(diffDays)} days.`,
                            timestamp: new Date().toISOString(), read: false, relatedId: customer.id, forRoles: [UserRole.Telesale, UserRole.Supervisor],
                        });
                    }
                }
            }
        });

        if (generatedNotifications.length > 0) {
            return [...generatedNotifications, ...prevNotifications].sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        }
        
        return prevNotifications;
    });
  }, [orders, customers]);


  const currentUser = useMemo(() => {
    if (sessionUser) {
      const byId = users.find(u => u.id === sessionUser.id);
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

  const viewingCustomer = useMemo(() => {
    if (!viewingCustomerId) return null;
    return customers.find(c => c.id === viewingCustomerId);
  }, [viewingCustomerId, customers]);
  
  const isSuperAdmin = useMemo(() => currentUser.role === UserRole.SuperAdmin, [currentUser]);

  // Load role permissions (from localStorage first for instant UI, then API)
  useEffect(() => {
    const role = currentUser.role as string;
    const key = `role_permissions:${role}`;
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        setRolePermissions(JSON.parse(cached));
      } else if (role === UserRole.Backoffice) {
        setRolePermissions({ 'home.sales_overview': { view: false }, 'home.calls_overview': { view: false } });
      } else {
        setRolePermissions({});
      }
    } catch { setRolePermissions({}); }

    getRolePermissions(role).then(res => {
      const data = (res && (res as any).data) || null;
      if (data) {
        setRolePermissions(data);
        try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
      }
    }).catch(() => {});

    const onUpdated = (e: any) => {
      if (!e?.detail || e.detail.role !== role) return;
      try {
        const cached2 = localStorage.getItem(key);
        if (cached2) setRolePermissions(JSON.parse(cached2));
      } catch {}
    };
    window.addEventListener('role-permissions-updated', onUpdated as any);
    return () => window.removeEventListener('role-permissions-updated', onUpdated as any);
  }, [currentUser.role]);

  const companyCustomers = useMemo(() => isSuperAdmin ? customers : customers.filter(c => c.companyId === currentUser.companyId), [customers, currentUser.companyId, isSuperAdmin]);
  const companyOrders = useMemo(() => isSuperAdmin ? orders : orders.filter(o => o.companyId === currentUser.companyId), [orders, currentUser.companyId, isSuperAdmin]);
  const companyUsers = useMemo(() => isSuperAdmin ? users : users.filter(u => u.companyId === currentUser.companyId), [users, currentUser.companyId, isSuperAdmin]);
  const companyProducts = useMemo(() => isSuperAdmin ? products : products.filter(p => p.companyId === currentUser.companyId), [products, currentUser.companyId, isSuperAdmin]);

  const visibleNotifications = useMemo(() => {
    return notifications.filter(n => n.forRoles.includes(currentUser.role));
  }, [notifications, currentUser.role]);
  
  const unreadNotificationCount = useMemo(() => {
    return visibleNotifications.filter(n => !n.read).length;
  }, [visibleNotifications]);

  const handleToggleNotificationPanel = () => {
    setIsNotificationPanelOpen(prev => !prev);
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => 
      prev.map(n => n.forRoles.includes(currentUser.role) ? { ...n, read: true } : n)
    );
  };

  const handleLogout = () => {
    // Clear session data
    localStorage.removeItem('sessionUser');
    setSessionUser(null);
    
    // Redirect to login page
    const url = new URL(window.location.href);
    url.searchParams.set('login', 'true');
    window.location.replace(url.toString());
  };

  // Handlers for modals and data updates
  const openModal = (type: ModalState['type'], data?: any) => {
    if (type === 'createOrder') {
      // navigate to the full-page create order and pass initial data
      setCreateOrderInitialData(data || null);
      setActivePage('สร้างคำสั่งซื้อ');
      return;
    }
    setModalState({ type, data });
  };
  const closeModal = () => setModalState({ type: null, data: null });

  const handleViewCustomer = (customer: Customer) => setViewingCustomerId(customer.id);
  const handleCloseCustomerDetail = () => setViewingCustomerId(null);

  // Clear any transient create-order initial data when leaving the page
  useEffect(() => {
    if (activePage !== 'สร้างคำสั่งซื้อ') setCreateOrderInitialData(null);
  }, [activePage]);

  const handleUpdateOrder = async (updatedOrder: Order) => {
    const originalOrder = orders.find(o => o.id === updatedOrder.id);
    if (!originalOrder) return;
  
    const activitiesToAdd: Activity[] = [];
  
    if (originalOrder.orderStatus !== updatedOrder.orderStatus) {
      activitiesToAdd.push({
        id: Date.now() + Math.random(),
        customerId: updatedOrder.customerId,
        timestamp: new Date().toISOString(),
        type: ActivityType.OrderStatusChanged,
        description: `เปลี่ยนสถานะออเดอร์ ${updatedOrder.id} จาก '${originalOrder.orderStatus}' เป็น '${updatedOrder.orderStatus}'`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`
      });
    }
  
    if (originalOrder.paymentStatus !== updatedOrder.paymentStatus && updatedOrder.paymentStatus === PaymentStatus.Paid) {
      activitiesToAdd.push({
        id: Date.now() + Math.random(),
        customerId: updatedOrder.customerId,
        timestamp: new Date().toISOString(),
        type: ActivityType.PaymentVerified,
        description: `ยืนยันการชำระเงินสำหรับออเดอร์ ${updatedOrder.id}`,
        actorName: `${currentUser.firstName} ${currentUser.lastName}`
      });
    }
    
    const originalTracking = new Set(originalOrder.trackingNumbers);
    const newTracking = updatedOrder.trackingNumbers.filter(t => t && !originalTracking.has(t));
    if (newTracking.length > 0) {
        activitiesToAdd.push({
            id: Date.now() + Math.random(),
            customerId: updatedOrder.customerId,
            timestamp: new Date().toISOString(),
            type: ActivityType.TrackingAdded,
            description: `เพิ่ม Tracking [${newTracking.join(', ')}] ในออเดอร์ ${updatedOrder.id}`,
            actorName: `${currentUser.firstName} ${currentUser.lastName}`
        });
    }
  
    if (activitiesToAdd.length > 0) {
      setActivities(prev => [...activitiesToAdd, ...prev]);
    }
    if (true) {
      try {
        const payload: any = {
          paymentStatus: (updatedOrder.paymentStatus as any) ?? undefined,
          amountPaid: (updatedOrder as any).amountPaid ?? null,
          codAmount: (updatedOrder as any).codAmount ?? null,
          notes: updatedOrder.notes ?? null,
        };
        if (typeof (updatedOrder as any).slipUrl !== 'undefined') payload.slipUrl = (updatedOrder as any).slipUrl;
        if (updatedOrder.orderStatus) payload.orderStatus = updatedOrder.orderStatus as any;
        if (updatedOrder.trackingNumbers && updatedOrder.trackingNumbers.length) payload.trackingNumbers = updatedOrder.trackingNumbers;
        await apiPatchOrder(updatedOrder.id, { ...payload, orderStatus: payload.orderStatus ? toApiOrderStatus(updatedOrder.orderStatus as any) : undefined, paymentStatus: payload.paymentStatus ? toApiPaymentStatus(updatedOrder.paymentStatus as any) : undefined });

        // If order is fully completed (Paid + Delivered), grant sale quota (+90 cap)
        if (updatedOrder.paymentStatus === PaymentStatus.Paid && updatedOrder.orderStatus === OrderStatus.Delivered) {
          try {
            await recordSale(updatedOrder.customerId);
            const updated = await getCustomerOwnershipStatus(updatedOrder.customerId);
            if (updated && updated.ownership_expires) {
              setCustomers(prev => prev.map(c => c.id === updatedOrder.customerId ? { ...c, ownershipExpires: updated.ownership_expires } : c));
            }
          } catch (e) {
            console.error('record sale / refresh ownership failed', e);
          }
        }
      } catch (e) {
        console.error('PATCH order failed', e);
      }
    }

    setOrders(prevOrders => prevOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    closeModal();
  };

  const handleCancelOrder = async (orderId: string) => {
    if(window.confirm('คุณต้องการยกเลิกออเดอร์นี้ใช่หรือไม่?')) {
        const orderToCancel = orders.find(o => o.id === orderId);
        if (orderToCancel && orderToCancel.orderStatus === OrderStatus.Pending) {
             const newActivity: Activity = {
                id: Date.now() + Math.random(),
                customerId: orderToCancel.customerId,
                timestamp: new Date().toISOString(),
                type: ActivityType.OrderCancelled,
                description: `ยกเลิกออเดอร์ ${orderId}`,
                actorName: `${currentUser.firstName} ${currentUser.lastName}`
            };
            if (true) {
              try {
                await createActivity({
                  customerId: newActivity.customerId,
                  timestamp: newActivity.timestamp,
                  type: newActivity.type,
                  description: newActivity.description,
                  actorName: newActivity.actorName
                });
              } catch (e) {
                console.error('Failed to create activity', e);
              }
            }
            setActivities(prev => [newActivity, ...prev]);
            if (true) {
              try { await apiPatchOrder(orderId, { orderStatus: 'Cancelled' }); } catch (e) { console.error('cancel API', e); }
            }
            setOrders(prevOrders => prevOrders.map(o => 
                o.id === orderId ? { ...o, orderStatus: OrderStatus.Cancelled } : o
            ));
        }
    }
  };

  const handleProcessOrders = async (orderIds: string[]) => {
      const activitiesToAdd: Activity[] = [];
      setOrders(prevOrders => {
          const updated = prevOrders.map(o => {
              if (orderIds.includes(o.id) && o.orderStatus === OrderStatus.Pending) {
                  activitiesToAdd.push({
                      id: Date.now() + Math.random(),
                      customerId: o.customerId,
                      timestamp: new Date().toISOString(),
                      type: ActivityType.OrderStatusChanged,
                      description: `เปลี่ยนสถานะออเดอร์ ${o.id} จาก '${OrderStatus.Pending}' เป็น '${OrderStatus.Picking}'`,
                      actorName: `${currentUser.firstName} ${currentUser.lastName}`
                  });
                  return { ...o, orderStatus: OrderStatus.Picking };
              }
              return o;
          });
          if(activitiesToAdd.length > 0) {
            if (true) {
              activitiesToAdd.forEach(activity => {
                createActivity({
                  customerId: activity.customerId,
                  timestamp: activity.timestamp,
                  type: activity.type,
                  description: activity.description,
                  actorName: activity.actorName
                }).catch(e => {
                  console.error('Failed to create activity', e);
                });
              });
            }
            setActivities(prev => [...activitiesToAdd, ...prev]);
          }
          return updated;
      });
      if (true) {
        for (const id of orderIds) {
          try { await apiPatchOrder(id, { orderStatus: 'Picking' }); } catch (e) { console.error('batch patch', e); }
        }
      }
  };

  const handleBulkUpdateTracking = async (updates: { orderId: string, trackingNumber: string }[]) => {
    const activitiesToAdd: Activity[] = [];
    const patchPromises: Promise<any>[] = [];
    setOrders(prevOrders => {
      const updatedOrdersMap = new Map(prevOrders.map(o => [o.id, o]));
      
      updates.forEach(update => {
        const orderToUpdate = updatedOrdersMap.get(update.orderId);
        if (orderToUpdate) {
          const existingTrackingNumbers = (orderToUpdate as Order).trackingNumbers || [];
          if (!existingTrackingNumbers.includes(update.trackingNumber)) {
            activitiesToAdd.push({
                id: Date.now() + Math.random(),
                customerId: (orderToUpdate as Order).customerId,
                timestamp: new Date().toISOString(),
                type: ActivityType.TrackingAdded,
                description: `เพิ่ม Tracking ${update.trackingNumber} สำหรับออเดอร์ ${update.orderId}`,
                actorName: `${currentUser.firstName} ${currentUser.lastName}`
            });

            const newOrderState: Order = {
              ...(orderToUpdate as Order),
              trackingNumbers: [...existingTrackingNumbers, update.trackingNumber],
              orderStatus: (orderToUpdate as Order).orderStatus === OrderStatus.Picking ? OrderStatus.Shipping : (orderToUpdate as Order).orderStatus,
            };

            if ((orderToUpdate as Order).orderStatus === OrderStatus.Picking) {
                activitiesToAdd.push({
                    id: Date.now() + Math.random(),
                    customerId: (orderToUpdate as Order).customerId,
                    timestamp: new Date().toISOString(),
                    type: ActivityType.OrderStatusChanged,
                    description: `เปลี่ยนสถานะออเดอร์ ${update.orderId} จาก '${OrderStatus.Picking}' เป็น '${OrderStatus.Shipping}'`,
                    actorName: `${currentUser.firstName} ${currentUser.lastName}`
                });
            }
            updatedOrdersMap.set(update.orderId, newOrderState);
            if (true) {
              const deduped = Array.from(new Set(newOrderState.trackingNumbers.filter(Boolean)));
              patchPromises.push(apiPatchOrder(update.orderId, { trackingNumbers: deduped }));
            }
          }
        }
      });
      return Array.from(updatedOrdersMap.values());
    });
    if (activitiesToAdd.length > 0) {
        if (true) {
          activitiesToAdd.forEach(activity => {
            createActivity({
              customerId: activity.customerId,
              timestamp: activity.timestamp,
              type: activity.type,
              description: activity.description,
              actorName: activity.actorName
            }).catch(e => {
              console.error('Failed to create activity', e);
            });
          });
        }
        setActivities(prev => [...activitiesToAdd, ...prev]);
    }
    if (true && patchPromises.length) {
      try { await Promise.all(patchPromises); } catch (e) { console.error('bulk tracking patch', e); }
    }
  };
  
  const handleCreateOrder = async (payload: { 
    order: Partial<Omit<Order, 'id' | 'orderDate' | 'companyId' | 'creatorId'>>,
    newCustomer?: Omit<Customer, 'id' | 'companyId' | 'totalPurchases' | 'totalCalls' | 'tags' | 'assignmentHistory'>,
    customerUpdate?: Partial<Pick<Customer, 'address' | 'facebookName' | 'lineId'>> 
  }) => {
    const { order: newOrderData, newCustomer: newCustomerData, customerUpdate } = payload;
    let customerIdForOrder = newOrderData.customerId;

    if (newCustomerData && newCustomerData.phone) {
        const newCustomerId = `CUS-${newCustomerData.phone.substring(1)}`;
        
        const newCustomer: Customer = {
          ...newCustomerData,
          id: newCustomerId,
          companyId: currentUser.companyId,
          assignedTo: currentUser.id,
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
            assignedTo: currentUser.id,
            dateAssigned: newCustomer.dateAssigned,
            dateRegistered: new Date().toISOString(),
            followUpDate: null,
            ownershipExpires: new Date(Date.now() + 30*24*3600*1000).toISOString(),
            lifecycleStatus: newCustomer.lifecycleStatus ?? CustomerLifecycleStatus.New,
            behavioralStatus: newCustomer.behavioralStatus ?? CustomerBehavioralStatus.Cold,
            grade: newCustomer.grade ?? CustomerGrade.D,
            totalPurchases: 0,
            totalCalls: 0,
            facebookName: newCustomer.facebookName ?? null,
            lineId: newCustomer.lineId ?? null,
            address: newCustomer.address ?? {},
          });
          console.log('Customer created successfully:', newCustomer.id);
        } catch (e) { 
          console.error('create customer API failed', e);
          alert('เกิดข้อผิดพลาดในการสร้างลูกค้าใหม่ กรุณาลองใหม่อีกครั้ง');
          return; // Don't proceed with order creation if customer creation fails
        }
        setCustomers(prev => [newCustomer, ...prev]);
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
      notes: newOrderData.notes,
      boxes: newOrderData.boxes,
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
    };
    
    console.log('Sending order payload:', orderPayload);
    
    try {
      const result = await apiCreateOrder(orderPayload);
      console.log('Order created successfully:', newOrder.id, 'API response:', result);
      
      // Refresh orders from API to get the latest data
      try {
        const freshOrders = await listOrders();
        
        // Helper functions for mapping API data
        const fromApiOrderStatus = (s: any): OrderStatus => {
          switch (String(s)) {
            case 'Pending': return OrderStatus.Pending as any;
            case 'Picking': return OrderStatus.Picking as any;
            case 'Shipping': return OrderStatus.Shipping as any;
            case 'Delivered': return OrderStatus.Delivered as any;
            case 'Returned': return OrderStatus.Returned as any;
            case 'Cancelled': return OrderStatus.Cancelled as any;
            default: return OrderStatus.Pending as any;
          }
        };
        const fromApiPaymentStatus = (s: any): PaymentStatus => {
          switch (String(s)) {
            case 'Unpaid': return PaymentStatus.Unpaid as any;
            case 'PendingVerification': return PaymentStatus.PendingVerification as any;
            case 'Paid': return PaymentStatus.Paid as any;
            default: return PaymentStatus.Unpaid as any;
          }
        };
        
        const mappedOrders = Array.isArray(freshOrders) ? freshOrders.map(o => ({
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
          shippingCost: parseFloat(o.shipping_cost || '0'),
          billDiscount: parseFloat(o.bill_discount || '0'),
          totalAmount: parseFloat(o.total_amount || '0'),
          paymentMethod: o.payment_method as PaymentMethod,
          paymentStatus: fromApiPaymentStatus(o.payment_status),
          orderStatus: fromApiOrderStatus(o.order_status),
          trackingNumbers: o.tracking_numbers ? o.tracking_numbers.split(',').filter(t => t.trim()) : [],
          notes: o.notes,
          boxes: [], // Will be loaded separately if needed
        })) : [];
        setOrders(mappedOrders);
        console.log('Orders refreshed from API');
      } catch (refreshError) {
        console.error('Failed to refresh orders:', refreshError);
        // Fallback to local state update
        setOrders(prevOrders => [newOrder, ...prevOrders]);
      }
    } catch (e) { 
      console.error('create order API failed', e);
      alert('เกิดข้อผิดพลาดในการสร้างออเดอร์ กรุณาลองใหม่อีกครั้ง');
      return; // Don't add to local state if API fails
    }

    const newActivity: Activity = {
      id: Date.now() + Math.random(),
      customerId: newOrder.customerId,
      timestamp: new Date().toISOString(),
      type: ActivityType.OrderCreated,
      description: `สร้างออเดอร์ใหม่ ${newOrder.id}`,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`
    };
    try {
      await createActivity({
        customerId: newActivity.customerId,
        timestamp: newActivity.timestamp,
        type: newActivity.type,
        description: newActivity.description,
        actorName: newActivity.actorName
      });
      console.log('Activity created successfully');
    } catch (e) {
      console.error('Failed to create activity', e);
      // Don't show alert for activity creation failure as it's not critical
    }
    setActivities(prev => [newActivity, ...prev]);

    // Update customer lifecycle status when an order is created
    // If customer is in FollowUp status, transition to Old3Months
    const customer = customers.find(c => c.id === customerIdForOrder);
    if (customer && customer.lifecycleStatus === CustomerLifecycleStatus.FollowUp) {
      setCustomers(prev => prev.map(c => 
        c.id === customerIdForOrder
        ? { 
            ...c, 
            lifecycleStatus: CustomerLifecycleStatus.Old3Months
          } 
        : c
      ));
      
      if (true) {
        try {
          await updateCustomer(customerIdForOrder, {
            lifecycleStatus: CustomerLifecycleStatus.Old3Months
          });
        } catch (e) {
          console.error('update customer lifecycle status after order creation', e);
        }
      }
    }

    // Note: Do NOT grant sale here. Sale quota (+90) is granted when order is Paid + Delivered.

    if (customerUpdate && customerIdForOrder) {
        setCustomers(prev => prev.map(c => 
            c.id === customerIdForOrder
            ? { ...c, ...customerUpdate }
            : c
        ));
    }

    closeModal();
    setActivePage('แดชบอร์ด'); // Go back to dashboard after creating
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
      } catch (e) { console.error('update customer API failed', e); }
    }
    setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
    closeModal();
  };
  
  const handleTakeCustomer = (customerToTake: Customer) => {
    if (window.confirm(`คุณต้องการรับลูกค้า "${customerToTake.firstName} ${customerToTake.lastName}" มาดูแลใช่หรือไม่?`)) {
        setCustomers(prev => prev.map(c => 
            c.id === customerToTake.id 
            ? { 
                ...c, 
                assignedTo: currentUser.id,
                lifecycleStatus: CustomerLifecycleStatus.FollowUp,
                dateAssigned: new Date().toISOString(),
              } 
            : c
        ));
    }
  };

  const handleSaveCustomer = (
    customerData: Omit<Customer, 'id' | 'companyId' | 'totalPurchases' | 'totalCalls' | 'tags'> & { ownershipDays?: number }
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
      
      setCustomers(prev => [newCustomer, ...prev]);
      return newCustomer;
  };


  const handleSaveUser = async (userToSave: Omit<User, 'id' | 'customTags'> | User) => {
    try {
      if ('id' in userToSave) {
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
        Object.keys(payload).forEach(k => (payload as any)[k] === undefined && delete (payload as any)[k]);
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
          teamId: typeof updated.team_id !== 'undefined' && updated.team_id !== null ? Number(updated.team_id) : undefined,
          supervisorId: typeof updated.supervisor_id !== 'undefined' && updated.supervisor_id !== null ? Number(updated.supervisor_id) : undefined,
          customTags: [],
        } as any;
        setUsers(prev => prev.map(u => u.id === mapped.id ? mapped : u));
      } else {
        const created = await apiCreateUser({
          username: userToSave.username,
          password: userToSave.password || '',
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
          teamId: typeof created.team_id !== 'undefined' && created.team_id !== null ? Number(created.team_id) : undefined,
          supervisorId: typeof created.supervisor_id !== 'undefined' && created.supervisor_id !== null ? Number(created.supervisor_id) : undefined,
          customTags: [],
        } as any;
        setUsers(prev => [...prev, mapped]);
      }
      closeModal();
    } catch (e) {
      console.error('Failed to save user via API', e);
      alert('บันทึกผู้ใช้ไปยังระบบไม่สำเร็จ (API)');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    try {
      await apiDeleteUser(userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      closeModal();
    } catch (e) {
      console.error('Failed to delete user via API', e);
      alert('ลบผู้ใช้จากระบบไม่สำเร็จ (อาจมีการอ้างอิงข้อมูลอื่น)');
    }
  };

  const handleSaveProduct = (productToSave: Omit<Product, 'id'> | Product) => {
    setProducts(prev => {
        if ('id' in productToSave) {
            return prev.map(p => p.id === productToSave.id ? productToSave : p);
        } else {
            const newId = Math.max(...prev.map(p => p.id), 0) + 1;
            return [...prev, { ...productToSave, id: newId }];
        }
    });
    closeModal();
  };

  const handleDeleteProduct = (productId: number) => {
    setProducts(prev => prev.filter(p => p.id !== productId));
    closeModal();
  };

  const handleLogCall = async (callLogData: Omit<CallHistory, 'id'>, customerId: string, newFollowUpDate?: string, newTags?: string[]) => {
    const newCallLog: CallHistory = {
        ...callLogData,
        id: Math.max(...callHistory.map(c => c.id), 0) + 1,
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
          duration: callLogData.duration,
        });
      } catch (e) { console.error('create call API failed', e); }
    }
    setCallHistory(prev => [newCallLog, ...prev]);

    // Determine the new lifecycle status based on the business rules
    let newLifecycleStatus: CustomerLifecycleStatus | undefined;
    
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      // If there's a follow-up date, set status to FollowUp
      if (newFollowUpDate) {
        newLifecycleStatus = CustomerLifecycleStatus.FollowUp;
      } 
      // If this is the first call and there's no follow-up, transition from New to Old
      else if (customer.lifecycleStatus === CustomerLifecycleStatus.New && customer.totalCalls === 0) {
        newLifecycleStatus = CustomerLifecycleStatus.Old;
      }
    }

    setCustomers(prev => 
        prev.map(c => {
            if (c.id === customerId) {
                let updatedCustomerTags: Tag[] = [...c.tags];
                if (newTags && newTags.length > 0) {
                    const existingTagNames = new Set(updatedCustomerTags.map(t => t.name));
                    const tagsToAdd: Tag[] = newTags
                        .filter(tagName => !existingTagNames.has(tagName))
                        .map(tagName => ({ // Create new USER tags on the fly. This won't be added to user's palette but will appear on customer.
                            id: Date.now() + Math.random(),
                            name: tagName,
                            type: TagType.User
                        }));
                    updatedCustomerTags = [...updatedCustomerTags, ...tagsToAdd];
                }
                
                const updatedCustomer = { 
                    ...c, 
                    totalCalls: c.totalCalls + 1,
                    followUpDate: newFollowUpDate || c.followUpDate,
                    tags: updatedCustomerTags,
                };
                
                // Update lifecycle status if needed
                if (newLifecycleStatus) {
                    updatedCustomer.lifecycleStatus = newLifecycleStatus;
                }
                
                return updatedCustomer;
            }
            return c;
        })
    );
    
    if (true) {
      try {
        const updateData: any = { 
          totalCalls: customer ? customer.totalCalls + 1 : 1 
        };
        
        if (newFollowUpDate) {
          updateData.followUpDate = newFollowUpDate;
        }
        
        if (newLifecycleStatus) {
          updateData.lifecycleStatus = newLifecycleStatus;
        }
        
        await updateCustomer(customerId, updateData);
      } catch (e) { console.error('update customer call data', e); }
    }
    
    if (newFollowUpDate) {
        const newAppointment: Appointment = {
            id: Math.max(...appointments.map(a => a.id), 0) + 1,
            customerId: customerId,
            date: newFollowUpDate,
            title: `โทรติดตามผล (${callLogData.result})`,
            status: 'รอดำเนินการ',
            notes: callLogData.notes || `สร้างอัตโนมัติจากการบันทึกการโทร`,
        };
        if (true) {
          try { await createAppointment({ customerId, date: newFollowUpDate, title: newAppointment.title, status: 'รอดำเนินการ', notes: newAppointment.notes }); } catch (e) { console.error('create appointment API failed', e); }
        }
        setAppointments(prev => [newAppointment, ...prev]);
        try {
          await recordFollowUp(customerId);
          const updated = await getCustomerOwnershipStatus(customerId);
          if (updated && updated.ownership_expires) {
            setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, ownershipExpires: updated.ownership_expires } : c));
          }
        } catch (e) {
          console.error('record follow-up / refresh ownership failed', e);
        }
    }
    
    const newActivity: Activity = {
      id: Date.now(),
      customerId: customerId,
      timestamp: new Date().toISOString(),
      type: ActivityType.CallLogged,
      description: `บันทึกการโทร: ${callLogData.result}`,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`
    };
    if (true) {
      try {
        await createActivity({
          customerId: newActivity.customerId,
          timestamp: newActivity.timestamp,
          type: newActivity.type,
          description: newActivity.description,
          actorName: newActivity.actorName
        });
      } catch (e) {
        console.error('Failed to create activity', e);
      }
    }
    setActivities(prev => [newActivity, ...prev]);

    closeModal();
  };

  const handleCreateAppointment = async (appointmentData: Omit<Appointment, 'id'>) => {
    const newAppointment: Appointment = {
        ...appointmentData,
        id: Math.max(...appointments.map(a => a.id), 0) + 1,
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
      } catch (e) { console.error('create appointment API failed', e); }
    }
    setAppointments(prev => [newAppointment, ...prev]);
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
      } catch (e) { console.error('update appointment API failed', e); }
    }
    setAppointments(prev => prev.map(a => a.id === updatedAppointment.id ? updatedAppointment : a));
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
        console.error('add customer tag API failed', e);
      }
    }
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, tags: [...c.tags, newTag] } : c));
  };

  const handleRemoveCustomerTag = async (customerId: string, tagId: number) => {
    if (true) {
      try {
        await removeCustomerTag(customerId, tagId);
      } catch (e) {
        console.error('remove customer tag API failed', e);
      }
    }
    setCustomers(prev => prev.map(c => c.id === customerId ? { ...c, tags: c.tags.filter(t => t.id !== tagId) } : c));
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
        console.error('create tag API failed', e);
      }
    }
    return newTag;
  };

  const handleCreateActivity = async (activityData: Omit<Activity, 'id'>) => {
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
      } catch (e) { console.error('create activity API failed', e); }
    }
    setActivities(prev => [newActivity, ...prev]);
  };
  
  const handleAddAppointment = async (appointmentData: Omit<Appointment, 'id' | 'status'>) => {
    const newAppointment: Appointment = {
        ...appointmentData,
        id: Math.max(...appointments.map(a => a.id), 0) + 1,
        status: 'รอดำเนินการ',
    };
    if (true) {
      try {
        await createAppointment({
          customerId: appointmentData.customerId,
          date: appointmentData.date,
          title: appointmentData.title,
          status: 'รอดำเนินการ',
          notes: appointmentData.notes,
        });
      } catch (e) {
        console.error('create appt API failed', e);
      }
    }
    setAppointments(prev => [newAppointment, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    
    // Update customer lifecycle status to FollowUp when creating an appointment
    setCustomers(prev => 
      prev.map(c => {
        if (c.id === appointmentData.customerId) {
          return { 
            ...c, 
            followUpDate: appointmentData.date,
            lifecycleStatus: CustomerLifecycleStatus.FollowUp
          };
        }
        return c;
      })
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
          const updated = await getCustomerOwnershipStatus(appointmentData.customerId);
          if (updated && updated.ownership_expires) {
            setCustomers(prev => prev.map(c => c.id === appointmentData.customerId ? { ...c, ownershipExpires: updated.ownership_expires } : c));
          }
        } catch (e) {
          console.error('refresh ownership after follow-up', e);
        }
      } catch (e) {
        console.error('update customer followUp', e);
      }
    }
    
    const newActivity: Activity = {
      id: Date.now() + Math.random(),
      customerId: appointmentData.customerId,
      timestamp: new Date().toISOString(),
      type: ActivityType.AppointmentSet,
      description: `สร้างนัดหมาย: ${appointmentData.title}`,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`
    };
    if (true) {
      try {
        await createActivity({
          customerId: newActivity.customerId,
          timestamp: newActivity.timestamp,
          type: newActivity.type,
          description: newActivity.description,
          actorName: newActivity.actorName
        });
      } catch (e) {
        console.error('Failed to create activity', e);
      }
    }
    setActivities(prev => [newActivity, ...prev]);

    closeModal();
  };
  
  const handleCompleteAppointment = async (appointmentId: number) => {
    const appointmentToUpdate = appointments.find(a => a.id === appointmentId);
    if (!appointmentToUpdate) return;
    
    const updatedAppointment = {
      ...appointmentToUpdate,
      status: 'เสร็จสิ้น'
    };
    
    if (true) {
      try {
        await updateAppointment(appointmentId, { status: 'เสร็จสิ้น' });
      } catch (e) {
        console.error('update appointment API failed', e);
        // If API fails, still update local state
        setAppointments(prev => 
          prev.map(a => a.id === appointmentId ? updatedAppointment : a)
        );
        return;
      }
    }
    
    setAppointments(prev => 
      prev.map(a => a.id === appointmentId ? updatedAppointment : a)
    );
    
    // Check if customer has any remaining pending appointments
    const customerAppointments = appointments.filter(a => 
      a.customerId === appointmentToUpdate.customerId && 
      a.id !== appointmentId
    );
    
    const hasPendingAppointments = customerAppointments.some(a => a.status !== 'เสร็จสิ้น');
    
    // If no pending appointments, update customer lifecycle status
    if (!hasPendingAppointments) {
      setCustomers(prev => 
        prev.map(c => {
          if (c.id === appointmentToUpdate.customerId) {
            // Determine the new lifecycle status based on business rules
            let newLifecycleStatus = c.lifecycleStatus;
            
            // If the customer was in FollowUp status and now has no pending appointments,
            // transition based on their previous status and actions
            if (c.lifecycleStatus === CustomerLifecycleStatus.FollowUp) {
              // Check if customer has any orders (sold)
              // Include both existing orders and newly created orders in this session
              const customerOrders = orders.filter(o => o.customerId === c.id);
              if (customerOrders.length > 0) {
                newLifecycleStatus = CustomerLifecycleStatus.Old3Months;
              } else {
                newLifecycleStatus = CustomerLifecycleStatus.Old;
              }
            }
            
            return { 
              ...c, 
              followUpDate: undefined,
              lifecycleStatus: newLifecycleStatus
            };
          }
          return c;
        })
      );
      
      if (true) {
        try {
          // Update customer in the database
          const customer = customers.find(c => c.id === appointmentToUpdate.customerId);
          if (customer) {
            let updateData: any = { followUpDate: null };
            
            // Determine the new lifecycle status based on business rules
            let newLifecycleStatus = customer.lifecycleStatus;
            if (customer.lifecycleStatus === CustomerLifecycleStatus.FollowUp) {
              // Check if customer has any orders (sold)
              // Include both existing orders and newly created orders in this session
              const customerOrders = orders.filter(o => o.customerId === customer.id);
              if (customerOrders.length > 0) {
                newLifecycleStatus = CustomerLifecycleStatus.Old3Months;
              } else {
                newLifecycleStatus = CustomerLifecycleStatus.Old;
              }
              updateData.lifecycleStatus = newLifecycleStatus;
            }
            
            await updateCustomer(appointmentToUpdate.customerId, updateData);
          }
        } catch (e) {
          console.error('update customer after appointment completion', e);
        }
      }
    }
    
    const newActivity: Activity = {
      id: Date.now() + Math.random(),
      customerId: appointmentToUpdate.customerId,
      timestamp: new Date().toISOString(),
      type: ActivityType.AppointmentSet,
      description: `นัดหมาย "${appointmentToUpdate.title}" ถูกทำเครื่องหมายว่าเสร็จสิ้น`,
      actorName: `${currentUser.firstName} ${currentUser.lastName}`
    };
    if (true) {
      try {
        await createActivity({
          customerId: newActivity.customerId,
          timestamp: newActivity.timestamp,
          type: newActivity.type,
          description: newActivity.description,
          actorName: newActivity.actorName
        });
      } catch (e) {
        console.error('Failed to create activity', e);
      }
    }
    setActivities(prev => [newActivity, ...prev]);
  };

  const handleAddTagToCustomer = async (customerId: string, tag: Tag) => {
    let persistedTag: Tag = tag;
    if (true) {
      try {
        const created = await createTag({ name: tag.name, type: tag.type || TagType.User });
        if (created && created.id) {
          persistedTag = { ...tag, id: Number(created.id) };
        }
      } catch (e) { console.error('create tag', e); }
      try { await addCustomerTag(customerId, persistedTag.id); } catch (e) { console.error('add tag', e); }
    }
    setCustomers(prev => prev.map(c => {
        if (c.id === customerId && !c.tags.some(t => t.id === tag.id)) {
            return { ...c, tags: [...c.tags, persistedTag] };
        }
        return c;
    }));
  };

  const handleRemoveTagFromCustomer = async (customerId: string, tagId: number) => {
      if (true) {
        try { await removeCustomerTag(customerId, tagId); } catch (e) { console.error('remove tag', e); }
      }
      setCustomers(prev => prev.map(c => {
          if (c.id === customerId) {
              return { ...c, tags: c.tags.filter(t => t.id !== tagId) };
          }
          return c;
      }));
  };

  const handleCreateUserTag = (tagName: string): Tag | null => {
    let newTag: Tag | null = null;
    setUsers(prev => {
        return prev.map(u => {
            if (u.id === currentUser.id) {
                if (u.customTags.length >= 10) {
                    alert('คุณสร้าง Tag ส่วนตัวได้สูงสุด 10 Tag เท่านั้น');
                    return u;
                }
                const existingTag = [...systemTags, ...u.customTags].find(t => t.name.toLowerCase() === tagName.toLowerCase());
                if (existingTag) {
                    alert('มี Tag นี้อยู่แล้ว');
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
  
  const handleImportSales = () => {
      // This is a placeholder for the complex sales import logic.
      // In a real application, this would process a file, update customers and orders.
      console.log('Importing sales...');
      alert('ฟังก์ชันนำเข้ายอดขายกำลังอยู่ในระหว่างการพัฒนา');
  };

  const handleImportCustomers = () => {
      // This is a placeholder for the customer import logic.
      console.log('Importing customers...');
      alert('ฟังก์ชันนำเข้าลูกค้ากำลังอยู่ในระหว่างการพัฒนา');
  };

  const renderPage = () => {
    if (currentUser.role === UserRole.Backoffice && activePage === 'Export History') {
      return <ExportHistoryPage />;
    }
    if (viewingCustomer) {
      return <CustomerDetailPage 
        customer={viewingCustomer}
        orders={companyOrders.filter(o => o.customerId === viewingCustomer.id)}
        callHistory={callHistory.filter(c => c.customerId === viewingCustomer.id)} 
        appointments={appointments.filter(a => a.customerId === viewingCustomer.id)}
        activities={activities.filter(a => a.customerId === viewingCustomer.id)}
        onClose={handleCloseCustomerDetail}
        openModal={openModal}
        user={currentUser}
        systemTags={systemTags}
        onAddTag={handleAddTagToCustomer}
        onRemoveTag={handleRemoveTagFromCustomer}
        onCreateUserTag={handleCreateUserTag}
        onCompleteAppointment={handleCompleteAppointment}
      />;
    }

    // Global entries: simple, international dashboards for layout-only views
    if (activePage === 'Sales Overview') {
      return <SalesDashboard orders={companyOrders} customers={companyCustomers} />;
    }
    if (activePage === 'Calls Overview') {
      return <CallsDashboard calls={callHistory} />;
    }

    // New, neutral sidebar labels mapping with role guard
    if (activePage === 'Dashboard') {
      if (currentUser.role === UserRole.Backoffice) {
        return <BackofficeDashboard user={currentUser} orders={companyOrders} customers={companyCustomers} openModal={openModal} />;
      }
      if (currentUser.role === UserRole.Telesale || currentUser.role === UserRole.Supervisor) {
        return <TelesaleSummaryDashboard user={currentUser} customers={companyCustomers} orders={companyOrders} activities={activities} openModal={() => openModal('createOrder')} />;
      }
      return <AdminDashboard user={currentUser} orders={companyOrders} customers={companyCustomers} openCreateOrderModal={() => openModal('createOrder')} />;
    }
    const superOnly = new Set(['Data Management', 'Permissions', 'Teams', 'Pages', 'Tags', 'Users', 'Products']);
    if (superOnly.has(activePage) && currentUser.role !== UserRole.SuperAdmin) {
      return <div className="p-6 text-red-600">Not authorized</div>;
    }
    if (activePage === 'Users') {
      return <UserManagementPage users={companyUsers} openModal={openModal} currentUser={currentUser} allCompanies={companies} />;
    }
    if (activePage === 'Products') {
      return <ProductManagementPage products={companyProducts} openModal={openModal} currentUser={currentUser} allCompanies={companies} />;
    }
    if (activePage === 'Customers') {
      if (currentUser.role === UserRole.Telesale || currentUser.role === UserRole.Supervisor) {
        return (
          <TelesaleDashboard
            user={currentUser}
            customers={companyCustomers}
            appointments={appointments}
            activities={activities}
            onViewCustomer={handleViewCustomer}
            openModal={openModal}
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
    if (activePage === 'Search') {
      return <CustomerSearchPage customers={companyCustomers} orders={companyOrders} users={companyUsers} currentUser={currentUser} onTakeCustomer={handleTakeCustomer} />;
    }
    if (activePage === 'Share') {
      return <CustomerDistributionPage allCustomers={companyCustomers} allUsers={companyUsers} setCustomers={setCustomers} />;
    }
    if (activePage === 'Data') {
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
    if (activePage === 'Data Management') {
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
    if (activePage === 'Permissions') {
      return <PermissionsPage />;
    }
    if (activePage === 'Teams') {
      return <TeamsManagementPage users={companyUsers} />;
    }
    if (activePage === 'Pages') {
      return <PagesManagementPage pages={pages} currentUser={currentUser} />;
    }
    if (activePage === 'Tags') {
      return <TagsManagementPage systemTags={systemTags} users={companyUsers} />;
    }
    if (activePage === 'Team') {
      if (currentUser.role === UserRole.Supervisor) {
        return <SupervisorTeamPage user={currentUser} allUsers={users} allCustomers={companyCustomers} allOrders={companyOrders} />;
      }
      return <TelesaleSummaryDashboard user={currentUser} customers={companyCustomers} orders={companyOrders} activities={activities} openModal={() => openModal('createOrder')} />;
    }
    if (activePage === 'Orders' || activePage === 'Manage Orders') {
      if (currentUser.role === UserRole.Backoffice || activePage === 'Manage Orders') {
        return <ManageOrdersPage user={currentUser} orders={companyOrders} customers={companyCustomers} users={companyUsers} openModal={openModal} onProcessOrders={handleProcessOrders} />;
      }
      return <TelesaleOrdersPage user={currentUser} orders={companyOrders} customers={companyCustomers} openModal={openModal} onCancelOrder={handleCancelOrder} />;
    }
    if (activePage === 'Debt') {
      return <DebtCollectionPage user={currentUser} orders={companyOrders} customers={companyCustomers} users={companyUsers} openModal={openModal} />;
    }
    if (activePage === 'Reports') {
      return <ReportsPage orders={companyOrders} />;
    }
    if (activePage === 'Bulk Tracking') {
      return <BulkTrackingPage orders={companyOrders} onBulkUpdateTracking={handleBulkUpdateTracking} />;
    }
    if (activePage === 'Call History' || activePage === 'ประวัติการโทร' || activePage === 'Dtac Onecall') {
      return <CallHistoryPage currentUser={currentUser} calls={callHistory} customers={companyCustomers} users={companyUsers} />;
    }

    switch (currentUser.role) {
      case UserRole.SuperAdmin:
      case UserRole.AdminControl:
          switch(activePage) {
              case 'แดชบอร์ด':
                return <AdminDashboard 
                            user={currentUser} 
                            orders={companyOrders} 
                            customers={companyCustomers} 
                            openCreateOrderModal={() => setActivePage('สร้างคำสั่งซื้อ')}
                        />;
              case 'สร้างคำสั่งซื้อ':
                return <CreateOrderPage
                            customers={companyCustomers}
                            products={companyProducts}
                            promotions={promotions}
                            pages={pages}
                            onSave={handleCreateOrder}
                            onCancel={() => setActivePage('แดชบอร์ด')}
                        />;
              case 'เพิ่มรายชื่อลูกค้า':
                return <AddCustomerPage
                            companyUsers={companyUsers}
                            onCancel={() => setActivePage('แดชบอร์ด')}
                            onSave={(customerData, andCreateOrder) => {
                                const newCustomer = handleSaveCustomer(customerData);
                                if (andCreateOrder) {
                                    setActivePage('สร้างคำสั่งซื้อ');
                                } else {
                                    setActivePage('แดชบอร์ด');
                                }
                            }}
                       />;
              case 'ระบบแจกลูกค้า':
                return <CustomerDistributionPage
                            allCustomers={companyCustomers}
                            allUsers={companyUsers}
                            setCustomers={setCustomers}
                       />;
              case 'จัดการผู้ใช้':
                return <UserManagementPage 
                            users={companyUsers} 
                            openModal={openModal} 
                            currentUser={currentUser} 
                            allCompanies={companies} 
                        />;
              case 'จัดการสินค้า':
                  return <ProductManagementPage 
                            products={companyProducts} 
                            openModal={openModal}
                            currentUser={currentUser}
                            allCompanies={companies}
                          />;
              case 'ค้นหาข้อมูลลูกค้า':
                  return <CustomerSearchPage 
                            customers={companyCustomers} 
                            orders={companyOrders} 
                            users={users} 
                            currentUser={currentUser}
                            onTakeCustomer={handleTakeCustomer}
                         />;
              case 'นำเข้าและส่งออกข้อมูล':
                    return <DataManagementPage
                                allUsers={companyUsers}
                                allCustomers={companyCustomers}
                                allOrders={companyOrders}
                                onImportSales={handleImportSales}
                                onImportCustomers={handleImportCustomers}
                           />;
              default:
                return <AdminDashboard user={currentUser} orders={companyOrders} customers={companyCustomers} openCreateOrderModal={() => openModal('createOrder')}/>;
          }

      case UserRole.Admin:
        switch(activePage) {
          case 'แดชบอร์ด':
             return <AdminDashboard 
                        user={currentUser} 
                        orders={companyOrders.filter(o => o.creatorId === currentUser.id)} 
                        customers={companyCustomers.filter(c => c.assignedTo === currentUser.id)} 
                        openCreateOrderModal={() => setActivePage('สร้างคำสั่งซื้อ')}
                    />;
          case 'สร้างคำสั่งซื้อ':
            return <CreateOrderPage
                        customers={companyCustomers}
                        products={companyProducts}
                        promotions={promotions}
                        pages={pages}
                        onSave={handleCreateOrder}
                        onCancel={() => setActivePage('แดชบอร์ด')}
                    />;
          case 'จัดการคำสั่งซื้อ':
            return <TelesaleOrdersPage user={currentUser} orders={companyOrders} customers={companyCustomers} openModal={openModal} title="ยอดขายของฉัน" onCancelOrder={handleCancelOrder} />;
          case 'ค้นหาข้อมูลลูกค้า':
            return <CustomerSearchPage 
                        customers={companyCustomers} 
                        orders={companyOrders} 
                        users={companyUsers}
                        currentUser={currentUser}
                        onTakeCustomer={handleTakeCustomer}
                    />;
          default:
             return <AdminDashboard user={currentUser} orders={companyOrders.filter(o => o.creatorId === currentUser.id)} customers={companyCustomers.filter(c => c.assignedTo === currentUser.id)} openCreateOrderModal={() => openModal('createOrder')}/>;
        }
        
      case UserRole.Telesale:
      case UserRole.Supervisor:
         switch(activePage) {
            case 'แดชบอร์ด':
                return <TelesaleSummaryDashboard user={currentUser} customers={companyCustomers} orders={companyOrders} activities={activities} openModal={() => setActivePage('สร้างคำสั่งซื้อ')} />;
            case 'สร้างคำสั่งซื้อ':
                return <CreateOrderPage
                            customers={companyCustomers}
                            products={companyProducts}
                            promotions={promotions}
                            pages={pages}
                            onSave={handleCreateOrder}
                            onCancel={() => setActivePage('แดชบอร์ด')}
                        />;
            case 'จัดการลูกค้า':
              return <TelesaleDashboard 
                        user={currentUser} 
                        customers={companyCustomers} 
                        appointments={appointments}
                        activities={activities}
                        onViewCustomer={handleViewCustomer} 
                        openModal={(type, data) => {
                          if (type === 'createOrder') {
                            setActivePage('สร้างคำสั่งซื้อ');
                          } else {
                            openModal(type, data);
                          }
                        }}
                        systemTags={systemTags}
                    />;
            case 'จัดการคำสั่งซื้อ':
              return <TelesaleOrdersPage user={currentUser} orders={companyOrders} customers={companyCustomers} openModal={openModal} onCancelOrder={handleCancelOrder} />;
            case 'ค้นหาข้อมูลลูกค้า':
              return <CustomerSearchPage 
                        customers={companyCustomers} 
                        orders={companyOrders} 
                        users={companyUsers} 
                        currentUser={currentUser}
                        onTakeCustomer={handleTakeCustomer}
                    />;
            case 'ดูแลทีม':
              return currentUser.role === UserRole.Supervisor 
                ? <SupervisorTeamPage user={currentUser} allUsers={users} allCustomers={companyCustomers} allOrders={companyOrders} /> 
                : <TelesaleDashboard 
                    user={currentUser} 
                    customers={companyCustomers} 
                    appointments={appointments}
                    activities={activities}
                    onViewCustomer={handleViewCustomer} 
                    openModal={openModal}
                    systemTags={systemTags} 
                  />;
            default:
              return <TelesaleSummaryDashboard user={currentUser} customers={companyCustomers} orders={companyOrders} activities={activities} openModal={() => openModal('createOrder')} />;
         }
        
      case UserRole.Marketing:
        // Dedicated marketing management page
        return <MarketingPage currentUser={currentUser} />;

      case UserRole.Backoffice:
        switch(activePage) {
            case 'แดชบอร์ด':
                return <BackofficeDashboard user={currentUser} orders={companyOrders} customers={companyCustomers} openModal={openModal} />;
            case 'จัดการออเดอร์':
                return <ManageOrdersPage user={currentUser} orders={companyOrders} customers={companyCustomers} users={companyUsers} openModal={openModal} onProcessOrders={handleProcessOrders} />;
            case 'นำเข้า Tracking':
                return <BulkTrackingPage orders={companyOrders} onBulkUpdateTracking={handleBulkUpdateTracking} />;
            case 'ติดตามหนี้':
                return <DebtCollectionPage user={currentUser} orders={companyOrders} customers={companyCustomers} users={companyUsers} openModal={openModal} />;
            case 'รายงาน':
                return <ReportsPage orders={companyOrders} />;
            case 'ค้นหาข้อมูลลูกค้า':
                return <CustomerSearchPage customers={companyCustomers} orders={companyOrders} users={companyUsers} />;
            default:
                return <BackofficeDashboard user={currentUser} orders={companyOrders} customers={companyCustomers} openModal={openModal} />;
        }
        
      default:
        return <div className="p-6">กรุณาเลือกบทบาทผู้ใช้</div>;
    }
  };
  
  const renderModal = () => {
      if (!modalState.type) return null;

      switch(modalState.type) {
          case 'manageOrder':
              return <OrderManagementModal 
                        order={modalState.data as Order} 
                        customers={customers}
                        activities={activities.filter(a => a.customerId === (modalState.data as Order).customerId)}
                        onSave={handleUpdateOrder} 
                        onClose={closeModal} 
                     />
          case 'createOrder':
              return <CreateOrderModal
                        customers={companyCustomers}
                        products={companyProducts}
                        onSave={handleCreateOrder}
                        onClose={() => {
                          closeModal();
                          setActivePage('แดชบอร์ด');
                        }}
                        initialData={modalState.data}
                     />
          case 'logCall':
            return <LogCallModal
              customer={modalState.data as Customer}
              user={currentUser}
              onSave={handleLogCall}
              onClose={closeModal}
            />
          case 'addAppointment':
            return <AppointmentModal
                customer={modalState.data as Customer}
                onSave={handleAddAppointment}
                onClose={closeModal}
            />
          case 'addUser':
          case 'editUser':
            return <UserManagementModal
              user={modalState.data as User | undefined}
              onSave={handleSaveUser}
              onClose={closeModal}
              currentUser={currentUser}
              allUsers={users}
              allCompanies={companies}
            />
          case 'addProduct':
          case 'editProduct':
            return <ProductManagementModal
              product={modalState.data as Product | undefined}
              onSave={handleSaveProduct}
              onClose={closeModal}
              companyId={currentUser.companyId}
            />
          case 'editCustomer':
            return <EditCustomerModal
              customer={modalState.data as Customer}
              onSave={handleUpdateCustomer}
              onClose={closeModal}
            />
          case 'confirmDelete':
            return <ConfirmDeleteModal
              itemName={modalState.data.name}
              onConfirm={() => modalState.data.type === 'user' ? handleDeleteUser(modalState.data.id) : handleDeleteProduct(modalState.data.id)}
              onClose={closeModal}
            />
          case 'manageTags':
            const currentCustomerState = customers.find(c => c.id === (modalState.data as Customer).id);
            if (!currentCustomerState) return null;
            
            return <TagManagementModal
              customer={currentCustomerState}
              user={currentUser}
              systemTags={systemTags}
              onAddTag={handleAddTagToCustomer}
              onRemoveTag={handleRemoveTagFromCustomer}
              onCreateUserTag={handleCreateUserTag}
              onClose={closeModal}
            />
          case 'viewAllActivities':
            return <ActivityLogModal
              customer={modalState.data as Customer}
              activities={activities.filter(a => a.customerId === (modalState.data as Customer).id)}
              onClose={closeModal}
            />
          default:
              return null;
      }
  }

  return (
    <div className="flex h-screen bg-[#F5F5F5]">
      {!viewingCustomer && <Sidebar 
        user={currentUser} 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
        onLogout={handleLogout}
        permissions={rolePermissions || undefined}
      />}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!viewingCustomer && <header className="flex justify-between items-center px-6 h-16 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="text-gray-600 lg:hidden">
                <Menu size={24}/>
            </button>
            <h1 className="text-xl font-semibold text-gray-800">{activePage}</h1>
          </div>
          <div className="flex items-center space-x-4">
             <div className="relative hidden">
              <select
                value={currentUserRole}
                onChange={(e) => {
                    setCurrentUserRole(e.target.value as UserRole);
                    setActivePage('แดชบอร์ด');
                    handleCloseCustomerDetail();
                }}
                className="appearance-none cursor-pointer bg-gray-100 border border-gray-200 text-gray-700 text-sm rounded-md focus:ring-green-500 focus:border-green-500 block w-full py-2 pl-3 pr-8"
              >
                <option value={UserRole.SuperAdmin}>Super Admin</option>
                <option value={UserRole.AdminControl}>Admin Control</option>
                <option value={UserRole.Admin}>Admin Page</option>
                <option value={UserRole.Telesale}>Telesale</option>
                <option value={UserRole.Supervisor}>Supervisor Telesale</option>
                <option value={UserRole.Backoffice}>Backoffice</option>
              </select>
              <ChevronsUpDown className="w-4 h-4 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
            <div className="relative">
                <button onClick={handleToggleNotificationPanel} className="relative p-2 rounded-full hover:bg-gray-100 text-gray-500">
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
        </header>}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#F5F5F5] relative">
          {renderPage()}
        </main>
      </div>
      {isNotificationPanelOpen && (
        <NotificationPanel
            notifications={visibleNotifications}
            onClose={() => setIsNotificationPanelOpen(false)}
            onMarkAllAsRead={handleMarkAllAsRead}
        />
       )}
      {renderModal()}
    </div>
  );
};

export default App;
        // Role permissions (menu visibility)
        try {
          const permData = (perms && (perms as any).data) || null;
          if (permData) {
            setRolePermissions(permData as any);
          } else {
            if ((sessionUser?.role ?? users[0]?.role) === UserRole.Backoffice) {
              setRolePermissions({ 'home.sales_overview': { view: false }, 'home.calls_overview': { view: false } });
            } else {
              setRolePermissions({});
            }
          }
        } catch {}
