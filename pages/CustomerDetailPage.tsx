import React, { useEffect, useMemo, useState } from "react";
import {
  Customer,
  Order,
  CallHistory,
  Appointment,
  ModalType,
  User,
  UserRole,
  Tag,
  TagType,
  CustomerLog,
  LineItem,
  Activity,
} from "../types";
// FIX: Add 'X', 'Repeat', 'Paperclip' icons to the import from 'lucide-react'.
import {
  ArrowLeft,
  Phone,
  Edit,
  MessageSquare,
  ShoppingCart,
  Check,
  Flame,
  Tag as TagIcon,
  Plus,
  Calendar,
  Briefcase,
  Facebook,
  MoreHorizontal,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Trash2,
  ChevronDown,
  ChevronUp,
  Zap,
  Loader2,
} from "lucide-react";
import { isSystemCheck } from "@/utils/isSystemCheck";
import { listRoles, Role } from "@/services/roleApi";
import APP_BASE_PATH from "../appBasePath";
import { getStatusChip, getPaymentStatusChip } from "../components/OrderTable";
import {
  createCustomerBlock,
  listCustomerLogs,
  getOrder,
  checkUpsellEligibility,
  listCallHistory,
  listAppointments,
  listOrders,
  updateCustomer,
  getCustomer
} from "@/services/api";
import {
  actionLabels,
  parseCustomerLogRow,
  summarizeCustomerLogChanges,
} from "../utils/customerLogs";
import { formatThaiDateTime, formatThaiDate } from "../utils/time";

interface CustomerDetailPageProps {
  customer: Customer;
  orders: Order[];
  callHistory: CallHistory[];
  appointments: Appointment[];
  activities: Activity[];
  user: User;
  allUsers: User[];
  systemTags: Tag[];
  onClose: () => void;
  openModal: (type: ModalType, data?: any) => void;
  onAddTag: (customerId: string, tag: Tag) => void;
  onRemoveTag: (customerId: string, tagId: number) => void;
  onCreateUserTag: (tagName: string) => Promise<Tag | null>;
  onCompleteAppointment?: (appointmentId: number, customerId?: string) => void;
  ownerName?: string;
  onStartCreateOrder?: (customer: Customer) => void;
  onUpsellClick?: (customer: Customer) => void;
  onChangeOwner?: (customerId: string, newOwnerId: number) => Promise<void> | void;
  customerCounts?: Record<number, number>;
  refreshTrigger?: number;
}

type ActiveTab = "calls" | "appointments" | "orders";

const InfoItem: React.FC<{
  label: string;
  value?: string | number;
  children?: React.ReactNode;
}> = ({ label, value, children }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    {value ? (
      <p className="text-sm font-medium text-gray-800 truncate">{value}</p>
    ) : (
      children
    )}
  </div>
);

const CustomerDetailPage: React.FC<CustomerDetailPageProps> = (props) => {
  const {
    customer,
    orders,
    callHistory,
    appointments,
    activities,
    user,
    allUsers,
    systemTags,
    onClose,
    openModal,
    onAddTag,
    onRemoveTag,
    onCreateUserTag,
    ownerName,
    onStartCreateOrder,
    onUpsellClick,
    onChangeOwner,
    customerCounts,
    refreshTrigger,
  } = props;
  const [activeTab, setActiveTab] = useState<ActiveTab>("calls");

  const [activityLogs, setActivityLogs] = useState<CustomerLog[]>([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  const [activityLogsError, setActivityLogsError] = useState<string | null>(
    null,
  );

  const [callHistoryPage, setCallHistoryPage] = useState(1);
  const [appointmentsPage, setAppointmentsPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const ITEMS_PER_PAGE = 8;
  const [orderDetails, setOrderDetails] = useState<
    Record<string, { items: LineItem[]; loading: boolean; error?: string }>
  >({});
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>([]);
  const [showOwnerChange, setShowOwnerChange] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | null>(null);
  const [ownerChangeError, setOwnerChangeError] = useState<string | null>(null);
  const [ownerChangeLoading, setOwnerChangeLoading] = useState(false);
  const [hasUpsell, setHasUpsell] = useState(false);
  const [upsellLoading, setUpsellLoading] = useState(true);

  // Basket change states
  const [roles, setRoles] = useState<Role[]>([]);
  const [basketConfigs, setBasketConfigs] = useState<{ id: number; basket_key: string; basket_name: string; target_page: string; is_active: number }[]>([]);
  const [showBasketChange, setShowBasketChange] = useState(false);
  const [selectedBasketKey, setSelectedBasketKey] = useState<string>('');
  const [basketChangeLoading, setBasketChangeLoading] = useState(false);
  const [basketChangeError, setBasketChangeError] = useState<string | null>(null);
  const [localBasketKey, setLocalBasketKey] = useState<number | string | undefined>(customer.current_basket_key);

  // Per-customer call history state (to bypass global sync limit)
  const [localCallHistory, setLocalCallHistory] = useState<CallHistory[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);

  // Per-customer appointments state (to bypass global sync limit)
  const [localAppointments, setLocalAppointments] = useState<Appointment[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);

  // Per-customer orders state (to bypass global sync limit)
  const [localOrders, setLocalOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [localTags, setLocalTags] = useState<any[]>(customer.tags || []);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Track order IDs that have upsell items (for immediate badge display)
  const [upsellDoneOrderIds, setUpsellDoneOrderIds] = useState<Set<string>>(new Set());

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

  // NOTE: Removed sync effect for callHistory
  // The fetch effect (listCallHistory) is the single source of truth now.
  // Previously, sync effect was conflicting with fetch effect causing race conditions.

  useEffect(() => {
    if (appointments.length > 0) {
      setLocalAppointments((prev) => {
        // Create a map of existing appointments by ID
        const localMap = new Map(prev.map((a) => [a.id, a]));
        let hasChanges = false;

        // Only update status for appointments that already exist in local state
        // Do NOT add new appointments from props - let the fetch useEffect handle that
        prev.forEach((p) => {
          const global = appointments.find((a) => a.id === p.id);
          if (global && global.status !== p.status) {
            localMap.set(p.id, { ...p, status: global.status });
            hasChanges = true;
          }
        });

        if (hasChanges) {
          return Array.from(localMap.values());
        }
        return prev;
      });
    }
  }, [appointments]);

  useEffect(() => {
    if (orders.length > 0) {
      setLocalOrders((prev) => {
        const prevIds = new Set(prev.map((o) => o.id));
        const newItems = orders.filter((o) => !prevIds.has(o.id));
        if (newItems.length > 0) {
          return [...newItems, ...prev];
        }
        return prev;
      });
    }
  }, [orders]);

  // Fetch roles and basket configs for system check
  useEffect(() => {
    listRoles().then(res => setRoles(res.roles || [])).catch(() => { });
    fetch(`${APP_BASE_PATH}api/basket_config.php?company_id=1`)
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : (data.data || data.baskets || []);
        setBasketConfigs(list);
      }).catch(() => { });
  }, []);

  // Sync localBasketKey when customer prop changes
  useEffect(() => {
    setLocalBasketKey(customer.current_basket_key);
  }, [customer.current_basket_key]);

  const isSystem = useMemo(() => isSystemCheck(user.role, roles), [user.role, roles]);

  const currentBasketConfig = useMemo(() => {
    if (!localBasketKey) return null;
    return basketConfigs.find(b => String(b.id) === String(localBasketKey)) || null;
  }, [localBasketKey, basketConfigs]);

  const handleBasketChange = async () => {
    if (!selectedBasketKey) return;
    setBasketChangeLoading(true);
    setBasketChangeError(null);
    try {
      const customerIdToUpdate = customer.pk ? String(customer.pk) : customer.id;
      await updateCustomer(customerIdToUpdate, { current_basket_key: Number(selectedBasketKey) });
      setLocalBasketKey(Number(selectedBasketKey));
      setShowBasketChange(false);
    } catch (e: any) {
      setBasketChangeError(e.message || 'ไม่สามารถเปลี่ยนตะกร้าได้');
    } finally {
      setBasketChangeLoading(false);
    }
  };

  const usersById = useMemo(() => {
    const map = new Map<number, User>();
    allUsers.forEach((userItem) => {
      map.set(userItem.id, userItem);
    });
    return map;
  }, [allUsers]);

  // Compatibility map for both number and string lookups
  const usersByIdAny = useMemo(() => {
    const map = new Map<number | string, User>();
    allUsers.forEach((userItem) => {
      map.set(userItem.id, userItem);
      map.set(String(userItem.id), userItem);
    });
    return map;
  }, [allUsers]);

  // Fetch call history for this customer
  useEffect(() => {
    let mounted = true;
    const cid = customer.id || String(customer.pk);
    if (!cid) return;

    setCallsLoading(true);
    listCallHistory({ customerId: cid, pageSize: 500 })
      .then((res) => {
        if (!mounted) return;
        const data = Array.isArray(res) ? res : (res?.data || []);
        setLocalCallHistory(data.map(mapCall));
      })
      .catch((err) => {
        console.error("Failed to fetch call history for customer", cid, err);
      })
      .finally(() => {
        if (mounted) setCallsLoading(false);
      });

    return () => { mounted = false; };
  }, [customer.id, customer.pk, refreshTrigger]);

  // Fetch latest tags on refresh
  useEffect(() => {
    let mounted = true;
    getCustomer(customer.id).then((res: any) => {
      if (mounted && res && res.tags) {
        setLocalTags(res.tags);
      }
    });
    return () => { mounted = false; };
  }, [customer.id, refreshTrigger]);

  // Fetch appointments for this customer
  useEffect(() => {
    let mounted = true;
    const cid = customer.pk ? String(customer.pk) : customer.id;
    if (!cid) return;

    setAppointmentsLoading(true);
    listAppointments({ customerId: cid, pageSize: 500 })
      .then((res: any) => {
        if (!mounted) return;
        const data = Array.isArray(res) ? res : (res?.data || res || []);
        const mapped: Appointment[] = data.map((r: any) => ({
          id: Number(r.id), // Ensure ID is a number for onCompleteAppointment
          customerId: r.customer_id,
          date: r.date,
          title: r.title,
          status: r.status,
          notes: r.notes ?? undefined,
        }));
        setLocalAppointments(mapped);
      })
      .catch((err) => {
        console.error("Failed to fetch appointments for customer", cid, err);
      })
      .finally(() => {
        if (mounted) setAppointmentsLoading(false);
      });

    return () => { mounted = false; };
  }, [customer.id, customer.pk, refreshTrigger]);

  // Fetch orders for this customer
  useEffect(() => {
    let mounted = true;
    const cid = customer.pk ? String(customer.pk) : customer.id;
    if (!cid) return;

    setOrdersLoading(true);
    // Use phone to search for orders since orders use different customer ID schemes
    listOrders({ customerPhone: customer.phone, pageSize: 100 })
      .then((res: any) => {
        if (!mounted) return;
        const orderData = res?.orders || [];
        // Map API response to Order type
        const mapped: Order[] = orderData.map((o: any) => ({
          id: o.id,
          customerId: o.customer_id,
          creatorId: o.creator_id,
          orderDate: o.order_date,
          deliveryDate: o.delivery_date,
          totalAmount: parseFloat(o.total_amount || 0),
          discountAmount: parseFloat(o.discount_amount || 0),
          discountPercent: parseFloat(o.discount_percent || 0),
          netAmount: parseFloat(o.net_amount || 0),
          orderStatus: o.order_status,
          paymentStatus: o.payment_status,
          paymentMethod: o.payment_method,
          trackingNumber: o.tracking_number,
          notes: o.notes,
        }));
        setLocalOrders(mapped);
      })
      .catch((err) => {
        console.error("Failed to fetch orders for customer", cid, err);
      })
      .finally(() => {
        if (mounted) setOrdersLoading(false);
      });

    return () => { mounted = false; };
  }, [customer.id, customer.pk, customer.phone, refreshTrigger]);

  // Auto-fetch items for Pending orders to check upsell status immediately
  useEffect(() => {
    const pendingOrders = localOrders.filter(o => o.orderStatus === 'Pending');
    if (pendingOrders.length === 0) return;

    const checkUpsellForOrders = async () => {
      const upsellOrderIds = new Set<string>();

      for (const order of pendingOrders) {
        try {
          const response = await getOrder(order.id);
          const items = response?.items ?? [];
          // Check if any item has different creator_id than order creator
          const hasUpsellItems = items.some(
            (item: any) => item.creator_id && order.creatorId && String(item.creator_id) !== String(order.creatorId)
          );
          if (hasUpsellItems) {
            upsellOrderIds.add(order.id);
          }
        } catch (err) {
          // Ignore errors, just don't show badge for this order
        }
      }

      setUpsellDoneOrderIds(upsellOrderIds);
    };

    checkUpsellForOrders();
  }, [localOrders]);

  // Check upsell eligibility
  useEffect(() => {
    let mounted = true;
    setUpsellLoading(true);
    setHasUpsell(false);
    const checkUpsell = async () => {
      try {
        const customerId = customer.id || customer.customerId || customer.customerRefId;
        if (!customerId) {
          setHasUpsell(false);
          setUpsellLoading(false);
          return;
        }
        const result = await checkUpsellEligibility(customerId, user?.id);
        if (mounted) {
          setHasUpsell(result.hasEligibleOrders);
          setUpsellLoading(false);
        }
      } catch (error) {
        console.error("Error checking upsell eligibility:", error);
        if (mounted) {
          setHasUpsell(false);
          setUpsellLoading(false);
        }
      }
    };

    checkUpsell();
    // Re-check every 30 seconds
    const interval = setInterval(checkUpsell, 30000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [customer.id, customer.customerId, customer.customerRefId, user?.id, refreshTrigger]);

  const eligibleOwners = useMemo(() => {
    // SuperAdmin can see everyone (or restrict if needed, but usually full access)
    if (user.role === UserRole.SuperAdmin) {
      return allUsers;
    }

    // Base: Always same company for others
    const sameCompanyUsers = allUsers.filter(
      (candidate) => candidate.companyId === user.companyId
    );

    // 1. Telesale: Can only transfer to their OWN Supervisor
    if (user.role === UserRole.Telesale) {
      return sameCompanyUsers.filter(
        (candidate) => candidate.id === user.supervisorId
      );
    }

    // 2. Supervisor (Super Telesale): 
    //    - Other Supervisors in same company (candidate.role === Supervisor)
    //    - Their own team members (candidate.supervisorId === user.id)
    if (user.role === UserRole.Supervisor) {
      return sameCompanyUsers.filter((candidate) => {
        // Exclude self (handled later in filteredEligibleOwners too, but safe here)
        if (candidate.id === user.id) return false; // Usually we want to see self?? No, transfer "to".

        // Logic: Target is Supervisor (same company) OR Target is my subordinate
        const isSameCompanySupervisor = candidate.role === UserRole.Supervisor;
        const isMySubordinate = candidate.supervisorId === user.id;

        return isSameCompanySupervisor || isMySubordinate;
      });
    }

    // 3. Other roles (Admin, etc) -> See everyone in company? 
    // User didn't specify, but assuming full company access for Admin/Backoffice
    return sameCompanyUsers;
  }, [allUsers, user]);

  const filteredEligibleOwners = useMemo(
    () =>
      eligibleOwners.filter(
        (candidate) =>
          candidate.id !== user.id &&
          (candidate.role === UserRole.Supervisor ||
            candidate.role === UserRole.Telesale),
      ),
    [eligibleOwners, user.id],
  );

  const currentOwnerUser =
    customer.assignedTo != null ? usersById.get(customer.assignedTo) : null;

  const currentOwnerBaseName =
    currentOwnerUser
      ? `${currentOwnerUser.firstName} ${currentOwnerUser.lastName}`.trim()
      : ownerName ||
      (customer.assignedTo != null ? `ID ${customer.assignedTo}` : "-");

  const currentOwnerCustomerCount = currentOwnerUser
    ? customerCounts?.[currentOwnerUser.id] ?? 0
    : null;

  const currentOwnerName = currentOwnerBaseName;

  const canChangeOwner =
    Boolean(onChangeOwner) && filteredEligibleOwners.length > 0;

  const ownerGroups = useMemo(() => {
    const supervisors = filteredEligibleOwners.filter(
      (candidate) => candidate.role === UserRole.Supervisor,
    );
    const telesales = filteredEligibleOwners.filter(
      (candidate) => candidate.role === UserRole.Telesale,
    );
    const others = filteredEligibleOwners.filter(
      (candidate) =>
        candidate.role !== UserRole.Supervisor &&
        candidate.role !== UserRole.Telesale,
    );

    return [
      {
        key: "supervisors",
        label: "หัวหน้าทีม (Supervisor)",
        users: supervisors,
      },
      {
        key: "telesales",
        label: "ลูกทีม (Telesale)",
        users: telesales,
      },
      {
        key: "others",
        label: "บทบาทอื่น",
        users: others,
      },
    ].filter((group) => group.users.length > 0);
  }, [filteredEligibleOwners]);

  const formatOwnerOption = (candidate: User) => {
    const fullName = `${candidate.firstName} ${candidate.lastName}`.trim();
    return fullName;
  };

  useEffect(() => {
    if (!showOwnerChange) {
      return;
    }
    if (filteredEligibleOwners.length === 0) {
      setSelectedOwnerId(null);
      return;
    }
    if (
      selectedOwnerId == null ||
      !filteredEligibleOwners.some(
        (candidate) => candidate.id === selectedOwnerId,
      )
    ) {
      const defaultCandidate =
        filteredEligibleOwners.find(
          (candidate) => candidate.id !== customer.assignedTo,
        ) || filteredEligibleOwners[0];
      setSelectedOwnerId(defaultCandidate ? defaultCandidate.id : null);
    }
  }, [
    showOwnerChange,
    filteredEligibleOwners,
    selectedOwnerId,
    customer.assignedTo,
  ]);

  const handleToggleOwnerSelector = () => {
    if (!canChangeOwner) return;

    if (!showOwnerChange) {
      const defaultCandidate =
        filteredEligibleOwners.find(
          (candidate) => candidate.id !== customer.assignedTo,
        ) || filteredEligibleOwners[0];
      setSelectedOwnerId(defaultCandidate ? defaultCandidate.id : null);
    }

    setOwnerChangeError(null);
    setShowOwnerChange((prev) => !prev);
  };

  const handleConfirmOwnerChange = async () => {
    if (!onChangeOwner) {
      return;
    }

    if (selectedOwnerId == null) {
      setOwnerChangeError("กรุณาเลือกผู้ดูแลใหม่");
      return;
    }

    if (selectedOwnerId === customer.assignedTo) {
      setOwnerChangeError("กรุณาเลือกผู้ดูแลคนอื่น");
      return;
    }

    const isEligible = filteredEligibleOwners.some(
      (candidate) => candidate.id === selectedOwnerId,
    );

    if (!isEligible) {
      setOwnerChangeError("ไม่สามารถมอบหมายให้ผู้ใช้งานนี้ได้");
      return;
    }

    try {
      setOwnerChangeLoading(true);
      setOwnerChangeError(null);

      // Call API to update customer assigned_to
      const customerIdToUpdate = customer.pk ? String(customer.pk) : customer.id;
      const dateAssigned = new Date().toISOString();
      await updateCustomer(customerIdToUpdate, {
        assignedTo: selectedOwnerId,
        assigned_to: selectedOwnerId,
        dateAssigned,
        date_assigned: dateAssigned
      });

      // Call callback to update parent state
      if (onChangeOwner) {
        await Promise.resolve(onChangeOwner(customer.id, selectedOwnerId));
      }
      setShowOwnerChange(false);
    } catch (error) {
      console.error("Failed to change owner", error);
      const message =
        error instanceof Error ? error.message : "ไม่สามารถเปลี่ยนผู้ดูแลได้";
      setOwnerChangeError(message);
    } finally {
      setOwnerChangeLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    `฿${Number(value || 0).toLocaleString("th-TH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const calculateLineNet = (item: LineItem) => {
    const hasParent =
      typeof item.parentItemId !== "undefined" && item.parentItemId !== null;
    if (hasParent || item.isFreebie) {
      return 0;
    }
    const quantity = Number(item.quantity ?? 0);
    const price = Number(item.pricePerUnit ?? 0);
    const discount = Number(item.discount ?? 0);
    if (quantity <= 0 || price <= 0) return 0;
    const base = quantity * price - discount;
    return base > 0 ? base : 0;
  };

  // ฟังก์ชันสำหรับนับจำนวนโปรโมชั่นในออเดอร์
  const countPromotions = (items: LineItem[]): number => {
    return items.filter((item) => item.isPromotionParent).length;
  };

  const mapApiOrderItems = (items: any[]): LineItem[] => {
    if (!Array.isArray(items)) return [];

    const mappedItems = items.map((it: any, index: number) => ({
      id: Number(it.id ?? index + 1),
      productName: String(
        it.product_name ?? it.productName ?? `สินค้า ${index + 1}`,
      ),
      quantity: Number(it.quantity ?? 0),
      pricePerUnit: Number(it.price_per_unit ?? it.pricePerUnit ?? 0),
      discount: Number(it.discount ?? 0),
      isFreebie: Boolean(it.is_freebie ?? it.isFreebie ?? 0),
      boxNumber: Number(it.box_number ?? it.boxNumber ?? 0),
      productId:
        typeof it.product_id !== "undefined" && it.product_id !== null
          ? Number(it.product_id)
          : undefined,
      promotionId:
        typeof it.promotion_id !== "undefined" && it.promotion_id !== null
          ? Number(it.promotion_id)
          : undefined,
      parentItemId:
        typeof it.parent_item_id !== "undefined" && it.parent_item_id !== null
          ? Number(it.parent_item_id)
          : undefined,
      isPromotionParent: Boolean(
        it.is_promotion_parent ?? it.isPromotionParent ?? 0,
      ),
    }));

    // Sort items: promotion parents first, then their children, then regular items
    const sortedItems: LineItem[] = [];
    const processedItemIds = new Set<number>();

    // ค้นหาสินค้าหลักของโปรโมชั่นทั้งหมด
    const promotionParents = mappedItems.filter(
      (item) => item.isPromotionParent,
    );

    // เรียงลำดับสินค้าหลักของโปรโมชั่นตาม ID
    promotionParents.sort((a, b) => a.id - b.id);

    // สำหรับแต่ละสินค้าหลักของโปรโมชั่น เพิ่มสินค้าหลักแล้วตามด้วยสินค้าลูกทั้งหมด
    promotionParents.forEach((parent) => {
      // เพิ่มสินค้าหลักของโปรโมชั่น
      sortedItems.push(parent);
      processedItemIds.add(parent.id);

      // ค้นหาสินค้าลูกทั้งหมดของสินค้าหลักนี้ (ใช้ parentItemId)
      const children = mappedItems
        .filter(
          (child) =>
            child.parentItemId === parent.id &&
            !child.isPromotionParent &&
            child.id !== parent.id,
        )
        .sort((a, b) => a.id - b.id); // เรียงลำดับสินค้าลูกตาม ID

      // เพิ่มสินค้าลูกทั้งหมดต่อจากสินค้าหลักทันที
      children.forEach((child) => {
        sortedItems.push(child);
        processedItemIds.add(child.id);
      });
    });

    // เพิ่มสินค้าทั่วไปที่ไม่ใช่ส่วนของโปรโมชั่น
    const regularItems = mappedItems
      .filter((item) => !item.isPromotionParent && !item.parentItemId)
      .sort((a, b) => a.id - b.id);

    regularItems.forEach((item) => {
      if (!processedItemIds.has(item.id)) {
        sortedItems.push(item);
        processedItemIds.add(item.id);
      }
    });

    // จัดการกับสินค้าลูกที่ไม่มีสินค้าหลัก (กรณีข้อมูลไม่สมบูรณ์)
    const orphanedChildren = mappedItems
      .filter((item) => item.parentItemId && !processedItemIds.has(item.id))
      .sort((a, b) => a.id - b.id);

    sortedItems.push(...orphanedChildren);

    return sortedItems;
  };

  const handleToggleOrderDetails = (orderId: string) => {
    const wasExpanded = expandedOrderIds.includes(orderId);
    setExpandedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );

    if (wasExpanded) {
      return;
    }

    const current = orderDetails[orderId];
    if (current?.loading) {
      return;
    }
    if (current && current.items.length > 0 && !current.error) {
      return;
    }

    setOrderDetails((prev) => ({
      ...prev,
      [orderId]: {
        items: current?.items ?? [],
        loading: true,
        error: undefined,
      },
    }));

    getOrder(orderId)
      .then((response: any) => {
        const mappedItems = mapApiOrderItems(response?.items ?? []);
        setOrderDetails((prev) => ({
          ...prev,
          [orderId]: {
            items: mappedItems,
            loading: false,
            error: undefined,
          },
        }));
      })
      .catch((error) => {
        console.error("Failed to load order details", error);
        setOrderDetails((prev) => ({
          ...prev,
          [orderId]: {
            items: [],
            loading: false,
            error: "ไม่สามารถโหลดรายละเอียดสินค้าได้",
          },
        }));
      });
  };

  const getRemainingTime = (expiryDate: string) => {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return { text: "หมดอายุ", color: "text-red-500" };
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return {
      text: `${days} วัน`,
      color: days < 7 ? "text-orange-500" : "text-gray-600",
    };
  };

  const formatAddress = (address: Customer["address"]) => {
    if (!address || !address.street) return "-";
    return `${address.street}, ต.${address.subdistrict}, อ.${address.district}, จ.${address.province} ${address.postalCode}`;
  };



  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds} วินาทีที่แล้ว`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} นาทีที่แล้ว`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ชั่วโมงที่แล้ว`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} วันที่แล้ว`;
  };

  // Helper function to get contrasting text color (black or white)
  const getContrastColor = (hexColor: string): string => {
    // Remove # if present
    const color = hexColor.replace('#', '');
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    // Calculate brightness
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // Return black or white based on brightness
    return brightness > 128 ? '#000000' : '#FFFFFF';
  };

  // Filter activities for this customer
  const customerActivities = useMemo(() => {
    if (!activities || !Array.isArray(activities)) return [];
    return activities.filter(a =>
      a.customerId === customer.id ||
      a.customerId === String(customer.pk) ||
      (customer.pk && String(a.customerId) === String(customer.pk))
    );
  }, [activities, customer.id, customer.pk]);

  useEffect(() => {
    let cancelled = false;
    setActivityLogsLoading(true);
    setActivityLogsError(null);

    // Load customer_logs (for detailed change history)
    const customerIdForLogs = customer.pk ? String(customer.pk) : customer.id;
    listCustomerLogs(customerIdForLogs, { limit: 50 })
      .then((rows) => {
        if (cancelled) return;
        const normalized = Array.isArray(rows)
          ? rows.map((row: any) => parseCustomerLogRow(row))
          : [];
        setActivityLogs(normalized);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("Failed to load customer logs", error);
        setActivityLogs([]);
        setActivityLogsError("ไม่สามารถโหลดกิจกรรมล่าสุดได้");
      })
      .finally(() => {
        if (!cancelled) {
          setActivityLogsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customer.id, refreshTrigger]);

  const actionIcons: Record<CustomerLog["actionType"], React.ElementType> = {
    create: Plus,
    update: Edit,
    delete: Trash2,
  };

  const ActivityIcon = ({ action }: { action: CustomerLog["actionType"] }) => {
    const Icon = actionIcons[action] || MoreHorizontal;
    return <Icon className="w-4 h-4 text-gray-500" />;
  };

  const logEntries = useMemo(
    () =>
      activityLogs
        .map((log) => ({
          log,
          summaries: summarizeCustomerLogChanges(log, usersById),
        }))
        .filter((entry) => entry.summaries.length > 0),
    [activityLogs, usersById],
  );

  const recentLogEntries = useMemo(() => logEntries.slice(0, 5), [logEntries]);

  // Combine customer_logs and activities for display
  const allRecentActivities = useMemo(() => {
    const activityItems = customerActivities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
      .map(activity => ({
        id: `activity-${activity.id}`,
        timestamp: activity.timestamp,
        description: activity.description,
        actorName: activity.actorName,
        type: 'activity' as const,
      }));

    const logItems = recentLogEntries.map(({ log, summaries }) => ({
      id: `log-${log.id}`,
      timestamp: log.createdAt,
      description: summaries.join(', ') || '',
      actorName: allUsers.find(u => u.id === log.createdBy)?.firstName + ' ' + allUsers.find(u => u.id === log.createdBy)?.lastName || '',
      type: 'log' as const,
      actionType: log.actionType,
      summaries: summaries,
    }));

    return [...activityItems, ...logItems]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5);
  }, [customerActivities, recentLogEntries, allUsers]);

  const Paginator: React.FC<{
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  }> = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex justify-end items-center mt-4 text-xs">
        <span className="text-gray-600">
          หน้า {currentPage} / {totalPages}
        </span>
        <div className="flex ml-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-2 py-1 border bg-white rounded-l-md disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-2 py-1 border bg-white rounded-r-md disabled:opacity-50 hover:bg-gray-50"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  const effectiveCallHistory = localCallHistory.length > 0 ? localCallHistory : callHistory;
  const totalCallPages = Math.ceil(effectiveCallHistory.length / ITEMS_PER_PAGE);
  const paginatedCallHistory = effectiveCallHistory.slice(
    (callHistoryPage - 1) * ITEMS_PER_PAGE,
    callHistoryPage * ITEMS_PER_PAGE,
  );

  // Sort appointments by ID descending (newest first, regardless of date)
  const effectiveAppointments = (localAppointments.length > 0 ? localAppointments : appointments)
    .slice()
    .sort((a, b) => b.id - a.id);
  const totalAppointmentPages = Math.ceil(effectiveAppointments.length / ITEMS_PER_PAGE);
  const paginatedAppointments = effectiveAppointments.slice(
    (appointmentsPage - 1) * ITEMS_PER_PAGE,
    appointmentsPage * ITEMS_PER_PAGE,
  );

  const effectiveOrders = localOrders.length > 0 ? localOrders : orders;
  const totalOrderPages = Math.ceil(effectiveOrders.length / ITEMS_PER_PAGE);
  const paginatedOrders = effectiveOrders.slice(
    (ordersPage - 1) * ITEMS_PER_PAGE,
    ordersPage * ITEMS_PER_PAGE,
  );

  // Filter appointments to show only future follow-ups that are not completed
  const upcomingFollowUps = effectiveAppointments
    .filter((appointment) => {
      const appointmentDate = new Date(appointment.date);
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      // Show appointments that are between now and 7 days from now, and not completed
      return appointmentDate >= now && appointmentDate <= sevenDaysFromNow && appointment.status !== "เสร็จสิ้น";
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <header className="relative flex justify-between items-center mb-6">
        <div className="flex-1"></div>

        {/* Centered Upsell Button with Animation and Aura */}
        {hasUpsell && !upsellLoading && onUpsellClick && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative">
              {/* Aura/Glow Effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 rounded-lg blur-lg opacity-75 animate-pulse"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 rounded-lg animate-ping opacity-50"></div>

              {/* Actual Button */}
              <button
                onClick={() => onUpsellClick(customer)}
                className="relative bg-gradient-to-r from-red-600 to-orange-600 text-white py-3 px-6 rounded-lg text-base font-bold flex items-center justify-center hover:from-red-700 hover:to-orange-700 shadow-2xl animate-bounce"
                title="เพิ่มรายการในออเดอร์เดิม (Upsell)"
              >
                <Zap size={20} className="mr-2 animate-pulse" />
                UPSELL ด่วน!
              </button>
            </div>
          </div>
        )}

        {/* Upsell Done Badge - Show when has upsell items and still has Pending orders */}
        {!hasUpsell && !upsellLoading && upsellDoneOrderIds.size > 0 && localOrders.some(o => o.orderStatus === 'Pending') && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold bg-green-100 text-green-800 border border-green-300 shadow-md">
              <Check size={18} className="mr-2" />
              Upsell สำเร็จแล้ว!
            </div>
          </div>
        )}


        <button
          onClick={onClose}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft size={20} className="mr-2" />
          <span className="font-semibold text-lg">กลับ</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                ข้อมูลลูกค้า
              </h2>
              {customer.behavioralStatus === "Hot" && (
                <span className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center">
                  <Flame size={14} className="mr-1.5" />
                  Hot
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
              <InfoItem label="รหัสลูกค้า" value={customer.id} />
              <InfoItem
                label="ชื่อ-นามสกุล"
                value={`${customer.firstName} ${customer.lastName}`}
              />
              <InfoItem label="เบอร์โทร" value={customer.phone} />
              <InfoItem label="เบอร์โทรสำรอง" value={customer.backupPhone || "-"} />
              <InfoItem label="Facebook">
                <div className="flex items-center space-x-2">
                  <Facebook size={16} className="text-blue-600" />
                  <p className="text-sm font-medium text-gray-800">
                    {customer.facebookName || "-"}
                  </p>
                </div>
              </InfoItem>
              <InfoItem label="LINE ID">
                <div className="flex items-center space-x-2">
                  <MessageSquare size={16} className="text-green-500" />
                  <p className="text-sm font-medium text-gray-800">
                    {customer.lineId || "-"}
                  </p>
                </div>
              </InfoItem>
              <InfoItem label="🎂 วันเกิด">
                <div className="flex items-center space-x-2">
                  <span className="text-pink-400">🎂</span>
                  <p className="text-sm font-medium text-gray-800">
                    {customer.birthDate
                      ? new Date(customer.birthDate).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                      : "-"}
                  </p>
                </div>
              </InfoItem>
              <InfoItem
                label="ที่อยู่"
                value={formatAddress(customer.address)}
              />
              <InfoItem label="จังหวัด" value={customer.province} />
              <div className="md:col-span-3 border-t my-2"></div>
              <InfoItem label="เกรดลูกค้า" value={customer.grade} />
              <InfoItem
                label="ยอดซื้อรวม"
                value={`฿${effectiveOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString()}`}
              />
              <InfoItem
                label="จำนวนครั้งที่ซื้อ"
                value={`${effectiveOrders.length} ครั้ง`}
              />
              <InfoItem
                label="จำนวนครั้งที่ติดต่อ"
                value={`${Math.max(customer.totalCalls || 0, effectiveCallHistory.length)} ครั้ง`}
              />
              <InfoItem label="ผู้ดูแล">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-800 mr-2">
                    {currentOwnerName}
                  </span>
                  {canChangeOwner && (
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={handleToggleOwnerSelector}
                    >
                      (เปลี่ยนผู้ดูแล)
                    </button>
                  )}
                  {!canChangeOwner && user.role === UserRole.Telesale && !user.supervisorId && (
                    <span className="text-xs text-red-600 ml-2">
                      (ต้องตั้งค่าหัวหน้าทีมก่อน)
                    </span>
                  )}
                </div>
                {showOwnerChange && canChangeOwner && (
                  <div className="mt-2 space-y-2">
                    <select
                      className="w-full border rounded-md px-2 py-1 text-sm"
                      value={selectedOwnerId != null ? String(selectedOwnerId) : ""}
                      onChange={(event) => {
                        const value = event.target.value;
                        setSelectedOwnerId(value === "" ? null : Number(value));
                        setOwnerChangeError(null);
                      }}
                    >
                      <option value="">เลือกผู้ดูแลใหม่</option>
                      {ownerGroups.map((group) => (
                        <optgroup key={group.key} label={group.label}>
                          {group.users.map((candidate) => (
                            <option key={candidate.id} value={String(candidate.id)}>
                              {formatOwnerOption(candidate)}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    {ownerChangeError && (
                      <p className="text-xs text-red-600">{ownerChangeError}</p>
                    )}
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={handleConfirmOwnerChange}
                        className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={
                          ownerChangeLoading ||
                          selectedOwnerId == null ||
                          selectedOwnerId === customer.assignedTo
                        }
                      >
                        {ownerChangeLoading ? "กำลังบันทึก..." : "ยืนยัน"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowOwnerChange(false);
                          setOwnerChangeError(null);
                        }}
                        className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
                      >
                        ยกเลิก
                      </button>
                    </div>
                  </div>
                )}
              </InfoItem>

              {/* Basket Change - visible only for system roles */}
              {isSystem && (
                <InfoItem label="ตะกร้าปัจจุบัน">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-800 mr-2">
                      {currentBasketConfig ? currentBasketConfig.basket_name : (localBasketKey ? `ID: ${localBasketKey}` : '-')}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-blue-600 hover:underline"
                      onClick={() => {
                        setShowBasketChange(prev => !prev);
                        setSelectedBasketKey(localBasketKey ? String(localBasketKey) : '');
                        setBasketChangeError(null);
                      }}
                    >
                      (เปลี่ยนตะกร้า)
                    </button>
                  </div>
                  {showBasketChange && (
                    <div className="mt-2 space-y-2">
                      <select
                        className="w-full border rounded-md px-2 py-1 text-sm"
                        value={selectedBasketKey}
                        onChange={e => { setSelectedBasketKey(e.target.value); setBasketChangeError(null); }}
                      >
                        <option value="">เลือกตะกร้า</option>
                        {basketConfigs.filter(b => b.is_active).map(b => (
                          <option key={b.id} value={String(b.id)}>
                            {b.basket_name} ({b.target_page})
                          </option>
                        ))}
                      </select>
                      {basketChangeError && <p className="text-xs text-red-600">{basketChangeError}</p>}
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleBasketChange}
                          className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={basketChangeLoading || !selectedBasketKey || selectedBasketKey === String(localBasketKey)}
                        >
                          {basketChangeLoading ? <Loader2 size={12} className="animate-spin inline mr-1" /> : null}
                          {basketChangeLoading ? 'กำลังบันทึก...' : 'ยืนยัน'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setShowBasketChange(false); setBasketChangeError(null); }}
                          className="text-xs px-3 py-1 rounded border border-gray-300 hover:bg-gray-100"
                        >
                          ยกเลิก
                        </button>
                      </div>
                    </div>
                  )}
                </InfoItem>
              )}

              <InfoItem
                label="วันที่ลงทะเบียน"
                value={
                  customer.dateRegistered
                    ? formatThaiDateTime(customer.dateRegistered)
                    : "-"
                }
              />
              <InfoItem label="ติดตามถัดไป">
                {upcomingFollowUps.length > 0 ? (
                  <span className="font-semibold text-red-600 px-2 py-1 bg-red-50 rounded-md">
                    {formatThaiDateTime(upcomingFollowUps[0].date)}
                  </span>
                ) : (
                  "-"
                )}
              </InfoItem>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border">
            <div className="border-b px-4">
              <div className="flex items-center justify-between">
                <nav className="flex space-x-4 -mb-px">
                  <button
                    onClick={() => setActiveTab("calls")}
                    className={`py-3 px-1 text-sm font-medium ${activeTab === "calls" ? "border-b-2 border-green-600 text-green-600" : "border-transparent text-gray-600 hover:text-gray-700"}`}
                  >
                    <Phone size={16} className="inline mr-2" />
                    ประวัติการโทร
                    {effectiveCallHistory.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px]">
                        {effectiveCallHistory.length}
                      </span>
                    )}
                    {callsLoading && <span className="ml-1 animate-pulse">...</span>}
                  </button>
                  <button
                    onClick={() => setActiveTab("appointments")}
                    className={`py-3 px-1 text-sm font-medium ${activeTab === "appointments" ? "border-b-2 border-green-600 text-green-600" : "border-transparent text-gray-600 hover:text-gray-700"}`}
                  >
                    <Calendar size={16} className="inline mr-2" />
                    รายการนัดหมาย
                    {effectiveAppointments.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px]">
                        {effectiveAppointments.length}
                      </span>
                    )}
                    {appointmentsLoading && <span className="ml-1 animate-pulse">...</span>}
                  </button>
                  <button
                    onClick={() => setActiveTab("orders")}
                    className={`py-3 px-1 text-sm font-medium ${activeTab === "orders" ? "border-b-2 border-green-600 text-green-600" : "border-transparent text-gray-600 hover:text-gray-700"}`}
                  >
                    <ShoppingCart size={16} className="inline mr-2" />
                    ประวัติคำสั่งซื้อ
                    {effectiveOrders.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px]">
                        {effectiveOrders.length}
                      </span>
                    )}
                    {ordersLoading && <span className="ml-1 animate-pulse">...</span>}
                  </button>
                </nav>
              </div>
              <div className="p-4">
                <div className="overflow-x-auto">
                  {activeTab === "calls" && (
                    <>
                      <table className="w-full text-xs text-left">
                        <thead className="text-gray-500">
                          <tr>
                            <th className="py-2 px-2">วันที่</th>
                            <th className="py-2 px-2">ผู้โทร</th>
                            <th className="py-2 px-2">สถานะ</th>
                            <th className="py-2 px-2">ผลการโทร</th>
                            <th className="py-2 px-2">พืช/พันธุ์</th>
                            <th className="py-2 px-2">ขนาดสวน</th>
                            <th className="py-2 px-2">หมายเหตุ</th>
                          </tr>
                        </thead>
                        <tbody className="text-gray-700">
                          {paginatedCallHistory.map((c) => (
                            <tr key={c.id} className="border-b last:border-0">
                              <td className="py-2 px-2">
                                {formatThaiDateTime(c.date)}
                              </td>
                              <td className="py-2 px-2">{c.caller}</td>
                              <td className="py-2 px-2">
                                <span
                                  className={`px-2 py-0.5 rounded-full ${c.status === "รับสาย" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                                >
                                  {c.status}
                                </span>
                              </td>
                              <td className="py-2 px-2">{c.result}</td>
                              <td className="py-2 px-2">{c.cropType || "-"}</td>
                              <td className="py-2 px-2">{c.areaSize || "-"}</td>
                              <td
                                className="py-2 px-2 max-w-[200px] truncate"
                                title={c.notes || ""}
                              >
                                {c.notes || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table >
                      <Paginator
                        currentPage={callHistoryPage}
                        totalPages={totalCallPages}
                        onPageChange={setCallHistoryPage}
                      />
                    </>
                  )}
                  {
                    activeTab === "appointments" && (
                      <>
                        <table className="w-full text-xs text-left">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="py-2 px-2">วันที่นัดหมาย</th>
                              <th className="py-2 px-2">หัวข้อ</th>
                              <th className="py-2 px-2">สถานะ</th>
                              <th className="py-2 px-2">หมายเหตุ</th>
                              <th className="py-2 px-2">การดำเนินการ</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-700">
                            {paginatedAppointments.map((a) => (
                              <tr key={a.id} className="border-b last:border-0">
                                <td className="py-2 px-2">
                                  {formatThaiDateTime(a.date)}
                                </td>
                                <td className="py-2 px-2">{a.title}</td>
                                <td className="py-2 px-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-full ${a.status === "เสร็จสิ้น" ? "bg-gray-100 text-gray-700" : "bg-yellow-100 text-yellow-700"}`}
                                  >
                                    {a.status}
                                  </span>
                                </td>
                                <td
                                  className="py-2 px-2 max-w-[200px] truncate"
                                  title={a.notes || ""}
                                >
                                  {a.notes || "-"}
                                </td>
                                <td className="py-2 px-2">
                                  {a.status === "เสร็จสิ้น" ? (
                                    <Check
                                      size={16}
                                      className="text-green-600 inline mr-2"
                                    />
                                  ) : (
                                    props.onCompleteAppointment && (
                                      <button
                                        onClick={() => {
                                          console.log('Complete appointment clicked, ID:', a.id, 'Type:', typeof a.id);
                                          props.onCompleteAppointment!(Number(a.id), props.customer.id);
                                          // Update local state immediately for instant UI feedback
                                          setLocalAppointments((prev) =>
                                            prev.map((apt) =>
                                              apt.id === a.id ? { ...apt, status: "เสร็จสิ้น" } : apt
                                            )
                                          );
                                        }}
                                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                      >
                                        ทำเครื่องหมายเสร็จ
                                      </button>
                                    )
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <Paginator
                          currentPage={appointmentsPage}
                          totalPages={totalAppointmentPages}
                          onPageChange={setAppointmentsPage}
                        />
                      </>
                    )
                  }
                  {
                    activeTab === "orders" && (
                      <>
                        <table className="w-full text-xs text-left">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="py-2 px-2">OrderID</th>
                              <th className="py-2 px-2">วันที่สั่ง</th>
                              <th className="py-2 px-2">ผู้ขาย</th>
                              <th className="py-2 px-2 text-right">ยอดรวม</th>
                              <th className="py-2 px-2">ชำระเงิน</th>
                              <th className="py-2 px-2">สถานะ</th>
                              <th className="py-2 px-2">รายละเอียดสินค้า</th>
                            </tr>
                          </thead>
                          <tbody className="text-gray-700">
                            {paginatedOrders.map((o) => {
                              // Match seller by id (ensure type compatibility)
                              const seller = o.creatorId
                                ? usersByIdAny.get(o.creatorId)
                                : undefined;
                              const sellerName = seller
                                ? `${seller.firstName} ${seller.lastName}`
                                : o.creatorId
                                  ? `ID ${o.creatorId}`
                                  : "ไม่ระบุ";
                              const detail = orderDetails[o.id];
                              const isExpanded = expandedOrderIds.includes(o.id);
                              const items = detail?.items ?? [];
                              const itemCount = items.length;
                              const loading = detail?.loading;
                              const error = detail?.error;

                              // Check if order has upsell items (items with different creator_id than order creator)
                              const hasUpsellItems = items.some(
                                (item: any) => item.creator_id && o.creatorId && String(item.creator_id) !== String(o.creatorId)
                              );
                              // Use either pre-fetched state or computed from expanded items
                              const isUpsellDone = upsellDoneOrderIds.has(o.id) || hasUpsellItems;

                              return (
                                <React.Fragment key={o.id}>
                                  <tr className="border-b last:border-0">
                                    <td className="py-2 px-2 font-mono">{o.id}</td>
                                    <td className="py-2 px-2">
                                      {formatThaiDate(o.orderDate)}
                                    </td>
                                    <td className="py-2 px-2">{sellerName}</td>
                                    <td className="py-2 px-2 text-right">
                                      {formatCurrency(o.totalAmount)}
                                    </td>
                                    <td className="py-2 px-2">
                                      {getPaymentStatusChip(
                                        o.paymentStatus,
                                        o.paymentMethod,
                                      )}
                                    </td>
                                    <td className="py-2 px-2">
                                      <div className="flex items-center gap-1">
                                        {getStatusChip(o.orderStatus)}
                                        {isUpsellDone && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            <Check size={12} className="mr-0.5" />
                                            Upsell
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="py-2 px-2">
                                      <button
                                        onClick={() =>
                                          handleToggleOrderDetails(o.id)
                                        }
                                        className="inline-flex items-center text-xs text-blue-600 hover:underline"
                                      >
                                        {isExpanded ? (
                                          <ChevronUp size={14} className="mr-1" />
                                        ) : (
                                          <ChevronDown size={14} className="mr-1" />
                                        )}
                                        {isExpanded ? "ซ่อนสินค้า" : "ดูสินค้า"}
                                        {itemCount > 0 && !loading
                                          ? ` (${itemCount})`
                                          : ""}
                                      </button>
                                    </td>
                                  </tr>
                                  {isExpanded && (
                                    <tr className="bg-gray-50">
                                      <td colSpan={7} className="px-4 py-3">
                                        {loading ? (
                                          <div className="text-xs text-gray-500">
                                            กำลังโหลดรายละเอียดสินค้า...
                                          </div>
                                        ) : error ? (
                                          <div className="text-xs text-red-600">
                                            {error}
                                          </div>
                                        ) : items.length === 0 ? (
                                          <div className="text-xs text-gray-500">
                                            ไม่พบรายการสินค้า
                                          </div>
                                        ) : (
                                          <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-left">
                                              <thead className="text-gray-500 bg-white">
                                                <tr>
                                                  <th className="px-3 py-2">
                                                    สินค้า
                                                  </th>
                                                  <th className="px-3 py-2 text-right">
                                                    จำนวน
                                                  </th>
                                                  <th className="px-3 py-2 text-right">
                                                    ราคาต่อหน่วย
                                                  </th>
                                                  <th className="px-3 py-2 text-right">
                                                    ส่วนลด
                                                  </th>
                                                  <th className="px-3 py-2 text-right">
                                                    ยอดสุทธิ
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="text-gray-700">
                                                {items.map((item, index) => {
                                                  const isChild =
                                                    item.parentItemId != null &&
                                                    !item.isPromotionParent;
                                                  const isFreebie = Boolean(
                                                    item.isFreebie,
                                                  );

                                                  const net =
                                                    calculateLineNet(item);

                                                  // Check if this is the last item in a promotion group
                                                  const isLastInPromotion =
                                                    item.isPromotionParent &&
                                                    (() => {
                                                      const nextItem =
                                                        items[index + 1];
                                                      return (
                                                        !nextItem ||
                                                        nextItem.parentItemId !==
                                                        item.id
                                                      );
                                                    })();

                                                  // Check if this is a promotion subtotal row (last child or last parent without children)
                                                  const isPromotionSubtotal =
                                                    (isChild &&
                                                      (() => {
                                                        const nextItem =
                                                          items[index + 1];
                                                        return (
                                                          !nextItem ||
                                                          nextItem.parentItemId !==
                                                          item.parentItemId
                                                        );
                                                      })()) ||
                                                    isLastInPromotion;

                                                  return (
                                                    <tr
                                                      key={item.id}
                                                      className={`border-b last:border-0 ${item.isPromotionParent ? "bg-orange-100" : isChild ? "bg-orange-50" : ""}`}
                                                    >
                                                      <td
                                                        className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"}`}
                                                      >
                                                        <span className="font-medium text-gray-800">
                                                          {isChild ? "- " : ""}
                                                          {item.productName ||
                                                            `สินค้า ${item.id}`}
                                                        </span>
                                                        {item.isPromotionParent && (
                                                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px]">
                                                            ชุดโปรโมชั่น
                                                          </span>
                                                        )}
                                                        {isFreebie && (
                                                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px]">
                                                            ของแถม
                                                          </span>
                                                        )}
                                                      </td>
                                                      <td
                                                        className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"} text-right`}
                                                      >
                                                        {item.quantity.toLocaleString(
                                                          "th-TH",
                                                        )}
                                                      </td>
                                                      <td
                                                        className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"} text-right`}
                                                      >
                                                        {isFreebie
                                                          ? "—"
                                                          : formatCurrency(
                                                            item.pricePerUnit,
                                                          )}
                                                      </td>
                                                      <td
                                                        className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"} text-right`}
                                                      >
                                                        {isFreebie
                                                          ? "—"
                                                          : formatCurrency(
                                                            item.discount,
                                                          )}
                                                      </td>
                                                      <td
                                                        className={`px-3 ${isPromotionSubtotal ? "py-4" : "py-2"} text-right font-medium text-gray-800`}
                                                      >
                                                        {isChild ? (
                                                          <div>
                                                            {formatCurrency(net)}
                                                            <div className="text-[10px] text-gray-500 italic">
                                                              รวมในชุด
                                                            </div>
                                                          </div>
                                                        ) : isFreebie ? (
                                                          <span className="text-[10px] text-gray-500 italic">
                                                            ของแถม
                                                          </span>
                                                        ) : (
                                                          <div>
                                                            {formatCurrency(net)}
                                                            {isPromotionSubtotal &&
                                                              item.isPromotionParent && (
                                                                <div className="text-xs text-orange-600 font-semibold mt-1">
                                                                  ยอดรวมชุดโปรโมชั่น
                                                                </div>
                                                              )}
                                                          </div>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                                <tr className="bg-white">
                                                  <td
                                                    colSpan={4}
                                                    className="px-3 py-2 text-right font-semibold text-gray-700"
                                                  >
                                                    ยอดรวมสินค้า
                                                  </td>
                                                  <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                                    {formatCurrency(
                                                      items.reduce((sum, item) => {
                                                        // เพิ่มเฉพาะ promotion parent และ regular items (ไม่รวมสินค้าลูกใน promotion)
                                                        if (
                                                          item.isPromotionParent ||
                                                          (!item.isPromotionParent &&
                                                            !item.promotionId)
                                                        ) {
                                                          return (
                                                            sum +
                                                            calculateLineNet(item)
                                                          );
                                                        }
                                                        return sum;
                                                      }, 0),
                                                    )}
                                                  </td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                        <Paginator
                          currentPage={ordersPage}
                          totalPages={totalOrderPages}
                          onPageChange={setOrdersPage}
                        />
                      </>
                    )
                  }
                </div >
              </div >
            </div >
          </div >
        </div >

        {/* Right Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Action Buttons Container */}
          <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-wrap gap-2 justify-center">
            <button
              onClick={() => openModal("logCall", customer)}
              className="bg-green-100 text-green-700 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center hover:bg-green-200 flex-1 whitespace-nowrap"
            >
              <Phone size={14} className="mr-1.5" />
              บันทึกโทร
            </button>
            <button
              onClick={() => openModal("addAppointment", customer)}
              className="bg-cyan-100 text-cyan-700 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center hover:bg-cyan-200 flex-1 whitespace-nowrap"
            >
              <Calendar size={14} className="mr-1.5" />
              นัดหมาย
            </button>
            <button
              onClick={() => {
                if (onStartCreateOrder) {
                  onStartCreateOrder(customer);
                } else {
                  openModal("createOrder", { customer });
                }
              }}
              className="bg-amber-100 text-amber-700 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center hover:bg-amber-200 flex-1 whitespace-nowrap"
            >
              <ShoppingCart size={14} className="mr-1.5" />
              สั่งซื้อ
            </button>
            <button
              onClick={() => openModal("editCustomer", customer)}
              className="bg-slate-700 text-white py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center hover:bg-slate-800 flex-1 whitespace-nowrap"
            >
              <Edit size={14} className="mr-1.5" />
              แก้ไข
            </button>
            <button
              onClick={async () => {
                if ((customer as any).isBlocked) return;
                const ok = window.confirm(
                  "คุณแน่ใจหรือไม่ว่าต้องการบล็อคลูกค้ารายนี้?",
                );
                if (!ok) return;
                const reason =
                  window.prompt(
                    "กรุณาระบุเหตุผลในการบล็อค (อย่างน้อย 5 ตัวอักษร)",
                  ) || "";
                if (!reason || reason.trim().length < 5) {
                  alert("กรุณากรอกเหตุผลอย่างน้อย 5 ตัวอักษร");
                  return;
                }
                try {
                  await (
                    await import("../services/api")
                  ).createCustomerBlock({
                    customerId: customer.id,
                    reason: reason.trim(),
                    blockedBy: user.id,
                  });
                  alert("บล็อคลูกค้าเรียบร้อย");
                  window.location.reload();
                } catch (e) {
                  console.error("block customer failed", e);
                  alert("บล็อคลูกค้าไม่สำเร็จ");
                }
              }}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center flex-1 whitespace-nowrap ${(customer as any).isBlocked ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-red-100 text-red-700 hover:bg-red-200"}`}
            >
              <ShieldAlert size={14} className="mr-1.5" /> บล็อค
            </button>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h3 className="font-semibold mb-4 text-gray-700">สถิติสรุป</h3>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {effectiveOrders.length}
                </p>
                <p className="text-xs text-gray-500">คำสั่งซื้อ</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  ฿{effectiveOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">ยอดซื้อรวม</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {effectiveCallHistory.length}
                </p>
                <p className="text-xs text-gray-500">การโทร</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {effectiveAppointments.length}
                </p>
                <p className="text-xs text-gray-500">นัดหมาย</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {logEntries.length}
                </p>
                <p className="text-xs text-gray-500">กิจกรรม</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-semibold mb-2 text-gray-700">TAG</h3>
            <div className="flex flex-wrap gap-2 mb-2 min-h-[24px]">
              {localTags.map((tag) => {
                const tagColor = tag.color || '#9333EA';
                const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
                const textColor = getContrastColor(bgColor);
                return (
                  <span
                    key={tag.id}
                    className="flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: bgColor, color: textColor }}
                  >
                    {tag.name}
                    <button
                      onClick={() => onRemoveTag(customer.id, tag.id)}
                      className="ml-1.5 opacity-70 hover:opacity-100"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="mt-2">
              <button
                onClick={() => openModal("manageTags", customer)}
                className="w-full bg-white text-gray-700 py-2 px-3 rounded-md text-xs font-medium hover:bg-gray-50 border border-gray-300 border-dashed flex items-center justify-center transition-colors"
              >
                <TagIcon size={14} className="mr-1.5 text-gray-400" />
                จัดการ Tag
              </button>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow-sm border">
            <h3 className="font-semibold mb-2 text-gray-700">กิจกรรมล่าสุด</h3>
            {activityLogsLoading && (
              <div className="text-sm text-gray-500">กำลังโหลดกิจกรรม...</div>
            )}
            {!activityLogsLoading && activityLogsError && (
              <div className="text-sm text-red-600">{activityLogsError}</div>
            )}
            {!activityLogsLoading &&
              !activityLogsError &&
              allRecentActivities.length === 0 && (
                <div className="text-sm text-gray-500">ยังไม่มีกิจกรรม</div>
              )}
            {!activityLogsLoading &&
              !activityLogsError &&
              allRecentActivities.length > 0 && (
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-xs text-left border border-gray-100 rounded-md overflow-hidden">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-[11px]">
                      <tr>
                        <th className="px-3 py-2">เวลา</th>
                        <th className="px-3 py-2">กิจกรรม</th>
                        <th className="px-3 py-2">รายละเอียด</th>
                        <th className="px-3 py-2">ผู้ทำ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {allRecentActivities.map((item) => {
                        return (
                          <tr key={item.id} className="align-top">
                            <td className="px-3 py-3 whitespace-nowrap text-[11px] text-gray-500">
                              <div className="font-medium text-gray-700">
                                {formatThaiDateTime(item.timestamp, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </div>
                              <div>{getRelativeTime(item.timestamp)}</div>
                            </td>
                            <td className="px-3 py-3 text-gray-700">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-gray-100 flex items-center justify-center">
                                  {item.type === 'activity' ? (
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <ActivityIcon action={(item as any).actionType || 'update'} />
                                  )}
                                </div>
                                <span className="font-semibold text-gray-800">
                                  {item.type === 'activity' ? 'กิจกรรม' : (
                                    actionLabels[(item as any).actionType] ?? (item as any).actionType
                                  )}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-gray-600">
                              <div className="space-y-1">
                                {item.type === 'activity' ? (
                                  <div className="text-[11px] leading-snug">
                                    {item.description}
                                  </div>
                                ) : (
                                  (item as any).summaries?.map((line: any, idx: number) => (
                                    <div
                                      key={`${item.id}-summary-${idx}`}
                                      className="flex text-[11px] leading-snug"
                                    >
                                      <span className="mr-1 text-gray-400">
                                        •
                                      </span>
                                      <span>{line.summary}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-gray-600 whitespace-nowrap text-[11px]">
                              {item.actorName || 'ระบบ'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            {logEntries.length > 5 &&
              !activityLogsLoading &&
              !activityLogsError && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() =>
                      openModal("viewAllActivities", {
                        customer,
                        logs: logEntries.map((entry) => entry.log),
                      })
                    }
                    className="text-xs text-blue-600 font-semibold hover:underline"
                  >
                    ดูเพิ่มเติม
                  </button>
                </div>
              )}
          </div>
        </div >
      </div >
    </div >
  );
};

export default CustomerDetailPage;
