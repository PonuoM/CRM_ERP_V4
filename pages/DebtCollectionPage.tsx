import React, { useMemo, useState, useEffect } from 'react';
import { User, Order, Customer, ModalType, PaymentStatus, OrderStatus } from '../types';
import OrderTable from '../components/OrderTable';
import { Filter, Calendar, PackageCheck, Loader2 } from 'lucide-react';
import { apiFetch } from '../services/api';

interface DebtCollectionPageProps {
  user: User;
  customers: Customer[];
  users: User[];
  openModal: (type: ModalType, data: Order) => void;
}

const DebtCollectionPage: React.FC<DebtCollectionPageProps> = ({ user, customers, users, openModal }) => {
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [readyOnly, setReadyOnly] = useState(true);
  const [requireTracking, setRequireTracking] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'shortfall_desc' | 'delivery_desc' | 'delivery_asc'>('shortfall_desc');

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      setLoading(true);
      try {
        const data = await apiFetch<Order[]>('/orders');
        if (data) {
          setOrders(data);
        }
      } catch (error) {
        console.error("Failed to fetch orders for debt collection:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Base: all orders that are not fully paid
  const notPaidOrders = useMemo(() => orders.filter(o => o.paymentStatus !== PaymentStatus.Paid), [orders]);

  // Apply business filters
  const filtered = useMemo(() => notPaidOrders.filter(o => {
    if (readyOnly && o.orderStatus !== OrderStatus.Delivered) return false;
    if (requireTracking && (!o.trackingNumbers || o.trackingNumbers.length === 0)) return false;
    if (startDate) {
      const d = new Date(o.deliveryDate);
      const s = new Date(startDate);
      if (isFinite(d.getTime()) && d < new Date(s.setHours(0, 0, 0, 0))) return false;
    }
    if (endDate) {
      const d = new Date(o.deliveryDate);
      const e = new Date(endDate);
      if (isFinite(d.getTime()) && d > new Date(e.setHours(23, 59, 59, 999))) return false;
    }
    return true;
  }), [notPaidOrders, readyOnly, requireTracking, startDate, endDate]);

  const paidAmount = (o: Order) => (o.amountPaid ?? (o as any).codAmount ?? 0) as number;
  const shortfall = (o: Order) => Math.max(0, o.totalAmount - paidAmount(o));

  const debtOrders = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case 'delivery_desc':
        return arr.sort((a, b) => new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime());
      case 'delivery_asc':
        return arr.sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime());
      case 'shortfall_desc':
      default:
        return arr.sort((a, b) => shortfall(b) - shortfall(a));
    }
  }, [filtered, sortBy]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">ติดตามหนี้</h2>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <>
          <p className="text-gray-600 mb-4">ทั้งหมด {debtOrders.length} ออเดอร์ (ยังไม่ชำระครบ)</p>

          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 mr-4">
                <Filter size={16} className="text-gray-500" />
                <label className="inline-flex items-center text-sm text-gray-700">
                  <input type="checkbox" className="mr-2" checked={readyOnly} onChange={e => setReadyOnly(e.target.checked)} />
                  เฉพาะ “ส่งถึงลูกค้าแล้ว” (Delivered)
                </label>
                <label className="inline-flex items-center text-sm text-gray-700 ml-4">
                  <input type="checkbox" className="mr-2" checked={requireTracking} onChange={e => setRequireTracking(e.target.checked)} />
                  ต้องมี Tracking
                </label>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <Calendar size={16} className="text-gray-500" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1 border border-gray-300 rounded-md text-sm" />
                <span className="text-gray-500 text-sm">ถึง</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1 border border-gray-300 rounded-md text-sm" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-600 flex items-center"><PackageCheck size={16} className="mr-1 text-gray-500" />จัดเรียง:</span>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="text-sm border border-gray-300 rounded-md p-1">
                <option value="shortfall_desc">ยอดค้างชำระ มาก → น้อย</option>
                <option value="delivery_desc">วันที่ส่งล่าสุด</option>
                <option value="delivery_asc">วันที่ส่งเก่าสุด</option>
              </select>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow">
            <OrderTable orders={debtOrders} customers={customers} openModal={openModal} users={users} />
          </div>
        </>
      )}
    </div>
  );
};

export default DebtCollectionPage;
