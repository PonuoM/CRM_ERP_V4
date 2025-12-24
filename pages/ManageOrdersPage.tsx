

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Order, Customer, ModalType, OrderStatus, PaymentMethod, PaymentStatus, Product } from '../types';
import OrderTable from '../components/OrderTable';
import { Send, Calendar, ListChecks, History, Filter, Package, Clock, CheckCircle2, ChevronLeft, ChevronRight, Truck } from 'lucide-react';
import { createExportLog, listOrderSlips, listOrders, getOrderCounts } from '../services/api';
import { apiFetch } from '../services/api';
import usePersistentState from '../utils/usePersistentState';
import Spinner from '../components/Spinner';

interface ManageOrdersPageProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  users: User[];
  products: Product[];
  openModal: (type: ModalType, data: Order) => void;
  onProcessOrders: (orderIds: string[]) => void;
  onCancelOrders: (orderIds: string[]) => void;
  onUpdateShippingProvider: (orderId: string, shippingProvider: string) => Promise<void> | void;
}

const DateFilterButton: React.FC<{ label: string, value: string, activeValue: string, onClick: (value: string) => void }> = ({ label, value, activeValue, onClick }) => (
  <button
    onClick={() => onClick(value)}
    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeValue === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
  >
    {label}
  </button>
);

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 500];
const SHIPPING_PROVIDERS = ["J&T Express", "Flash Express", "Kerry Express", "Aiport Logistic"];

const ManageOrdersPage: React.FC<ManageOrdersPageProps> = ({ user, orders, customers, users, products, openModal, onProcessOrders, onCancelOrders, onUpdateShippingProvider }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDatePreset, setActiveDatePreset] = useState('today'); // Default to 'today' instead of 'all'
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = usePersistentState<'waitingVerifySlip' | 'waitingExport' | 'preparing' | 'shipping' | 'awaiting_account' | 'completed'>('manageOrders:activeTab', 'waitingVerifySlip');
  const [itemsPerPage, setItemsPerPage] = usePersistentState<number>('manageOrders:itemsPerPage', PAGE_SIZE_OPTIONS[1]);
  const [currentPage, setCurrentPage] = usePersistentState<number>('manageOrders:currentPage', 1);
  const [fullOrdersById, setFullOrdersById] = useState<Record<string, Order>>({});
  const [tabCounts, setTabCounts] = useState<Record<string, number>>({});
  const [refreshCounter, setRefreshCounter] = useState(0); // For triggering refresh on modal close
  const [payTab, setPayTab] = useState<'all' | 'unpaid' | 'paid'>('all'); // Always 'all' - payment status filtering is done via advanced filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fOrderId, setFOrderId] = useState('');
  const [fTracking, setFTracking] = useState('');
  const [fOrderDate, setFOrderDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [fDeliveryDate, setFDeliveryDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [fPaymentMethod, setFPaymentMethod] = useState<PaymentMethod | ''>('');
  const [fPaymentStatus, setFPaymentStatus] = useState<PaymentStatus | ''>('');
  const [fCustomerName, setFCustomerName] = useState('');
  const [fCustomerPhone, setFCustomerPhone] = useState('');
  const [fShop, setFShop] = useState<string>('');
  // Applied (effective) advanced filter values - only used after user presses Search
  const [afOrderId, setAfOrderId] = useState('');
  const [afTracking, setAfTracking] = useState('');
  const [afOrderDate, setAfOrderDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [afDeliveryDate, setAfDeliveryDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [afPaymentMethod, setAfPaymentMethod] = useState<PaymentMethod | ''>('');
  const [afPaymentStatus, setAfPaymentStatus] = useState<PaymentStatus | ''>('');
  const [afCustomerName, setAfCustomerName] = useState('');
  const [afCustomerPhone, setAfCustomerPhone] = useState('');
  // Removed duplicate states
  const [afShop, setAfShop] = useState<string>('');

  // API Data States (Server-Side Pagination)
  const [apiOrders, setApiOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(1);

  const [countMap, setCountMap] = useState<Record<string, number>>({}); // Count per tab
  const [countsLoading, setCountsLoading] = useState(false);

  // Ref for click-outside to collapse advanced filters
  const advRef = useRef<HTMLDivElement | null>(null);
  const [shippingSavingIds, setShippingSavingIds] = useState<Set<string>>(new Set());
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);

  // Persist filters across page switches
  const filterStorageKey = 'manage_orders_filters';

  // Load saved filters once on mount
  useEffect(() => {
    try {
      const savedRaw = localStorage.getItem(filterStorageKey);
      if (!savedRaw) return;
      const saved = JSON.parse(savedRaw);
      if (saved && typeof saved === 'object') {
        setActiveDatePreset(saved.activeDatePreset ?? 'today'); // Default to 'today' instead of 'all'
        setDateRange(saved.dateRange ?? { start: '', end: '' });

        setPayTab('all'); // Always use 'all' - payment status filtering is done via advanced filters
        setShowAdvanced(!!saved.showAdvanced);
        setFOrderId(saved.fOrderId ?? '');
        setFTracking(saved.fTracking ?? '');
        setFOrderDate(saved.fOrderDate ?? { start: '', end: '' });
        setFDeliveryDate(saved.fDeliveryDate ?? { start: '', end: '' });
        setFPaymentMethod(saved.fPaymentMethod ?? '');
        setFPaymentStatus(saved.fPaymentStatus ?? ''); // Always restore saved payment status
        setFCustomerName(saved.fCustomerName ?? '');
        setFCustomerPhone(saved.fCustomerPhone ?? '');
        setFShop(saved.fShop ?? '');
        // Applied values (fallback to edited values if not present)
        setAfOrderId(saved.afOrderId ?? saved.fOrderId ?? '');
        setAfTracking(saved.afTracking ?? saved.fTracking ?? '');
        setAfOrderDate(saved.afOrderDate ?? saved.fOrderDate ?? { start: '', end: '' });
        setAfDeliveryDate(saved.afDeliveryDate ?? saved.fDeliveryDate ?? { start: '', end: '' });
        setAfPaymentMethod(saved.afPaymentMethod ?? saved.fPaymentMethod ?? '');
        setAfPaymentStatus(saved.afPaymentStatus ?? saved.fPaymentStatus ?? '');
        setAfCustomerName(saved.afCustomerName ?? saved.fCustomerName ?? '');
        setAfCustomerPhone(saved.afCustomerPhone ?? saved.fCustomerPhone ?? '');
        setAfShop(saved.afShop ?? saved.fShop ?? '');
      }
    } catch { }
  }, []);

  useEffect(() => {
    try {
      const payload = {
        activeDatePreset,
        dateRange,
        activeTab,
        showAdvanced, // Removed payTab
        fOrderId,
        fTracking,
        fOrderDate,
        fDeliveryDate,
        fPaymentMethod,
        fPaymentStatus, // No longer conditional on payTab
        fCustomerName,
        fCustomerPhone,
        fShop,
        // Applied values
        afOrderId,
        afTracking,
        afOrderDate,
        afDeliveryDate,
        afPaymentMethod,
        afPaymentStatus,
        afCustomerName,
        afCustomerPhone,
        afShop,
      };
      localStorage.setItem(filterStorageKey, JSON.stringify(payload));
    } catch { }
  }, [activeDatePreset, dateRange, activeTab, showAdvanced, fOrderId, fTracking, fOrderDate, fDeliveryDate, fPaymentMethod, fPaymentStatus, fCustomerName, fCustomerPhone, fShop, afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone, afShop]);

  // --- API Fetching Logic ---

  // Determine filters based on Active Tab


  // Fetch tab counts once on mount
  useEffect(() => {
    const fetchCounts = async () => {
      if (!user?.companyId) return;
      setCountsLoading(true);
      try {
        const res = await getOrderCounts(user.companyId);
        if (res.ok && res.tabCounts) {
          setTabCounts(prev => ({ ...prev, ...res.tabCounts }));
        }
      } catch (error) {
        console.error('Failed to fetch tab counts:', error);
      } finally {
        setCountsLoading(false);
      }
    };
    fetchCounts();
  }, [user?.companyId, refreshCounter]);

  // Fetch orders from API
  useEffect(() => {
    const controller = new AbortController();
    const fetchOrders = async () => {
      if (!user?.companyId) return;

      setLoading(true);
      try {
        const params: any = {
          companyId: user.companyId,
          page: currentPage,
          pageSize: itemsPerPage,
          // Advanced Filters
          orderId: afOrderId || undefined,
          trackingNumber: afTracking || undefined,
          orderDateStart: afOrderDate.start || undefined,
          orderDateEnd: afOrderDate.end || undefined,
          deliveryDateStart: afDeliveryDate.start || undefined,
          deliveryDateEnd: afDeliveryDate.end || undefined,
          paymentMethod: afPaymentMethod || undefined,
          paymentStatus: afPaymentStatus || undefined,
          customerName: afCustomerName || undefined,
          customerPhone: afCustomerPhone || undefined,
          // shop: afShop || undefined, // Backend needs to support this

          // Send active tab to backend for specialized filtering logic
          tab: activeTab,
        };

        // TODO: Backend currently might not support 'orderStatus' filter directly in listOrders signature (based on TelesaleOrdersPage experience).
        // If listOrders doesn't support orderStatus, we rely on default fetching or need to update listOrders.
        // Based on previous task, listOrders supports: orderId, tracking, dates, payment info.
        // It DOES NOT seem to support `orderStatus` yet based on my memory of listOrders in services/api.ts.
        // I should check `services/api.ts` to see if I need to add `orderStatus`.

        const response = await listOrders({ ...params, signal: controller.signal });

        if (response.ok) {
          const mappedOrders = (response.orders || []).map((r: any) => ({
            id: r.id,
            customerId: r.customer_id,
            companyId: r.company_id,
            creatorId: r.creator_id,
            orderDate: r.order_date,
            deliveryDate: r.delivery_date,
            shippingAddress: {
              recipientFirstName: r.recipient_first_name || '',
              recipientLastName: r.recipient_last_name || '',
              street: r.street || '',
              subdistrict: r.subdistrict || '',
              district: r.district || '',
              province: r.province || '',
              postalCode: r.postal_code || '',
            },
            shippingProvider: r.shipping_provider,
            shippingCost: Number(r.shipping_cost || 0),
            billDiscount: Number(r.bill_discount || 0),
            totalAmount: Number(r.total_amount || 0),
            paymentMethod: r.payment_method,
            paymentStatus: r.payment_status,
            orderStatus: r.order_status,
            trackingNumbers: r.tracking_numbers ? r.tracking_numbers.split(',').map((t: string) => t.trim()) : [],
            amountPaid: r.amount_paid !== undefined && r.amount_paid !== null ? Number(r.amount_paid) : undefined,
            codAmount: r.cod_amount ? Number(r.cod_amount) : undefined,
            slipUrl: r.slip_url,
            salesChannel: r.sales_channel,
            salesChannelPageId: r.sales_channel_page_id,
            warehouseId: r.warehouse_id,
            bankAccountId: r.bank_account_id,
            transferDate: r.transfer_date,
            items: (r.items || []).map((it: any) => ({
              ...it,
              pricePerUnit: Number(it.price_per_unit ?? it.price ?? 0),
              quantity: Number(it.quantity ?? 0),
              discount: Number(it.discount ?? 0),
              netTotal: Number(it.net_total ?? it.netTotal ?? 0),
              isPromotionParent: !!(it.is_promotion_parent ?? 0),
              parentItemId: it.parent_item_id ?? it.parentItemId,
            })),
            slips: r.slips || [],
            trackingDetails: r.tracking_details || r.trackingDetails || [],
            boxes: r.boxes || [],
            reconcileAction: r.reconcile_action,
            // Customer information from API
            customerInfo: r.customer_first_name ? {
              firstName: r.customer_first_name,
              lastName: r.customer_last_name,
              phone: r.customer_phone,
              address: {
                street: r.customer_street || '',
                subdistrict: r.customer_subdistrict || '',
                district: r.customer_district || '',
                province: r.customer_province || '',
                postalCode: r.customer_postal_code || '',
              }
            } : undefined,
          }));


          setApiOrders(mappedOrders);
          setTotalOrders(response.pagination.total);
          setApiTotalPages(response.pagination.totalPages);

          // Lazy load verified count if on completed tab (not returned by getOrderCounts)
          if (activeTab === 'completed') {
            setTabCounts(prev => ({ ...prev, completed: response.pagination.total }));
          }
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Fetch orders failed:', error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      controller.abort();
    };
  }, [user?.companyId, currentPage, itemsPerPage, activeTab, afOrderId, afTracking, afOrderDate.start, afOrderDate.end, afDeliveryDate.start, afDeliveryDate.end, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone, refreshCounter]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  // Listen for modal close event to refresh data
  useEffect(() => {
    const handleModalClose = () => {
      setRefreshCounter(prev => prev + 1);
    };

    window.addEventListener('orderModalClosed', handleModalClose);

    return () => {
      window.removeEventListener('orderModalClosed', handleModalClose);
    };
  }, [activeTab]);

  const hasTrackingNumbers = (order: Order) =>
    Array.isArray(order.trackingNumbers) && order.trackingNumbers.some((tn) => (tn || '').trim().length > 0);

  const qualifiesForAccountReview = (order: Order) => {
    // Claim and FreeGift skip accounting review entirely
    if (order.paymentMethod === PaymentMethod.Claim || order.paymentMethod === PaymentMethod.FreeGift) {
      return false;
    }

    if (order.paymentStatus === PaymentStatus.PreApproved) {
      return true;
    }
    if (!hasTrackingNumbers(order)) {
      return false;
    }
    if (order.paymentStatus === PaymentStatus.Approved || order.paymentStatus === PaymentStatus.Paid) {
      return order.reconcileAction !== 'Confirmed';
    }
    switch (order.paymentMethod) {
      case PaymentMethod.COD:
        return (order.amountPaid ?? 0) > 0;
      case PaymentMethod.Transfer:
      case PaymentMethod.PayAfter:
        return order.paymentStatus === PaymentStatus.Verified;
      default:
        return false;
    }
  };

  // Removed unused client-side filtering logic

  // No longer needed to count orders client-side for badges if we want to show exact counts from API.
  // But for now, we only fetch current tab due to performance.
  // To avoid confusion, we can remove badges or fetch counts separately (like we did in TelesaleOrdersPage).
  // For ManageOrdersPage, we have MANY tabs. Fetching counts for ALL tabs might be heavy.
  // We can show count only for active tab or display "..." for others.

  // However, the tab UI might still expect some counts.
  // If we want to keep badges, we need to fetch counts.
  // Let's assume for now we only show count for active tab or 0.


  // Use API orders for display directly
  const finalDisplayedOrders = apiOrders;

  // Pagination logic (Server-Side)
  const safeItemsPerPage = itemsPerPage > 0 ? itemsPerPage : PAGE_SIZE_OPTIONS[1];
  const totalItems = totalOrders;
  const totalPages = apiTotalPages; // Use from API
  const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);

  // For server-side pagination, we display all items in apiOrders (which is already the current page slice)
  const paginatedOrders = apiOrders;

  const startIndex = (effectivePage - 1) * safeItemsPerPage;
  const endIndex = Math.min(startIndex + safeItemsPerPage, totalItems);

  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = totalItems === 0 ? 0 : endIndex;

  // Restore shopOptions for filter dropdown
  const shopOptions = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      const shop = (p.shop || '').trim();
      if (shop) set.add(shop);
    });
    return Array.from(set).sort();
  }, [products]);

  // Preserve page per tab when tab changes
  useEffect(() => {
    // Use a different key per tab to preserve page state per tab
    const tabPageKey = `manageOrders:currentPage:${activeTab}`;
    const savedPage = localStorage.getItem(tabPageKey);
    if (savedPage) {
      const pageNum = parseInt(savedPage, 10);
      if (!isNaN(pageNum) && pageNum >= 1) {
        setCurrentPage(pageNum);
      } else {
        setCurrentPage(1);
      }
    } else {
      setCurrentPage(1);
    }
  }, [activeTab, setCurrentPage]);

  // Save current page per tab
  useEffect(() => {
    const tabPageKey = `manageOrders:currentPage:${activeTab}`;
    localStorage.setItem(tabPageKey, currentPage.toString());
  }, [activeTab, currentPage]);

  // Reset to page 1 when items per page changes
  const handleItemsPerPageChange = (value: number) => {
    const nextValue = value > 0 ? value : PAGE_SIZE_OPTIONS[1];
    setItemsPerPage(nextValue);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(next);
  };

  const getPageNumbers = () => {
    const pages: Array<number | '...'> = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else if (effectivePage <= 3) {
      for (let i = 1; i <= 4; i += 1) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (effectivePage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = effectivePage - 1; i <= effectivePage + 1; i += 1) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.length === 0) return prev;
      const visibleIds = new Set(finalDisplayedOrders.map(o => o.id));
      const filtered = prev.filter(id => visibleIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [finalDisplayedOrders]);

  // Local helpers to map API enums/shape to UI types used by the CSV generator
  const fromApiOrderStatus = (s: any): OrderStatus => {
    switch (String(s)) {
      case 'Pending': return OrderStatus.Pending as any;
      case 'AwaitingVerification': return OrderStatus.AwaitingVerification as any;
      case 'Confirmed': return OrderStatus.Confirmed as any;
      case 'Preparing': return OrderStatus.Preparing as any;
      case 'Picking': return OrderStatus.Picking as any;
      case 'Shipping': return OrderStatus.Shipping as any;
      case 'PreApproved': return OrderStatus.PreApproved as any;
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
      case 'Verified': return PaymentStatus.Verified as any;
      case 'PreApproved': return PaymentStatus.PreApproved as any;
      case 'Approved': return PaymentStatus.Approved as any;
      case 'Paid': return PaymentStatus.Paid as any;
      default: return PaymentStatus.Unpaid as any;
    }
  };
  const fromApiPaymentMethod = (s: any): PaymentMethod => {
    switch (String(s)) {
      case 'COD': return PaymentMethod.COD as any;
      case 'Transfer': return PaymentMethod.Transfer as any;
      case 'PayAfter': return PaymentMethod.PayAfter as any;
      case 'Claim': return PaymentMethod.Claim as any;
      case 'FreeGift': return PaymentMethod.FreeGift as any;
      default: return PaymentMethod.COD as any;
    }
  };

  // Prefetch full order details (with items/boxes/address) for selected orders
  useEffect(() => {
    if (selectedIds.length === 0) return;
    const missing = selectedIds.filter(id => !fullOrdersById[id] || (fullOrdersById[id].items?.length ?? 0) === 0);
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.allSettled(missing.map(id => apiFetch(`orders/${encodeURIComponent(id)}`)));
        if (cancelled) return;
        const updates: Record<string, Order> = {};
        results.forEach((res, idx) => {
          if (res.status !== 'fulfilled') return;
          const r: any = res.value || {};
          const mapped: Order = {
            id: String(r.id),
            customerId: String(r.customer_id ?? ''),
            companyId: Number(r.company_id ?? 0),
            creatorId: Number(r.creator_id ?? 0),
            orderDate: r.order_date ?? '',
            deliveryDate: r.delivery_date ?? '',
            shippingAddress: {
              recipientFirstName: r.recipient_first_name || '',
              recipientLastName: r.recipient_last_name || '',
              street: r.street || '',
              subdistrict: r.subdistrict || '',
              district: r.district || '',
              province: r.province || '',
              postalCode: r.postal_code || '',
            },
            items: Array.isArray(r.items) ? r.items.map((it: any, i: number) => ({
              id: Number(it.id ?? i + 1),
              productName: String(it.product_name ?? ''),
              quantity: Number(it.quantity ?? 0),
              pricePerUnit: Number(it.price_per_unit ?? 0),
              discount: Number(it.discount ?? 0),
              isFreebie: !!(it.is_freebie ?? 0),
              boxNumber: Number(it.box_number ?? 0),
              productId: it.product_id ? Number(it.product_id) : undefined,
              // Preserve raw order_items IDs so CSV export can use them
              orderId:
                typeof it.order_id !== 'undefined' && it.order_id !== null
                  ? String(it.order_id)
                  : undefined,
              parentOrderId:
                typeof it.parent_order_id !== 'undefined' && it.parent_order_id !== null
                  ? String(it.parent_order_id)
                  : undefined,
              netTotal: Number(it.net_total ?? 0),
              isPromotionParent: !!(it.is_promotion_parent ?? 0),
            })) : [],
            shippingCost: Number(r.shipping_cost ?? 0),
            billDiscount: Number(r.bill_discount ?? 0),
            totalAmount: Number(r.total_amount ?? 0),
            paymentMethod: fromApiPaymentMethod(r.payment_method),
            paymentStatus: fromApiPaymentStatus(r.payment_status ?? 'Unpaid'),
            orderStatus: fromApiOrderStatus(r.order_status ?? 'Pending'),
            trackingNumbers: Array.isArray(r.trackingNumbers)
              ? r.trackingNumbers
              : (typeof r.tracking_numbers === 'string' ? String(r.tracking_numbers).split(',').filter(Boolean) : []),
            boxes: Array.isArray(r.boxes) ? r.boxes.map((b: any) => ({
              boxNumber: Number(b.box_number ?? 0),
              codAmount: Number(b.cod_amount ?? b.collection_amount ?? 0),
              collectionAmount: Number(b.collection_amount ?? b.cod_amount ?? 0),
              collectedAmount: Number(b.collected_amount ?? 0),
              waivedAmount: Number(b.waived_amount ?? 0),
              paymentMethod: b.payment_method ?? undefined,
              status: b.status ?? undefined,
              subOrderId: b.sub_order_id ?? undefined,
            })) : [],
            notes: r.notes ?? undefined,
            reconcileAction: r.reconcile_action || undefined,
          };
          updates[missing[idx]] = mapped;
        });
        if (Object.keys(updates).length > 0) {
          setFullOrdersById(prev => ({ ...prev, ...updates }));
        }
      } catch (e) {
        // ignore prefetch errors; export will fallback
        console.error('Prefetch orders failed', e);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedIds, fullOrdersById]);


  const generateAndDownloadCsv = async (selectedOrders: Order[]) => {
    const headers = [
      'หมายเลขออเดอร์ออนไลน์', 'ชื่อร้านค้า', 'เวลาที่สั่งซื้อ', 'บัญชีร้านค้า',
      'หมายเลขใบชำระเงิน', 'COD', 'ช่องทางชำระเงิน', 'เวลาชำระเงิน',
      'หมายเหตุใบสั่งซื้อ', 'ข้อความจากร้านค้า', 'ค่าขนส่ง', 'จำนวนเงินที่ต้องชำระ',
      'ผู้รับสินค้า', 'นามสกุลผู้รับสินค้า', 'หมายเลขโทรศัพท์', 'หมายเลขมือถือ',
      'สถานที่', 'ภูมิภาค', 'อำเภอ', 'จังหวัด', 'รหัสไปรษณีย์', 'ประเทศ',
      'รับสินค้าที่ร้านหรือไม่', 'รหัสสินค้าบนแพลตฟอร์ม', 'รหัสสินค้าในระบบ',
      'ชื่อสินค้า', 'สีและรูปแบบ', 'จำนวน', 'ราคาสินค้าต่อหน่วย',
      'บริษัทขนส่ง', 'หมายเลขขนส่ง', 'เวลาส่งสินค้า', 'สถานะ',
      'พนักงานขาย', 'หมายเหตุออฟไลน์', 'รูปแบบคำสั่งซื้อ', 'รูปแบบการชำระ'
    ];

    const escapeCsvCell = (cellData: any): string => {
      const str = String(cellData ?? '');
      // Use standard CSV escaping: wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = selectedOrders.flatMap(order => {
      // Match customer by pk (customer_id) or id (string)
      const customer = customers.find(c => {
        if (c.pk && typeof order.customerId === 'number') {
          return c.pk === order.customerId;
        }
        return String(c.id) === String(order.customerId) ||
          String(c.pk) === String(order.customerId);
      });
      // Match seller by id (ensure type compatibility)
      const seller = users.find(u => {
        if (!order.creatorId) return false;
        if (typeof u.id === 'number' && typeof order.creatorId === 'number') {
          return u.id === order.creatorId;
        }
        return String(u.id) === String(order.creatorId);
      });
      const address =
        order.shippingAddress || {
          recipientFirstName: '',
          recipientLastName: '',
          street: '',
          subdistrict: '',
          district: '',
          province: '',
          postalCode: '',
        };

      // Group items by boxId (referencing order.boxes)
      const itemsByOrderId = new Map<string, typeof order.items>();

      order.items.forEach(item => {
        const boxNum = item.boxNumber || (item as any).box_number || 1;
        const match = (order.boxes || []).find(b => ((b as any).boxNumber ?? (b as any).box_number) === boxNum);

        // Use subOrderId from box if found, otherwise fall back to item.orderId or order.id
        let onlineOrderId = (match as any)?.subOrderId ?? (match as any)?.sub_order_id ?? (item as any).orderId ?? (item as any).order_id ?? order.id;

        // Ensure Box 1 has -1 suffix if it matches the main order ID and doesn't have any suffix
        if (boxNum === 1 && onlineOrderId === order.id && !onlineOrderId.includes(`${order.id}-`)) {
          onlineOrderId = `${order.id}-1`;
        }

        if (!itemsByOrderId.has(onlineOrderId)) {
          itemsByOrderId.set(onlineOrderId, []);
        }
        itemsByOrderId.get(onlineOrderId)!.push(item);
      });

      // สร้างแถวสำหรับแต่ละ orderId
      const orderRows: any[] = [];

      // Sort keys (orderIds) by suffix (box number)
      const sortedOnlineOrderIds = Array.from(itemsByOrderId.keys()).sort((a, b) => {
        const matchA = a.match(/-(\d+)$/);
        const matchB = b.match(/-(\d+)$/);
        const suffixA = matchA ? parseInt(matchA[1], 10) : 0;
        const suffixB = matchB ? parseInt(matchB[1], 10) : 0;

        if (suffixA > 0 && suffixB > 0) {
          return suffixA - suffixB;
        }
        if (suffixA !== suffixB) {
          return suffixA - suffixB;
        }
        return a.localeCompare(b);
      });

      sortedOnlineOrderIds.forEach((onlineOrderId) => {
        const items = itemsByOrderId.get(onlineOrderId)!;
        // Exclude promotion parent items (is_promotion_parent = 1 in DB)
        const exportItems = items.filter((it: any) => !it.isPromotionParent);
        if (exportItems.length === 0) {
          return;
        }

        exportItems.forEach((item, index) => {
          const codAmount = order.paymentMethod === PaymentMethod.COD
            ? (order.boxes?.reduce((sum, box) => sum + (box.codAmount ?? 0), 0) || 0)
            : 0;

          // คำนวณ totalAmount สำหรับ orderId นี้
          // จำนวนเงินที่ต้องชำระ: ใช้จาก order_boxes.cod_amount ของกล่องที่ sub_order_id ตรงกับ order_items.order_id
          const boxForThisOrder = (order.boxes || []).find(
            (b: any) =>
              String(b.subOrderId ?? b.sub_order_id ?? "") === String(onlineOrderId),
          );

          let orderIdTotalAmount: string | number = "";

          if (order.paymentMethod === PaymentMethod.COD) {
            // สำหรับ COD ใช้ค่าจาก box
            orderIdTotalAmount = boxForThisOrder && typeof boxForThisOrder.codAmount === "number"
              ? boxForThisOrder.codAmount
              : 0;
          } else if (order.paymentMethod === PaymentMethod.Transfer || order.paymentMethod === PaymentMethod.PayAfter) {
            // สำหรับ Transfer และ PayAfter ใช้ totalAmount หารด้วยจำนวน orderId
            const totalOrderIds = itemsByOrderId.size;
            orderIdTotalAmount = totalOrderIds > 0 ? (order.totalAmount || 0) / totalOrderIds : (order.totalAmount || 0);
          } else {
            // สำหรับ payment method อื่นๆ ใช้ totalAmount หารด้วยจำนวน orderId
            const totalOrderIds = itemsByOrderId.size;
            orderIdTotalAmount = totalOrderIds > 0 ? (order.totalAmount || 0) / totalOrderIds : (order.totalAmount || 0);
          }

          // ตรวจสอบว่า orderId มี suffix -1, -2, -3 หรือไม่
          const boxNumberMatch = onlineOrderId.match(/-(\d+)$/);
          const boxNumber = boxNumberMatch ? parseInt(boxNumberMatch[1], 10) : null;

          // สร้างชื่อผู้รับพร้อมนามสกุลและ (กล่องที่ X) ถ้ามี boxNumber
          let recipientName = '';
          if (index === 0) {
            const firstName = customer?.firstName ?? '';
            const lastName = customer?.lastName ?? '';
            const fullName = `${firstName} ${lastName}`.trim();

            if (fullName && boxNumber !== null) {
              recipientName = `${fullName} (กล่องที่ ${boxNumber})`;
            } else {
              recipientName = fullName;
            }
          }

          // กำหนดค่า COD ตามเงื่อนไข
          let codValue: string | number = '';
          if (index === 0) {
            // แถวแรกของ orderId
            if (orderIdTotalAmount === 0 || !orderIdTotalAmount) {
              codValue = 'ไม่';
            } else if (order.paymentMethod === PaymentMethod.COD) {
              codValue = 'ใช่';
            } else {
              codValue = 'ไม่';
            }
          }
          // ถ้าไม่ใช่แถวแรก (index > 0) ให้เป็นค่าว่าง

          // ค้นหาข้อมูล shop จาก products โดยใช้ productId
          const product = item.productId ? products.find(p => p.id === item.productId) : null;
          const shopName = product?.shop ?? 'N/A';

          const rowData: { [key: string]: string | number | undefined } = {
            // แสดงหมายเลขออเดอร์ออนไลน์เฉพาะแถวแรกของแต่ละ orderId
            'หมายเลขออเดอร์ออนไลน์': index === 0 ? onlineOrderId : '',
            'ชื่อร้านค้า': shopName,
            'เวลาที่สั่งซื้อ': index === 0 ? (order.orderDate?.substring(0, 10) ?? '') : '',
            'บัญชีร้านค้า': '', // ว่างเปล่า
            'หมายเลขใบชำระเงิน': '',
            'COD': codValue,
            'ช่องทางชำระเงิน': '',
            'เวลาชำระเงิน': '',
            'หมายเหตุใบสั่งซื้อ': order.notes ?? '',
            'ข้อความจากร้านค้า': '',
            'ค่าขนส่ง': '', // ว่างเปล่า
            // แสดงข้อมูลที่อยู่เฉพาะแถวแรกของแต่ละ orderId
            // แสดงจำนวนเงินเฉพาะเมื่อ COD = "ใช่"
            'จำนวนเงินที่ต้องชำระ': (index === 0 && codValue === 'ใช่') ? orderIdTotalAmount : '',
            'ผู้รับสินค้า': recipientName,
            'นามสกุลผู้รับสินค้า': '', // ว่างเปล่าเสมอ
            'หมายเลขโทรศัพท์': index === 0 ? (customer?.phone ? (customer.phone.startsWith('0') ? customer.phone : `0${customer.phone}`) : '') : '',
            'หมายเลขมือถือ': index === 0 ? (customer?.phone ? (customer.phone.startsWith('0') ? customer.phone : `0${customer.phone}`) : '') : '',
            'สถานที่': index === 0 ? address.street : '',
            'ภูมิภาค': index === 0 ? address.subdistrict : '',
            'อำเภอ': index === 0 ? address.district : '',
            'จังหวัด': index === 0 ? address.province : '',
            'รหัสไปรษณีย์': index === 0 ? address.postalCode : '',
            'ประเทศ': index === 0 ? 'ไทย' : '',
            // ไม่ใส่ข้อมูลในคอลัม "รับสินค้าที่ร้านหรือไม่" ทุกกรณี
            'รับสินค้าที่ร้านหรือไม่': '',
            'รหัสสินค้าบนแพลตฟอร์ม': '', // ว่างเปล่า
            'รหัสสินค้าในระบบ': item.quantity > 1 ? `${product?.sku ?? ''}-${item.quantity}` : (product?.sku ?? ''),
            'ชื่อสินค้า': `${item.productName} ${item.quantity}`,
            'สีและรูปแบบ': '',
            'จำนวน': 1,
            // แสดงราคาสินค้าต่อหน่วยเฉพาะเมื่อ COD = "ใช่"
            'ราคาสินค้าต่อหน่วย': (index === 0 && codValue === 'ใช่') ? orderIdTotalAmount : '',
            'บริษัทขนส่ง': order.shippingProvider || '',
            'หมายเลขขนส่ง': order.trackingNumbers.join(', '),
            'เวลาส่งสินค้า': '',
            'สถานะ': order.orderStatus === 'Pending' ? 'ชำระแล้วรอตรวจสอบ' : order.orderStatus,
            'พนักงานขาย': '',
            'หมายเหตุออฟไลน์': '',
            'รูปแบบคำสั่งซื้อ': '',
            'รูปแบบการชำระ': '',
          };

          orderRows.push(headers.map(header => rowData[header]));
        });
      });

      return orderRows;
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(escapeCsvCell).join(','))
    ].join('\n');

    const fullContent = '\uFEFF' + csvContent;
    const blob = new Blob([fullContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const filename = `orders_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    try {
      const b64 = btoa(unescape(encodeURIComponent(fullContent)));
      await createExportLog({
        filename,
        contentBase64: b64,
        ordersCount: selectedOrders.length,
        userId: user?.id,
        exportedBy: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || undefined,
      });
    } catch (e) {
      console.error('Failed to log export file', e);
    }
  };


  const handleExportAndProcessSelected = async () => {
    // Prefer full details for selected orders when available (with items)
    // Prefer full details for selected orders when available (with items)
    // Prefer full details for selected orders when available (with items)
    const baseMap = new Map(apiOrders.map(o => [o.id, o]));
    let selectedOrders = selectedIds
      .map(id => {
        const full = fullOrdersById[id];
        const base = baseMap.get(id);
        if (full) {
          // Ensure we have the latest shippingProvider from base if full is stale (though we try to keep full updated)
          if (!full.shippingProvider && (base as any)?.shippingProvider) {
            return { ...full, shippingProvider: (base as any).shippingProvider };
          }
          return full;
        }
        return base;
      })
      .filter((o): o is Order => !!o);
    if (selectedOrders.length === 0) return;

    // If none of the selected orders have items yet, synchronously fetch details
    const needsFetch = selectedOrders.filter(o => (o.items?.length ?? 0) === 0).map(o => o.id);
    if (needsFetch.length === selectedOrders.length) {
      try {
        const results = await Promise.allSettled(needsFetch.map(id => apiFetch(`orders/${encodeURIComponent(id)}`)));
        const merged: Order[] = [];
        results.forEach((res, idx) => {
          const fallback = selectedOrders[idx];
          if (res.status !== 'fulfilled') { merged.push(fallback); return; }
          const r: any = res.value || {};
          const mapped: Order = {
            id: String(r.id ?? fallback.id),
            customerId: String(r.customer_id ?? fallback.customerId ?? ''),
            companyId: Number(r.company_id ?? fallback.companyId ?? 0),
            creatorId: Number(r.creator_id ?? fallback.creatorId ?? 0),
            orderDate: r.order_date ?? fallback.orderDate,
            deliveryDate: r.delivery_date ?? fallback.deliveryDate,
            shippingAddress: {
              recipientFirstName:
                (r.recipient_first_name ??
                  (fallback as any).shippingAddress?.recipientFirstName) || '',
              recipientLastName:
                (r.recipient_last_name ??
                  (fallback as any).shippingAddress?.recipientLastName) || '',
              street: (r.street ?? (fallback as any).shippingAddress?.street) || '',
              subdistrict:
                (r.subdistrict ?? (fallback as any).shippingAddress?.subdistrict) || '',
              district:
                (r.district ?? (fallback as any).shippingAddress?.district) || '',
              province:
                (r.province ?? (fallback as any).shippingAddress?.province) || '',
              postalCode:
                (r.postal_code ?? (fallback as any).shippingAddress?.postalCode) || '',
            },
            items: Array.isArray(r.items) ? r.items.map((it: any, i: number) => ({
              id: Number(it.id ?? i + 1),
              productName: String(it.product_name ?? ''),
              quantity: Number(it.quantity ?? 0),
              pricePerUnit: Number(it.price_per_unit ?? 0),
              discount: Number(it.discount ?? 0),
              isFreebie: !!(it.is_freebie ?? 0),
              boxNumber: Number(it.box_number ?? 0),
              productId: it.product_id ? Number(it.product_id) : undefined,
              // Preserve raw order_items IDs so CSV export can use them
              orderId:
                typeof it.order_id !== 'undefined' && it.order_id !== null
                  ? String(it.order_id)
                  : undefined,
              parentOrderId:
                typeof it.parent_order_id !== 'undefined' && it.parent_order_id !== null
                  ? String(it.parent_order_id)
                  : undefined,
            })) : (fallback.items || []),
            shippingCost: Number(r.shipping_cost ?? fallback.shippingCost ?? 0),
            billDiscount: Number(r.bill_discount ?? fallback.billDiscount ?? 0),
            totalAmount: Number(r.total_amount ?? fallback.totalAmount ?? 0),
            paymentMethod: fromApiPaymentMethod(r.payment_method ?? (fallback as any).paymentMethod),
            paymentStatus: fromApiPaymentStatus(r.payment_status ?? (fallback as any).paymentStatus ?? 'Unpaid'),
            orderStatus: fromApiOrderStatus(r.order_status ?? (fallback as any).orderStatus ?? 'Pending'),
            trackingNumbers: Array.isArray(r.trackingNumbers)
              ? r.trackingNumbers
              : (typeof r.tracking_numbers === 'string' ? String(r.tracking_numbers).split(',').filter(Boolean) : (fallback.trackingNumbers || [])),
            boxes: Array.isArray(r.boxes) ? r.boxes.map((b: any) => ({
              boxNumber: Number(b.box_number ?? 0),
              codAmount: Number(b.cod_amount ?? b.collection_amount ?? 0),
              collectionAmount: Number(b.collection_amount ?? b.cod_amount ?? 0),
              collectedAmount: Number(b.collected_amount ?? 0),
              waivedAmount: Number(b.waived_amount ?? 0),
              paymentMethod: b.payment_method ?? undefined,
              status: b.status ?? undefined,
              subOrderId: b.sub_order_id ?? undefined,
            })) : (fallback.boxes || []),
            notes: r.notes ?? fallback.notes,
          };
          merged.push(mapped);
        });
        selectedOrders = merged;
      } catch (e) {
        // fall back silently if fetch fails
        console.error('Fetch selected order details failed', e);
      }
    }

    // Validate export readiness based on payment method
    try {
      // Ensure Transfer orders have slip(s) and are not Unpaid
      const transferOrders = selectedOrders.filter(o => o.paymentMethod === PaymentMethod.Transfer);
      const slipsCountByOrder: Record<string, number> = {};
      for (const o of transferOrders) {
        try {
          const res: any = await listOrderSlips(o.id);
          const slips = Array.isArray(res) ? res : (Array.isArray(res?.rows) ? res.rows : []);
          slipsCountByOrder[o.id] = slips.length || 0;
        } catch (e) {
          slipsCountByOrder[o.id] = 0;
        }
      }
      const blocked = selectedOrders.filter(o => {
        if (o.paymentMethod === PaymentMethod.Transfer) {
          const cnt = slipsCountByOrder[o.id] || 0;
          const hasSlip = cnt > 0 || !!(o as any).slipUrl;
          const verifiedOrPending = !!o.paymentStatus && o.paymentStatus !== PaymentStatus.Unpaid;
          return !(hasSlip && verifiedOrPending);
        }
        // COD and PayAfter: no slip required
        return false;
      });
      if (blocked.length > 0) {
        alert(`ออเดอร์ต่อไปนี้ต้องมีสลิปและสถานะการชำระ (โอน) ต้องไม่เป็นค้างชำระก่อน Export:\n${blocked.map(b => `- ${b.id}`).join('\n')}`);
        return;
      }



    } catch (e) {
      console.error('pre-export validation failed', e);
      alert('ตรวจสอบข้อมูลก่อน Export ไม่สำเร็จ กรุณาลองใหม่');
      return;
    }

    if (window.confirm(`คุณต้องการส่งออกและส่งออเดอร์ ${selectedOrders.length} รายการให้คลังสินค้าใช่หรือไม่? สถานะจะถูกเปลี่ยนเป็น "กำลังจัดสินค้า"`)) {
      try {
        // First, trigger the file download.
        generateAndDownloadCsv(selectedOrders);

        // Then, use setTimeout to schedule the state updates to run in the next
        // event loop cycle to avoid interfering with the download.
        setTimeout(() => {
          onProcessOrders(selectedIds);
          setSelectedIds([]);
          // Trigger refresh to update the grid and tab counts
          setRefreshCounter(prev => prev + 1);
        }, 0);

      } catch (error) {
        console.error('An error occurred during the export process:', error);
        alert('เกิดข้อผิดพลาดในการสร้างไฟล์ CSV กรุณาตรวจสอบ Console log และลองใหม่อีกครั้ง');
      }
    }
  };

  const handleMoveToAwaitingExport = async () => {
    if (selectedIds.length === 0) return;

    if (window.confirm(`คุณต้องการย้ายออเดอร์ ${selectedIds.length} รายการไปยัง "รอดึงข้อมูล" ใช่หรือไม่?`)) {
      try {
        // อัปเดตสถานะของออเดอร์ที่เลือกเป็น Verified
        const updatedOrders = selectedIds.map(id => {
          const order = orders.find(o => o.id === id);
          if (!order) return null;

          return {
            ...order,
            paymentStatus: PaymentStatus.Verified,
            verificationInfo: {
              verifiedBy: user.id,
              verifiedByName: `${user.firstName} ${user.lastName}`,
              verifiedAt: new Date().toISOString(),
            }
          };
        }).filter(Boolean) as Order[];

        // ส่งข้อมูลที่อัปเดตกลับไปยัง parent component
        onProcessOrders(selectedIds);

        // แสดงข้อความยืนยัน
        alert(`ย้ายออเดอร์ ${selectedIds.length} รายการไปยัง "รอดึงข้อมูล" เรียบร้อยแล้ว`);

        // ล้างการเลือก
        setSelectedIds([]);
      } catch (error) {
        console.error('Failed to move orders to awaiting export:', error);
        alert('เกิดข้อผิดพลาดในการย้ายออเดอร์ กรุณาลองใหม่');
      }
    }
  };

  const handleDatePresetClick = (preset: string) => {
    setActiveDatePreset(preset);
    setDateRange({ start: '', end: '' });
  };

  const handleDateRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setDateRange(prev => {
      const newRange = { ...prev, [name]: value };
      if (newRange.start && newRange.end) {
        setActiveDatePreset('range');
      } else if (!newRange.start && !newRange.end) {
        setActiveDatePreset('today'); // Reset to 'today' instead of 'all' when date range is cleared
      }
      return newRange;
    });
  };

  // Payment status filtering is now done via advanced filters only (no payTab sync needed)

  // Compute ตัวกรองขั้นสูง badge count (exclude implied payTab status)
  const advancedCount = useMemo(() => {
    const baseFields = [
      afOrderId,
      afTracking,
      afOrderDate.start,
      afOrderDate.end,
      afDeliveryDate.start,
      afDeliveryDate.end,
      afPaymentMethod,
      afCustomerName,
      afCustomerPhone,
    ];
    let c = baseFields.filter(v => !!v && String(v).trim() !== '').length;
    if (afPaymentStatus && String(afPaymentStatus).trim() !== '') c += 1; // No longer conditional on payTab
    if (afShop && String(afShop).trim() !== '') c += 1;
    return c;
  }, [afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone, afShop]);

  const clearFilters = () => {
    // Reset all filters
    setFOrderId('');
    setFTracking('');
    setFOrderDate({ start: '', end: '' });
    setFDeliveryDate({ start: '', end: '' });
    setFPaymentMethod('' as any);
    setFPaymentStatus('' as any); // Unconditional reset
    // Reset date presets
    setActiveDatePreset('today'); // Reset to 'today' instead of 'all'
    setDateRange({ start: '', end: '' });
    // Also clear applied values immediately
    setFShop('');
    setAfOrderId('');
    setAfTracking('');
    setAfOrderDate({ start: '', end: '' });
    setAfDeliveryDate({ start: '', end: '' });
    setAfPaymentMethod('' as any);
    setAfPaymentStatus('' as any); // Unconditional reset
    setFCustomerName('');
    setFCustomerPhone('');
    setAfCustomerName('');
    setAfCustomerPhone('');
    setAfShop('');
  };

  // Apply (Search) advanced filters
  const applyAdvancedFilters = () => {
    setAfOrderId(fOrderId.trim());
    setAfTracking(fTracking.trim());
    setAfOrderDate({ ...fOrderDate });
    setAfDeliveryDate({ ...fDeliveryDate });
    setAfPaymentMethod(fPaymentMethod || '' as any);
    setAfPaymentStatus(fPaymentStatus || '' as any); // Unconditional set
    setAfCustomerName(fCustomerName.trim());
    setAfCustomerPhone(fCustomerPhone.trim());
    setAfShop(fShop.trim());
    setShowAdvanced(false);
  };

  const handleShippingProviderChange = async (orderId: string, shippingProvider: string) => {
    if (highlightedOrderId === orderId) {
      setHighlightedOrderId(null);
    }

    // Optimistically update fullOrdersById to ensure export validation sees the change immediately
    setFullOrdersById(prev => {
      if (!prev[orderId]) return prev;
      return {
        ...prev,
        [orderId]: {
          ...prev[orderId],
          shippingProvider
        }
      };
    });

    setShippingSavingIds(prev => {
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });
    try {
      await onUpdateShippingProvider(orderId, shippingProvider);
    } catch (error) {
      console.error('Failed to update shipping provider', error);
      alert('ไม่สามารถอัปเดตขนส่งได้');
    } finally {
      setShippingSavingIds(prev => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Click outside to collapse advanced filters
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!showAdvanced) return;
      const el = advRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setShowAdvanced(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [showAdvanced]);

  const datePresets = [
    { label: 'วันนี้', value: 'today' },
    { label: 'พรุ่งนี้', value: 'tomorrow', spacerAfter: 'w-8' }, // เพิ่ม flag สำหรับเว้นระยะห่าง
    { label: 'ล่วงหน้า 7 วัน', value: 'next7days' },
    { label: 'ล่วงหน้า 30 วัน', value: 'next30days' },
    { label: 'ทั้งหมด', value: 'all', spacerAfter: 'w-10' },
    { label: 'ตกหล่น', value: 'missed' },
  ];

  const handleBulkShippingChange = async (provider: string) => {
    if (!provider) return;
    if (selectedIds.length === 0) return;
    if (!window.confirm(`คุณต้องการเปลี่ยนขนส่งของออเดอร์ ${selectedIds.length} รายการเป็น "${provider}" ใช่หรือไม่?`)) return;

    // Optimistic update
    setFullOrdersById(prev => {
      const next = { ...prev };
      selectedIds.forEach(id => {
        if (next[id]) {
          next[id] = { ...next[id], shippingProvider: provider };
        }
      });
      return next;
    });

    try {
      await Promise.all(selectedIds.map(id => onUpdateShippingProvider(id, provider)));
      alert('อัปเดตขนส่งเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Failed to bulk update shipping provider', error);
      alert('เกิดข้อผิดพลาดในการอัปเดตขนส่ง');
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">จัดการออเดอร์</h2>
          <p className="text-gray-600">{`ทั้งหมด ${finalDisplayedOrders.length} รายการ`}</p>
        </div>
        {activeTab !== 'pending' && activeTab !== 'verified' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={handleExportAndProcessSelected}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} className="mr-2" />
              {activeTab === 'verified' ? 'ส่งออกข้อมูลไปคลัง' : 'ส่งออกข้อมูล'}
            </button>
          </div>
        )}
        {activeTab === 'verified' && (
          <div className="flex items-center space-x-2">

            <button
              onClick={handleExportAndProcessSelected}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={16} className="mr-2" />
              ส่งออกข้อมูลไปคลัง ({selectedIds.length})
            </button>
          </div>
        )}
      </div>

      {/* ตัวกรองขั้นสูง toggle and panel */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4" ref={advRef}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdvanced(v => !v)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50">
            <Filter size={14} />
            ตัวกรองขั้นสูง
            {advancedCount > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px]">{advancedCount}</span>
            ) : null}
          </button>
          <button onClick={applyAdvancedFilters} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border bg-blue-50 text-blue-700 hover:bg-blue-100">
            ค้นหา
          </button>
          {(advancedCount > 0 || activeDatePreset !== 'all' || (dateRange.start || dateRange.end)) && (
            <button onClick={clearFilters} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50 text-gray-600">
              ล้างตัวกรอง
            </button>
          )}
        </div>
        {showAdvanced && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">ชื่อลูกค้า</label>
              <input value={fCustomerName} onChange={e => setFCustomerName(e.target.value)} className="w-full p-2 border rounded" placeholder="ชื่อหรือนามสกุล" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">เบอร์โทร</label>
              <input value={fCustomerPhone} onChange={e => setFCustomerPhone(e.target.value)} className="w-full p-2 border rounded" placeholder="เช่น 0812345678" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">เลขออเดอร์</label>
              <input value={fOrderId} onChange={e => setFOrderId(e.target.value)} className="w-full p-2 border rounded" placeholder="ORD-..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ค้นหา Tracking</label>
              <input value={fTracking} onChange={e => setFTracking(e.target.value)} className="w-full p-2 border rounded" placeholder="TH..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">วิธีการชำระ</label>
              <select value={fPaymentMethod} onChange={e => setFPaymentMethod((e.target.value as any) || '')} className="w-full p-2 border rounded">
                <option value="">ทั้งหมด</option>
                <option value={PaymentMethod.Transfer}>โอนเงิน</option>
                <option value={PaymentMethod.COD}>เก็บเงินปลายทาง (COD)</option>
                <option value={PaymentMethod.PayAfter}>รับสินค้าก่อน</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">สถานะการชำระ</label>
              <select value={fPaymentStatus} onChange={e => setFPaymentStatus((e.target.value as any) || '')} className="w-full p-2 border rounded">
                <option value="">ทั้งหมด</option>
                <option value={PaymentStatus.Unpaid}>ยังไม่ชำระ</option>
                <option value={PaymentStatus.PendingVerification}>รอตรวจสอบ</option>
                <option value={PaymentStatus.Verified}>ยืนยันแล้ว</option>
                <option value={PaymentStatus.PreApproved}>Pre Approved</option>
                <option value={PaymentStatus.Approved}>Approved</option>
                <option value={PaymentStatus.Paid}>ชำระแล้ว</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ร้านค้า</label>
              <select value={fShop} onChange={e => setFShop(e.target.value)} className="w-full p-2 border rounded">
                <option value="">ทั้งหมด</option>
                {shopOptions.map((shop) => (
                  <option key={shop} value={shop}>{shop}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ช่วงวันที่ออเดอร์ (จาก)</label>
              <input type="date" value={fOrderDate.start} onChange={e => setFOrderDate(v => ({ ...v, start: e.target.value }))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ช่วงวันที่ออเดอร์ (ถึง)</label>
              <input type="date" value={fOrderDate.end} onChange={e => setFOrderDate(v => ({ ...v, end: e.target.value }))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่ส่ง (จาก)</label>
              <input type="date" value={fDeliveryDate.start} onChange={e => setFDeliveryDate(v => ({ ...v, start: e.target.value }))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่ส่ง (ถึง)</label>
              <input type="date" value={fDeliveryDate.end} onChange={e => setFDeliveryDate(v => ({ ...v, end: e.target.value }))} className="w-full p-2 border rounded" />
            </div>
          </div>
        )}
      </div>

      <div className="flex border-b border-gray-200 mb-6">

        <button
          onClick={() => setActiveTab('waitingVerifySlip')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'waitingVerifySlip'
            ? 'border-b-2 border-blue-600 text-blue-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <ListChecks size={16} />
          <span>รอตรวจสอบสลิป</span>
          {countsLoading ? (
            <span className="px-2 py-0.5"><Spinner size="sm" /></span>
          ) : (tabCounts['waitingVerifySlip'] || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-600">
              {tabCounts['waitingVerifySlip'] || 0}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('waitingExport')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'waitingExport'
            ? 'border-b-2 border-yellow-600 text-yellow-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <ListChecks size={16} />
          <span>รอดึงข้อมูล</span>
          {countsLoading ? (
            <span className="px-2 py-0.5"><Spinner size="sm" /></span>
          ) : (tabCounts['waitingExport'] || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-600">
              {tabCounts['waitingExport'] || 0}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('preparing')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'preparing'
            ? 'border-b-2 border-purple-600 text-purple-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Package size={16} />
          <span>กำลังเตรียมสินค้า</span>
          {countsLoading ? (
            <span className="px-2 py-0.5"><Spinner size="sm" /></span>
          ) : (tabCounts['preparing'] || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-600">
              {tabCounts['preparing'] || 0}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('shipping')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'shipping'
            ? 'border-b-2 border-indigo-600 text-indigo-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Truck size={16} />
          <span>กำลังจัดส่ง</span>
          {countsLoading ? (
            <span className="px-2 py-0.5"><Spinner size="sm" /></span>
          ) : (tabCounts['shipping'] || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-600">
              {tabCounts['shipping'] || 0}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('awaiting_account')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'awaiting_account'
            ? 'border-b-2 border-orange-600 text-orange-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <Clock size={16} />
          <span>รอตรวจสอบจากบัญชี</span>
          {countsLoading ? (
            <span className="px-2 py-0.5"><Spinner size="sm" /></span>
          ) : (tabCounts['awaiting_account'] || 0) > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-600">
              {tabCounts['awaiting_account'] || 0}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'completed'
            ? 'border-b-2 border-gray-600 text-gray-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <CheckCircle2 size={16} />
          <span>เสร็จสิ้น</span>
          {(
            <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
              {tabCounts['completed'] !== undefined ? tabCounts['completed'] : '....'}
            </span>
          )}
        </button>
      </div>

      {/* แสดงตัวกรองวันที่จัดส่งเฉพาะ tab "รอดึงข้อมูล" */}
      {activeTab === 'waitingExport' && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center mr-4">
              <Calendar size={16} className="text-gray-500 mr-2" />
              <span className="text-sm font-medium text-gray-700">วันจัดส่ง:</span>
              <span className="text-sm text-gray-600 ml-2">({totalOrders} รายการ)</span>
            </div>
            {datePresets.map((preset, index) => (
              <React.Fragment key={preset.value}>
                <DateFilterButton
                  label={preset.label}
                  value={preset.value}
                  activeValue={activeDatePreset}
                  onClick={handleDatePresetClick}
                />
                {preset.spacerAfter && <div className={preset.spacerAfter} />}
              </React.Fragment>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="date"
                name="start"
                value={dateRange.start}
                onChange={handleDateRangeChange}
                className="p-1 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-gray-500 text-sm">ถึง</span>
              <input
                type="date"
                name="end"
                value={dateRange.end}
                onChange={handleDateRangeChange}
                className="p-1 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-96">
            <Spinner />
          </div>
        ) : (
          <>
            <OrderTable
              orders={paginatedOrders}
              customers={customers}
              openModal={openModal}
              users={users}
              selectable={activeTab === 'waitingVerifySlip' || activeTab === 'waitingExport'}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              showShippingColumn={activeTab !== 'waitingExport'}
              shippingEditable={false}
              shippingOptions={SHIPPING_PROVIDERS}
              shippingSavingIds={Array.from(shippingSavingIds)}
              onShippingChange={handleShippingProviderChange}
              highlightedOrderId={highlightedOrderId}
              allOrders={orders}
              isWaitingVerifySlipTab={activeTab === 'waitingVerifySlip'}
            />

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                {/* Left side - Display range */}
                <div className="text-sm text-gray-700">
                  แสดง {displayStart} - {displayEnd} จาก {totalItems} รายการ
                </div>

                {/* Right side - Pagination controls */}
                <div className="flex items-center space-x-2">
                  {/* Items per page selector */}
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">แสดง:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                      className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                    >
                      {PAGE_SIZE_OPTIONS.map((sz) => (
                        <option key={sz} value={sz}>
                          {sz}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Page navigation */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handlePageChange(effectivePage - 1)}
                      disabled={effectivePage === 1}
                      className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {getPageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() =>
                          typeof page === "number" ? handlePageChange(page) : undefined
                        }
                        disabled={page === "..."}
                        className={`px-3 py-1 text-sm rounded ${page === effectivePage
                          ? "bg-blue-600 text-white"
                          : page === "..."
                            ? "text-gray-400 cursor-default"
                            : "text-gray-700 hover:bg-gray-100"
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => handlePageChange(effectivePage + 1)}
                      disabled={effectivePage === totalPages}
                      className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ManageOrdersPage;
