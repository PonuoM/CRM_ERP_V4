import React, { useState, useEffect } from 'react';
import { getUnacknowledgedCancellations, acknowledgeAllCancellations, acknowledgeCancellation } from '../../services/api';
import { CheckCircle2, AlertCircle, Clock, CheckSquare } from 'lucide-react';
import { useToast } from '../Toast';
import OrderDetailModal from '../OrderDetailModal';

interface CancellationAcknowledgeTabProps {
  dateRange: { start: string; end: string };
}

export default function CancellationAcknowledgeTab({ dateRange }: CancellationAcknowledgeTabProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  
  const { error: toastError, success } = useToast();

  useEffect(() => {
    fetchUnacknowledged();
  }, [dateRange]);

  const fetchUnacknowledged = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getUnacknowledgedCancellations({
        dateStart: dateRange.start || undefined,
        dateEnd: dateRange.end || undefined
      });
      if (res && res.ok) {
        setOrders(res.orders || []);
      } else {
        setError(res?.error || 'Failed to load pending orders');
      }
    } catch (e: any) {
      setError(e.message || 'Error loading pending orders');
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledgeSingle = async (orderId: string) => {
    try {
      const res = await acknowledgeCancellation(orderId);
      if (res && res.ok) {
        setOrders(prev => prev.filter(o => o.order_id !== orderId));
        success('สำเร็จ', 'รับทราบออเดอร์เรียบร้อยแล้ว');
      } else {
        toastError('เกิดข้อผิดพลาด', res?.message || 'Failed to acknowledge');
      }
    } catch (e: any) {
      toastError('เกิดข้อผิดพลาด', e.message || 'Failed to acknowledge');
    }
  };

  const handleAcknowledgeAll = async () => {
    if (orders.length === 0) return;
    
    if (!window.confirm(`ยืนยันการรับทราบออเดอร์ทั้งหมดจำนวน ${orders.length} รายการใช่หรือไม่?`)) {
      return;
    }

    try {
      const orderIds = orders.map(o => o.order_id);
      const res = await acknowledgeAllCancellations(orderIds);
      if (res && res.ok) {
        setOrders([]);
        success('สำเร็จ', `รับทราบออเดอร์ทั้งหมด ${res.count} รายการเรียบร้อยแล้ว`);
      } else {
        toastError('เกิดข้อผิดพลาด', res?.message || 'Failed to acknowledge all');
      }
    } catch (e: any) {
      toastError('เกิดข้อผิดพลาด', e.message || 'Failed to acknowledge all');
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-gray-500" />
            รายการออเดอร์รอรับทราบ ({orders.length})
          </h2>
          {orders.length > 0 && (
            <button 
              onClick={handleAcknowledgeAll}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <CheckSquare className="w-4 h-4" />
              รับทราบทั้งหมด
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mr-3"></div>
            กำลังโหลดข้อมูล...
          </div>
        ) : error ? (
          <div className="p-6">
            <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              {error}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">ออเดอร์</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">พนักงานขาย</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500 uppercase tracking-wider">เหตุผลที่ยกเลิก</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">มูลค่า (บาท)</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((o) => (
                  <tr key={o.order_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-blue-600 hover:text-blue-800 cursor-pointer" onClick={() => setSelectedOrderId(o.order_id)}>
                        #{o.order_id}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {new Date(o.order_date).toLocaleDateString('th-TH')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{o.creator_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {o.cancellation_reason || 'ไม่ระบุเหตุผล'}
                      </div>
                      {o.cancellation_notes && (
                        <p className="text-xs text-gray-500 mt-1 truncate max-w-xs" title={o.cancellation_notes}>
                          {o.cancellation_notes}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-gray-900">
                      ฿ {Number(o.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button 
                        onClick={() => handleAcknowledgeSingle(o.order_id)}
                        className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700 text-sm font-medium rounded-md transition-colors"
                      >
                        รับทราบ
                      </button>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">ไม่มีออเดอร์ค้างรับทราบ</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrderId && (
        <OrderDetailModal
          isOpen={!!selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          orderId={selectedOrderId}
        />
      )}
    </div>
  );
}
