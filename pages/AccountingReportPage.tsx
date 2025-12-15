import React, { useState, useEffect, useMemo } from 'react';
import { listStatementReport, listBankAccounts, getDashboardStats, listOutstandingOrders, updateOrderStatus } from '../services/api';
import usePersistentState from '../utils/usePersistentState';
import { Search, ChevronLeft, ChevronRight, Download, DollarSign, ShoppingBag, CreditCard, TrendingUp, CheckCircle, Package, Truck, AlertCircle, XCircle, RotateCcw, Ban, FileWarning } from 'lucide-react';
import Chart from 'react-apexcharts';
import { ApexOptions } from 'apexcharts';

interface StatementRow {
    statement_id: number;
    transfer_at: string;
    bank_name: string;
    statement_amount: number;
    channel: string;
    description: string;
    order_id: string | null;
    confirmed_amount: number | null;
    order_total_amount: number | null;
    payment_method: string | null;
    order_status: string | null;
    payment_status: string | null;
}

interface BankAccount {
    id: number;
    bank: string;
    bank_number: string;
    account_name: string;
}

interface DashboardStats {
    current_month: {
        total_sales: number;
        total_orders: number;
        shipping_count: number;
        shipping_amount: number;
        returned_count: number;
        returned_amount: number;
        cancelled_count: number;
        cancelled_amount: number;
        pending_approval_count: number;
        pending_approval_amount: number;
        claiming_count: number;
        claiming_amount: number;
        bad_debt_count: number;
        bad_debt_amount: number;
    };
    outstanding: {
        count: number;
        amount: number;
    };
    claiming_outstanding: {
        count: number;
        amount: number;
    };
}

interface OutstandingOrder {
    id: string;
    order_date: string;
    delivery_date: string;
    customer_first_name: string;
    customer_last_name: string;
    total_amount: number;
    payment_method: string;
    order_status: string;
    tracking_numbers: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 500];

// --- Modal Component ---
const OutstandingOrdersModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    month: number;
    year: number;
    onUpdate: () => void;
}> = ({ isOpen, onClose, month, year, onUpdate }) => {
    const [orders, setOrders] = useState<OutstandingOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadOrders();
        }
    }, [isOpen, month, year]);

    const loadOrders = async () => {
        setLoading(true);
        try {
            const data = await listOutstandingOrders({ month, year });
            if (Array.isArray(data)) setOrders(data);
        } catch (err) {
            console.error("Failed to load outstanding orders", err);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (orderId: string, status: 'Claiming' | 'BadDebt') => {
        if (!confirm(`คุณต้องการเปลี่ยนสถานะออเดอร์นี้เป็น "${status === 'Claiming' ? 'รอเคลม' : 'หนี้สูญ'}" ใช่หรือไม่?`)) return;

        setProcessingId(orderId);
        try {
            await updateOrderStatus({ orderId, status, note: `Marked as ${status} from Dashboard` });
            // Remove from list locally
            setOrders(prev => prev.filter(o => o.id !== orderId));
            onUpdate(); // Trigger dashboard refresh
        } catch (err) {
            alert("Failed to update status");
        } finally {
            setProcessingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-bold text-gray-800">จัดการรายการค้างจ่าย (Outstanding)</h3>
                        <p className="text-sm text-gray-500 mt-1">รายการเก่าที่ยังไม่จบสถานะ (ก่อนเดือน {month}/{year})</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div></div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">ไม่มีรายการค้างจ่าย</div>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4 bg-gray-100 font-semibold text-gray-600">Order ID</th>
                                    <th className="px-6 py-4 bg-gray-100 font-semibold text-gray-600">วันที่</th>
                                    <th className="px-6 py-4 bg-gray-100 font-semibold text-gray-600">ลูกค้า</th>
                                    <th className="px-6 py-4 text-right bg-gray-100 font-semibold text-gray-600">ยอดเงิน</th>
                                    <th className="px-6 py-4 bg-gray-100 font-semibold text-gray-600">สถานะ</th>
                                    <th className="px-6 py-4 text-center bg-gray-100 min-w-[200px] font-semibold text-gray-600">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-gray-600">{order.id}</td>
                                        <td className="px-6 py-4 text-gray-600">{new Date(order.order_date).toLocaleDateString('th-TH')}</td>
                                        <td className="px-6 py-4 font-medium text-gray-900">{order.customer_first_name} {order.customer_last_name}</td>
                                        <td className="px-6 py-4 text-right font-bold text-red-600">
                                            {new Intl.NumberFormat('th-TH').format(order.total_amount)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${order.order_status === 'Pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    order.order_status === 'Picking' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                        'bg-gray-100 text-gray-700 border-gray-200'
                                                }`}>
                                                {order.order_status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-center gap-2 whitespace-nowrap">
                                                <button
                                                    onClick={() => handleStatusUpdate(order.id, 'Claiming')}
                                                    disabled={!!processingId}
                                                    className="px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded hover:bg-amber-100 text-xs font-medium disabled:opacity-50 transition-colors shadow-sm"
                                                >
                                                    แจ้งรอเคลม
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(order.id, 'BadDebt')}
                                                    disabled={!!processingId}
                                                    className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded hover:bg-red-100 text-xs font-medium disabled:opacity-50 transition-colors shadow-sm"
                                                >
                                                    ตัดหนี้สูญ
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Page Component ---
const AccountingReportPage: React.FC = () => {
    const [statements, setStatements] = useState<StatementRow[]>([]);
    const [orderStats, setOrderStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [showOutstandingModal, setShowOutstandingModal] = useState(false);

    // Filters
    const [selectedMonth, setSelectedMonth] = usePersistentState<number>('acc:month', new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = usePersistentState<number>('acc:year', new Date().getFullYear());
    const [selectedBankId, setSelectedBankId] = usePersistentState<string>('acc:bankId', '');
    const [searchTerm, setSearchTerm] = useState('');

    // Pagination
    const [itemsPerPage, setItemsPerPage] = usePersistentState<number>('acc:itemsPerPage', PAGE_SIZE_OPTIONS[1]);
    const [currentPage, setCurrentPage] = usePersistentState<number>('acc:currentPage', 1);

    useEffect(() => {
        loadBanks();
    }, []);

    useEffect(() => {
        loadData();
        setCurrentPage(1);
    }, [selectedMonth, selectedYear, selectedBankId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const loadBanks = async () => {
        try {
            const data = await listBankAccounts();
            if (Array.isArray(data)) setBanks(data);
        } catch (err) {
            console.error("Failed to load banks", err);
        }
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const stmtPromise = listStatementReport({
                month: selectedMonth,
                year: selectedYear,
                bankId: selectedBankId ? Number(selectedBankId) : undefined,
                q: searchTerm
            });

            const statsPromise = getDashboardStats({
                month: selectedMonth,
                year: selectedYear
            });

            const [stmtData, statsData] = await Promise.all([stmtPromise, statsPromise]);

            if (Array.isArray(stmtData)) {
                setStatements(stmtData);
            } else {
                setStatements([]);
            }

            if (statsData) {
                setOrderStats(statsData);
            }

        } catch (err) {
            console.error("Failed to load accounting data", err);
            setStatements([]);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!statements.length) return;

        const headers = [
            "วันที่", "เวลา", "ธนาคาร", "ยอดเงินเข้า", "ช่องทาง", "รายละเอียด",
            "เลขที่ออเดอร์", "ยอดออเดอร์", "วิธีชำระ", "สถานะออเดอร์", "สถานะยืนยัน"
        ];

        const csvContent = [
            headers.join(','),
            ...statements.map(s => {
                const dateObj = new Date(s.transfer_at);
                const dateStr = dateObj.toLocaleDateString('th-TH');
                const timeStr = dateObj.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

                return [
                    `"${dateStr}"`,
                    `"${timeStr}"`,
                    `"${(s.bank_name || '').replace(/"/g, '""')}"`,
                    s.statement_amount,
                    `"${(s.channel || '').replace(/"/g, '""')}"`,
                    `"${(s.description || '').replace(/"/g, '""')}"`,
                    `"${s.order_id || ''}"`,
                    s.order_total_amount || 0,
                    `"${mapPaymentMethod(s.payment_method) || ''}"`,
                    `"${mapOrderStatus(s.order_status) || ''}"`,
                    `"${s.payment_status || ''}"`
                ].join(',');
            })
        ].join('\n');

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `statement_report_${selectedYear}_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const mapPaymentMethod = (method: string | null) => {
        if (!method) return '-';
        if (method === 'Transfer') return 'โอนเงิน';
        if (method === 'COD') return 'เก็บเงินปลายทาง';
        return method;
    };

    const mapOrderStatus = (status: string | null) => {
        if (!status) return '-';
        const map: Record<string, string> = {
            'Pending': 'รอตรวจสอบ',
            'Picking': 'กำลังจัดของ',
            'Shipping': 'กำลังส่ง',
            'Delivered': 'เสร็จสิ้น',
            'Returned': 'ตีกลับ',
            'Cancelled': 'ยกเลิก',
            'Preparing': 'เตรียมจัดส่ง',
            'Claiming': 'รอเคลม',
            'BadDebt': 'หนี้สูญ'
        };
        return map[status] || status;
    };

    const stats = useMemo(() => {
        const totalIncome = statements.reduce((sum, s) => sum + Number(s.statement_amount), 0);
        const totalTransactions = statements.length;
        const uniqueOrders = new Set(statements.filter(s => s.order_id).map(s => s.order_id));
        const totalMatchedOrders = uniqueOrders.size;

        const avgTransactionValue = totalTransactions > 0 ? totalIncome / totalTransactions : 0;

        const dailyIncome: Record<number, number> = {};
        statements.forEach(s => {
            const day = new Date(s.transfer_at).getDate();
            dailyIncome[day] = (dailyIncome[day] || 0) + Number(s.statement_amount);
        });

        const paymentMethods: Record<string, number> = {};
        statements.forEach(s => {
            if (s.order_id) {
                const method = mapPaymentMethod(s.payment_method);
                const amt = s.confirmed_amount ? Number(s.confirmed_amount) : Number(s.statement_amount);
                paymentMethods[method] = (paymentMethods[method] || 0) + amt;
            } else {
                paymentMethods['ไม่ระบุ'] = (paymentMethods['ไม่ระบุ'] || 0) + Number(s.statement_amount);
            }
        });

        return {
            totalIncome,
            totalTransactions,
            totalMatchedOrders,
            avgTransactionValue,
            dailyIncome,
            paymentMethods
        };
    }, [statements]);

    // --- Chart Options ---
    const dailyChartOptions: ApexOptions = {
        chart: { type: 'area', toolbar: { show: false }, fontFamily: 'Inter, sans-serif' },
        stroke: { curve: 'smooth', width: 2 },
        fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.7, opacityTo: 0.2, stops: [0, 90, 100] } },
        xaxis: { categories: Object.keys(stats.dailyIncome).sort((a, b) => Number(a) - Number(b)).map(d => `${d}`) },
        colors: ['#10B981'],
        dataLabels: { enabled: false },
        tooltip: { y: { formatter: (val) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val) } }
    };

    const dailyChartSeries = [{ name: 'ยอดเงิน', data: Object.keys(stats.dailyIncome).sort((a, b) => Number(a) - Number(b)).map(d => stats.dailyIncome[Number(d)]) }];

    const paymentChartOptions: ApexOptions = {
        chart: { type: 'donut', fontFamily: 'Inter, sans-serif' },
        labels: Object.keys(stats.paymentMethods),
        colors: ['#3B82F6', '#F59E0B', '#10B981', '#94A3B8'],
        plotOptions: { pie: { donut: { size: '65%' } } },
        dataLabels: { enabled: false },
        legend: { position: 'bottom' },
        tooltip: { y: { formatter: (val) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(val) } }
    };

    const paymentChartSeries = Object.values(stats.paymentMethods);


    const formatCurrency = (amount: number | string | null) => {
        const val = Number(amount || 0);
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 }).format(val);
    };

    const formatDateTime = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return {
                date: new Intl.DateTimeFormat('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }).format(date),
                time: new Intl.DateTimeFormat('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
            };
        } catch (e) {
            return { date: dateStr, time: '' };
        }
    };

    const totalItems = statements.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (effectivePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedStatements = statements.slice(startIndex, endIndex);
    const displayStart = totalItems === 0 ? 0 : startIndex + 1;
    const displayEnd = Math.min(endIndex, totalItems);

    return (
        <div className="p-6 bg-slate-50 min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800 tracking-tight">แดชบอร์ดการเงิน</h2>
                    <p className="text-slate-500 mt-1">ภาพรวมธุรกรรมขาเข้าและยอดขาย</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <select
                            value={selectedBankId}
                            onChange={(e) => setSelectedBankId(e.target.value)}
                            className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-emerald-500 focus:border-emerald-500 min-w-[150px] shadow-sm"
                        >
                            <option value="">ทุกธนาคาร</option>
                            {banks.map(b => (
                                <option key={b.id} value={b.id}>{b.bank} {b.bank_number}</option>
                            ))}
                        </select>

                        <div className="flex bg-white rounded-lg shadow-sm border border-slate-200 p-1">
                            <select
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                                className="bg-transparent text-sm font-medium text-slate-700 px-3 py-1.5 focus:outline-none cursor-pointer hover:bg-slate-50 rounded"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>{new Date(0, m - 1).toLocaleString('th-TH', { month: 'short' })}</option>
                                ))}
                            </select>
                            <div className="w-px bg-slate-200 my-1"></div>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(Number(e.target.value))}
                                className="bg-transparent text-sm font-medium text-slate-700 px-3 py-1.5 focus:outline-none cursor-pointer hover:bg-slate-50 rounded"
                            >
                                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                                    <option key={y} value={y}>{y + 543}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={statements.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 shadow-sm transition-all text-sm font-medium disabled:opacity-50"
                    >
                        <Download size={16} />
                        ดาวน์โหลด CSV
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent"></div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* 1. Summary Cards (Statement Centric) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">ยอดรายรับ (Statement)</p>
                                <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(stats.totalIncome)}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                                <ShoppingBag size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">จำนวนรายการ</p>
                                <h3 className="text-2xl font-bold text-slate-800">{stats.totalTransactions}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                                <CheckCircle size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">ออเดอร์ที่จับคู่</p>
                                <h3 className="text-2xl font-bold text-slate-800">{stats.totalMatchedOrders}</h3>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-shadow">
                            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center text-purple-600">
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <p className="text-sm text-slate-500 font-medium">ยอดเฉลี่ยต่อรายการ</p>
                                <h3 className="text-2xl font-bold text-slate-800">{formatCurrency(stats.avgTransactionValue)}</h3>
                            </div>
                        </div>
                    </div>

                    {/* 2. Order Statistics Section (NEW) */}
                    {orderStats && (
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 mb-4 px-1">ภาพรวมออเดอร์ (Order Status)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                {/* Total Sales */}
                                <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-4 rounded-xl text-white shadow-lg shadow-indigo-200">
                                    <p className="text-indigo-100 text-xs font-medium mb-1">ยอดขายทั้งหมด</p>
                                    <h4 className="text-xl font-bold">{formatCurrency(orderStats.current_month.total_sales)}</h4>
                                    <div className="flex items-center gap-1 mt-2 text-indigo-100 text-xs">
                                        <Package size={12} /> {orderStats.current_month.total_orders} รายการ
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 lg:col-span-2">
                                    {/* Shipping */}
                                    <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-slate-500 text-xs font-medium">กำลังจัดส่ง</p>
                                            <Truck size={14} className="text-blue-500" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-800">{formatCurrency(orderStats.current_month.shipping_amount)}</h4>
                                        <p className="text-xs text-slate-400 mt-1">{orderStats.current_month.shipping_count} รายการ</p>
                                    </div>

                                    {/* Returned */}
                                    <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-slate-500 text-xs font-medium">ตีกลับ</p>
                                            <RotateCcw size={14} className="text-orange-500" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-800">{formatCurrency(orderStats.current_month.returned_amount)}</h4>
                                        <p className="text-xs text-slate-400 mt-1">{orderStats.current_month.returned_count} รายการ</p>
                                    </div>

                                    {/* Claiming */}
                                    <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-slate-500 text-xs font-medium">รอเคลม</p>
                                            <FileWarning size={14} className="text-amber-500" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-800">{formatCurrency(orderStats.current_month.claiming_amount)}</h4>
                                        <p className="text-xs text-slate-400 mt-1">{orderStats.current_month.claiming_count} รายการ</p>
                                    </div>

                                    {/* Bad Debt */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <p className="text-slate-500 text-xs font-medium">หนี้สูญ</p>
                                            <Ban size={14} className="text-gray-500" />
                                        </div>
                                        <h4 className="text-lg font-bold text-slate-800">{formatCurrency(orderStats.current_month.bad_debt_amount)}</h4>
                                        <p className="text-xs text-slate-400 mt-1">{orderStats.current_month.bad_debt_count} รายการ</p>
                                    </div>
                                </div>

                                {/* Outstanding (Previous Months) - CLICKABLE */}
                                <div
                                    className="bg-red-50 p-4 rounded-xl border border-red-100 shadow-sm cursor-pointer hover:bg-red-100 transition-colors group"
                                    onClick={() => setShowOutstandingModal(true)}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-red-700 text-xs font-bold group-hover:underline">ค้างจ่าย (เก่า) - คลิกเพื่อจัดการ</p>
                                        <AlertCircle size={14} className="text-red-500" />
                                    </div>
                                    <h4 className="text-lg font-bold text-red-700">{formatCurrency(orderStats.outstanding.amount)}</h4>
                                    <p className="text-xs text-red-500 mt-1">{orderStats.outstanding.count} รายการ</p>
                                </div>

                                {/* Claiming (Outstanding Loop) */}
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="text-amber-700 text-xs font-bold">กำลังเคลม (เก่า)</p>
                                        <AlertCircle size={14} className="text-amber-500" />
                                    </div>
                                    <h4 className="text-lg font-bold text-amber-700">{formatCurrency(orderStats.claiming_outstanding.amount)}</h4>
                                    <p className="text-xs text-amber-500 mt-1">{orderStats.claiming_outstanding.count} รายการ</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 3. Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Daily Trend */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 lg:col-span-2">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">แนวโน้มรายรับรายวัน</h3>
                            <div className="h-64">
                                <Chart options={dailyChartOptions} series={dailyChartSeries} type="area" height="100%" />
                            </div>
                        </div>
                        {/* Payment Mix */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">สัดส่วนช่องทางการชำระเงิน</h3>
                            <div className="h-64 flex items-center justify-center">
                                <Chart options={paymentChartOptions} series={paymentChartSeries} type="donut" height="100%" />
                            </div>
                        </div>
                    </div>

                    {/* 4. Detailed Table */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800">รายการเดินบัญชี (Statement)</h3>

                            {/* Table Controls */}
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="ค้นหา..."
                                    className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-emerald-500 focus:border-emerald-500 w-64"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        {/* Columns requested: Date, Time, Bank, Income, Channel, Details, Order No, Order Amount, P.Method, Status, Confirm */}
                                        <th className="px-4 py-3">วันที่</th>
                                        <th className="px-4 py-3">เวลา</th>
                                        <th className="px-4 py-3">ธนาคาร</th>
                                        <th className="px-4 py-3 text-right">ยอดเงินเข้า</th>
                                        <th className="px-4 py-3">ช่องทาง</th>
                                        <th className="px-4 py-3">รายละเอียด</th>
                                        <th className="px-4 py-3">เลขที่ออเดอร์</th>
                                        <th className="px-4 py-3 text-right">ยอดออเดอร์</th>
                                        <th className="px-4 py-3">วิธีชำระ</th>
                                        <th className="px-4 py-3">สถานะออเดอร์</th>
                                        <th className="px-4 py-3">สถานะยืนยัน</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedStatements.length === 0 ? (
                                        <tr><td colSpan={11} className="px-6 py-8 text-center text-gray-400">ไม่พบรายการ</td></tr>
                                    ) : (
                                        paginatedStatements.map((row, idx) => {
                                            const dt = formatDateTime(row.transfer_at);
                                            return (
                                                <tr key={row.statement_id + '_' + idx} className="bg-white border-b hover:bg-gray-50/80 transition-colors">
                                                    <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{dt.date}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">{dt.time}</td>
                                                    <td className="px-4 py-3 max-w-[150px] truncate" title={row.bank_name}>
                                                        {row.bank_name}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-emerald-600">
                                                        {formatCurrency(row.statement_amount)}
                                                    </td>
                                                    <td className="px-4 py-3">{row.channel}</td>
                                                    <td className="px-4 py-3 max-w-[200px] truncate" title={row.description}>
                                                        {row.description}
                                                    </td>
                                                    <td className="px-4 py-3 font-mono text-xs">
                                                        {row.order_id || '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {row.order_total_amount ? formatCurrency(row.order_total_amount) : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {mapPaymentMethod(row.payment_method)}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {row.order_status && (
                                                            <span className={`px-2 py-0.5 rounded-full ${row.order_status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                                                row.order_status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                                                    row.order_status === 'BadDebt' ? 'bg-gray-800 text-white' :
                                                                        row.order_status === 'Claiming' ? 'bg-amber-100 text-amber-800' :
                                                                            'bg-yellow-100 text-yellow-800'
                                                                }`}>
                                                                {mapOrderStatus(row.order_status)}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs">
                                                        {row.payment_status && (
                                                            <span className={`px-2 py-0.5 rounded-full ${row.payment_status === 'Paid' || row.payment_status === 'Approved' ? 'bg-green-100 text-green-800' :
                                                                'bg-gray-100 text-gray-800'
                                                                }`}>
                                                                {row.payment_status}
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">แสดง</span>
                                <select
                                    value={itemsPerPage}
                                    onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                >
                                    {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 mr-2">
                                    {displayStart}-{displayEnd} จากทั้งหมด {totalItems}
                                </span>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={effectivePage === 1}
                                    className="p-1.5 border border-gray-300 rounded hover:bg-white disabled:opacity-50"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={effectivePage === totalPages}
                                    className="p-1.5 border border-gray-300 rounded hover:bg-white disabled:opacity-50"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            <OutstandingOrdersModal
                isOpen={showOutstandingModal}
                onClose={() => setShowOutstandingModal(false)}
                month={selectedMonth}
                year={selectedYear}
                onUpdate={() => {
                    loadData();
                }}
            />
        </div>
    );
};

export default AccountingReportPage;
