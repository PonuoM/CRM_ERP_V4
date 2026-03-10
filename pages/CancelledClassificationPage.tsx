import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardList,
  Search,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Check,
  RefreshCw,
  Filter,
} from 'lucide-react';
import { User } from '../types';
import {
  getCancellationTypes,
  analyzeCancelledOrders,
  confirmCancellation,
} from '../services/api';
import OrderDetailModal from '../components/OrderDetailModal';

interface CancelledClassificationPageProps {
  currentUser: User;
}

interface CancellationType {
  id: number;
  label: string;
  description: string;
}

interface RelatedOrder {
  order_id: string;
  order_date: string;
  total_amount: number;
  order_status: string;
  creator_name: string;
}

interface AnalyzedOrder {
  order_id: string;
  order_date: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  creator_name: string;
  suggested_type_id: number;
  suggested_type_label: string;
  confidence: 'high' | 'medium' | 'low';
  related_orders: RelatedOrder[];
}

interface Summary {
  total_cancelled: number;
  classified: number;
  unclassified: number;
}

const CONFIDENCE_CONFIG = {
  high: { label: 'สูง', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  medium: { label: 'ปานกลาง', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  low: { label: 'ต่ำ', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
};

const CancelledClassificationPage: React.FC<CancelledClassificationPageProps> = ({ currentUser }) => {
  const [cancellationTypes, setCancellationTypes] = useState<CancellationType[]>([]);
  const [orders, setOrders] = useState<AnalyzedOrder[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_cancelled: 0, classified: 0, unclassified: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<Record<string, number>>({});
  const [checkedOrders, setCheckedOrders] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  // Fetch cancellation types
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const res = await getCancellationTypes();
        if (res?.status === 'success') {
          setCancellationTypes(res.data);
        }
      } catch (err) {
        console.error('Failed to load cancellation types:', err);
      }
    };
    loadTypes();
  }, []);

  // Fetch analyzed orders
  const loadOrders = async (p: number = 1) => {
    if (!currentUser?.companyId) return;
    setLoading(true);
    try {
      const res = await analyzeCancelledOrders(currentUser.companyId, p, 20);
      if (res?.status === 'success') {
        setOrders(res.data || []);
        setSummary(res.summary || { total_cancelled: 0, classified: 0, unclassified: 0 });
        setTotalPages(res.pagination?.total_pages || 1);
        // Initialize selected types based on suggestions
        const newTypes: Record<string, number> = {};
        (res.data || []).forEach((o: AnalyzedOrder) => {
          newTypes[o.order_id] = o.suggested_type_id;
        });
        setSelectedTypes(newTypes);
        setCheckedOrders(new Set());
      }
    } catch (err) {
      console.error('Failed to load cancelled orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(page);
  }, [page, currentUser?.companyId]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (!searchTerm) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(o =>
      o.order_id.toLowerCase().includes(term) ||
      o.customer_name?.toLowerCase().includes(term) ||
      o.customer_phone?.includes(term)
    );
  }, [orders, searchTerm]);

  const toggleCheck = (orderId: string) => {
    setCheckedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleCheckAll = () => {
    if (checkedOrders.size === filteredOrders.length) {
      setCheckedOrders(new Set());
    } else {
      setCheckedOrders(new Set(filteredOrders.map(o => o.order_id)));
    }
  };

  const toggleExpand = (orderId: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const handleConfirm = async (orderIds?: string[]) => {
    const ids = orderIds || Array.from(checkedOrders);
    if (ids.length === 0) {
      alert('กรุณาเลือกรายการที่จะยืนยัน');
      return;
    }

    const items = ids.map(id => ({
      order_id: id,
      cancellation_type_id: selectedTypes[id] || 1,
    }));

    setSaving(true);
    try {
      const res = await confirmCancellation(items, currentUser.id);
      if (res?.status === 'success') {
        alert(`จัดประเภทสำเร็จ ${res.count} รายการ`);
        loadOrders(page);
      }
    } catch (err) {
      console.error('Failed to confirm:', err);
      alert('เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    const d = new Date(date);
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
            <ClipboardList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">จัดประเภทการยกเลิก</h1>
            <p className="text-sm text-gray-500">จำแนกออเดอร์ที่ถูกยกเลิกเป็นประเภทต่าง ๆ</p>
          </div>
        </div>
        <button
          onClick={() => loadOrders(page)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm text-sm font-medium text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{summary.total_cancelled}</p>
              <p className="text-xs text-gray-500">ยกเลิกทั้งหมด</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-green-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-700">{summary.classified}</p>
              <p className="text-xs text-gray-500">จัดประเภทแล้ว</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-orange-700">{summary.unclassified}</p>
              <p className="text-xs text-gray-500">ยังไม่จัดประเภท</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="ค้นหา Order ID, ชื่อ, เบอร์..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-72 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <span className="text-sm text-gray-500">
              {filteredOrders.length} รายการ
            </span>
          </div>
          {checkedOrders.size > 0 && (
            <button
              onClick={() => handleConfirm()}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg shadow hover:shadow-md transition font-medium text-sm disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saving ? 'กำลังบันทึก...' : `ยืนยัน ${checkedOrders.size} รายการ`}
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/80 text-left">
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={filteredOrders.length > 0 && checkedOrders.size === filteredOrders.length}
                    onChange={toggleCheckAll}
                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">Order ID</th>
                <th className="px-4 py-3 font-semibold text-gray-600">วันที่</th>
                <th className="px-4 py-3 font-semibold text-gray-600">ลูกค้า</th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right">ยอด (฿)</th>
                <th className="px-4 py-3 font-semibold text-gray-600">ผู้สร้าง</th>
                <th className="px-4 py-3 font-semibold text-gray-600">แนะนำ</th>
                <th className="px-4 py-3 font-semibold text-gray-600">ความเชื่อมั่น</th>
                <th className="px-4 py-3 font-semibold text-gray-600 min-w-[200px]">เลือกประเภท</th>
                <th className="px-4 py-3 font-semibold text-gray-600 w-20 text-center">ยืนยัน</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-400">กำลังโหลดข้อมูล...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">ไม่มีรายการที่ยังไม่จัดประเภท</p>
                    <p className="text-gray-400 text-xs mt-1">ออเดอร์ Cancelled ทั้งหมดถูกจัดประเภทแล้ว</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const conf = CONFIDENCE_CONFIG[order.confidence] || CONFIDENCE_CONFIG.medium;
                  const isExpanded = expandedOrders.has(order.order_id);
                  return (
                    <React.Fragment key={order.order_id}>
                      <tr className={`border-b border-gray-50 hover:bg-orange-50/30 transition ${checkedOrders.has(order.order_id) ? 'bg-orange-50/50' : ''}`}>
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={checkedOrders.has(order.order_id)}
                            onChange={() => toggleCheck(order.order_id)}
                            className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {order.related_orders.length > 0 && (
                              <button
                                onClick={() => toggleExpand(order.order_id)}
                                className="text-gray-400 hover:text-gray-600 transition"
                              >
                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </button>
                            )}
                            <button
                              onClick={() => setViewOrderId(order.order_id)}
                              className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition"
                            >
                              {order.order_id}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{formatDate(order.order_date)}</td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-gray-800 text-xs font-medium">{order.customer_name || '-'}</p>
                            <p className="text-gray-400 text-xs">{order.customer_phone || ''}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-gray-800">{formatAmount(order.total_amount)}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{order.creator_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            {order.suggested_type_label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${conf.bg} ${conf.text} border ${conf.border}`}>
                            {conf.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={selectedTypes[order.order_id] || order.suggested_type_id}
                            onChange={(e) =>
                              setSelectedTypes(prev => ({ ...prev, [order.order_id]: Number(e.target.value) }))
                            }
                            className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                          >
                            {cancellationTypes.map(ct => (
                              <option key={ct.id} value={ct.id}>{ct.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleConfirm([order.order_id])}
                            disabled={saving}
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition disabled:opacity-50"
                            title="ยืนยันรายการนี้"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      {/* Expanded: related orders */}
                      {isExpanded && order.related_orders.length > 0 && (
                        <tr className="bg-blue-50/30">
                          <td colSpan={10} className="px-8 py-3">
                            <div className="text-xs text-gray-500 font-medium mb-2 flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              ออเดอร์ที่เกี่ยวข้อง (ลูกค้าเดียวกัน ±7 วัน)
                            </div>
                            <div className="space-y-1.5">
                              {order.related_orders.map((rel) => (
                                <div key={rel.order_id} className="flex items-center gap-4 bg-white rounded-lg px-3 py-2 border border-blue-100">
                                  <button
                                    onClick={() => setViewOrderId(rel.order_id)}
                                    className="font-mono text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition"
                                  >
                                    {rel.order_id}
                                  </button>
                                  <span className="text-xs text-gray-500">{formatDate(rel.order_date)}</span>
                                  <span className="text-xs text-gray-500">฿{formatAmount(rel.total_amount)}</span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                                    rel.order_status === 'Delivered' ? 'bg-green-100 text-green-700' :
                                    rel.order_status === 'Shipping' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {rel.order_status}
                                  </span>
                                  <span className="text-xs text-gray-400">{rel.creator_name}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-sm text-gray-500">
              หน้า {page} จาก {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition"
              >
                ก่อนหน้า
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 transition"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <OrderDetailModal
        isOpen={!!viewOrderId}
        onClose={() => setViewOrderId(null)}
        orderId={viewOrderId}
        companyId={currentUser.companyId}
      />
    </div>
  );
};

export default CancelledClassificationPage;
