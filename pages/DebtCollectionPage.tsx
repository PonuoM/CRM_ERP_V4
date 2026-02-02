import React, { useState, useEffect } from 'react';
import { User, Order, Customer, ModalType } from '../types';
import DebtCollectionModal from '../components/DebtCollectionModal';
import OrderDetailModal from '../components/OrderDetailModal';
import { DollarSign, FileText, Loader2, ChevronLeft, ChevronRight, Phone, CheckCircle, XCircle } from 'lucide-react';
import { getDebtCollectionOrders, getDebtCollectionSummary, closeDebtCase, DebtCollectionSummary, getDebtCollectionHistory, updateDebtCollection } from '../services/api';

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

  // Tab State
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');


  // Modal state
  const [trackModalOpen, setTrackModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailSelectedOrder, setDetailSelectedOrder] = useState<Order | null>(null);
  const [closingCase, setClosingCase] = useState(false);

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
        status: activeTab // Filter by tab status
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
  }, [user?.companyId, currentPage, itemsPerPage, activeTab]);

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

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

  // Indices for display
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalOrders);
  const displayStart = totalOrders === 0 ? 0 : startIndex + 1;
  const displayEnd = totalOrders === 0 ? 0 : endIndex;

  // Render
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">ติดตามหนี้</h2>

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

      {loading && orders.length === 0 ? (
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ยอด
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      จำนวนครั้ง
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ติดตาม
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {activeTab === 'completed' ? 'ยกเลิก' : 'จบเคส'}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {orders.map((order) => {
                    const customerInfo = (order as any).customerInfo;
                    const remainingDebt = (order as any).remainingDebt;
                    const totalAmount = order.totalAmount;
                    const collected = (order as any).totalDebtCollected;

                    return (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetail(order)}
                            className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                          >
                            {order.id}
                          </button>
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
                        <td className="px-4 py-3 whitespace-nowrap text-center text-sm text-gray-600">

                          {(order as any).trackingCount > 0 ? (
                            <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              {(order as any).trackingCount} ครั้ง
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <button
                            onClick={() => handleTrackClick(order)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 transition-colors"
                          >
                            <FileText size={14} />
                            ติดตาม
                          </button>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {activeTab === 'completed' ? (
                            <button
                              onClick={() => handleCancelCase(order)}
                              disabled={closingCase}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <XCircle size={14} />
                              ยกเลิก
                            </button>
                          ) : (
                            <button
                              onClick={() => handleCloseCase(order)}
                              disabled={closingCase}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CheckCircle size={14} />
                              จบเคส
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
      )}

      {/* Debt Collection Modal */}
      {selectedOrder && trackModalOpen && (
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
      )}

      {/* Order Detail Modal */}
      {detailSelectedOrder && detailModalOpen && (
        <OrderDetailModal
          isOpen={detailModalOpen}
          onClose={() => {
            setDetailModalOpen(false);
            setDetailSelectedOrder(null);
          }}
          orderId={detailSelectedOrder.id}
        />
      )}
    </div>
  );
};

export default DebtCollectionPage;
