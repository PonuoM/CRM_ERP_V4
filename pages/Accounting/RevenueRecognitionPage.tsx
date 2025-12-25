import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api'; // Adjust path based on location
import { Search, Loader2, ExternalLink, Filter, CheckSquare, TrendingUp, AlertCircle, Calendar, CheckCircle, X, Copy, Check, Download } from 'lucide-react';
import { Order, ModalType } from '../../types';
import StatCard from '../../components/StatCard';
import OrderDetailModal from '../../components/OrderDetailModal';
import TrackingModal from '../../components/TrackingModal';




interface RevenueItem {
    id: string; // Order ID
    order_date: string;
    total_amount: number;
    customer_name: string;
    order_status: string;
    tracking_no: string;
    goods_issue_date: string | null;
    revenue_month: string | null;
    is_recognized: boolean;
    cross_period: boolean;
    pending_issue: boolean;
    order_month: string;
    shipping_provider?: string;
}

const RevenueRecognitionPage: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<RevenueItem[]>([]);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    // Modal State
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [openTrackingId, setOpenTrackingId] = useState<string | null>(null);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setOpenTrackingId(null);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const query = new URLSearchParams({
                month: String(month),
                year: String(year)
            });
            const response = await apiFetch(`accounting_revenue_recognition?${query}`);

            // API returns array directly
            if (Array.isArray(response)) {
                setData(response);
            } else if (response && response.data && Array.isArray(response.data)) {
                // Fallback if API changes to return envelope
                setData(response.data);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to fetch revenue data');
        } finally {
            setLoading(false);
        }
    };



    const handleOrderClick = (orderId: string) => {
        setSelectedOrderId(orderId);
    };

    useEffect(() => {
        fetchData();
    }, [month, year]);

    const handleExportCSV = () => {
        if (data.length === 0) {
            alert("ไม่พบข้อมูลสำหรับส่งออก");
            return;
        }

        const headers = [
            "Order ID",
            "Customer",
            "Order Date",
            "Goods Issue Date",
            "Shipping Provider",
            "Tracking No",
            "Amount",
            "Status",
            "Revenue Month",
            "Is Cross Period"
        ];

        const csvContent = [
            headers.join(","),
            ...data.map(item => [
                `"${item.id}"`,
                `"${(item.customer_name || '').replace(/"/g, '""')}"`,
                `"${new Date(item.order_date).toLocaleDateString('th-TH')}"`,
                `"${item.goods_issue_date ? new Date(item.goods_issue_date).toLocaleString('th-TH') : 'ยังไม่ส่งออก'}"`,
                `"${(item.shipping_provider || '').replace(/"/g, '""')}"`,
                `"${(item.tracking_no || '').replace(/"/g, '""')}"`,
                item.total_amount,
                `"${item.is_recognized ? 'Recognized' : 'Pending'}"`,
                `"${item.revenue_month || ''}"`,
                item.cross_period ? 'Yes' : 'No'
            ].join(","))
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `revenue_recognition_${year}_${month}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Calculate Summary Stats
    const totalRevenue = data
        .filter(item => item.revenue_month === `${year}-${String(month).padStart(2, '0')}`)
        .reduce((sum, item) => sum + item.total_amount, 0);

    const pendingRevenue = data
        .filter(item => item.pending_issue)
        .reduce((sum, item) => sum + item.total_amount, 0);

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center">
                        <CheckCircle className="w-6 h-6 mr-2 text-green-600" />
                        ปิดบัญชีลูกหนี้ (Revenue Recognition)
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        ตรวจสอบวันที่สินค้าออกจากคลังจริง เพื่อบันทึกบัญชีตามรอบเดือน
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border">
                    <Calendar className="w-5 h-5 text-gray-500" />
                    <select
                        value={month}
                        onChange={(e) => setMonth(Number(e.target.value))}
                        className="border-none focus:ring-0 text-sm font-medium text-gray-700 bg-transparent"
                    >
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>
                                {new Date(0, i).toLocaleString('th-TH', { month: 'long' })}
                            </option>
                        ))}
                    </select>
                    <select
                        value={year}
                        onChange={(e) => setYear(Number(e.target.value))}
                        className="border-none focus:ring-0 text-sm font-medium text-gray-700 bg-transparent"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    <button
                        onClick={fetchData}
                        className="ml-2 p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                        title="Reload Data"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                    <button
                        onClick={handleExportCSV}
                        disabled={data.length === 0 || loading}
                        className="ml-2 p-2 bg-green-50 text-green-600 rounded-full hover:bg-green-100 transition-colors disabled:opacity-50"
                        title="Export CSV"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <StatCard
                    title="รายได้ที่รับรู้แล้ว (เดือนนี้)"
                    value={`฿${totalRevenue.toLocaleString()}`}
                    subtext="Goods Issued Log Detected"
                    icon={TrendingUp}
                />
                <StatCard
                    title="รอรับรู้ (Pending Issue)"
                    value={`฿${pendingRevenue.toLocaleString()}`}
                    subtext="Order created this month, but not shipped"
                    icon={AlertCircle}
                />
                <StatCard
                    title="คาบเกี่ยว (Cross Period)"
                    value={`${data.filter(i => i.cross_period && i.revenue_month === `${year}-${String(month).padStart(2, '0')}`).length} รายการ`}
                    subtext="Created in prev month -> Recognized this month"
                    icon={Calendar}
                />
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden border">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
                            <tr>
                                <th className="px-6 py-4 text-left">Order ID</th>
                                <th className="px-6 py-4 text-left">ลูกค้า</th>
                                <th className="px-6 py-4 text-center">วันที่สั่งซื้อ (Booking)</th>
                                <th className="px-6 py-4 text-center bg-blue-50/50">วันที่ส่งของ (Goods Issue)</th>
                                <th className="px-6 py-4 text-left">ขนส่ง</th>
                                <th className="px-6 py-4 text-center">หลักฐาน (Tracking/Log)</th>
                                <th className="px-6 py-4 text-right">ยอดเงิน</th>
                                <th className="px-6 py-4 text-center">สถานะบัญชี</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
                                            <p>กำลังประมวลผลข้อมูลจาก Audit Log...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : data.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                                        ไม่พบข้อมูลในเดือนนี้
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => {
                                    const isRevenueThisMonth = item.revenue_month === `${year}-${String(month).padStart(2, '0')}`;

                                    return (
                                        <tr
                                            key={item.id}
                                            className={`hover:bg-gray-50 transition-colors 
                                                ${item.cross_period ? 'bg-purple-50/30' : ''} 
                                                ${!item.is_recognized && item.pending_issue ? 'bg-orange-50/30' : ''}`}
                                        >
                                            <td className="px-6 py-4 font-medium text-gray-900">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleOrderClick(item.id)}
                                                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center"
                                                    >
                                                        {item.id}
                                                        <ExternalLink className="w-3 h-3 ml-1" />
                                                    </button>
                                                    {item.cross_period && (
                                                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200 whitespace-nowrap">
                                                            ข้ามเดือน
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]">
                                                {item.customer_name || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center text-gray-500">
                                                {new Date(item.order_date).toLocaleDateString('th-TH')}
                                            </td>
                                            <td className={`px-6 py-4 text-center font-bold ${item.goods_issue_date ? 'text-green-600' : 'text-gray-400 italic'}`}>
                                                {item.goods_issue_date
                                                    ? new Date(item.goods_issue_date).toLocaleDateString('th-TH', {
                                                        year: '2-digit', month: 'short', day: 'numeric',
                                                        hour: '2-digit', minute: '2-digit'
                                                    })
                                                    : 'ยังไม่ส่งออก'
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">
                                                {item.shipping_provider || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {item.tracking_no ? (
                                                    <div className="flex flex-wrap gap-1 justify-center relative">
                                                        {item.tracking_no.split(',').map((track, i) => {
                                                            const t = track.trim();
                                                            if (i < 2) {
                                                                return (
                                                                    <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs border border-gray-200">
                                                                        {t}
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                        {item.tracking_no.split(',').length > 2 && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setOpenTrackingId(item.id);
                                                                }}
                                                                className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px] border border-blue-100 hover:bg-blue-100 transition-colors"
                                                            >
                                                                +{item.tracking_no.split(',').length - 2}
                                                            </button>
                                                        )}
                                                    </div>
                                                ) : item.goods_issue_date ? (
                                                    <span className="text-xs text-gray-400">Log Detected</span>
                                                ) : (
                                                    '-'
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium">
                                                ฿{item.total_amount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {item.is_recognized ? (
                                                    isRevenueThisMonth ? (
                                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">
                                                            รับรู้รายได้แล้ว
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full border">
                                                            รอบเดือน {item.revenue_month}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-bold flex items-center justify-center gap-1">
                                                        <AlertCircle className="w-3 h-3" /> รอของออก
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
                <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-xs text-gray-500">
                    <div>
                        * Log System เริ่มทำงานเมื่อ {new Date().toLocaleDateString('th-TH')}
                    </div>
                    <div>
                        Total Items: {data.length}
                    </div>
                </div>
            </div>

            {/* Tracking Modal */}
            {openTrackingId && (() => {
                const item = data.find(d => d.id === openTrackingId);
                if (!item) return null;
                return (
                    <TrackingModal
                        isOpen={true}
                        onClose={() => setOpenTrackingId(null)}
                        trackingNo={item.tracking_no}
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

// Local definition removed, using imported component
export default RevenueRecognitionPage;
