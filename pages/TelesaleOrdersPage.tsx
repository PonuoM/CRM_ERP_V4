
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Order, Customer, ModalType, PaymentMethod, PaymentStatus } from '../types';
import OrderTable from '../components/OrderTable';
import { CreditCard, List, History, ListChecks, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import usePersistentState from '../utils/usePersistentState';
import { listOrders } from '../services/api';
import Spinner from '../components/Spinner';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 500];

interface TelesaleOrdersPageProps {
  user: User;
  users: User[];
  orders?: Order[]; // Make optional for backward compatibility
  customers: Customer[];
  openModal: (type: ModalType, data: Order) => void;
  onCancelOrder: (orderId: string) => void;
  title?: string;
}

const TelesaleOrdersPage: React.FC<TelesaleOrdersPageProps> = ({ user, users, orders, customers, openModal, onCancelOrder, title }) => {
  const filterStorageKey = `telesale_orders_filters_${user?.id ?? '0'}`;

  const savedFilters = useMemo<Record<string, unknown> | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(filterStorageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }, [filterStorageKey]);

  const initialPagination = useMemo(() => {
    const fallback = { itemsPerPage: PAGE_SIZE_OPTIONS[0], page: 1, hasStoredPage: false };
    if (!savedFilters) return fallback;

    const storedItems = Number(savedFilters['itemsPerPage']);
    const resolvedItems = Number.isFinite(storedItems) && PAGE_SIZE_OPTIONS.includes(storedItems)
      ? storedItems
      : fallback.itemsPerPage;

    const storedPage = Number(savedFilters['currentPage']);
    const hasStoredPage = Number.isFinite(storedPage) && storedPage >= 1;
    const resolvedPage = hasStoredPage ? Math.floor(storedPage) : fallback.page;

    return { itemsPerPage: resolvedItems, page: resolvedPage, hasStoredPage };
  }, [savedFilters]);

  const [activeTab, setActiveTab] = useState<'all' | 'pendingSlip'>('all');
  const [payTab, setPayTab] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fOrderId, setFOrderId] = useState('');
  const [fTracking, setFTracking] = useState('');
  const [fOrderDate, setFOrderDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [fDeliveryDate, setFDeliveryDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [fPaymentMethod, setFPaymentMethod] = useState<PaymentMethod | ''>('');
  const [fPaymentStatus, setFPaymentStatus] = useState<PaymentStatus | ''>('');
  const [fCustomerName, setFCustomerName] = useState('');
  const [fCustomerPhone, setFCustomerPhone] = useState('');
  // Applied (effective) advanced filters (only used after pressing Search)
  const [afOrderId, setAfOrderId] = useState('');
  const [afTracking, setAfTracking] = useState('');
  const [afOrderDate, setAfOrderDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [afDeliveryDate, setAfDeliveryDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [afPaymentMethod, setAfPaymentMethod] = useState<PaymentMethod | ''>('');
  const [afPaymentStatus, setAfPaymentStatus] = useState<PaymentStatus | ''>('');
  const [afCustomerName, setAfCustomerName] = useState('');
  const [afCustomerPhone, setAfCustomerPhone] = useState('');

  const advRef = useRef<HTMLDivElement | null>(null);

  // Use persistent state for pagination
  const paginationKey = `telesale_orders_pagination_${user?.id ?? '0'}`;
  const [itemsPerPage, setItemsPerPage] = usePersistentState<number>(
    `${paginationKey}:itemsPerPage`,
    initialPagination.itemsPerPage
  );
  const [currentPage, setCurrentPage] = usePersistentState<number>(
    `${paginationKey}:currentPage`,
    initialPagination.page
  );

  // API data states
  const [apiOrders, setApiOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalOrders, setTotalOrders] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [pendingSlipTotal, setPendingSlipTotal] = useState(0);
  const [allOrdersTotal, setAllOrdersTotal] = useState(0);

  // Load saved filters (key depends on user)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(filterStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        setActiveTab(saved.activeTab === 'pendingSlip' ? 'pendingSlip' : 'all');
        setPayTab('all'); // Always use 'all' - payment status filtering is done via advanced filters
        setShowAdvanced(!!saved.showAdvanced);
        setFOrderId(saved.fOrderId ?? '');
        setFTracking(saved.fTracking ?? '');
        setFOrderDate(saved.fOrderDate ?? { start: '', end: '' });
        setFDeliveryDate(saved.fDeliveryDate ?? { start: '', end: '' });
        setFPaymentMethod(saved.fPaymentMethod ?? '');
        setFPaymentStatus(saved.fPaymentStatus ?? '');
        setFCustomerName(saved.fCustomerName ?? '');
        setFCustomerPhone(saved.fCustomerPhone ?? '');
        // Applied values (fallback to edited values if absent)
        setAfOrderId(saved.afOrderId ?? saved.fOrderId ?? '');
        setAfTracking(saved.afTracking ?? saved.fTracking ?? '');
        setAfOrderDate(saved.afOrderDate ?? saved.fOrderDate ?? { start: '', end: '' });
        setAfDeliveryDate(saved.afDeliveryDate ?? saved.fDeliveryDate ?? { start: '', end: '' });
        setAfPaymentMethod(saved.afPaymentMethod ?? saved.fPaymentMethod ?? '');
        setAfPaymentStatus(saved.afPaymentStatus ?? saved.fPaymentStatus ?? '');
        setAfCustomerName(saved.afCustomerName ?? saved.fCustomerName ?? '');
        setAfCustomerPhone(saved.afCustomerPhone ?? saved.fCustomerPhone ?? '');
        const savedItemsPerPage = Number(saved.itemsPerPage);
        if (Number.isFinite(savedItemsPerPage) && PAGE_SIZE_OPTIONS.includes(savedItemsPerPage)) {
          setItemsPerPage(savedItemsPerPage);
        }
        const savedPage = Number(saved.currentPage);
        if (Number.isFinite(savedPage) && savedPage >= 1) {
          const normalized = Math.floor(savedPage);
          setCurrentPage(normalized);
        }
      }
    } catch { }
  }, [filterStorageKey]);

  // Save filters whenever they change
  useEffect(() => {
    try {
      const payload = {
        activeTab,
        showAdvanced,
        fOrderId,
        fTracking,
        fOrderDate,
        fDeliveryDate,
        fPaymentMethod,
        fPaymentStatus,
        fCustomerName,
        fCustomerPhone,
        afOrderId,
        afTracking,
        afOrderDate,
        afDeliveryDate,
        afPaymentMethod,
        afPaymentStatus,
        afCustomerName,
        afCustomerPhone,
        itemsPerPage,
        currentPage,
      };
      localStorage.setItem(filterStorageKey, JSON.stringify(payload));
    } catch { }
  }, [activeTab, showAdvanced, fOrderId, fTracking, fOrderDate, fDeliveryDate, fPaymentMethod, fPaymentStatus, fCustomerName, fCustomerPhone, afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone, itemsPerPage, currentPage, filterStorageKey]);

  // Fetch orders from API
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.companyId) return;

      setLoading(true);
      try {
        const response = await listOrders({
          companyId: user.companyId,
          page: currentPage,
          pageSize: itemsPerPage,
          creatorId: user.id, // Filter by current user
          orderId: afOrderId || undefined,
          trackingNumber: afTracking || undefined,
          orderDateStart: afOrderDate.start || undefined,
          orderDateEnd: afOrderDate.end || undefined,
          deliveryDateStart: afDeliveryDate.start || undefined,
          deliveryDateEnd: afDeliveryDate.end || undefined,
          paymentMethod: afPaymentMethod || undefined,
          // If on pendingSlip tab, filter by PendingVerification status
          paymentStatus: activeTab === 'pendingSlip' ? 'PendingVerification' : (afPaymentStatus || undefined),
          customerName: afCustomerName || undefined,
          customerPhone: afCustomerPhone || undefined,
        });

        if (response.ok) {
          // Map API response to frontend format
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
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        setApiOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user?.companyId, user?.id, currentPage, itemsPerPage, activeTab, afOrderId, afTracking, afOrderDate.start, afOrderDate.end, afDeliveryDate.start, afDeliveryDate.end, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone]);

  // Fetch pending slip count for badge (only when not on pendingSlip tab)
  useEffect(() => {
    const fetchPendingSlipCount = async () => {
      if (!user?.companyId || activeTab === 'pendingSlip') return;

      try {
        const response = await listOrders({
          companyId: user.companyId,
          page: 1,
          pageSize: 1, // We only need the count
          creatorId: user.id,
          paymentStatus: 'PendingVerification',
        });

        if (response.ok) {
          setPendingSlipTotal(response.pagination.total);
        }
      } catch (error) {
        console.error('Failed to fetch pending slip count:', error);
      }
    };

    fetchPendingSlipCount();
  }, [user?.companyId, user?.id, activeTab]);

  // Fetch all orders count for badge (only when not on all tab)
  useEffect(() => {
    const fetchAllOrdersCount = async () => {
      if (!user?.companyId || activeTab === 'all') return;

      try {
        const response = await listOrders({
          companyId: user.companyId,
          page: 1,
          pageSize: 1, // We only need the count
          creatorId: user.id,
          // No paymentStatus filter - get all orders
        });

        if (response.ok) {
          setAllOrdersTotal(response.pagination.total);
        }
      } catch (error) {
        console.error('Failed to fetch all orders count:', error);
      }
    };

    fetchAllOrdersCount();
  }, [user?.companyId, user?.id, activeTab]);

  // Always use API orders (no fallback to props)
  const displayedOrders = apiOrders;

  // Advanced filter badge count
  const advancedCount = useMemo(() => {
    const base = [
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
    let c = base.filter(v => !!v && String(v).trim() !== '').length;
    if (afPaymentStatus && String(afPaymentStatus).trim() !== '') c += 1;
    return c;
  }, [afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone]);

  const clearFilters = () => {
    // reset draft filters
    setFOrderId('');
    setFTracking('');
    setFOrderDate({ start: '', end: '' });
    setFDeliveryDate({ start: '', end: '' });
    setFPaymentMethod('' as any);
    setFPaymentStatus('' as any);
    setFCustomerName('');
    setFCustomerPhone('');
    // reset applied filters
    setAfOrderId('');
    setAfTracking('');
    setAfOrderDate({ start: '', end: '' });
    setAfDeliveryDate({ start: '', end: '' });
    setAfPaymentMethod('' as any);
    setAfPaymentStatus('' as any);
    setAfCustomerName('');
    setAfCustomerPhone('');
    setCurrentPage(1); // Reset to first page
  };

  // Apply (Search) filters action
  const applyAdvancedFilters = () => {
    setAfOrderId(fOrderId.trim());
    setAfTracking(fTracking.trim());
    setAfOrderDate({ ...fOrderDate });
    setAfDeliveryDate({ ...fDeliveryDate });
    setAfPaymentMethod(fPaymentMethod || '' as any);
    setAfPaymentStatus(fPaymentStatus || '' as any);
    setAfCustomerName(fCustomerName.trim());
    setAfCustomerPhone(fCustomerPhone.trim());
    setShowAdvanced(false);
    setCurrentPage(1); // Reset to first page when applying filters
  };

  // Click outside to collapse advanced panel
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

  const customerById = useMemo(() => {
    const m = new Map<string, Customer>();
    for (const c of customers) m.set(c.id as any, c);
    return m;
  }, [customers]);

  // Use server-side pagination data
  const totalItems = totalOrders;
  const totalPages = apiTotalPages;
  const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);
  const displayStart = totalItems === 0 ? 0 : (effectivePage - 1) * itemsPerPage + 1;
  const displayEnd = totalItems === 0 ? 0 : Math.min(effectivePage * itemsPerPage, totalItems);

  const handlePageChange = (page: number) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(next);
  };

  const handleItemsPerPageChange = (value: number) => {
    const nextValue = value > 0 ? value : PAGE_SIZE_OPTIONS[0];
    setItemsPerPage(nextValue);
    setCurrentPage(1);
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

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title || "คำสั่งซื้อของฉัน"}</h2>

      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'all'
            ? 'border-b-2 border-blue-600 text-blue-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <List size={16} />
          <span>ออเดอร์ทั้งหมด</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>{activeTab === 'all' ? totalOrders : allOrdersTotal}</span>
        </button>
        <button
          onClick={() => setActiveTab('pendingSlip')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'pendingSlip'
            ? 'border-b-2 border-orange-600 text-orange-600'
            : 'text-gray-500 hover:text-gray-700'
            }`}
        >
          <CreditCard size={16} />
          <span>รอสลิป</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'pendingSlip' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
            }`}>{activeTab === 'pendingSlip' ? totalOrders : pendingSlipTotal}</span>
        </button>
      </div>

      {/* Payment tabs (moved to top row) */}
      {false && (
        <div className="flex border-b border-gray-200 mb-4">
          <button onClick={() => setPayTab('all')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab === 'all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <History size={16} />
            <span>ทั้งหมด</span>
          </button>
          <button onClick={() => setPayTab('unpaid')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab === 'unpaid' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <ListChecks size={16} />
            <span>ยังไม่ชำระ</span>
          </button>
          <button onClick={() => setPayTab('paid')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab === 'paid' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}>
            <ListChecks size={16} />
            <span>ชำระแล้ว</span>
          </button>
        </div>
      )}

      {/* ตัวกรองขั้นสูง */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4" ref={advRef}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdvanced(v => !v)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50">
            <Filter size={14} />
            ตัวกรองขั้นสูง
            {advancedCount > 0 ? (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px]">{advancedCount}</span>
            ) : null}
          </button>
          <button onClick={applyAdvancedFilters} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border bg-blue-50 text-blue-700 hover:bg-blue-100">ค้นหา</button>
          {advancedCount > 0 && (
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

      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8">
            <Spinner size="md" />
          </div>
        ) : (
          <OrderTable
            orders={displayedOrders}
            customers={customers}
            openModal={openModal}
            user={user}
            users={users}
            onCancelOrder={onCancelOrder}
          />
        )}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <div className="text-sm text-gray-700">
            Showing {displayStart} to {displayEnd} of {totalItems} entries
          </div>
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-700">Lines per page</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
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
                  key={`${page}-${index}`}
                  onClick={() => (typeof page === 'number' ? handlePageChange(page) : undefined)}
                  disabled={page === '...'}
                  className={`px-3 py-1 text-sm rounded ${page === effectivePage
                    ? 'bg-blue-600 text-white'
                    : page === '...'
                      ? 'text-gray-400 cursor-default'
                      : 'text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {page}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(effectivePage + 1)}
                disabled={effectivePage === totalPages || totalItems === 0}
                className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelesaleOrdersPage;
