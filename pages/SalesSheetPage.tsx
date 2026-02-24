import React, { useState, useEffect, useMemo, useCallback } from "react";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Download, ChevronLeft, ChevronRight, Search, FileSpreadsheet, Loader2, X, Filter } from "lucide-react";

interface SalesSheetPageProps {
    currentUser: User;
}

interface SheetRow {
    order_date: string;
    order_number: string;
    customer_type: string | null;
    basket_key_at_sale: string | null;
    sales_channel: string | null;
    payment_method: string | null;
    customer_name: string;
    customer_phone: string | null;
    address: string | null;
    province: string | null;
    product_sku: string | null;
    product_name: string;
    quantity: number;
    net_total: number;
    price_per_unit: number;
    is_freebie: number;
    delivery_date: string | null;
    order_status: string;
    payment_status: string | null;
    seller_name: string;
    seller_id: number;
    order_id: string;
}

interface Seller {
    id: number;
    name: string;
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

const STATUS_OPTIONS = [
    { value: "", label: "ทุกสถานะ" },
    { value: "Pending", label: "รอดำเนินการ" },
    { value: "Confirmed", label: "ยืนยันแล้ว" },
    { value: "Picking", label: "กำลังจัดเตรียม" },
    { value: "Shipping", label: "กำลังจัดส่ง" },
    { value: "Delivered", label: "จัดส่งสำเร็จ" },
    { value: "Cancelled", label: "ยกเลิก" },
    { value: "Returned", label: "ตีกลับ" },
];

const CUSTOMER_TYPE_OPTIONS = [
    { value: "", label: "ลูกค้าทุกประเภท" },
    { value: "New Customer", label: "ลูกค้าใหม่" },
    { value: "Reorder Customer", label: "ลูกค้ารีออเดอร์" },
];

const formatDate = (iso: string | null): string => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit" });
};

const formatMoney = (amount: number): string =>
    new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount || 0);

const getStatusColor = (status: string): string => {
    switch (status) {
        case "Delivered": return "bg-emerald-100 text-emerald-700";
        case "Shipping": return "bg-blue-100 text-blue-700";
        case "Confirmed": return "bg-sky-100 text-sky-700";
        case "Picking": return "bg-amber-100 text-amber-700";
        case "Pending": return "bg-gray-100 text-gray-600";
        case "Cancelled": return "bg-red-100 text-red-600";
        case "Returned": return "bg-orange-100 text-orange-700";
        default: return "bg-gray-100 text-gray-600";
    }
};

const getStatusThai = (status: string): string => {
    const map: Record<string, string> = {
        Pending: "รอดำเนินการ", Confirmed: "ยืนยันแล้ว", Picking: "กำลังเตรียม",
        Shipping: "กำลังส่ง", Delivered: "ส่งแล้ว", Cancelled: "ยกเลิก",
        Returned: "ตีกลับ", PreApproved: "รออนุมัติ", BadDebt: "หนี้สูญ",
    };
    return map[status] || status;
};

const getPaymentThai = (method: string | null): string => {
    if (!method) return "-";
    const map: Record<string, string> = {
        COD: "COD", Transfer: "โอน", PayAfter: "จ่ายทีหลัง",
        Claim: "เคลม", FreeGift: "ของแถม",
    };
    return map[method] || method;
};

const getCustomerTypeThai = (type: string | null): string => {
    if (!type) return "-";
    const map: Record<string, string> = {
        "New Customer": "ใหม่", "Reorder Customer": "รีออเดอร์", "Reorder": "รีออเดอร์",
    };
    return map[type] || type;
};

const SalesSheetPage: React.FC<SalesSheetPageProps> = ({ currentUser }) => {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [sellerId, setSellerId] = useState(0);
    const [orderStatus, setOrderStatus] = useState("");
    const [customerType, setCustomerType] = useState("");
    const [searchText, setSearchText] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(200);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<SheetRow[]>([]);
    const [sellers, setSellers] = useState<Seller[]>([]);
    const [summary, setSummary] = useState({ total_orders: 0, total_items: 0, total_revenue: 0 });
    const [pagination, setPagination] = useState({ page: 1, pageSize: 200, total: 0, totalPages: 0 });

    // --- Column Filters (client-side) ---
    const [colFilters, setColFilters] = useState<Record<string, string>>({});
    const [showFilters, setShowFilters] = useState(false);

    const updateColFilter = useCallback((key: string, value: string) => {
        setColFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    const clearAllColFilters = useCallback(() => {
        setColFilters({});
    }, []);

    const hasActiveColFilters = useMemo(() => Object.values(colFilters).some(v => v !== ''), [colFilters]);

    // Client-side filtering of loaded rows
    const filteredRows = useMemo(() => {
        if (!hasActiveColFilters) return rows;
        return rows.filter(row => {
            const match = (field: string | null | undefined, filter: string | undefined) => {
                if (!filter) return true;
                return (field || '').toLowerCase().includes(filter.toLowerCase());
            };
            if (colFilters.order_number && !match(row.order_number, colFilters.order_number)) return false;
            if (colFilters.seller_name && !match(row.seller_name, colFilters.seller_name)) return false;
            if (colFilters.customer_type && row.customer_type !== colFilters.customer_type) return false;
            if (colFilters.basket && !match(row.basket_key_at_sale, colFilters.basket)) return false;
            if (colFilters.sales_channel && !match(row.sales_channel, colFilters.sales_channel)) return false;
            if (colFilters.payment_method && !match(row.payment_method, colFilters.payment_method)) return false;
            if (colFilters.customer_name && !match(row.customer_name, colFilters.customer_name)) return false;
            if (colFilters.customer_phone && !match(row.customer_phone, colFilters.customer_phone)) return false;
            if (colFilters.province && !match(row.province, colFilters.province)) return false;
            if (colFilters.product_sku && !match(row.product_sku, colFilters.product_sku)) return false;
            if (colFilters.product_name && !match(row.product_name, colFilters.product_name)) return false;
            if (colFilters.order_status && row.order_status !== colFilters.order_status) return false;
            return true;
        });
    }, [rows, colFilters, hasActiveColFilters]);

    // Compute sum stats for filtered rows
    const filteredStats = useMemo(() => {
        const totalQty = filteredRows.reduce((s, r) => s + (r.quantity || 0), 0);
        const totalNet = filteredRows.reduce((s, r) => s + (r.is_freebie ? 0 : (r.net_total || 0)), 0);
        return { totalQty, totalNet };
    }, [filteredRows]);

    // Get unique values for dropdown column filters
    const uniqueChannels = useMemo(() => [...new Set(rows.map(r => r.sales_channel).filter(Boolean))] as string[], [rows]);
    const uniquePayments = useMemo(() => [...new Set(rows.map(r => r.payment_method).filter(Boolean))] as string[], [rows]);
    const uniqueProvinces = useMemo(() => [...new Set(rows.map(r => r.province).filter(Boolean))].sort() as string[], [rows]);

    // Reset column filters when data changes
    useEffect(() => { setColFilters({}); }, [month, year, sellerId, orderStatus, customerType, debouncedSearch]);

    const yearOptions = useMemo(() => {
        const cur = new Date().getFullYear();
        return [cur, cur - 1, cur - 2];
    }, []);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
        return () => clearTimeout(timer);
    }, [searchText]);

    // Reset page on filter change
    useEffect(() => { setPage(1); }, [month, year, sellerId, orderStatus, customerType, debouncedSearch]);

    // Fetch data
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                month: String(month),
                year: String(year),
                page: String(page),
                pageSize: String(pageSize),
            });
            if (sellerId > 0) params.set("seller_id", String(sellerId));
            if (orderStatus) params.set("order_status", orderStatus);
            if (customerType) params.set("customer_type", customerType);
            if (debouncedSearch) params.set("search", debouncedSearch);

            const result = await apiFetch(`User_DB/sales_sheet.php?${params}`);
            if (result?.success) {
                setRows(result.rows || []);
                setSummary(result.summary || { total_orders: 0, total_items: 0, total_revenue: 0 });
                setPagination(result.pagination || { page: 1, pageSize, total: 0, totalPages: 0 });
                if (result.sellers) setSellers(result.sellers);
            }
        } catch (err) {
            console.error("Sales Sheet fetch error:", err);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [month, year, sellerId, orderStatus, customerType, debouncedSearch, page, pageSize]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // CSV Export
    const exportCSV = () => {
        const headers = [
            "วันที่สั่ง", "เลขออเดอร์", "ผู้ขาย", "ประเภทลูกค้า", "ตะกร้าขาย",
            "ช่องทาง", "การชำระ", "ชื่อลูกค้า", "เบอร์โทร", "ที่อยู่",
            "รหัสสินค้า", "ชื่อสินค้า", "จำนวน", "ยอดรวม (net)", "วันจัดส่ง", "สถานะ"
        ];
        const csvRows = rows.map(r => [
            formatDate(r.order_date), r.order_number, r.seller_name.trim(),
            getCustomerTypeThai(r.customer_type), r.basket_key_at_sale || "-",
            r.sales_channel || "-", getPaymentThai(r.payment_method),
            r.customer_name.trim(), r.customer_phone || "-", `"${(r.address || '-').replace(/"/g, '""')}"`,
            r.product_sku || "-", `"${(r.product_name || '-').replace(/"/g, '""')}"`,
            r.quantity, formatMoney(r.net_total), formatDate(r.delivery_date), getStatusThai(r.order_status),
        ]);
        const csv = [headers, ...csvRows].map(row => row.join(",")).join("\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `sales_sheet_${year}_${String(month).padStart(2, "0")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-green-600" />
                        <h1 className="text-lg font-bold text-gray-800">ยอดขาย (Sheet)</h1>
                        <span className="text-xs text-gray-400 ml-1">• {THAI_MONTHS_SHORT[month - 1]} {year + 543}</span>
                    </div>
                    <button
                        onClick={exportCSV}
                        disabled={rows.length === 0}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                        ดาวน์โหลด CSV
                    </button>
                </div>

                {/* Month Tabs */}
                <div className="flex items-center gap-1 mb-3">
                    <select
                        value={year}
                        onChange={e => setYear(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-xs mr-2 bg-white"
                    >
                        {yearOptions.map(y => (
                            <option key={y} value={y}>{y + 543}</option>
                        ))}
                    </select>
                    <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                        {THAI_MONTHS_SHORT.map((m, idx) => (
                            <button
                                key={idx}
                                onClick={() => setMonth(idx + 1)}
                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${month === idx + 1
                                    ? "bg-green-600 text-white shadow-sm"
                                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px] max-w-[280px]">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            placeholder="ค้นหา ออเดอร์, ชื่อ, เบอร์, สินค้า..."
                            className="w-full pl-7 pr-7 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500"
                        />
                        {searchText && (
                            <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Seller */}
                    <select
                        value={sellerId}
                        onChange={e => setSellerId(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white min-w-[130px]"
                    >
                        <option value={0}>พนักงานทั้งหมด</option>
                        {sellers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>

                    {/* Status */}
                    <select
                        value={orderStatus}
                        onChange={e => setOrderStatus(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
                    >
                        {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>

                    {/* Customer Type */}
                    <select
                        value={customerType}
                        onChange={e => setCustomerType(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white"
                    >
                        {CUSTOMER_TYPE_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="px-4 py-2 flex-shrink-0">
                <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white rounded-lg border px-3 py-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">ออเดอร์</div>
                        <div className="text-lg font-bold text-gray-800">{summary.total_orders.toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-lg border px-3 py-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">รายการสินค้า</div>
                        <div className="text-lg font-bold text-gray-800">{summary.total_items.toLocaleString()}</div>
                    </div>
                    <div className="bg-white rounded-lg border px-3 py-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">ยอดขายรวม (net)</div>
                        <div className="text-lg font-bold text-emerald-700">฿{formatMoney(summary.total_revenue)}</div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-hidden px-4 pb-2">
                <div className="bg-white rounded-lg border h-full flex flex-col">
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                            <span className="ml-2 text-sm text-gray-500">กำลังโหลด...</span>
                        </div>
                    ) : (
                        <>
                            <div className="flex-1 overflow-auto">
                                <table className="w-full text-[11px] border-collapse min-w-[1200px]">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-gray-100 border-b border-gray-300">
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[70px]">วันที่สั่ง</th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[110px]">เลขออเดอร์</th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[90px]">ผู้ขาย</th>
                                            <th className="px-2 py-1.5 text-center font-semibold text-gray-600 border-r border-gray-200 w-[55px]">ประเภท</th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[70px]">ตะกร้า</th>
                                            <th className="px-2 py-1.5 text-center font-semibold text-gray-600 border-r border-gray-200 w-[60px]">ช่องทาง</th>
                                            <th className="px-2 py-1.5 text-center font-semibold text-gray-600 border-r border-gray-200 w-[50px]">ชำระ</th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[110px]">ชื่อลูกค้า</th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[85px]">เบอร์โทร</th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200">
                                                จังหวัด
                                            </th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[65px]">รหัส</th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[140px]">ชื่อสินค้า</th>
                                            <th className="px-2 py-1.5 text-right font-semibold text-gray-600 border-r border-gray-200 w-[50px]">จำนวน</th>
                                            <th className="px-2 py-1.5 text-right font-semibold text-gray-600 border-r border-gray-200 w-[75px]">ยอดรวม</th>
                                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600 border-r border-gray-200 w-[65px]">วันส่ง</th>
                                            <th className="px-2 py-1.5 text-center font-semibold text-gray-600 w-[70px]">
                                                <div className="flex items-center justify-center gap-1">
                                                    สถานะ
                                                    <button
                                                        onClick={() => setShowFilters(f => !f)}
                                                        className={`p-0.5 rounded transition-colors ${showFilters ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}
                                                        title={showFilters ? 'ซ่อนตัวกรอง' : 'แสดงตัวกรอง'}
                                                    >
                                                        <Filter className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </th>
                                        </tr>
                                        {/* Column Filter Row */}
                                        {showFilters && (
                                            <tr className="bg-yellow-50/80 border-b border-gray-200">
                                                <td className="px-1 py-1 border-r border-gray-200"></td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <input type="text" value={colFilters.order_number || ''} onChange={e => updateColFilter('order_number', e.target.value)} placeholder="🔍" className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none" />
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <input type="text" value={colFilters.seller_name || ''} onChange={e => updateColFilter('seller_name', e.target.value)} placeholder="🔍" className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none" />
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <select value={colFilters.customer_type || ''} onChange={e => updateColFilter('customer_type', e.target.value)} className="w-full px-0.5 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none">
                                                        <option value="">ทั้งหมด</option>
                                                        <option value="New Customer">ใหม่</option>
                                                        <option value="Reorder Customer">รีออเดอร์</option>
                                                    </select>
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <input type="text" value={colFilters.basket || ''} onChange={e => updateColFilter('basket', e.target.value)} placeholder="🔍" className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none" />
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <select value={colFilters.sales_channel || ''} onChange={e => updateColFilter('sales_channel', e.target.value)} className="w-full px-0.5 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none">
                                                        <option value="">ทั้งหมด</option>
                                                        {uniqueChannels.map(c => <option key={c} value={c}>{c}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <select value={colFilters.payment_method || ''} onChange={e => updateColFilter('payment_method', e.target.value)} className="w-full px-0.5 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none">
                                                        <option value="">ทั้งหมด</option>
                                                        {uniquePayments.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <input type="text" value={colFilters.customer_name || ''} onChange={e => updateColFilter('customer_name', e.target.value)} placeholder="🔍" className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none" />
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <input type="text" value={colFilters.customer_phone || ''} onChange={e => updateColFilter('customer_phone', e.target.value)} placeholder="🔍" className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none" />
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <select value={colFilters.province || ''} onChange={e => updateColFilter('province', e.target.value)} className="w-full px-0.5 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none">
                                                        <option value="">ทั้งหมด</option>
                                                        {uniqueProvinces.map(p => <option key={p} value={p}>{p}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <input type="text" value={colFilters.product_sku || ''} onChange={e => updateColFilter('product_sku', e.target.value)} placeholder="🔍" className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none" />
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200">
                                                    <input type="text" value={colFilters.product_name || ''} onChange={e => updateColFilter('product_name', e.target.value)} placeholder="🔍" className="w-full px-1 py-0.5 text-[10px] border border-gray-300 rounded bg-white focus:ring-1 focus:ring-green-400 focus:outline-none" />
                                                </td>
                                                <td className="px-1 py-1 border-r border-gray-200"></td>
                                                <td className="px-1 py-1 border-r border-gray-200"></td>
                                                <td className="px-1 py-1 border-r border-gray-200"></td>
                                                <td className="px-1 py-1 text-center">
                                                    {hasActiveColFilters && (
                                                        <button onClick={clearAllColFilters} className="text-red-500 hover:text-red-700 text-[10px] font-medium" title="ล้างตัวกรองทั้งหมด">
                                                            <X className="w-3 h-3 inline" /> ล้าง
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </thead>
                                    <tbody>
                                        {filteredRows.map((row, idx) => (
                                            <tr
                                                key={`${row.order_id}-${idx}`}
                                                className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                                                    }`}
                                            >
                                                <td className="px-2 py-1.5 text-gray-600 border-r border-gray-100">{formatDate(row.order_date)}</td>
                                                <td className="px-2 py-1.5 text-blue-600 font-medium border-r border-gray-100 truncate" title={row.order_number}>{row.order_number}</td>
                                                <td className="px-2 py-1.5 text-gray-700 border-r border-gray-100 truncate" title={row.seller_name.trim()}>{row.seller_name.trim() || "-"}</td>
                                                <td className="px-2 py-1.5 text-center border-r border-gray-100">
                                                    {row.customer_type ? (
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${row.customer_type === "New Customer" ? "bg-green-100 text-green-700" : "bg-purple-100 text-purple-700"
                                                            }`}>
                                                            {getCustomerTypeThai(row.customer_type)}
                                                        </span>
                                                    ) : "-"}
                                                </td>
                                                <td className="px-2 py-1.5 text-gray-500 border-r border-gray-100 truncate text-[10px]" title={row.basket_key_at_sale || ""}>{row.basket_key_at_sale || "-"}</td>
                                                <td className="px-2 py-1.5 text-center text-gray-500 border-r border-gray-100 text-[10px]">{row.sales_channel || "-"}</td>
                                                <td className="px-2 py-1.5 text-center text-gray-600 border-r border-gray-100 text-[10px]">{getPaymentThai(row.payment_method)}</td>
                                                <td className="px-2 py-1.5 text-gray-700 border-r border-gray-100 truncate" title={row.customer_name.trim()}>{row.customer_name.trim() || "-"}</td>
                                                <td className="px-2 py-1.5 text-gray-600 border-r border-gray-100">{row.customer_phone || "-"}</td>
                                                <td className="px-2 py-1.5 text-gray-500 border-r border-gray-100 truncate text-[10px]" title={row.province || ""}>{row.province || "-"}</td>
                                                <td className="px-2 py-1.5 text-gray-500 border-r border-gray-100 text-[10px] font-mono">{row.product_sku || "-"}</td>
                                                <td className="px-2 py-1.5 text-gray-700 border-r border-gray-100 truncate" title={row.product_name}>
                                                    {row.is_freebie ? <span className="text-orange-500 mr-0.5">🎁</span> : null}
                                                    {row.product_name || "-"}
                                                </td>
                                                <td className="px-2 py-1.5 text-right text-gray-700 border-r border-gray-100 font-medium">{row.quantity}</td>
                                                <td className="px-2 py-1.5 text-right border-r border-gray-100 font-medium">
                                                    <span className={row.is_freebie ? "text-gray-400" : "text-gray-800"}>
                                                        {row.is_freebie ? "0" : formatMoney(row.net_total)}
                                                    </span>
                                                </td>
                                                <td className="px-2 py-1.5 text-gray-500 border-r border-gray-100">{formatDate(row.delivery_date)}</td>
                                                <td className="px-2 py-1.5 text-center">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${getStatusColor(row.order_status)}`}>
                                                        {getStatusThai(row.order_status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRows.length === 0 && (
                                            <tr>
                                                <td colSpan={16} className="px-4 py-10 text-center text-gray-400 text-sm">
                                                    {hasActiveColFilters ? 'ไม่พบข้อมูลตามตัวกรองที่เลือก' : 'ไม่พบข้อมูลสำหรับเดือนที่เลือก'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer: Pagination + Filtered Stats */}
                            <div className="px-3 py-2 bg-gray-50 border-t flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] text-gray-500">
                                        แสดง {filteredRows.length > 0 ? ((page - 1) * pageSize) + 1 : 0} - {Math.min(page * pageSize, pagination.total)} จาก {pagination.total.toLocaleString()} รายการ
                                    </span>
                                    {hasActiveColFilters && (
                                        <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                            กรอง: {filteredRows.length} รายการ · ฿{formatMoney(filteredStats.totalNet)} · จำนวน {filteredStats.totalQty.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                {pagination.totalPages > 1 && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <div className="flex items-center gap-0.5">
                                            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                                                let pageNum: number;
                                                if (pagination.totalPages <= 7) {
                                                    pageNum = i + 1;
                                                } else if (page <= 4) {
                                                    pageNum = i + 1;
                                                } else if (page >= pagination.totalPages - 3) {
                                                    pageNum = pagination.totalPages - 6 + i;
                                                } else {
                                                    pageNum = page - 3 + i;
                                                }
                                                return (
                                                    <button
                                                        key={pageNum}
                                                        onClick={() => setPage(pageNum)}
                                                        className={`w-7 h-7 rounded text-xs font-medium transition-colors ${page === pageNum
                                                            ? "bg-green-600 text-white"
                                                            : "text-gray-600 hover:bg-gray-200"
                                                            }`}
                                                    >
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button
                                            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                            disabled={page === pagination.totalPages}
                                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesSheetPage;
