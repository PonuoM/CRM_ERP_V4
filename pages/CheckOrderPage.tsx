import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardList,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Check,
  RefreshCw,
  ArrowUpDown,
  Star,
  Settings,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  AlertTriangle,
  GripVertical,
  Shield,
  Tag,
  Wand2,
  UserCheck,
} from 'lucide-react';
import { User } from '../types';
import {
  getCancellationTypes,
  analyzeCancelledOrders,
  confirmCancellation,
  manageCancellationTypes,
  setDefaultCancellationType,
  validatePromotionOrders,
  fixPromotionOrders,
  validateCreatorOrders,
} from '../services/api';
import OrderDetailModal from '../components/OrderDetailModal';
import OrderManagementModal from '../components/OrderManagementModal';
import { patchOrder, getOrder } from '../services/api';

interface CheckOrderPageProps {
  currentUser: User;
}

// ======== Shared Types ========
interface CancellationType {
  id: number;
  label: string;
  description: string;
  sort_order?: number;
  is_active?: number;
  created_at?: string;
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

// ======== Classification Tab ========
const ClassificationTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [cancellationTypes, setCancellationTypes] = useState<CancellationType[]>([]);
  const [allOrders, setAllOrders] = useState<AnalyzedOrder[]>([]);
  const [summary, setSummary] = useState<Summary>({ total_cancelled: 0, classified: 0, unclassified: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedTypes, setSelectedTypes] = useState<Record<string, number>>({});
  const [checkedOrders, setCheckedOrders] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recommended' | 'all'>('recommended');
  const [sortKey, setSortKey] = useState<string>('order_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const loadOrders = async () => {
    if (!currentUser?.companyId) return;
    setLoading(true);
    try {
      const res = await analyzeCancelledOrders(currentUser.companyId, 1, 5000);
      if (res?.status === 'success') {
        setAllOrders(res.data || []);
        setSummary(res.summary || { total_cancelled: 0, classified: 0, unclassified: 0 });
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
    loadOrders();
  }, [currentUser?.companyId]);

  const filteredOrders = useMemo(() => {
    let result = allOrders;
    if (activeTab === 'recommended') {
      result = result.filter(o => o.confidence === 'high');
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(o =>
        o.order_id.toLowerCase().includes(term) ||
        o.customer_name?.toLowerCase().includes(term) ||
        o.customer_phone?.includes(term)
      );
    }
    result = [...result].sort((a, b) => {
      let valA: any, valB: any;
      switch (sortKey) {
        case 'order_id': valA = a.order_id; valB = b.order_id; break;
        case 'order_date': valA = a.order_date; valB = b.order_date; break;
        case 'customer_name': valA = a.customer_name || ''; valB = b.customer_name || ''; break;
        case 'total_amount': valA = a.total_amount; valB = b.total_amount; break;
        case 'creator_name': valA = a.creator_name || ''; valB = b.creator_name || ''; break;
        case 'suggested_type_label': valA = a.suggested_type_label; valB = b.suggested_type_label; break;
        case 'confidence':
          const order = { high: 3, medium: 2, low: 1 };
          valA = order[a.confidence] || 0;
          valB = order[b.confidence] || 0;
          break;
        default: valA = a.order_date; valB = b.order_date;
      }
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [allOrders, searchTerm, activeTab, sortKey, sortDir]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;
  const paginatedOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, page, pageSize]);

  useEffect(() => {
    setPage(1);
    setCheckedOrders(new Set());
  }, [activeTab, searchTerm, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon: React.FC<{ colKey: string }> = ({ colKey }) => {
    if (sortKey !== colKey) return <ArrowUpDown className="w-3 h-3 text-gray-300 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-orange-500 ml-1 inline" />
      : <ChevronDown className="w-3 h-3 text-orange-500 ml-1 inline" />;
  };

  const highConfidenceCount = useMemo(() => allOrders.filter(o => o.confidence === 'high').length, [allOrders]);

  const toggleCheck = (orderId: string) => {
    setCheckedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleCheckAll = () => {
    if (checkedOrders.size === paginatedOrders.length) {
      setCheckedOrders(new Set());
    } else {
      setCheckedOrders(new Set(paginatedOrders.map(o => o.order_id)));
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
        loadOrders();
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
    <div className="space-y-5">
      {/* Toolbar Row */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-1 max-w-xs">
          <div className="bg-white rounded-xl border border-orange-200 p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-700">{summary.unclassified}</p>
                <p className="text-xs text-gray-500">ยังไม่ระบุประเภท</p>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={() => loadOrders()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition shadow-sm text-sm font-medium text-gray-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-1 px-5 pt-3 border-b border-gray-100">
          <button
            onClick={() => setActiveTab('recommended')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
              activeTab === 'recommended'
                ? 'border-orange-500 text-orange-700 bg-orange-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            แนะนำ (ความมั่นใจสูง)
            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
              activeTab === 'recommended' ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-600'
            }`}>
              {highConfidenceCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition ${
              activeTab === 'all'
                ? 'border-orange-500 text-orange-700 bg-orange-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            ทั้งหมด
            <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
              activeTab === 'all' ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-600'
            }`}>
              {allOrders.length}
            </span>
          </button>
        </div>

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
                    checked={paginatedOrders.length > 0 && checkedOrders.size === paginatedOrders.length}
                    onChange={toggleCheckAll}
                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort('order_id')}>
                  Order ID <SortIcon colKey="order_id" />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort('order_date')}>
                  วันที่ <SortIcon colKey="order_date" />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort('customer_name')}>
                  ลูกค้า <SortIcon colKey="customer_name" />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 text-right cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort('total_amount')}>
                  ยอด (฿) <SortIcon colKey="total_amount" />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort('creator_name')}>
                  ผู้สร้าง <SortIcon colKey="creator_name" />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort('suggested_type_label')}>
                  แนะนำ <SortIcon colKey="suggested_type_label" />
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:text-orange-600 select-none" onClick={() => handleSort('confidence')}>
                  ความเชื่อมั่น <SortIcon colKey="confidence" />
                </th>
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
              ) : paginatedOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center">
                    <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                      {activeTab === 'recommended' ? 'ไม่มีรายการความมั่นใจสูง' : 'ไม่มีรายการที่ยังไม่จัดประเภท'}
                    </p>
                    <p className="text-gray-400 text-xs mt-1">
                      {activeTab === 'recommended' ? 'ลองดู tab "ทั้งหมด" สำหรับรายการทั้งหมด' : 'ออเดอร์ Cancelled ทั้งหมดถูกจัดประเภทแล้ว'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedOrders.map((order) => {
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
        {!loading && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                แสดง {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, filteredOrders.length)} จาก {filteredOrders.length} รายการ
              </span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value={10}>10 / หน้า</option>
                <option value={20}>20 / หน้า</option>
                <option value={50}>50 / หน้า</option>
                <option value={100}>100 / หน้า</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                หน้า {page} / {totalPages}
              </span>
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

// ======== Settings Tab ========
const SettingsTab: React.FC = () => {
  const [types, setTypes] = useState<CancellationType[]>([]);
  const [defaultTypeId, setDefaultTypeIdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ label: '', description: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ label: '', description: '' });
  const [saving, setSaving] = useState(false);

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await manageCancellationTypes('GET');
      if (res?.status === 'success') {
        setTypes(res.data || []);
        setDefaultTypeIdState(res.default_type_id ?? null);
      }
    } catch (err) {
      console.error('Failed to load types:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const handleAdd = async () => {
    if (!addForm.label.trim()) {
      alert('กรุณาระบุชื่อประเภท');
      return;
    }
    setSaving(true);
    try {
      const res = await manageCancellationTypes('POST', {
        label: addForm.label,
        description: addForm.description,
      });
      if (res?.status === 'success') {
        setAddForm({ label: '', description: '' });
        setShowAddForm(false);
        loadTypes();
      }
    } catch (err) {
      console.error('Failed to add type:', err);
      alert('เกิดข้อผิดพลาดในการเพิ่ม');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (type: CancellationType) => {
    setEditingId(type.id);
    setEditForm({ label: type.label, description: type.description || '' });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editForm.label.trim()) return;
    setSaving(true);
    try {
      await manageCancellationTypes('PUT', {
        id: editingId,
        label: editForm.label,
        description: editForm.description,
      });
      setEditingId(null);
      loadTypes();
    } catch (err) {
      console.error('Failed to update:', err);
      alert('เกิดข้อผิดพลาดในการแก้ไข');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: CancellationType) => {
    if (!confirm(`ต้องการลบประเภท "${type.label}" ใช่หรือไม่?`)) return;
    try {
      const res = await manageCancellationTypes('DELETE', { id: type.id });
      if (res?.status === 'success') {
        alert(res.message);
        loadTypes();
      }
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  const handleToggleActive = async (type: CancellationType) => {
    try {
      await manageCancellationTypes('PUT', {
        id: type.id,
        is_active: type.is_active ? 0 : 1,
      });
      loadTypes();
    } catch (err) {
      console.error('Failed to toggle:', err);
    }
  };

  const handleSetDefault = async (typeId: number) => {
    try {
      await setDefaultCancellationType(typeId);
      setDefaultTypeIdState(typeId);
    } catch (err) {
      console.error('Failed to set default:', err);
      alert('เกิดข้อผิดพลาดในการตั้งค่า');
    }
  };

  return (
    <div className="space-y-5 max-w-[900px]">
      {/* Default Setting Card */}
      <div className="bg-white rounded-xl border border-violet-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-violet-50/50 border-b border-violet-100">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-violet-600" />
            <h2 className="font-semibold text-violet-900 text-sm">ค่าเริ่มต้นสำหรับปุ่มยกเลิก (หน้า Orders)</h2>
          </div>
          <p className="text-xs text-violet-600 mt-1">เมื่อกดยกเลิกออเดอร์จากหน้า Orders จะใช้ประเภทนี้โดยอัตโนมัติ</p>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 flex-wrap">
            {types.filter(t => t.is_active).map(type => (
              <button
                key={type.id}
                onClick={() => handleSetDefault(type.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                  defaultTypeId === type.id
                    ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm ring-2 ring-violet-200'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:bg-violet-50/30'
                }`}
              >
                {defaultTypeId === type.id && <Star className="w-4 h-4 text-violet-500 fill-violet-500" />}
                {type.label}
              </button>
            ))}
          </div>
          {defaultTypeId && (
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-500" />
              ค่าเริ่มต้นปัจจุบัน: <strong className="text-gray-600">{types.find(t => t.id === defaultTypeId)?.label}</strong>
            </p>
          )}
        </div>
      </div>

      {/* Add Button + Form */}
      <div className="flex justify-end">
        {!showAddForm && (
          <button
            onClick={() => { setShowAddForm(true); setAddForm({ label: '', description: '' }); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg shadow hover:shadow-md transition text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            เพิ่มประเภท
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
          <h3 className="font-semibold text-green-800 text-sm mb-3 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            เพิ่มประเภทยกเลิกใหม่
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">ชื่อประเภท *</label>
              <input
                type="text"
                value={addForm.label}
                onChange={(e) => setAddForm(prev => ({ ...prev, label: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="ระบุชื่อประเภทยกเลิก"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">คำอธิบาย</label>
              <input
                type="text"
                value={addForm.description}
                onChange={(e) => setAddForm(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                placeholder="คำอธิบายเพิ่มเติม (ไม่บังคับ)"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !addForm.label.trim()}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-green-500 rounded-lg hover:bg-green-600 transition disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
          </div>
        </div>
      )}

      {/* Types List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <h2 className="font-semibold text-gray-700 text-sm">ประเภทการยกเลิกทั้งหมด ({types.length})</h2>
        </div>

        {loading ? (
          <div className="py-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">กำลังโหลด...</p>
          </div>
        ) : types.length === 0 ? (
          <div className="py-12 text-center">
            <AlertTriangle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">ยังไม่มีประเภทการยกเลิก</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {types.map((type) => (
              <div
                key={type.id}
                className={`flex items-center px-5 py-4 hover:bg-gray-50/50 transition-colors ${!type.is_active ? 'opacity-50 bg-gray-50/30' : ''}`}
              >
                <div className="flex items-center gap-3 mr-4 text-gray-300">
                  <GripVertical className="w-4 h-4" />
                  <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded">#{type.sort_order}</span>
                </div>

                {editingId === type.id ? (
                  <div className="flex-1 flex items-center gap-3">
                    <input
                      type="text"
                      value={editForm.label}
                      onChange={(e) => setEditForm(prev => ({ ...prev, label: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-violet-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      placeholder="คำอธิบาย"
                    />
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-gray-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-800 text-sm">{type.label}</span>
                        {defaultTypeId === type.id && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-violet-100 text-violet-700">
                            <Star className="w-3 h-3 fill-violet-500" />
                            ค่าเริ่มต้น
                          </span>
                        )}
                        {!type.is_active && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            ปิดใช้งาน
                          </span>
                        )}
                      </div>
                      {type.description && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{type.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 ml-4">
                      <button
                        onClick={() => handleToggleActive(type)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                          type.is_active
                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {type.is_active ? 'เปิดใช้' : 'ปิดอยู่'}
                      </button>
                      <button
                        onClick={() => handleEdit(type)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition"
                        title="แก้ไข"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(type)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                        title="ลบ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};



// ======== Promo Check Tab ========
const PromoCheckTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; mismatch: number }>({ total: 0, mismatch: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string>('order_id');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [manageOrder, setManageOrder] = useState<any | null>(null);
  const [manageLoading, setManageLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{ show: boolean; count: number; error?: string }>({ show: false, count: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await validatePromotionOrders(currentUser.companyId);
      if (res?.status === 'success') {
        setData((res.data || []).map((r: any) => ({
          ...r,
          total_amount: Number(r.total_amount) || 0,
          parent_net: Number(r.parent_net) || 0,
          parent_discount: Number(r.parent_discount) || 0,
          affected_children: Number(r.affected_children) || 0,
        })));
        setSummary({ total: Number(res.summary?.total_promo_orders || 0), mismatch: Number(res.summary?.mismatch_count || 0) });
      }
    } catch (err) {
      console.error('Failed to load promo validation', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let list = data;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(r => String(r.order_id).toLowerCase().includes(s) || String(r.customer_name || '').toLowerCase().includes(s) || String(r.promo_name || '').toLowerCase().includes(s));
    }
    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data, searchTerm, sortKey, sortDir]);

  const handleManage = async (orderId: string) => {
    setManageLoading(true);
    try {
      const { getOrder } = await import('../services/api');
      const orderData = await getOrder(orderId);
      if (orderData) {
        // Normalize items from API
        if (orderData.items && !Array.isArray(orderData.items)) {
          orderData.items = Object.values(orderData.items);
        }
        const normalizedOrder = {
          id: orderData.id ?? orderData.order_id,
          customerId: orderData.customer_id ?? orderData.customerId,
          companyId: currentUser.companyId,
          orderDate: orderData.order_date ?? orderData.orderDate,
          deliveryDate: orderData.delivery_date ?? orderData.deliveryDate,
          orderStatus: orderData.order_status ?? orderData.orderStatus ?? 'Pending',
          paymentMethod: orderData.payment_method ?? orderData.paymentMethod,
          paymentStatus: orderData.payment_status ?? orderData.paymentStatus,
          totalAmount: Number(orderData.total_amount ?? orderData.totalAmount ?? 0),
          shippingCost: Number(orderData.shipping_cost ?? orderData.shippingCost ?? 0),
          billDiscount: Number(orderData.bill_discount ?? orderData.billDiscount ?? 0),
          codAmount: Number(orderData.cod_amount ?? orderData.codAmount ?? 0),
          amountPaid: Number(orderData.amount_paid ?? orderData.amountPaid ?? 0),
          notes: orderData.notes,
          shippingAddress: orderData.shippingAddress ?? orderData.shipping_address ?? {
            recipientFirstName: orderData.recipient_first_name,
            recipientLastName: orderData.recipient_last_name,
            street: orderData.street,
            subdistrict: orderData.subdistrict,
            district: orderData.district,
            province: orderData.province,
            postalCode: orderData.postal_code,
          },
          items: (orderData.items || []).map((it: any, i: number) => ({
            id: Number(it.id ?? i + 1),
            productId: Number(it.product_id ?? it.productId),
            productName: String(it.product_name ?? it.productName ?? ''),
            quantity: Number(it.quantity ?? 0),
            pricePerUnit: Number(it.price_per_unit ?? it.pricePerUnit ?? 0),
            discount: Number(it.discount ?? 0),
            isFreebie: !!(it.is_freebie ?? it.isFreebie ?? 0),
            boxNumber: Number(it.box_number ?? it.boxNumber ?? 1),
            parentItemId: it.parent_item_id ? Number(it.parent_item_id) : (it.parentItemId ? Number(it.parentItemId) : undefined),
            isPromotionParent: !!(it.is_promotion_parent ?? it.isPromotionParent),
            promotionId: it.promotion_id ?? it.promotionId,
          })),
          boxes: Array.isArray(orderData.boxes) ? orderData.boxes.map((b: any) => ({
            boxNumber: Number(b.box_number ?? b.boxNumber ?? 1),
            codAmount: Number(b.cod_amount ?? b.codAmount ?? 0),
            collectionAmount: Number(b.collection_amount ?? b.collectionAmount ?? 0),
          })) : [],
          trackingNumbers: orderData.tracking_numbers ?? orderData.trackingNumbers ?? [],
          slips: orderData.slips ?? [],
        };
        setManageOrder(normalizedOrder);
      }
    } catch (err) {
      console.error('Failed to load order for management', err);
    } finally {
      setManageLoading(false);
    }
  };

  const handleSaveOrder = async (updatedOrder: any) => {
    try {
      const { patchOrder } = await import('../services/api');
      await patchOrder(updatedOrder.id, updatedOrder);
      setManageOrder(null);
      fetchData(); // Refresh list
    } catch (err) {
      console.error('Failed to save order', err);
    }
  };

  const correct = summary.total - summary.mismatch;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-blue-100 p-5 shadow-sm">
          <div className="text-sm text-blue-600 font-medium mb-1">โปรโมชั่นทั้งหมด</div>
          <div className="text-3xl font-bold text-blue-700">{summary.total.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-red-100 p-5 shadow-sm">
          <div className="text-sm text-red-600 font-medium mb-1">ราคาไม่ตรง</div>
          <div className="text-3xl font-bold text-red-600">{summary.mismatch.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl border border-emerald-100 p-5 shadow-sm">
          <div className="text-sm text-emerald-600 font-medium mb-1">ราคาถูกต้อง</div>
          <div className="text-3xl font-bold text-emerald-600">{correct.toLocaleString()}</div>
        </div>
      </div>

      {/* Search + Refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="ค้นหา Order ID, ลูกค้า, โปรโมชั่น..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-400"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 rounded-xl hover:bg-rose-100 transition-colors text-sm font-medium border border-rose-200"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
        {summary.mismatch > 0 && (
          <button
            type="button"
            onClick={() => {
              console.log('>>> Auto-fix button clicked!');
              (async () => {
                setFixing(true);
                setFixResult({ show: false, count: 0 });
                try {
                  const freshRes = await validatePromotionOrders(currentUser.companyId);
                  const freshData = freshRes?.status === 'success' ? (freshRes.data || []) : data;
                  const parentIds = freshData.map((r: any) => Number(r.parent_item_id)).filter((id: number) => id > 0);
                  console.log('Auto-fix: sending parent_item_ids =', parentIds);
                  if (parentIds.length === 0) {
                    setFixResult({ show: true, count: 0, error: 'ไม่พบ parent_item_id ที่ต้องแก้ไข' });
                    return;
                  }
                  const res = await fixPromotionOrders(currentUser.companyId, parentIds);
                  console.log('Auto-fix response:', res);
                  if (res?.status === 'success') {
                    setFixResult({ show: true, count: res.fixed_count || 0 });
                    fetchData();
                  } else {
                    setFixResult({ show: true, count: 0, error: res?.message || 'Unknown error' });
                  }
                } catch (err: any) {
                  console.error('Auto-fix error:', err);
                  setFixResult({ show: true, count: 0, error: err?.message || 'Failed' });
                } finally {
                  setFixing(false);
                }
              })();
            }}
            disabled={fixing}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
          >
            <Wand2 className={`w-4 h-4 ${fixing ? 'animate-pulse' : ''}`} />
            {fixing ? 'กำลังแก้ไข...' : 'แก้ไขออโต้'}
          </button>
        )}
      </div>

      {/* Fix result alert */}
      {fixResult.show && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${fixResult.error ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {fixResult.error ? (
            <><AlertTriangle className="w-4 h-4" /> เกิดข้อผิดพลาด: {fixResult.error}</>
          ) : (
            <><CheckCircle className="w-4 h-4" /> แก้ไขสำเร็จ {fixResult.count} รายการ</>
          )}
          <button onClick={() => setFixResult({ show: false, count: 0 })} className="ml-auto text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-rose-400 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">ไม่พบรายการราคาไม่ตรง</p>
          <p className="text-sm text-gray-400 mt-1">ทุกออเดอร์โปรโมชั่นมีราคาถูกต้อง</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  {[
                    { key: 'order_id', label: 'Order ID' },
                    { key: 'order_date', label: 'วันที่' },
                    { key: 'customer_name', label: 'ลูกค้า' },
                    { key: 'order_status', label: 'สถานะ' },
                    { key: 'promo_name', label: 'โปรโมชั่น' },
                    { key: 'parent_qty', label: 'จำนวนเซ็ต' },
                    { key: 'parent_net', label: 'Parent Net' },
                    { key: 'affected_children', label: 'Child ผิด' },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row, idx) => {
                  const parentNet = Number(row.parent_net || 0);
                  return (
                    <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <button
                          onClick={() => setViewOrderId(String(row.order_id))}
                          className="text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                          {row.order_id}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.order_date ? new Date(row.order_date).toLocaleDateString('th-TH') : '-'}</td>
                      <td className="px-3 py-2.5 text-gray-800 font-medium max-w-[180px] truncate">{row.customer_name || '-'}</td>
                      <td className="px-3 py-2.5">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">{row.order_status || '-'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700 max-w-[200px] truncate">{row.promo_name || '-'}</td>
                      <td className="px-3 py-2.5 text-center font-medium text-gray-700">{row.parent_qty}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-gray-700">฿{parentNet.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                          {row.affected_children}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => handleManage(String(row.order_id))}
                          disabled={manageLoading}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 border border-violet-200 transition-colors"
                        >
                          <Pencil className="w-3 h-3" />
                          จัดการ
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <OrderDetailModal
        isOpen={!!viewOrderId}
        onClose={() => setViewOrderId(null)}
        orderId={viewOrderId}
        companyId={currentUser.companyId}
      />

      {manageOrder && (
        <OrderManagementModal
          order={manageOrder}
          customers={[]}
          activities={[]}
          onSave={handleSaveOrder}
          onClose={() => setManageOrder(null)}
          currentUser={currentUser}
          permission="manager"
        />
      )}
    </div>
  );
};

// ======== Creator Check Tab ========
const CreatorCheckTab: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ total: 0, flagged: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState('order_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [manageOrder, setManageOrder] = useState<any>(null);
  const [manageLoading, setManageLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await validateCreatorOrders(currentUser.companyId);
      if (res?.status === 'success') {
        setData(res.data || []);
        setSummary({
          total: Number(res.summary?.total_orders || 0),
          flagged: Number(res.summary?.flagged_count || 0),
        });
      }
    } catch (err) {
      console.error('Failed to load creator validation', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser.companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortKey(key); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    let list = data;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      list = list.filter(r =>
        String(r.order_id).toLowerCase().includes(s) ||
        String(r.customer_name || '').toLowerCase().includes(s) ||
        String(r.creator_name || '').toLowerCase().includes(s) ||
        String(r.creator_role || '').toLowerCase().includes(s)
      );
    }
    list.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data, searchTerm, sortKey, sortDir]);

  const handleManage = async (orderId: string) => {
    setManageLoading(true);
    try {
      const orderData = await getOrder(orderId);
      if (orderData) {
        if (orderData.items && !Array.isArray(orderData.items)) {
          orderData.items = Object.values(orderData.items);
        }
        const normalizedOrder = {
          id: orderData.id ?? orderData.order_id,
          customerId: orderData.customer_id ?? orderData.customerId,
          companyId: currentUser.companyId,
          orderDate: orderData.order_date ?? orderData.orderDate,
          deliveryDate: orderData.delivery_date ?? orderData.deliveryDate,
          orderStatus: orderData.order_status ?? orderData.orderStatus ?? 'Pending',
          paymentMethod: orderData.payment_method ?? orderData.paymentMethod,
          paymentStatus: orderData.payment_status ?? orderData.paymentStatus,
          totalAmount: Number(orderData.total_amount ?? orderData.totalAmount ?? 0),
          shippingCost: Number(orderData.shipping_cost ?? orderData.shippingCost ?? 0),
          billDiscount: Number(orderData.bill_discount ?? orderData.billDiscount ?? 0),
          codAmount: Number(orderData.cod_amount ?? orderData.codAmount ?? 0),
          amountPaid: Number(orderData.amount_paid ?? orderData.amountPaid ?? 0),
          notes: orderData.notes,
          shippingAddress: orderData.shippingAddress ?? orderData.shipping_address ?? {
            recipientFirstName: orderData.recipient_first_name,
            recipientLastName: orderData.recipient_last_name,
            street: orderData.street,
            subdistrict: orderData.subdistrict,
            district: orderData.district,
            province: orderData.province,
            postalCode: orderData.postal_code,
          },
          items: (orderData.items || []).map((it: any, i: number) => ({
            id: Number(it.id ?? i + 1),
            productId: Number(it.product_id ?? it.productId),
            productName: String(it.product_name ?? it.productName ?? ''),
            quantity: Number(it.quantity ?? 0),
            pricePerUnit: Number(it.price_per_unit ?? it.pricePerUnit ?? 0),
            discount: Number(it.discount ?? 0),
            isFreebie: !!(it.is_freebie ?? it.isFreebie ?? 0),
            boxNumber: Number(it.box_number ?? it.boxNumber ?? 1),
            parentItemId: it.parent_item_id ? Number(it.parent_item_id) : (it.parentItemId ? Number(it.parentItemId) : undefined),
            isPromotionParent: !!(it.is_promotion_parent ?? it.isPromotionParent),
            promotionId: it.promotion_id ?? it.promotionId,
          })),
          boxes: Array.isArray(orderData.boxes) ? orderData.boxes.map((b: any) => ({
            boxNumber: Number(b.box_number ?? b.boxNumber ?? 1),
            codAmount: Number(b.cod_amount ?? b.codAmount ?? 0),
            collectionAmount: Number(b.collection_amount ?? b.collectionAmount ?? 0),
          })) : [],
          trackingNumbers: orderData.tracking_numbers ?? orderData.trackingNumbers ?? [],
          slips: orderData.slips ?? [],
        };
        setManageOrder(normalizedOrder);
      }
    } catch (err) {
      console.error('Failed to load order for management', err);
    } finally {
      setManageLoading(false);
    }
  };

  const handleSaveOrder = async (updatedOrder: any) => {
    try {
      await patchOrder(updatedOrder.id, updatedOrder);
      setManageOrder(null);
      fetchData();
    } catch (err) {
      console.error('Failed to save order', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">ออเดอร์ทั้งหมด</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{summary.total.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Creator ไม่ใช่ Telesale/Admin</p>
          <p className={`text-3xl font-bold mt-1 ${summary.flagged > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{summary.flagged}</p>
        </div>
      </div>

      {/* Search + Refresh */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหา Order ID, ลูกค้า, Creator..."
            className="w-full pl-9 pr-4 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-teal-300 focus:border-teal-400 outline-none"
          />
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          รีเฟรช
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-teal-400 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">ไม่พบรายการที่มีปัญหา</p>
          <p className="text-sm text-gray-400 mt-1">ทุก order_items มี creator เป็น Telesale/Admin</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  {[
                    { key: 'order_id', label: 'Order ID' },
                    { key: 'order_date', label: 'วันที่' },
                    { key: 'customer_name', label: 'ลูกค้า' },
                    { key: 'order_status', label: 'สถานะ' },
                    { key: 'creator_name', label: 'Creator' },
                    { key: 'creator_role', label: 'Role' },
                    { key: 'affected_items', label: 'Items' },
                  ].map(col => (
                    <th
                      key={col.key}
                      className="px-3 py-2.5 text-left cursor-pointer hover:bg-gray-100 transition-colors select-none whitespace-nowrap"
                      onClick={() => handleSort(col.key)}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className="w-3 h-3 text-gray-400" />
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-center whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row, idx) => (
                  <tr key={idx} className="hover:bg-teal-50/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <span className="text-gray-800 font-medium">{row.order_id}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.order_date ? new Date(row.order_date).toLocaleDateString('th-TH') : '-'}</td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium max-w-[180px] truncate">{row.customer_name || '-'}</td>
                    <td className="px-3 py-2.5">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">{row.order_status || '-'}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-800 font-medium">{row.creator_name || '-'}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                        {row.creator_role || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center font-medium text-gray-700">{row.affected_items}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => handleManage(String(row.order_id))}
                        disabled={manageLoading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-violet-50 text-violet-700 rounded-lg hover:bg-violet-100 border border-violet-200 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        จัดการ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {manageOrder && (
        <OrderManagementModal
          order={manageOrder}
          customers={[]}
          activities={[]}
          onSave={handleSaveOrder}
          onClose={() => setManageOrder(null)}
          currentUser={currentUser}
          permission="manager"
        />
      )}
    </div>
  );
};

// ======== Main Page ========
const CheckOrderPage: React.FC<CheckOrderPageProps> = ({ currentUser }) => {
  const [activeMainTab, setActiveMainTab] = useState<'classification' | 'promo-check' | 'creator-check' | 'settings'>('classification');

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">ตรวจสอบคำสั่งซื้อ</h1>
          <p className="text-sm text-gray-500">จัดประเภทออเดอร์ยกเลิกและตั้งค่าประเภทการยกเลิก</p>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveMainTab('classification')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeMainTab === 'classification'
              ? 'border-orange-500 text-orange-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          จัดประเภทยกเลิก
        </button>
        <button
          onClick={() => setActiveMainTab('promo-check')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeMainTab === 'promo-check'
              ? 'border-rose-500 text-rose-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Tag className="w-4 h-4" />
          ตรวจสอบโปรโมชั่น
        </button>
        <button
          onClick={() => setActiveMainTab('creator-check')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeMainTab === 'creator-check'
              ? 'border-teal-500 text-teal-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          ตรวจสอบ Creator
        </button>
        <button
          onClick={() => setActiveMainTab('settings')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
            activeMainTab === 'settings'
              ? 'border-violet-500 text-violet-700'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <Settings className="w-4 h-4" />
          ตั้งค่ายกเลิก
        </button>
      </div>

      {/* Tab Content */}
      {activeMainTab === 'classification' ? (
        <ClassificationTab currentUser={currentUser} />
      ) : activeMainTab === 'promo-check' ? (
        <PromoCheckTab currentUser={currentUser} />
      ) : activeMainTab === 'creator-check' ? (
        <CreatorCheckTab currentUser={currentUser} />
      ) : (
        <SettingsTab />
      )}
    </div>
  );
};

export default CheckOrderPage;
