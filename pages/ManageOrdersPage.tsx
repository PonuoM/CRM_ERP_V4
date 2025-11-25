

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Order, Customer, ModalType, OrderStatus, PaymentMethod, PaymentStatus } from '../types';
import OrderTable from '../components/OrderTable';
import { Send, Calendar, ListChecks, History, Filter, Package, Clock, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { createExportLog, listOrderSlips } from '../services/api';
import { apiFetch } from '../services/api';
import usePersistentState from '../utils/usePersistentState';

interface ManageOrdersPageProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  users: User[];
  openModal: (type: ModalType, data: Order) => void;
  onProcessOrders: (orderIds: string[]) => void;
  onCancelOrders: (orderIds: string[]) => void;
}

const DateFilterButton: React.FC<{label: string, value: string, activeValue: string, onClick: (value: string) => void}> = ({ label, value, activeValue, onClick }) => (
    <button 
        onClick={() => onClick(value)}
        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            activeValue === value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
    >
        {label}
    </button>
);

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 500];

const ManageOrdersPage: React.FC<ManageOrdersPageProps> = ({ user, orders, customers, users, openModal, onProcessOrders, onCancelOrders }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDatePreset, setActiveDatePreset] = useState('today'); // Default to 'today' instead of 'all'
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState<'pending' | 'verified' | 'preparing' | 'shipping' | 'awaiting_account' | 'completed'>('pending');
  const [itemsPerPage, setItemsPerPage] = usePersistentState<number>('manageOrders:itemsPerPage', PAGE_SIZE_OPTIONS[1]);
  const [currentPage, setCurrentPage] = usePersistentState<number>('manageOrders:currentPage', 1);
  const [fullOrdersById, setFullOrdersById] = useState<Record<string, Order>>({});
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
  // Applied (effective) advanced filter values - only used after user presses Search
  const [afOrderId, setAfOrderId] = useState('');
  const [afTracking, setAfTracking] = useState('');
  const [afOrderDate, setAfOrderDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [afDeliveryDate, setAfDeliveryDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [afPaymentMethod, setAfPaymentMethod] = useState<PaymentMethod | ''>('');
  const [afPaymentStatus, setAfPaymentStatus] = useState<PaymentStatus | ''>('');
  const [afCustomerName, setAfCustomerName] = useState('');
  const [afCustomerPhone, setAfCustomerPhone] = useState('');

  // Ref for click-outside to collapse advanced filters
  const advRef = useRef<HTMLDivElement | null>(null);

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
        setActiveTab(
          saved.activeTab === 'completed' ? 'completed' :
          saved.activeTab === 'awaiting_account' ? 'awaiting_account' :
          saved.activeTab === 'preparing' ? 'preparing' :
          saved.activeTab === 'processed' ? 'preparing' : // Migrate old 'processed' to 'preparing'
          saved.activeTab === 'verified' ? 'verified' :
          saved.activeTab === 'shipping' ? 'shipping' : 'pending'
        );
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
        // Applied values (fallback to edited values if not present)
        setAfOrderId(saved.afOrderId ?? saved.fOrderId ?? '');
        setAfTracking(saved.afTracking ?? saved.fTracking ?? '');
        setAfOrderDate(saved.afOrderDate ?? saved.fOrderDate ?? { start: '', end: '' });
        setAfDeliveryDate(saved.afDeliveryDate ?? saved.fDeliveryDate ?? { start: '', end: '' });
        setAfPaymentMethod(saved.afPaymentMethod ?? saved.fPaymentMethod ?? '');
        setAfPaymentStatus(saved.afPaymentStatus ?? saved.fPaymentStatus ?? '');
        setAfCustomerName(saved.afCustomerName ?? saved.fCustomerName ?? '');
        setAfCustomerPhone(saved.afCustomerPhone ?? saved.fCustomerPhone ?? '');
      }
    } catch {}
  }, []);

  // Save filters whenever they change
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
        // Applied values
        afOrderId,
        afTracking,
        afOrderDate,
        afDeliveryDate,
        afPaymentMethod,
        afPaymentStatus,
        afCustomerName,
        afCustomerPhone,
      };
      localStorage.setItem(filterStorageKey, JSON.stringify(payload));
    } catch {}
  }, [activeDatePreset, dateRange, activeTab, showAdvanced, fOrderId, fTracking, fOrderDate, fDeliveryDate, fPaymentMethod, fPaymentStatus, fCustomerName, fCustomerPhone, afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const hasTrackingNumbers = (order: Order) =>
    Array.isArray(order.trackingNumbers) && order.trackingNumbers.some((tn) => (tn || '').trim().length > 0);

  const qualifiesForAccountReview = (order: Order) => {
    if (order.paymentStatus === PaymentStatus.PreApproved) {
      return true;
    }
    if (!hasTrackingNumbers(order)) {
      return false;
    }
    if (order.paymentStatus === PaymentStatus.Approved || order.paymentStatus === PaymentStatus.Paid) {
      return false;
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

  const pendingOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (o.orderStatus !== OrderStatus.Pending) {
          return false;
        }
        if (o.paymentMethod !== PaymentMethod.Transfer) {
          return false;
        }
        // โอนที่ยังไม่ผ่านการตรวจสอบสลิป
        return (
          o.paymentStatus === PaymentStatus.Unpaid ||
          o.paymentStatus === PaymentStatus.PendingVerification
        );
      }),
    [orders],
  );
  
  // กำลังจัดเตรียม: หลัง export/ดึงข้อมูลแล้ว (Preparing, Picking)
  const preparingOrders = useMemo(() => 
    orders.filter(o => 
      (o.orderStatus === OrderStatus.Preparing || o.orderStatus === OrderStatus.Picking) &&
      (!o.trackingNumbers || o.trackingNumbers.length === 0) // ยังไม่มี tracking
    ), [orders]
  );

  // รอตรวจสอบจากบัญชี: PreApproved (COD หลังใส่ยอด, PayAfter หลัง upload รูป, Transfer หลัง tracking 1 วัน)
  const awaitingAccountCheckOrders = useMemo(
    () => orders.filter((o) => qualifiesForAccountReview(o)),
    [orders],
  );

  // เสร็จสิ้น: Approved หรือ Paid
  const completedOrders = useMemo(() => 
    orders.filter(o => 
      o.paymentStatus === PaymentStatus.Approved || 
      o.paymentStatus === PaymentStatus.Paid ||
      o.orderStatus === OrderStatus.Delivered
    ), [orders]
  );
  
  const awaitingExportOrders = useMemo(
    () =>
      orders.filter((o) => {
        if (o.orderStatus !== OrderStatus.Pending) {
          return false;
        }
        // รอดึงข้อมูล: รวม COD, รับสินค้าก่อน และโอนที่ตรวจสอบสลิปผ่านแล้ว
        if (o.paymentMethod === PaymentMethod.COD) {
          return true;
        }
        if (o.paymentMethod === PaymentMethod.PayAfter) {
          return true;
        }
        if (o.paymentMethod === PaymentMethod.Transfer) {
          return (
            o.paymentStatus === PaymentStatus.Verified ||
            o.paymentStatus === PaymentStatus.Paid
          );
        }
        return false;
      }),
    [orders],
  );

  // กำลังจัดส่ง: ออเดอร์ที่มี tracking number แล้ว (COD และ PayAfter auto เปลี่ยน, Transfer ต้องมี tracking)
  const shippingOrders = useMemo(
    () =>
      orders.filter((o) => {
        // ต้องมี tracking number
        if (!o.trackingNumbers || o.trackingNumbers.length === 0) {
          return false;
        }
        // ต้องยังไม่ PreApproved (ถ้า PreApproved จะไป tab รอตรวจสอบจากบัญชี)
        if (o.paymentStatus === PaymentStatus.PreApproved) {
          return false;
        }
        // ต้องยังไม่ Approved/Paid (ถ้า Approved/Paid จะไป tab เสร็จสิ้น)
        if (o.paymentStatus === PaymentStatus.Approved || o.paymentStatus === PaymentStatus.Paid) {
          return false;
        }
        return (
          o.orderStatus === OrderStatus.Shipping ||
          o.orderStatus === OrderStatus.Preparing ||
          (o.orderStatus === OrderStatus.Pending && o.trackingNumbers.length > 0)
        );
      }),
    [orders],
  );
  
  const displayedOrders = useMemo(() => {
    let sourceOrders;
    if (activeTab === 'pending') {
      sourceOrders = pendingOrders;
    } else if (activeTab === 'verified') {
      sourceOrders = awaitingExportOrders;
    } else if (activeTab === 'preparing') {
      sourceOrders = preparingOrders;
    } else if (activeTab === 'shipping') {
      sourceOrders = shippingOrders;
    } else if (activeTab === 'awaiting_account') {
      sourceOrders = awaitingAccountCheckOrders;
    } else if (activeTab === 'completed') {
      sourceOrders = completedOrders;
    } else {
      sourceOrders = [];
    }
    
    // กรองตามวันที่จัดส่งเฉพาะ tab "รอดึงข้อมูล" เท่านั้น
    if (activeTab !== 'verified') {
      return sourceOrders;
    }
    
    if (activeDatePreset === 'all') {
      return sourceOrders;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return sourceOrders.filter(order => {
        const deliveryDate = new Date(order.deliveryDate);
        deliveryDate.setHours(0, 0, 0, 0);
        
        switch (activeDatePreset) {
            case 'today':
                return deliveryDate.getTime() === today.getTime();
            case 'tomorrow':
                const tomorrow = new Date(today);
                tomorrow.setDate(today.getDate() + 1);
                return deliveryDate.getTime() === tomorrow.getTime();
            case 'next7days':
                const sevenDaysLater = new Date(today);
                sevenDaysLater.setDate(today.getDate() + 7);
                return deliveryDate >= today && deliveryDate <= sevenDaysLater;
            case 'next30days':
                const thirtyDaysLater = new Date(today);
                thirtyDaysLater.setDate(today.getDate() + 30);
                return deliveryDate >= today && deliveryDate <= thirtyDaysLater;
            case 'range':
                if (!dateRange.start || !dateRange.end) return true;
                const startDate = new Date(dateRange.start);
                startDate.setHours(0,0,0,0);
                const endDate = new Date(dateRange.end);
                endDate.setHours(0,0,0,0);
                return deliveryDate >= startDate && deliveryDate <= endDate;
            default:
                return true;
        }
    });
  }, [pendingOrders, awaitingExportOrders, preparingOrders, shippingOrders, awaitingAccountCheckOrders, completedOrders, activeTab, activeDatePreset, dateRange]);

  // Filter orders by delivery date for "รอดึงข้อมูล" tab only (for display count in date filter section)
  const filteredAwaitingExportOrders = useMemo(() => {
    if (activeDatePreset === 'all') {
      return awaitingExportOrders;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return awaitingExportOrders.filter(order => {
      const deliveryDate = new Date(order.deliveryDate);
      deliveryDate.setHours(0, 0, 0, 0);
      
      switch (activeDatePreset) {
        case 'today':
          return deliveryDate.getTime() === today.getTime();
        case 'tomorrow':
          const tomorrow = new Date(today);
          tomorrow.setDate(today.getDate() + 1);
          return deliveryDate.getTime() === tomorrow.getTime();
        case 'next7days':
          const sevenDaysLater = new Date(today);
          sevenDaysLater.setDate(today.getDate() + 7);
          return deliveryDate >= today && deliveryDate <= sevenDaysLater;
        case 'next30days':
          const thirtyDaysLater = new Date(today);
          thirtyDaysLater.setDate(today.getDate() + 30);
          return deliveryDate >= today && deliveryDate <= thirtyDaysLater;
        case 'range':
          if (!dateRange.start || !dateRange.end) return true;
          const startDate = new Date(dateRange.start);
          startDate.setHours(0,0,0,0);
          const endDate = new Date(dateRange.end);
          endDate.setHours(0,0,0,0);
          return deliveryDate >= startDate && deliveryDate <= endDate;
        default:
          return true;
      }
    });
  }, [awaitingExportOrders, activeDatePreset, dateRange]);

  // Apply advanced filters on top of displayedOrders (non-destructive to existing logic)
  const customerById = useMemo(() => {
    const m = new Map<string, Customer>();
    for (const c of customers) m.set(c.id as any, c);
    return m;
  }, [customers]);

  const finalDisplayedOrders = useMemo(() => {
    let list = displayedOrders.slice();
    const idTerm = afOrderId.trim().toLowerCase();
    const trackTerm = afTracking.trim().toLowerCase();
    if (idTerm) list = list.filter(o => o.id.toLowerCase().includes(idTerm));
    if (trackTerm) list = list.filter(o => (o.trackingNumbers || []).some(t => t.toLowerCase().includes(trackTerm)));
    if (afOrderDate.start) { const s = new Date(afOrderDate.start); s.setHours(0,0,0,0); list = list.filter(o => { const d = new Date(o.orderDate); d.setHours(0,0,0,0); return d >= s; }); }
    if (afOrderDate.end) { const e = new Date(afOrderDate.end); e.setHours(23,59,59,999); list = list.filter(o => { const d = new Date(o.orderDate); return d <= e; }); }
    if (afDeliveryDate.start) { const s = new Date(afDeliveryDate.start); s.setHours(0,0,0,0); list = list.filter(o => { const d = new Date(o.deliveryDate); d.setHours(0,0,0,0); return d >= s; }); }
    if (afDeliveryDate.end) { const e = new Date(afDeliveryDate.end); e.setHours(23,59,59,999); list = list.filter(o => { const d = new Date(o.deliveryDate); return d <= e; }); }
    if (afPaymentMethod) list = list.filter(o => o.paymentMethod === afPaymentMethod);
    // Payment status filtering is done via advanced filters only
    if (afPaymentStatus) list = list.filter(o => o.paymentStatus === afPaymentStatus);
    const nameTerm = afCustomerName.trim().toLowerCase();
    if (nameTerm) {
      list = list.filter(o => {
        const c = customerById.get(o.customerId as any);
        if (!c) return false;
        const full = `${(c.firstName||'').toString()} ${(c.lastName||'').toString()}`.toLowerCase();
        return full.includes(nameTerm) || (c.firstName||'').toString().toLowerCase().includes(nameTerm) || (c.lastName||'').toString().toLowerCase().includes(nameTerm);
      });
    }
    const phoneTerm = afCustomerPhone.replace(/\D/g, '');
    if (phoneTerm) {
      list = list.filter(o => {
        const c = customerById.get(o.customerId as any);
        if (!c) return false;
        const p = ((c.phone||'') as any).toString().replace(/\D/g, '');
        return p.includes(phoneTerm);
      });
    }
    return list;
  }, [displayedOrders, afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone, customerById]);

  // Pagination logic
  const safeItemsPerPage = itemsPerPage > 0 ? itemsPerPage : PAGE_SIZE_OPTIONS[1];
  const totalItems = finalDisplayedOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = totalItems === 0 ? 0 : (effectivePage - 1) * safeItemsPerPage;
  const endIndex = Math.min(startIndex + safeItemsPerPage, totalItems);
  
  const paginatedOrders = useMemo(() => 
    finalDisplayedOrders.slice(startIndex, endIndex), 
    [finalDisplayedOrders, startIndex, endIndex]
  );

  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = totalItems === 0 ? 0 : endIndex;

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
            boxes: Array.isArray(r.boxes) ? r.boxes.map((b: any) => ({ boxNumber: Number(b.box_number ?? 0), codAmount: Number(b.cod_amount ?? 0) })) : [],
            notes: r.notes ?? undefined,
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
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
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


          return order.items.map(item => {
              const codAmount = order.paymentMethod === PaymentMethod.COD ? (order.boxes?.reduce((sum, box) => sum + box.codAmount, 0) || order.totalAmount) : 0;
              
              const rowData: { [key: string]: string | number | undefined } = {
                  'หมายเลขออเดอร์ออนไลน์': order.id,
                  'ชื่อร้านค้า': 'N/A',
                  'เวลาที่สั่งซื้อ': new Date(order.orderDate).toLocaleString('th-TH'),
                  'บัญชีร้านค้า': 'N/A',
                  'หมายเลขใบชำระเงิน': '',
                  'COD': codAmount,
                  'ช่องทางชำระเงิน': order.paymentMethod,
                  'เวลาชำระเงิน': '',
                  'หมายเหตุใบสั่งซื้อ': order.notes,
                  'ข้อความจากร้านค้า': '',
                  'ค่าขนส่ง': order.shippingCost,
                  'จำนวนเงินที่ต้องชำระ': order.totalAmount,
                  'ผู้รับสินค้า': customer?.firstName,
                  'นามสกุลผู้รับสินค้า': customer?.lastName,
                  'หมายเลขโทรศัพท์': customer?.phone,
                  'หมายเลขมือถือ': customer?.phone,
                  'สถานที่': address.street,
                  'ภูมิภาค': address.subdistrict,
                  'อำเภอ': address.district,
                  'จังหวัด': address.province,
                  'รหัสไปรษณีย์': address.postalCode,
                  'ประเทศ': 'ไทย',
                  'รับสินค้าที่ร้านหรือไม่': 'ไม่',
                  'รหัสสินค้าบนแพลตฟอร์ม': item.id,
                  'รหัสสินค้าในระบบ': item.id,
                  'ชื่อสินค้า': item.productName,
                  'สีและรูปแบบ': '',
                  'จำนวน': item.quantity,
                  'ราคาสินค้าต่อหน่วย': item.pricePerUnit,
                  'บริษัทขนส่ง': '',
                  'หมายเลขขนส่ง': order.trackingNumbers.join(', '),
                  'เวลาส่งสินค้า': new Date(order.deliveryDate).toLocaleDateString('th-TH'),
                  'สถานะ': order.orderStatus,
                  'พนักงานขาย': seller ? `${seller.firstName} ${seller.lastName}` : '',
                  'หมายเหตุออฟไลน์': '',
                  'รูปแบบคำสั่งซื้อ': 'ออนไลน์',
                  'รูปแบบการชำระ': order.paymentMethod,
              };
              
              return headers.map(header => rowData[header]);
          });
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
      const filename = `orders_export_${new Date().toISOString().slice(0,10)}.csv`;
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
    const baseMap = new Map(displayedOrders.map(o => [o.id, o]));
    let selectedOrders = selectedIds
      .map(id => fullOrdersById[id] || baseMap.get(id))
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
            boxes: Array.isArray(r.boxes) ? r.boxes.map((b: any) => ({ boxNumber: Number(b.box_number ?? 0), codAmount: Number(b.cod_amount ?? 0) })) : (fallback.boxes || []),
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
      alert('ตรวจสอบสลิปก่อน Export ไม่สำเร็จ กรุณาลองใหม่');
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
    return c;
  }, [afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone]);

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
    setShowAdvanced(false);
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
    { label: 'พรุ่งนี้', value: 'tomorrow', hasSpacing: true }, // เพิ่ม flag สำหรับเว้นระยะห่าง
    { label: 'ล่วงหน้า 7 วัน', value: 'next7days' },
    { label: 'ล่วงหน้า 30 วัน', value: 'next30days' },
    { label: 'ทั้งหมด', value: 'all' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">จัดการออเดอร์</h2>
            <p className="text-gray-600">{`ทั้งหมด ${finalDisplayedOrders.length} รายการ`}</p>
        </div>
        {activeTab !== 'pending' && (
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
        {activeTab === 'pending' && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (selectedIds.length === 0) return;
                if (window.confirm(`คุณต้องการยกเลิกออเดอร์ ${selectedIds.length} รายการใช่หรือไม่?`)) {
                  onCancelOrders(selectedIds);
                }
              }}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ยกเลิกออเดอร์ ({selectedIds.length})
            </button>
            <button
              onClick={handleMoveToAwaitingExport}
              disabled={selectedIds.length === 0}
              className="inline-flex items-center px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ListChecks size={16} className="mr-2" />
              ย้ายไปยังรอดึงข้อมูล ({selectedIds.length})
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
          <button onClick={() => setShowAdvanced(v=>!v)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50">
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
              <input value={fCustomerName} onChange={e=>setFCustomerName(e.target.value)} className="w-full p-2 border rounded" placeholder="ชื่อหรือนามสกุล" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">เบอร์โทร</label>
              <input value={fCustomerPhone} onChange={e=>setFCustomerPhone(e.target.value)} className="w-full p-2 border rounded" placeholder="เช่น 0812345678" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">เลขออเดอร์</label>
              <input value={fOrderId} onChange={e=>setFOrderId(e.target.value)} className="w-full p-2 border rounded" placeholder="ORD-..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ค้นหา Tracking</label>
              <input value={fTracking} onChange={e=>setFTracking(e.target.value)} className="w-full p-2 border rounded" placeholder="TH..." />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">วิธีการชำระ</label>
              <select value={fPaymentMethod} onChange={e=>setFPaymentMethod((e.target.value as any)||'')} className="w-full p-2 border rounded">
                <option value="">ทั้งหมด</option>
                <option value={PaymentMethod.Transfer}>โอนเงิน</option>
                <option value={PaymentMethod.COD}>เก็บเงินปลายทาง (COD)</option>
                <option value={PaymentMethod.PayAfter}>รับสินค้าก่อน</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">สถานะการชำระ</label>
              <select value={fPaymentStatus} onChange={e=>setFPaymentStatus((e.target.value as any)||'')} className="w-full p-2 border rounded">
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
              <label className="block text-xs text-gray-500 mb-1">ช่วงวันที่ออเดอร์ (จาก)</label>
              <input type="date" value={fOrderDate.start} onChange={e=>setFOrderDate(v=>({...v,start:e.target.value}))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ช่วงวันที่ออเดอร์ (ถึง)</label>
              <input type="date" value={fOrderDate.end} onChange={e=>setFOrderDate(v=>({...v,end:e.target.value}))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่ส่ง (จาก)</label>
              <input type="date" value={fDeliveryDate.start} onChange={e=>setFDeliveryDate(v=>({...v,start:e.target.value}))} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">วันที่ส่ง (ถึง)</label>
              <input type="date" value={fDeliveryDate.end} onChange={e=>setFDeliveryDate(v=>({...v,end:e.target.value}))} className="w-full p-2 border rounded" />
            </div>
          </div>
        )}
      </div>

      <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'pending'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListChecks size={16} />
            <span>รอตรวจสอบสลิป</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'pending' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
             }`}>{pendingOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('verified')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'verified'
                ? 'border-b-2 border-yellow-600 text-yellow-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ListChecks size={16} />
            <span>รอดึงข้อมูล</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'verified' ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-600'
             }`}>{awaitingExportOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('preparing')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'preparing'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package size={16} />
            <span>กำลังจัดเตรียม</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'preparing' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
             }`}>{preparingOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('shipping')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'shipping'
                ? 'border-b-2 border-purple-600 text-purple-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Send size={16} />
            <span>กำลังจัดส่ง</span>
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'shipping' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-600'
             }`}>{shippingOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('awaiting_account')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'awaiting_account'
                ? 'border-b-2 border-orange-600 text-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock size={16} />
            <span>รอตรวจสอบจากบัญชี</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'awaiting_account' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
             }`}>{awaitingAccountCheckOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'completed'
                ? 'border-b-2 border-gray-600 text-gray-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>เสร็จสิ้น</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'completed' ? 'bg-gray-100 text-gray-600' : 'bg-gray-100 text-gray-600'
             }`}>{completedOrders.length}</span>
          </button>
      </div>

      {/* แสดงตัวกรองวันที่จัดส่งเฉพาะ tab "รอดึงข้อมูล" */}
      {activeTab === 'verified' && (
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center mr-4">
                  <Calendar size={16} className="text-gray-500 mr-2"/>
                  <span className="text-sm font-medium text-gray-700">วันจัดส่ง:</span>
                  <span className="text-sm text-gray-600 ml-2">({filteredAwaitingExportOrders.length} รายการ)</span>
              </div>
              {datePresets.map((preset, index) => (
                  <React.Fragment key={preset.value}>
                      <DateFilterButton 
                          label={preset.label}
                          value={preset.value}
                          activeValue={activeDatePreset}
                          onClick={handleDatePresetClick}
                      />
                      {preset.hasSpacing && <div className="w-8" />}
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
      
      <div className="bg-white rounded-lg shadow">
        <OrderTable 
            orders={paginatedOrders} 
            customers={customers} 
            openModal={openModal}
            users={users}
            selectable={activeTab === 'pending' || activeTab === 'verified'}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
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
                    className={`px-3 py-1 text-sm rounded ${
                      page === effectivePage
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
      </div>
    </div>
  );
};

export default ManageOrdersPage;
