

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Order, Customer, ModalType, OrderStatus, PaymentMethod, PaymentStatus } from '../types';
import OrderTable from '../components/OrderTable';
import { Send, Calendar, ListChecks, History, Filter } from 'lucide-react';
import { createExportLog, listOrderSlips } from '../services/api';
import { apiFetch } from '../services/api';

interface ManageOrdersPageProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  users: User[];
  openModal: (type: ModalType, data: Order) => void;
  onProcessOrders: (orderIds: string[]) => void;
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

const ManageOrdersPage: React.FC<ManageOrdersPageProps> = ({ user, orders, customers, users, openModal, onProcessOrders }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeDatePreset, setActiveDatePreset] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');
  const [fullOrdersById, setFullOrdersById] = useState<Record<string, Order>>({});
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
        setActiveDatePreset(saved.activeDatePreset ?? 'all');
        setDateRange(saved.dateRange ?? { start: '', end: '' });
        setActiveTab(saved.activeTab === 'processed' ? 'processed' : 'pending');
        setPayTab(saved.payTab === 'unpaid' || saved.payTab === 'paid' ? saved.payTab : 'all');
        setShowAdvanced(!!saved.showAdvanced);
        setFOrderId(saved.fOrderId ?? '');
        setFTracking(saved.fTracking ?? '');
        setFOrderDate(saved.fOrderDate ?? { start: '', end: '' });
        setFDeliveryDate(saved.fDeliveryDate ?? { start: '', end: '' });
        setFPaymentMethod(saved.fPaymentMethod ?? '');
        // fPaymentStatus is controlled by payTab when not 'all'; when 'all' restore saved
        if (saved.payTab === 'all') {
          setFPaymentStatus(saved.fPaymentStatus ?? '');
        }
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
        payTab,
        showAdvanced,
        fOrderId,
        fTracking,
        fOrderDate,
        fDeliveryDate,
        fPaymentMethod,
        // Save fPaymentStatus for 'all' tab; for unpaid/paid it is implied
        fPaymentStatus: payTab === 'all' ? fPaymentStatus : undefined,
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
  }, [activeDatePreset, dateRange, activeTab, payTab, showAdvanced, fOrderId, fTracking, fOrderDate, fDeliveryDate, fPaymentMethod, fPaymentStatus, fCustomerName, fCustomerPhone, afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  const pendingOrders = useMemo(() => orders.filter(o => o.orderStatus === OrderStatus.Pending), [orders]);
  
  const processedOrders = useMemo(() => orders.filter(o => 
      o.orderStatus !== OrderStatus.Pending &&
      o.orderStatus !== OrderStatus.Delivered && 
      o.orderStatus !== OrderStatus.Cancelled && 
      o.orderStatus !== OrderStatus.Returned
  ), [orders]);
  
  const displayedOrders = useMemo(() => {
    const sourceOrders = activeTab === 'pending' ? pendingOrders : processedOrders;
    
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
  }, [pendingOrders, processedOrders, activeTab, activeDatePreset, dateRange]);

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
    const effectiveStatus = payTab === 'unpaid' ? PaymentStatus.Unpaid : (payTab === 'paid' ? PaymentStatus.Paid : afPaymentStatus);
    if (effectiveStatus) list = list.filter(o => o.paymentStatus === effectiveStatus);
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
  }, [displayedOrders, afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, payTab, afCustomerName, afCustomerPhone, customerById]);

  // Local helpers to map API enums/shape to UI types used by the CSV generator
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
          const customer = customers.find(c => c.id === order.customerId);
          const seller = users.find(u => u.id === order.creatorId);
          const address = order.shippingAddress || { street: '', subdistrict: '', district: '', province: '', postalCode: '' };


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
              street: (r.street ?? (fallback as any).shippingAddress?.street) || '',
              subdistrict: (r.subdistrict ?? (fallback as any).shippingAddress?.subdistrict) || '',
              district: (r.district ?? (fallback as any).shippingAddress?.district) || '',
              province: (r.province ?? (fallback as any).shippingAddress?.province) || '',
              postalCode: (r.postal_code ?? (fallback as any).shippingAddress?.postalCode) || '',
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
             setActiveDatePreset('all');
        }
        return newRange;
    });
  };

  // Sync payment status filter with payTab selection
  useEffect(() => {
    if (payTab === 'unpaid') {
      setFPaymentStatus(PaymentStatus.Unpaid);
    } else if (payTab === 'paid') {
      setFPaymentStatus(PaymentStatus.Paid);
    } else {
      // payTab === 'all' -> keep user-selected payment status (persisted)
    }
  }, [payTab]);

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
    const statusCountable = payTab === 'all' ? afPaymentStatus : '';
    if (statusCountable && String(statusCountable).trim() !== '') c += 1;
    return c;
  }, [afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, payTab, afCustomerName, afCustomerPhone]);

  const clearFilters = () => {
    // Reset all filters but keep the tab's implied payment status
    setFOrderId('');
    setFTracking('');
    setFOrderDate({ start: '', end: '' });
    setFDeliveryDate({ start: '', end: '' });
    setFPaymentMethod('' as any);
    if (payTab === 'all') {
      setFPaymentStatus('' as any);
    }
    // Reset date presets
    setActiveDatePreset('all');
    setDateRange({ start: '', end: '' });
    // Also clear applied values immediately
    setAfOrderId('');
    setAfTracking('');
    setAfOrderDate({ start: '', end: '' });
    setAfDeliveryDate({ start: '', end: '' });
    setAfPaymentMethod('' as any);
    if (payTab === 'all') setAfPaymentStatus('' as any);
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
    setAfPaymentStatus(payTab === 'all' ? (fPaymentStatus || '' as any) : afPaymentStatus);
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
    { label: 'ทั้งหมด', value: 'all' },
    { label: 'วันนี้', value: 'today' },
    { label: 'พรุ่งนี้', value: 'tomorrow' },
    { label: 'ล่วงหน้า 7 วัน', value: 'next7days' },
    { label: 'ล่วงหน้า 30 วัน', value: 'next30days' },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">จัดการออเดอร์</h2>
            <p className="text-gray-600">{`ทั้งหมด ${finalDisplayedOrders.length} รายการ`}</p>
        </div>
        {selectedIds.length > 0 && (
            <button
                onClick={handleExportAndProcessSelected}
                className="bg-blue-100 text-blue-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-blue-200 shadow-sm"
            >
                <Send size={16} className="mr-2"/>
                Export และส่งให้คลัง ({selectedIds.length})
            </button>
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
            {payTab === 'all' && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">สถานะการชำระ</label>
                <select value={fPaymentStatus} onChange={e=>setFPaymentStatus((e.target.value as any)||'')} className="w-full p-2 border rounded">
                  <option value="">ทั้งหมด</option>
                  <option value={PaymentStatus.Unpaid}>ยังไม่ชำระ</option>
                  <option value={PaymentStatus.PendingVerification}>รอตรวจสอบ</option>
                  <option value={PaymentStatus.Paid}>ชำระแล้ว</option>
                </select>
              </div>
            )}
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

      {/* Payment tabs: All / Unpaid / Paid */}
      <div className="flex border-b border-gray-200 mb-4">
        <button
          onClick={() => setPayTab('all')}
          className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab==='all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <History size={16} />
          <span>ทั้งหมด</span>
        </button>
        <button
          onClick={() => setPayTab('unpaid')}
          className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab==='unpaid' ? 'border-b-2 border-red-600 text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ListChecks size={16} />
          <span>ยังไม่ชำระ</span>
        </button>
        <button
          onClick={() => setPayTab('paid')}
          className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab==='paid' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ListChecks size={16} />
          <span>ชำระแล้ว</span>
        </button>
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
            <span>ยังไม่ได้ดึงข้อมูล</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'pending' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>{pendingOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('processed')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'processed'
                ? 'border-b-2 border-green-600 text-green-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <History size={16} />
            <span>ดึงข้อมูลแล้ว</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'processed' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
            }`}>{processedOrders.length}</span>
          </button>
      </div>

      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center mr-4">
                <Calendar size={16} className="text-gray-500 mr-2"/>
                <span className="text-sm font-medium text-gray-700">วันจัดส่ง:</span>
            </div>
            {datePresets.map(preset => (
                <DateFilterButton 
                    key={preset.value}
                    label={preset.label}
                    value={preset.value}
                    activeValue={activeDatePreset}
                    onClick={handleDatePresetClick}
                />
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
      
      <div className="bg-white rounded-lg shadow">
        <OrderTable 
            orders={finalDisplayedOrders} 
            customers={customers} 
            openModal={openModal}
            users={users}
            selectable={activeTab === 'pending'}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
        />
      </div>
    </div>
  );
};

export default ManageOrdersPage;
