import React, { useState, useEffect, useMemo } from "react";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Calendar, Download, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react";

interface OrdersReportPageProps {
    currentUser: User;
}

interface OrderRow {
    id: string;
    order_date: string;
    delivery_date: string | null;
    creator_id: number;
    creator_name?: string;
    total_amount: number;
    payment_method: string;
    payment_status: string;
    order_status: string;
    shipping_provider: string | null;
    tracking_numbers: string | null;
}

const THAI_MONTHS = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
];

const PAYMENT_STATUSES = ["All", "Pending", "Paid", "PartialPaid", "Cancelled"];
const PAGE_SIZES = [100, 500, 1000];

const formatDate = (iso: string | null): string => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const formatMoney = (amount: number): string => {
    return new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);
};

const OrdersReportPage: React.FC<OrdersReportPageProps> = ({ currentUser }) => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [paymentStatus, setPaymentStatus] = useState("All");
    const [pageSize, setPageSize] = useState(100);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [total, setTotal] = useState(0);
    const [users, setUsers] = useState<Record<number, string>>({});

    const yearOptions = useMemo(() => {
        const currentYear = new Date().getFullYear();
        return [currentYear, currentYear - 1, currentYear - 2];
    }, []);

    // Fetch users for seller name lookup
    useEffect(() => {
        apiFetch("users").then((data: any[]) => {
            const map: Record<number, string> = {};
            data.forEach((u) => {
                map[u.id] = `${u.first_name || ""} ${u.last_name || ""}`.trim();
            });
            setUsers(map);
        }).catch(() => { });
    }, []);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const endDate = new Date(year, month, 0).toISOString().slice(0, 10);

            let url = `orders?page=${page}&pageSize=${pageSize}&orderDateStart=${startDate}&orderDateEnd=${endDate}`;
            if (currentUser.companyId) url += `&companyId=${currentUser.companyId}`;
            if (paymentStatus !== "All") url += `&paymentStatus=${paymentStatus}`;

            const result = await apiFetch(url);
            setOrders(result.orders || []);
            setTotal(result.pagination?.total || 0);
        } catch (error) {
            console.error("Failed to fetch orders", error);
            setOrders([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setPage(1);
    }, [month, year, paymentStatus, pageSize]);

    useEffect(() => {
        fetchOrders();
    }, [page, month, year, paymentStatus, pageSize]);

    const totalPages = Math.ceil(total / pageSize);

    const exportCSV = () => {
        const headers = ["วันที่สั่ง", "ออเดอร์", "วันที่ส่ง", "ผู้ขาย", "ราคา", "ช่องทางชำระ", "สถานะการชำระ", "สถานะออเดอร์", "ขนส่ง", "Tracking"];
        const rows = orders.map((o) => [
            formatDate(o.order_date),
            o.id,
            formatDate(o.delivery_date),
            users[o.creator_id] || "-",
            formatMoney(o.total_amount),
            o.payment_method || "-",
            o.payment_status || "-",
            o.order_status || "-",
            o.shipping_provider || "-",
            o.tracking_numbers || "-",
        ]);

        const csvContent = [headers, ...rows].map((row) => row.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `orders_report_${year}_${month}.csv`;
        link.click();
    };

    return (
        <div className="p-4 max-w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <ShoppingCart className="w-6 h-6 text-blue-600" />
                    <h1 className="text-xl font-bold text-gray-800">รายงานคำสั่งซื้อ</h1>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <select
                            value={month}
                            onChange={(e) => setMonth(Number(e.target.value))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                            {THAI_MONTHS.map((name, idx) => (
                                <option key={idx} value={idx + 1}>{name}</option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={(e) => setYear(Number(e.target.value))}
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                        >
                            {yearOptions.map((y) => (
                                <option key={y} value={y}>{y + 543}</option>
                            ))}
                        </select>
                    </div>

                    <select
                        value={paymentStatus}
                        onChange={(e) => setPaymentStatus(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                        {PAYMENT_STATUSES.map((s) => (
                            <option key={s} value={s}>{s === "All" ? "สถานะทั้งหมด" : s}</option>
                        ))}
                    </select>

                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                        {PAGE_SIZES.map((s) => (
                            <option key={s} value={s}>{s} รายการ</option>
                        ))}
                    </select>

                    <button
                        onClick={exportCSV}
                        disabled={orders.length === 0}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        CSV
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="mb-2 text-sm text-gray-600">
                ทั้งหมด <span className="font-semibold text-gray-800">{total.toLocaleString()}</span> รายการ
                {totalPages > 1 && ` (หน้า ${page}/${totalPages})`}
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            )}

            {/* Table */}
            {!loading && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead>
                                <tr className="bg-gray-100 border-b">
                                    <th className="px-2 py-2 text-left font-semibold text-gray-700">วันที่สั่ง</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-700">ออเดอร์</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-700">วันที่ส่ง</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-700">ผู้ขาย</th>
                                    <th className="px-2 py-2 text-right font-semibold text-gray-700">ราคา</th>
                                    <th className="px-2 py-2 text-center font-semibold text-gray-700">ชำระ</th>
                                    <th className="px-2 py-2 text-center font-semibold text-gray-700">สถานะชำระ</th>
                                    <th className="px-2 py-2 text-center font-semibold text-gray-700">สถานะ</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-700">ขนส่ง</th>
                                    <th className="px-2 py-2 text-left font-semibold text-gray-700">Tracking</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order, idx) => (
                                    <tr key={order.id} className={`border-b hover:bg-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                                        <td className="px-2 py-1.5 text-gray-600">{formatDate(order.order_date)}</td>
                                        <td className="px-2 py-1.5 text-blue-600 font-medium">{order.id}</td>
                                        <td className="px-2 py-1.5 text-gray-600">{formatDate(order.delivery_date)}</td>
                                        <td className="px-2 py-1.5 text-gray-700 truncate max-w-[120px]">{users[order.creator_id] || "-"}</td>
                                        <td className="px-2 py-1.5 text-right text-gray-700 font-medium">{formatMoney(order.total_amount)}</td>
                                        <td className="px-2 py-1.5 text-center text-gray-600">{order.payment_method || "-"}</td>
                                        <td className="px-2 py-1.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${order.payment_status === "Paid" ? "bg-green-100 text-green-700" :
                                                order.payment_status === "Pending" ? "bg-yellow-100 text-yellow-700" :
                                                    order.payment_status === "PartialPaid" ? "bg-blue-100 text-blue-700" :
                                                        "bg-gray-100 text-gray-600"
                                                }`}>
                                                {order.payment_status || "-"}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-center">
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${order.order_status === "Completed" ? "bg-green-100 text-green-700" :
                                                order.order_status === "Shipped" ? "bg-blue-100 text-blue-700" :
                                                    order.order_status === "Cancelled" ? "bg-red-100 text-red-700" :
                                                        "bg-gray-100 text-gray-600"
                                                }`}>
                                                {order.order_status || "-"}
                                            </span>
                                        </td>
                                        <td className="px-2 py-1.5 text-gray-600 truncate max-w-[100px]">{order.shipping_provider || "-"}</td>
                                        <td className="px-2 py-1.5 text-gray-600 truncate max-w-[150px]">{order.tracking_numbers || "-"}</td>
                                    </tr>
                                ))}
                                {orders.length === 0 && (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                            ไม่พบข้อมูลคำสั่งซื้อ
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="px-4 py-2 bg-gray-50 border-t flex items-center justify-between">
                            <div className="text-xs text-gray-500">
                                แสดง {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, total)} จาก {total}
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-2 text-sm">{page} / {totalPages}</span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={page === totalPages}
                                    className="p-1 rounded hover:bg-gray-200 disabled:opacity-50"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default OrdersReportPage;
