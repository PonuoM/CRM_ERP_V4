
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User, Order, Customer, ModalType, PaymentMethod, PaymentStatus } from '../types';
import OrderTable from '../components/OrderTable';
import { CreditCard, List } from 'lucide-react';
import { History, ListChecks, Filter } from 'lucide-react';

interface TelesaleOrdersPageProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  openModal: (type: ModalType, data: Order) => void;
  onCancelOrder: (orderId: string) => void;
  title?: string;
}

const TelesaleOrdersPage: React.FC<TelesaleOrdersPageProps> = ({ user, orders, customers, openModal, onCancelOrder, title }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pendingSlip'>('all');
  const [payTab, setPayTab] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
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

  // Persist filters across page switches (per user)
  const filterStorageKey = `telesale_orders_filters_${user?.id ?? '0'}`;

  // Load saved filters once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(filterStorageKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === 'object') {
        setActiveTab(saved.activeTab === 'pendingSlip' ? 'pendingSlip' : 'all');
        setPayTab(saved.payTab === 'unpaid' || saved.payTab === 'paid' ? saved.payTab : 'unpaid');
        setShowAdvanced(!!saved.showAdvanced);
        setFOrderId(saved.fOrderId ?? '');
        setFTracking(saved.fTracking ?? '');
        setFOrderDate(saved.fOrderDate ?? { start: '', end: '' });
        setFDeliveryDate(saved.fDeliveryDate ?? { start: '', end: '' });
        setFPaymentMethod(saved.fPaymentMethod ?? '');
        if (saved.payTab === 'all') {
          setFPaymentStatus(saved.fPaymentStatus ?? '');
        }
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
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save filters whenever they change
  useEffect(() => {
    try {
      const payload = {
        activeTab,
        payTab,
        showAdvanced,
        fOrderId,
        fTracking,
        fOrderDate,
        fDeliveryDate,
        fPaymentMethod,
        fPaymentStatus: payTab === 'all' ? fPaymentStatus : undefined,
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
      };
      localStorage.setItem(filterStorageKey, JSON.stringify(payload));
    } catch {}
  }, [activeTab, payTab, showAdvanced, fOrderId, fTracking, fOrderDate, fDeliveryDate, fPaymentMethod, fPaymentStatus, fCustomerName, fCustomerPhone, afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, afCustomerName, afCustomerPhone, filterStorageKey]);
  
  const myOrders = useMemo(() => {
    return orders.filter(order => order.creatorId === user.id);
  }, [orders, user.id]);

  const pendingSlipOrders = useMemo(() => {
    return myOrders.filter(o => o.paymentMethod === PaymentMethod.Transfer && o.paymentStatus !== PaymentStatus.Paid);
  }, [myOrders]);

  const displayedOrders = activeTab === 'pendingSlip' ? pendingSlipOrders : myOrders;

  // Sync payment status with payTab (do not clear when switching back to 'all')
  useEffect(() => {
    if (payTab === 'unpaid') setFPaymentStatus(PaymentStatus.Unpaid);
    else if (payTab === 'paid') setFPaymentStatus(PaymentStatus.Paid);
    else {
      // keep user-selected status for 'all'
    }
  }, [payTab]);

  // Advanced filter badge count (based on applied values; exclude implied status)
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
    if (payTab === 'all' && afPaymentStatus && String(afPaymentStatus).trim() !== '') c += 1;
    return c;
  }, [afOrderId, afTracking, afOrderDate, afDeliveryDate, afPaymentMethod, afPaymentStatus, payTab, afCustomerName, afCustomerPhone]);

  const clearFilters = () => {
    // reset draft filters
    setFOrderId('');
    setFTracking('');
    setFOrderDate({ start: '', end: '' });
    setFDeliveryDate({ start: '', end: '' });
    setFPaymentMethod('' as any);
    if (payTab === 'all') setFPaymentStatus('' as any);
    setFCustomerName('');
    setFCustomerPhone('');
    // reset applied filters
    setAfOrderId('');
    setAfTracking('');
    setAfOrderDate({ start: '', end: '' });
    setAfDeliveryDate({ start: '', end: '' });
    setAfPaymentMethod('' as any);
    if (payTab === 'all') setAfPaymentStatus('' as any);
    setAfCustomerName('');
    setAfCustomerPhone('');
  };

  // Apply (Search) filters action
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

  const finalOrders = useMemo(() => {
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

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title || "คำสั่งซื้อของฉัน"}</h2>
      
      <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <List size={16} />
            <span>ออเดอร์ทั้งหมด</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>{myOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('pendingSlip')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'pendingSlip'
                ? 'border-b-2 border-orange-600 text-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard size={16} />
            <span>รอสลิป</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'pendingSlip' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
            }`}>{pendingSlipOrders.length}</span>
          </button>
          <button onClick={() => { if (payTab==='unpaid') { setPayTab('all'); setAfPaymentStatus('' as any); setFPaymentStatus('' as any); } else { setPayTab('unpaid'); } }} className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${payTab==='unpaid'?'border-b-2 border-red-600 text-red-600':'text-gray-500 hover:text-gray-700'}`}>
            <ListChecks size={16} />
            <span>ยังไม่ชำระ</span>
          </button>
          <button onClick={() => { if (payTab==='paid') { setPayTab('all'); setAfPaymentStatus('' as any); setFPaymentStatus('' as any); } else { setPayTab('paid'); } }} className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${payTab==='paid'?'border-b-2 border-green-600 text-green-600':'text-gray-500 hover:text-gray-700'}`}>
            <ListChecks size={16} />
            <span>ชำระแล้ว</span>
          </button>
      </div>

      {/* Payment tabs (moved to top row) */}
      {false && (
      <div className="flex border-b border-gray-200 mb-4">
        <button onClick={() => setPayTab('all')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab==='all'?'border-b-2 border-blue-600 text-blue-600':'text-gray-500 hover:text-gray-700'}`}>
          <History size={16} />
          <span>ทั้งหมด</span>
        </button>
        <button onClick={() => setPayTab('unpaid')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab==='unpaid'?'border-b-2 border-red-600 text-red-600':'text-gray-500 hover:text-gray-700'}`}>
          <ListChecks size={16} />
          <span>ยังไม่ชำระ</span>
        </button>
        <button onClick={() => setPayTab('paid')} className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium transition-colors ${payTab==='paid'?'border-b-2 border-green-600 text-green-600':'text-gray-500 hover:text-gray-700'}`}>
          <ListChecks size={16} />
          <span>ชำระแล้ว</span>
        </button>
      </div>
      )}

      {/* ตัวกรองขั้นสูง */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4" ref={advRef}>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdvanced(v=>!v)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50">
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

      <div className="bg-white rounded-lg shadow">
        <OrderTable 
            orders={finalOrders} 
            customers={customers} 
            openModal={openModal} 
            user={user}
            onCancelOrder={onCancelOrder}
        />
      </div>
    </div>
  );
};

export default TelesaleOrdersPage;
