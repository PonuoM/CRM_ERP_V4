import React, { useState, useEffect, useMemo } from 'react';
import { listSentOrders, listBankAccounts, getOrder } from '../../services/api';
import usePersistentState from '../../utils/usePersistentState';
import { Search, ChevronLeft, ChevronRight, Filter, DollarSign, Package, Calendar, X, ShoppingBag, CreditCard, Box, User, MapPin } from 'lucide-react';
// If headlessui is not available in dependencies, we'll use a custom Modal build similar to OutstandingOrdersModal

interface SentOrder {
    id: string;
    order_date: string;
    delivery_date: string | null;
    customer_id: string;
    customer_first_name: string;
    customer_last_name: string;
    recipient_first_name: string | null;
    recipient_last_name: string | null;
    total_amount: number;
    payment_method: string;
    payment_status: string;
    order_status: string;
    tracking_numbers: string | null;
    bank_info: string | null;
    total_slip_amount: number | null;
}

interface BankAccount {
    id: number;
    bank: string;
    bank_number: string;
    account_name: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500];

// --- Order Detail Modal Component ---
import OrderDetailModal from '../../components/OrderDetailModal';
import TrackingModal from '../../components/TrackingModal';



const AllOrdersSentPage: React.FC = () => {
    const [orders, setOrders] = useState<SentOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [banks, setBanks] = useState<BankAccount[]>([]);

    // Filters
    // Set default range to current month
    const [startDate, setStartDate] = useState<string>(
        `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`
    );
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );

    // Fallback/Legacy
    const [selectedMonth, setSelectedMonth] = usePersistentState<number>('aos:month', new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = usePersistentState<number>('aos:year', new Date().getFullYear());

    const [selectedBankId, setSelectedBankId] = usePersistentState<string>('aos:bankId', '');
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [itemsPerPage, setItemsPerPage] = usePersistentState<number>('aos:itemsPerPage', PAGE_SIZE_OPTIONS[1]);
    const [currentPage, setCurrentPage] = usePersistentState<number>('aos:currentPage', 1);

    // Modal State
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [openTrackingId, setOpenTrackingId] = useState<string | null>(null);

    useEffect(() => {
        loadBanks();
    }, []);

    // Initial load and filter change load handled by search button, but allow search term updates
    useEffect(() => {
        // Debounce search only or just wait for manual search? 
        // User requested "Search Button", so auto-reload might be disabled for dates, but search box usually expects debounce.
        // Let's load on mount first.
        loadOrders();
    }, []);

    const loadBanks = async () => {
        try {
            const data = await listBankAccounts();
            if (Array.isArray(data)) setBanks(data);
        } catch (err) {
            console.error("Failed to load banks", err);
        }
    };

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await listSentOrders({
                startDate,
                endDate,
                month: selectedMonth, // fallback
                year: selectedYear,   // fallback
                bankId: selectedBankId ? Number(selectedBankId) : undefined,
                q: searchTerm
            });
            if (Array.isArray(data)) {
                setOrders(data);
                setCurrentPage(1); // Reset to page 1 on new search
            } else {
                setOrders([]);
            }
        } catch (err) {
            console.error("Failed to load orders", err);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    };

    // Calculate Summary Stats from displayed orders
    const stats = useMemo(() => {
        const totalCount = orders.length;
        const totalMatched = orders.filter(o => o.total_slip_amount && o.total_slip_amount > 0).length;
        const totalAmount = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const totalSlip = orders.reduce((sum, o) => sum + Number(o.total_slip_amount || 0), 0);
        const diff = totalSlip - totalAmount;

        const statusCounts: Record<string, number> = {};
        orders.forEach(o => {
            const s = mapOrderStatus(o.order_status);
            statusCounts[s] = (statusCounts[s] || 0) + 1;
        });

        return {
            totalCount,
            totalMatched,
            totalAmount,
            diff,
            statusCounts
        };
    }, [orders]);

    // Pagination Logic
    const totalItems = orders.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (effectivePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedOrders = orders.slice(startIndex, endIndex);

    const displayStart = totalItems === 0 ? 0 : startIndex + 1;
    const displayEnd = Math.min(endIndex, totalItems);

    const formatCurrency = (amount: number | string | null) => {
        const val = Number(amount || 0);
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val);
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        try {
            const date = new Date(dateStr);
            return new Intl.DateTimeFormat('th-TH', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            }).format(date);
        } catch (e) {
            return dateStr;
        }
    };

    function mapOrderStatus(status: string) {
        const map: Record<string, string> = {
            'Pending': 'รอตรวจสอบ',
            'Confirmed': 'ยืนยันแล้ว',
            'Picking': 'กำลังจัดของ',
            'Shipping': 'กำลังส่ง',
            'Delivered': 'จัดส่งสำเร็จ',
            'Returned': 'ตีกลับ',
            'Cancelled': 'ยกเลิก',
            'Claiming': 'แจ้งรอเคลม',
            'BadDebt': 'หนี้สูญ',
            'Preparing': 'เตรียมจัดส่ง'
        };
        return map[status] || status;
    }

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">All Orders (Sent/Billed)</h2>
                    <p className="text-slate-500">รายงานการส่งสินค้าและยอดบิล (ภาษาไทย)</p>
                </div>
            </div>

            {/* Dashboard & Filters Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4 items-stretch">
                {/* Left Column: Summary Cards + Filters */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                    {/* Summary Cards Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-between">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">จำนวนรายการทั้งหมด</p>
                                <h3 className="text-2xl font-bold text-slate-800">{stats.totalCount}</h3>
                            </div>
                            <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
                                <Package size={14} /> รายการ
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100 flex flex-col justify-between">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">ตรวจสอบพบกับ Bank (มีสลิป)</p>
                                <h3 className="text-2xl font-bold text-green-700">{stats.totalMatched}</h3>
                            </div>
                            <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                                <CreditCard size={14} /> รายการ
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col justify-between">
                            <div>
                                <p className="text-sm text-slate-500 mb-1">ยอดรวม Amount</p>
                                <h3 className="text-2xl font-bold text-emerald-700">{formatCurrency(stats.totalAmount)}</h3>
                            </div>
                            <div className={`mt-2 text-xs font-semibold flex items-center gap-1 ${stats.diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                Diff: {formatCurrency(stats.diff)}
                            </div>
                        </div>
                    </div>

                    {/* Filters Section */}
                    <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 h-full flex items-center">
                        <div className="flex flex-wrap gap-4 items-end w-full">
                            <div className="flex gap-2 items-center">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">ตั้งแต่วันที่</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <span className="text-gray-400 mt-6">-</span>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-500 mb-1">ถึงวันที่</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 mb-1">ธนาคาร</label>
                                <select
                                    value={selectedBankId}
                                    onChange={(e) => setSelectedBankId(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm min-w-[200px] focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">ทั้งหมด</option>
                                    {banks.map(b => (
                                        <option key={b.id} value={b.id}>{b.bank} {b.bank_number} ({b.account_name})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="min-w-[200px] w-[320px]">
                                <label className="block text-xs font-semibold text-slate-500 mb-1">ค้นหา</label>
                                <input
                                    type="text"
                                    placeholder="ค้นหา ID, ชื่อลูกค้า, Tracking..."
                                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && loadOrders()}
                                />
                            </div>

                            <button
                                onClick={loadOrders}
                                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-sm transition-all flex items-center gap-2 font-medium"
                            >
                                <Search size={18} />
                                ค้นหา
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right Column: Status Summary */}
                <div className="lg:col-span-1 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
                    <p className="text-sm text-slate-500 mb-2 font-semibold">สถานะ</p>
                    <div className="overflow-y-auto pr-1 flex-1">
                        <table className="w-full text-sm">
                            <tbody className="divide-y divide-gray-50">
                                {(() => {
                                    // Keys here are already mapped to Thai by stats.statusCounts
                                    const sortOrder = ['กำลังจัดของ', 'กำลังส่ง', 'PreApproved', 'จัดส่งสำเร็จ', 'หนี้สูญ'];
                                    const sortedStatuses = Object.entries(stats.statusCounts).sort((a, b) => {
                                        const indexA = sortOrder.indexOf(a[0]);
                                        const indexB = sortOrder.indexOf(b[0]);

                                        // Specific order for known items
                                        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                        // Known items come first
                                        if (indexA !== -1) return -1;
                                        if (indexB !== -1) return 1;
                                        // Others sorted alphabetically
                                        return a[0].localeCompare(b[0]);
                                    });

                                    return sortedStatuses.map(([status, count]) => {
                                        const isBadDebt = status === 'หนี้สูญ';
                                        return (
                                            <tr key={status}>
                                                <td className={`py-1.5 ${isBadDebt ? 'text-red-500 font-semibold' : 'text-slate-600'}`}>{status}</td>
                                                <td className={`py-1.5 text-right font-medium ${isBadDebt ? 'text-red-500' : 'text-slate-800'}`}>{count}</td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50/50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 font-semibold">วันที่ส่ง / ออเดอร์</th>
                                <th className="px-6 py-4 font-semibold">Order ID</th>
                                <th className="px-6 py-4 font-semibold">ลูกค้า / ผู้รับ</th>
                                <th className="px-6 py-4 font-semibold">การชำระเงิน</th>
                                <th className="px-6 py-4 font-semibold">Bank Info</th>
                                <th className="px-6 py-4 text-right font-semibold">ยอดเงิน</th>
                                <th className="px-6 py-4 font-semibold">สถานะ</th>
                                <th className="px-6 py-4 font-semibold">Tracking</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">Loading data...</td></tr>
                            ) : paginatedOrders.length === 0 ? (
                                <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400">ไม่พบรายการในช่วงเวลาที่เลือก</td></tr>
                            ) : (
                                paginatedOrders.map((order) => (
                                    <tr key={order.id} className="bg-white hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-slate-700">{formatDate(order.delivery_date)}</div>
                                            <div className="text-xs text-slate-400">สั่งซื้อ: {formatDate(order.order_date)}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => setSelectedOrderId(order.id)}
                                                className="font-mono font-medium text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 px-2 py-1 rounded transition-colors"
                                            >
                                                {order.id}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-slate-800 font-medium">{order.customer_first_name} {order.customer_last_name}</div>
                                            {(order.recipient_first_name || order.recipient_last_name) && (
                                                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <User size={10} /> {order.recipient_first_name} {order.recipient_last_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${order.payment_status === 'Paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                }`}>
                                                {order.payment_method}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-slate-600 max-w-xs break-words">
                                            {order.bank_info || '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-bold text-slate-700">{formatCurrency(order.total_amount)}</div>
                                            {order.total_slip_amount && Number(order.total_slip_amount) > 0 && (
                                                <div className="text-xs text-emerald-600 font-medium mt-0.5">Slip: {formatCurrency(order.total_slip_amount)}</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs border ${order.order_status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                order.order_status === 'Returned' ? 'bg-red-50 text-red-700 border-red-200' :
                                                    order.order_status === 'Claiming' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                        order.order_status === 'BadDebt' ? 'bg-gray-100 text-gray-700 border-gray-300' :
                                                            'bg-slate-50 text-slate-700 border-slate-200'
                                                }`}>
                                                {mapOrderStatus(order.order_status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 max-w-xs break-words text-xs">
                                            {order.tracking_numbers ? (
                                                <div className="flex flex-wrap gap-1 relative">
                                                    {order.tracking_numbers.split(', ').map((t, idx) => {
                                                        const cleanTrack = t.trim();
                                                        if (idx < 2) {
                                                            return (
                                                                <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs border border-gray-200 font-mono">
                                                                    {cleanTrack}
                                                                </span>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                    {order.tracking_numbers.split(', ').length > 2 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setOpenTrackingId(order.id);
                                                            }}
                                                            className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] border border-blue-100 hover:bg-blue-100 transition-colors"
                                                        >
                                                            +{order.tracking_numbers.split(', ').length - 2}
                                                        </button>
                                                    )}
                                                </div>
                                            ) : <span className="text-slate-300">-</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600">แสดงแถว:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                            {PAGE_SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="text-sm text-slate-600 mr-4">
                            {displayStart} - {displayEnd} จาก {totalItems}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={effectivePage === 1}
                            className="p-2 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm text-slate-700 font-medium px-2">
                            หน้า {effectivePage} / {totalPages}
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={effectivePage === totalPages}
                            className="p-2 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Tracking Modal */}
            {openTrackingId && (() => {
                const item = orders.find(d => d.id === openTrackingId);
                if (!item || !item.tracking_numbers) return null;
                return (
                    <TrackingModal
                        isOpen={true}
                        onClose={() => setOpenTrackingId(null)}
                        trackingNo={item.tracking_numbers}
                    />
                );
            })()}

            {/* Order Detail Modal */}
            <OrderDetailModal
                isOpen={!!selectedOrderId}
                onClose={() => setSelectedOrderId(null)}
                orderId={selectedOrderId}
            />
        </div>
    );
};

export default AllOrdersSentPage;
