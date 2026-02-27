import React, { useState, useEffect } from 'react';
import { User, Order, Customer, ModalType } from '../types';
import DebtCollectionModal from '../components/DebtCollectionModal';
import OrderDetailModal from '../components/OrderDetailModal';
import { DollarSign, FileText, Loader2, ChevronLeft, ChevronRight, Phone, CheckCircle, XCircle, AlertOctagon, Download, Filter, Clock } from 'lucide-react';
import { getDebtCollectionOrders, getDebtCollectionSummary, closeDebtCase, DebtCollectionSummary, getDebtCollectionHistory, updateDebtCollection, exportDebtCollection } from '../services/api';
import DateRangePicker from '../components/DateRangePicker';

interface DebtCollectionPageProps {
  user: User;
  customers: Customer[];
  users: User[];
  openModal: (type: ModalType, data: Order) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const DebtCollectionPage: React.FC<DebtCollectionPageProps> = ({ user, customers, openModal }) => {
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(PAGE_SIZE_OPTIONS[0]); // Default 10
  const [totalPages, setTotalPages] = useState(1);

  // Summary State
  const [summaryStats, setSummaryStats] = useState<DebtCollectionSummary>({ orderCount: 0, totalDebt: 0 });
  const [trackers, setTrackers] = useState<{ id: number; name: string }[]>([]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');


  // Modal state
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailSelectedOrder, setDetailSelectedOrder] = useState<Order | null>(null);
  const [closingCase, setClosingCase] = useState(false);

  // Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDaysOverdue, setFilterDaysOverdue] = useState('');
  const [filterTrackingStatus, setFilterTrackingStatus] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterMissingReceivedDate, setFilterMissingReceivedDate] = useState(false);
  const [filterOver7Days, setFilterOver7Days] = useState(false);
  const [filterTrackerId, setFilterTrackerId] = useState('');

  // CSV Export State
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'orders' | 'history'>('history');
  const [exportStatus, setExportStatus] = useState<string>('');

  // Fetch Summary Statistics (Global)
  const fetchSummary = async () => {
    if (!user?.companyId) return;
    try {
      const response = await getDebtCollectionSummary({
        // companyId: user.companyId, 
        status: activeTab // Filter summary by tab status
      });
      if (response.ok) {
        setSummaryStats({
          orderCount: response.orderCount || 0,
          totalDebt: response.totalDebt || 0
        });
        if ((response as any).trackers) {
          setTrackers((response as any).trackers);
        }
      }
    } catch (error) {
      console.error("Failed to fetch summary:", error);
    }
  };

  // Fetch Orders List (Paginated)
  const fetchOrders = async () => {
    if (!user?.companyId) return;

    setLoading(true);
    try {
      const response = await getDebtCollectionOrders({
        // companyId: user.companyId, // Filtered by user auth in API usually, or pass if needed
        page: currentPage,
        pageSize: itemsPerPage,
        status: activeTab, // Filter by tab status

        // Search filters
        // Identify if search term is name, phone, or order ID
        customerName: isNaN(Number(searchTerm)) && !searchTerm.startsWith('OD') ? searchTerm : undefined,
        customerPhone: !isNaN(Number(searchTerm)) && searchTerm.length > 5 ? searchTerm : undefined,
        orderId: searchTerm.startsWith('OD') || (!isNaN(Number(searchTerm)) && searchTerm.length <= 5) ? searchTerm : undefined,

        minDaysOverdue: filterDaysOverdue ? Number(filterDaysOverdue) : undefined,
        trackingStatus: filterTrackingStatus || undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate || undefined,
        missingReceivedDate: filterMissingReceivedDate ? '1' : undefined,
        over7Days: filterOver7Days ? '1' : undefined,
        trackerId: filterTrackerId || undefined
      });

      if (response.ok) {
        // Map API response to Order type (partial) for display
        // Note: The API returns formatted objects, we assume they align with what we need
        setOrders(response.orders || []);
        setTotalOrders(response.pagination?.total || 0);
        setTotalPages(response.pagination?.totalPages || 1);
      }
    } catch (error) {
      console.error("Failed to fetch orders:", error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchSummary();
  }, [user?.companyId, currentPage, itemsPerPage, activeTab, searchTerm, filterDaysOverdue, filterTrackingStatus, filterStartDate, filterEndDate, filterMissingReceivedDate, filterOver7Days, filterTrackerId]);

  // Reset page when tab changes OR FILTER changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm, filterDaysOverdue, filterTrackingStatus, filterStartDate, filterEndDate, filterMissingReceivedDate, filterOver7Days, filterTrackerId]);

  const handlePageChange = (page: number) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(next);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
  };

  const handleViewDetail = (order: Order) => {
    setDetailSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleTrackClick = (order: Order) => {
    setSelectedOrder(order);
    setTrackModalOpen(true);
  };

  const handleCloseCase = async (order: Order) => {
    if (!confirm(`ยืนยันการจบเคสสำหรับ Order ${order.id}?`)) {
      return;
    }

    setClosingCase(true);
    try {
      // User requested to set collected amount to 0 when closing via quick button
      const response = await closeDebtCase({
        order_id: order.id,
        user_id: user.id,
        amount_collected: 0,
        result_status: 3, // Collected All / Closed
        note: 'จบเคส - ปิดการติดตามหนี้ (ไม่ได้ยอดเพิ่ม)',
      });

      if (response.ok) {
        alert('จบเคสเรียบร้อยแล้ว');
        fetchOrders();
        fetchSummary(); // Refresh stats too
      } else {
        alert(response.error || 'เกิดข้อผิดพลาดในการจบเคส');
      }
    } catch (error: any) {
      alert(error.message || 'เกิดข้อผิดพลาดในการจบเคส');
    } finally {
      setClosingCase(false);
    }
  };

  const handleCancelCase = async (order: Order) => {
    if (!confirm(`ยืนยันการยกเลิกสถานะ "จบเคส" สำหรับ Order ${order.id}?`)) {
      return;
    }

    setClosingCase(true);
    try {
      // 1. Fetch history to find the closing record
      const historyResponse = await getDebtCollectionHistory({ order_id: order.id });

      if (!historyResponse.ok || !historyResponse.data) {
        throw new Error('ไม่สามารถดึงข้อมูลประวัติการติดตามได้');
      }

      const closingRecord = historyResponse.data.find(r => r.is_complete === 1);

      if (!closingRecord) {
        throw new Error('ไม่พบรายการที่ทำการจบเคส');
      }

      // 2. Update is_complete to 0
      const response = await updateDebtCollection(closingRecord.id, {
        is_complete: 0
      });

      if (response.ok) {
        alert('ยกเลิกการจบเคสเรียบร้อยแล้ว');
        fetchOrders();
        fetchSummary();
      } else {
        alert(response.error || 'เกิดข้อผิดพลาดในการยกเลิกจบเคส');
      }
    } catch (error: any) {
      alert(error.message || 'เกิดข้อผิดพลาดในการยกเลิกจบเคส');
    } finally {
      setClosingCase(false);
    }
  };

  const handleTrackSuccess = () => {
    fetchOrders();
    fetchSummary(); // Refresh stats too
  };

  const getPageNumbers = () => {
    const pages: Array<number | '...'> = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      for (let i = 1; i <= 4; i += 1) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i += 1) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  // CSV Export Handler
  const handleExportCSV = async () => {
    if (!exportStartDate || !exportEndDate) {
      alert('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด');
      return;
    }
    if (!exportStatus) {
      alert('กรุณาเลือกสถานะเคส');
      return;
    }
    setExporting(true);
    try {
      if (exportType === 'history') {
        // ===== Export: ประวัติการติดตาม =====
        const response = await exportDebtCollection({
          startDate: exportStartDate,
          endDate: exportEndDate,
          type: 'history',
          status: exportStatus
        });
        if (response.ok && response.records) {
          const records = response.records;
          const headers = ['Order ID', 'ชื่อลูกค้า', 'เบอร์โทร', 'วันที่ส่ง', 'วันที่รับของ', 'ยอดออเดอร์', 'ผู้ติดตาม', 'วันที่ติดตาม', 'วันที่ติดตามแรก', 'ห่างกี่วัน', 'ยอดเก็บได้', 'ผลการติดตาม', 'จบเคส', 'หมายเหตุ', 'ยอดเก็บรวม', 'ยอดคงเหลือ', 'สถานะออเดอร์', 'สถานะชำระ'];
          const rows = records.map((r: any) => [
            r.orderId,
            r.customerName,
            r.customerPhone || '',
            r.deliveryDate || '',
            r.customerReceivedDate || '',
            r.totalAmount,
            r.trackerName,
            r.trackingDate || '',
            r.firstTrackingDate || '',
            r.daysToFirstTracking ?? '',
            r.amountCollected,
            r.resultStatus,
            r.isComplete ? 'ใช่' : 'ไม่',
            r.note || '',
            r.totalCollected,
            r.remainingDebt,
            r.orderStatus,
            r.paymentStatus
          ]);

          downloadCSV(headers, rows, `debt_tracking_history_${exportStartDate}_${exportEndDate}.csv`);
        } else {
          alert('ไม่พบข้อมูล หรือเกิดข้อผิดพลาด');
        }
      } else {
        // ===== Export: ข้อมูลออเดอร์ =====
        const response = await getDebtCollectionOrders({
          status: exportStatus,
          startDate: exportStartDate,
          endDate: exportEndDate,
          pageSize: 9999,
          page: 1
        });
        if (response.ok && response.orders) {
          const orders = response.orders;
          const headers = ['Order ID', 'ชื่อลูกค้า', 'เบอร์โทร', 'วันที่สั่ง', 'วันที่ส่ง', 'ยอดรวม', 'ยอดเก็บแล้ว', 'ยอดคงเหลือ', 'วันค้าง', 'สถานะออเดอร์', 'สถานะชำระ', 'สถานะเคส', 'จำนวนติดตาม', 'ผู้ติดตามล่าสุด', 'สินค้าที่ขาย', 'จำนวนสินค้า'];
          const rows: any[][] = [];
          orders.forEach((o: any) => {
            const items: { productName: string; quantity: number }[] = o.orderItems || [];
            const baseRow = [
              o.id,
              `${o.customerInfo?.firstName || ''} ${o.customerInfo?.lastName || ''}`.trim(),
              o.customerInfo?.phone || '',
              o.orderDate || '',
              o.deliveryDate || '',
              o.totalAmount,
              o.totalDebtCollected,
              o.remainingDebt,
              o.daysPassed,
              o.orderStatus,
              o.paymentStatus,
              o.debtStatus || '',
              o.trackingCount,
              o.lastTrackerName || '',
            ];
            if (items.length === 0) {
              rows.push([...baseRow, '', '']);
            } else {
              items.forEach((item: any) => {
                rows.push([...baseRow, item.productName, item.quantity]);
              });
            }
          });

          downloadCSV(headers, rows, `debt_collection_${activeTab}_${exportStartDate}_${exportEndDate}.csv`);
        } else {
          alert('ไม่พบข้อมูล หรือเกิดข้อผิดพลาด');
        }
      }
      setShowExportModal(false);
    } catch (err) {
      console.error('Export failed:', err);
      alert('เกิดข้อผิดพลาดในการดาวน์โหลด');
    } finally {
      setExporting(false);
    }
  };

  const downloadCSV = (headers: string[], rows: any[][], filename: string) => {
    const csvContent = [headers, ...rows]
      .map(row => row.map((cell: any) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Indices for display
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalOrders);
  const displayStart = totalOrders === 0 ? 0 : startIndex + 1;
  const displayEnd = totalOrders === 0 ? 0 : endIndex;

  // Render
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">ติดตามหนี้</h2>
        <button
          onClick={() => setShowExportModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Download size={16} />
          ดาวน์โหลด CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('active')}
            className={`${activeTab === 'active'
              ? 'border-blue-500 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            กำลังติดตาม
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`${activeTab === 'completed'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
          >
            จบเคสแล้ว / จ่ายครบ
          </button>
        </nav>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">ค้นหา</label>
            <div className="relative">
              <input
                type="text"
                placeholder="ชื่อลูกค้า, เบอร์โทร, Order ID"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute left-3 top-2.5 text-gray-400">
                <FileText size={16} />
              </div>
            </div>
          </div>

          {/* Date Range (Delivery Date) */}
          <div className="w-full md:w-auto flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงวันที่ส่ง</label>
            <DateRangePicker
              value={{ start: filterStartDate, end: filterEndDate }}
              onApply={(range) => {
                setFilterStartDate(range.start);
                setFilterEndDate(range.end);
              }}
            />
          </div>

          {/* Days Overdue */}
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">ค้างชำระ (วัน)</label>
            <select
              value={filterDaysOverdue}
              onChange={(e) => setFilterDaysOverdue(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">ทั้งหมด</option>
              <option value="3">เกิน 3 วัน</option>
              <option value="7">เกิน 7 วัน</option>
              <option value="15">เกิน 15 วัน</option>
              <option value="30">เกิน 30 วัน</option>
            </select>
          </div>

          {/* Tracking Status */}
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะการติดตาม</label>
            <select
              value={filterTrackingStatus}
              onChange={(e) => setFilterTrackingStatus(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">ทั้งหมด</option>
              <option value="never">ยังไม่เคยติดตาม</option>
              <option value="tracked">ติดตามแล้ว</option>
            </select>
          </div>

          {/* ผู้ติดตาม */}
          <div className="w-full md:w-36">
            <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ติดตาม</label>
            <select
              value={filterTrackerId}
              onChange={(e) => setFilterTrackerId(e.target.value)}
              className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            >
              <option value="">ทั้งหมด</option>
              {trackers.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

        </div>

        {/* Row 2: Toggle filters */}
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {/* Toggle: ยังไม่ใส่วันรับของ */}
          <label className="flex items-center gap-2 cursor-pointer bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 hover:bg-amber-100 transition-colors">
            <input
              type="checkbox"
              checked={filterMissingReceivedDate}
              onChange={(e) => setFilterMissingReceivedDate(e.target.checked)}
              className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-amber-800">📦 ยังไม่ใส่วันรับของ</span>
          </label>

          {/* Toggle: เกิน 7 วัน */}
          <label className="flex items-center gap-2 cursor-pointer bg-red-50 border border-red-200 rounded-lg px-3 py-2 hover:bg-red-100 transition-colors">
            <input
              type="checkbox"
              checked={filterOver7Days}
              onChange={(e) => setFilterOver7Days(e.target.checked)}
              className="rounded border-gray-300 text-red-600 focus:ring-red-500"
            />
            <span className="text-sm font-medium text-red-800">🔴 ติดตามช้าเกิน 7 วัน</span>
          </label>
        </div>

        <div className="flex justify-end pt-2 border-t mt-2">
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterDaysOverdue('');
              setFilterTrackingStatus('');
              setFilterStartDate('');
              setFilterEndDate('');
              setFilterMissingReceivedDate(false);
              setFilterOver7Days(false);
              setFilterTrackerId('');
            }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow-sm border border-red-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-red-200 p-3 rounded-full">
              <DollarSign className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">ยอดค้างชำระทั้งหมด (ทั้งระบบ)</p>
              <p className="text-2xl font-bold text-gray-900">
                {summaryStats.totalDebt.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} บาท
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-6">
          <div className="flex items-center gap-4">
            <div className="bg-blue-200 p-3 rounded-full">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">จำนวนคำสั่งซื้อ (ทั้งระบบ)</p>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.orderCount} รายการ</p>
            </div>
          </div>
        </div>
      </div>

      {
        loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
          </div>
        ) : (
          <>

            {/* Pagination Controls - Top */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>แสดง</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    {PAGE_SIZE_OPTIONS.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                  <span>รายการต่อหน้า</span>
                  <span className="ml-4">
                    แสดง {displayStart}-{displayEnd} จาก {totalOrders} รายการ
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  {getPageNumbers().map((page, idx) => (
                    page === '...' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page as number)}
                        className={`px-3 py-1 rounded-md border text-sm font-medium ${currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                          }`}
                      >
                        {page}
                      </button>
                    )
                  ))}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>

            {/* Custom Orders Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ลูกค้า
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        เบอร์โทร
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        วันจัดส่ง
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        วันรับของ
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ยอด
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-orange-500 uppercase tracking-wider">
                        ยอดรอตรวจ
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        จำนวนครั้ง
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ติดตามล่าสุด
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ติดตาม
                      </th>

                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => {
                      const customerInfo = (order as any).customerInfo;
                      const remainingDebt = (order as any).remainingDebt;
                      const totalAmount = order.totalAmount;
                      const collected = (order as any).totalDebtCollected;
                      const pendingSlipAmount = (order as any).pendingSlipAmount || 0;
                      const hasPendingSlips = (order as any).hasPendingSlips || false;
                      const isPendingFullyCovered = hasPendingSlips && remainingDebt <= 0;

                      return (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-1">
                              <button
                                onClick={() => handleViewDetail(order)}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                {order.id}
                              </button>
                              {(order as any).paymentStatus === 'BadDebt' || (order as any).orderStatus === 'BadDebt' || (order as any).order_status === 'BadDebt' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                                  <AlertOctagon size={10} className="mr-1" />
                                  หนี้สูญ
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {customerInfo ? `${customerInfo.firstName} ${customerInfo.lastName}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {customerInfo?.phone ? (
                              <a href={`tel:${customerInfo.phone}`} className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                                <Phone size={14} />
                                {customerInfo.phone}
                              </a>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {(order as any).deliveryDate ? (
                              <div className="flex flex-col">
                                <span>{new Date((order as any).deliveryDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                                <span className="text-xs text-gray-500">ผ่านมา {(order as any).daysPassed} วัน</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {(order as any).customerReceivedDate ? (
                              <span>{new Date((order as any).customerReceivedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-gray-900">
                                {totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                              <span className="text-xs text-green-600">
                                ตามได้: {collected > 0 ? collected.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '-'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                            {hasPendingSlips ? (
                              <div className="flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 text-orange-600 font-semibold">
                                  <Clock size={12} />
                                  {pendingSlipAmount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </span>
                                <span className="text-[10px] text-orange-500">รอตรวจสอบ</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600">

                            {(order as any).trackingCount > 0 ? (
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                {(order as any).trackingCount} ครั้ง
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {(order as any).lastTrackingDate ? (
                              <span>{new Date((order as any).lastTrackingDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            {isPendingFullyCovered ? (
                              <span
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-md cursor-default"
                                title={`มีสลิปยอด ฿${pendingSlipAmount.toLocaleString()} รอการตรวจสอบ`}
                              >
                                <Clock size={14} />
                                รอตรวจสลิป
                              </span>
                            ) : (
                              <button
                                onClick={() => handleTrackClick(order)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                              >
                                <FileText size={14} />
                                ติดตาม
                              </button>
                            )}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {orders.length === 0 && !loading && (
                <div className="text-center py-12 text-gray-500">
                  <p>ไม่พบข้อมูลรายการหนี้</p>
                </div>
              )}
            </div>

            {/* Pagination Controls - Bottom */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mt-4">
              {/* Simple Pagination */}
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>

                {getPageNumbers().map((page, idx) => (
                  page === '...' ? (
                    <span key={`bottom-ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={`bottom-${page}`}
                      onClick={() => handlePageChange(page as number)}
                      className={`px-3 py-1 rounded-md border text-sm font-medium ${currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        )
      }

      {/* Debt Collection Modal */}
      {
        selectedOrder && trackModalOpen && (
          <DebtCollectionModal
            isOpen={trackModalOpen}
            onClose={() => {
              setTrackModalOpen(false);
              setSelectedOrder(null);
            }}
            order={selectedOrder}
            currentUser={user}
            onSuccess={handleTrackSuccess}
            isCompletedView={activeTab === 'completed'}
            onViewDetail={handleViewDetail}
          />
        )
      }

      {/* Order Detail Modal */}
      {
        detailSelectedOrder && detailModalOpen && (
          <OrderDetailModal
            isOpen={detailModalOpen}
            onClose={() => {
              setDetailModalOpen(false);
              setDetailSelectedOrder(null);
            }}
            orderId={detailSelectedOrder.id}
          />
        )
      }

      {/* CSV Export Modal */}
      {
        showExportModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold text-gray-800 mb-4">ดาวน์โหลด CSV</h3>
              <div className="space-y-4">
                {/* Export Type Toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทข้อมูล</label>
                  <div className="flex rounded-lg border overflow-hidden">
                    <button
                      onClick={() => setExportType('history')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${exportType === 'history'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      📋 ประวัติการติดตาม
                    </button>
                    <button
                      onClick={() => setExportType('orders')}
                      className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${exportType === 'orders'
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      📦 ข้อมูลออเดอร์
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {exportType === 'history'
                      ? 'แต่ละรายการติดตาม + ผู้ติดตาม + ยอดเก็บ (สำหรับคำนวณค่าคอม)'
                      : 'ข้อมูลสรุประดับออเดอร์ (ยอดรวม, ยอดค้าง)'}
                  </p>
                </div>

                {/* Status Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">สถานะเคส</label>
                  <select
                    value={exportStatus}
                    onChange={(e) => setExportStatus(e.target.value as 'active' | 'completed')}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="">-- เลือกสถานะ --</option>
                    <option value="all">ทั้งหมด</option>
                    <option value="active">กำลังติดตาม</option>
                    <option value="completed">จบเคสแล้ว</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่เริ่มต้น ({exportType === 'history' ? 'วันที่ติดตาม' : 'วันที่ส่ง'})
                  </label>
                  <input
                    type="date"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    วันที่สิ้นสุด ({exportType === 'history' ? 'วันที่ติดตาม' : 'วันที่ส่ง'})
                  </label>
                  <input
                    type="date"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  disabled={exporting}
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleExportCSV}
                  disabled={exporting || !exportStartDate || !exportEndDate || !exportStatus}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  {exporting ? 'กำลังดาวน์โหลด...' : 'ดาวน์โหลด'}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default DebtCollectionPage;
