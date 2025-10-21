
import React, { useState, useMemo, useEffect } from 'react';
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
  const [payTab, setPayTab] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fOrderId, setFOrderId] = useState('');
  const [fTracking, setFTracking] = useState('');
  const [fOrderDate, setFOrderDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [fDeliveryDate, setFDeliveryDate] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [fPaymentMethod, setFPaymentMethod] = useState<PaymentMethod | ''>('');
  const [fPaymentStatus, setFPaymentStatus] = useState<PaymentStatus | ''>('');
  
  const myOrders = useMemo(() => {
    return orders.filter(order => order.creatorId === user.id);
  }, [orders, user.id]);

  const pendingSlipOrders = useMemo(() => {
    return myOrders.filter(o => o.paymentMethod === PaymentMethod.Transfer && o.paymentStatus !== PaymentStatus.Paid);
  }, [myOrders]);

  const displayedOrders = activeTab === 'pendingSlip' ? pendingSlipOrders : myOrders;

  // Sync payment status with payTab
  useEffect(() => {
    if (payTab === 'all') setFPaymentStatus('' as any);
    else if (payTab === 'unpaid') setFPaymentStatus(PaymentStatus.Unpaid);
    else setFPaymentStatus(PaymentStatus.Paid);
  }, [payTab]);

  const finalOrders = useMemo(() => {
    let list = displayedOrders.slice();
    const idTerm = fOrderId.trim().toLowerCase();
    const trackTerm = fTracking.trim().toLowerCase();
    if (idTerm) list = list.filter(o => o.id.toLowerCase().includes(idTerm));
    if (trackTerm) list = list.filter(o => (o.trackingNumbers || []).some(t => t.toLowerCase().includes(trackTerm)));
    if (fOrderDate.start) { const s = new Date(fOrderDate.start); s.setHours(0,0,0,0); list = list.filter(o => { const d = new Date(o.orderDate); d.setHours(0,0,0,0); return d >= s; }); }
    if (fOrderDate.end) { const e = new Date(fOrderDate.end); e.setHours(23,59,59,999); list = list.filter(o => { const d = new Date(o.orderDate); return d <= e; }); }
    if (fDeliveryDate.start) { const s = new Date(fDeliveryDate.start); s.setHours(0,0,0,0); list = list.filter(o => { const d = new Date(o.deliveryDate); d.setHours(0,0,0,0); return d >= s; }); }
    if (fDeliveryDate.end) { const e = new Date(fDeliveryDate.end); e.setHours(23,59,59,999); list = list.filter(o => { const d = new Date(o.deliveryDate); return d <= e; }); }
    if (fPaymentMethod) list = list.filter(o => o.paymentMethod === fPaymentMethod);
    if (fPaymentStatus) list = list.filter(o => o.paymentStatus === fPaymentStatus);
    return list;
  }, [displayedOrders, fOrderId, fTracking, fOrderDate, fDeliveryDate, fPaymentMethod, fPaymentStatus]);

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
      </div>

      {/* Payment tabs */}
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

      {/* Advanced Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdvanced(v=>!v)} className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md border hover:bg-gray-50">
            <Filter size={14} />
            Advanced Filters
            {(() => { const c=[fOrderId,fTracking,fOrderDate.start,fOrderDate.end,fDeliveryDate.start,fDeliveryDate.end,fPaymentMethod,fPaymentStatus].filter(v=>!!v && String(v).trim()!=='').length; return c>0 ? (<span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[10px]">{c}</span>) : null; })()}
          </button>
        </div>
        {showAdvanced && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
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
