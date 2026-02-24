import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Download, ChevronLeft, ChevronRight, Search, FileSpreadsheet, Loader2, X } from "lucide-react";

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

    // --- Cell selection (Click + Shift+Click, Google Sheets style) ---
    const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
    const [selectionStats, setSelectionStats] = useState<{ sum: number; count: number; avg: number } | null>(null);
    const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
    const lastClickedCell = useRef<{ row: number; col: string } | null>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Numeric column keys that support selection
    const NUMERIC_COLS = useMemo(() => ['quantity', 'net_total'] as const, []);

    const getCellKey = (rowIdx: number, col: string) => `${rowIdx}:${col}`;

    const computeStats = useCallback((cells: Set<string>) => {
        if (cells.size === 0) { setSelectionStats(null); return; }
        let sum = 0;
        let count = 0;
        cells.forEach(key => {
            const [rStr, col] = key.split(':');
            const r = parseInt(rStr);
            if (r >= 0 && r < rows.length) {
                const row = rows[r];
                const val = col === 'quantity' ? Number(row.quantity) : Number(row.net_total);
                if (!isNaN(val)) { sum += val; count++; }
            }
        });
        setSelectionStats(count > 0 ? { sum, count, avg: sum / count } : null);
    }, [rows]);

    // Build rectangle selection from start to end cell
    const buildRectSelection = useCallback((startRow: number, startCol: string, endRow: number, endCol: string): Set<string> => {
        const newSet = new Set<string>();
        const colIdx = (c: string) => NUMERIC_COLS.indexOf(c as any);
        const sCI = colIdx(startCol);
        const eCI = colIdx(endCol);
        if (sCI === -1 || eCI === -1) return newSet;
        const minR = Math.min(startRow, endRow);
        const maxR = Math.max(startRow, endRow);
        const minC = Math.min(sCI, eCI);
        const maxC = Math.max(sCI, eCI);
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                newSet.add(getCellKey(r, NUMERIC_COLS[c]));
            }
        }
        return newSet;
    }, [NUMERIC_COLS]);

    const handleCellClick = useCallback((e: React.MouseEvent, rowIdx: number, col: string) => {
        e.stopPropagation();
        // Update tooltip position
        setTooltipPos({ x: e.clientX, y: e.clientY });

        if (e.shiftKey && lastClickedCell.current) {
            // Shift+Click: select range from last clicked cell to this one
            const newSet = buildRectSelection(
                lastClickedCell.current.row, lastClickedCell.current.col,
                rowIdx, col
            );
            setSelectedCells(newSet);
            computeStats(newSet);
        } else if (e.ctrlKey || e.metaKey) {
            // Ctrl+Click: toggle this cell in selection
            const key = getCellKey(rowIdx, col);
            setSelectedCells(prev => {
                const newSet = new Set(prev);
                if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
                computeStats(newSet);
                return newSet;
            });
            lastClickedCell.current = { row: rowIdx, col };
        } else {
            // Normal click: select only this cell
            const newSet = new Set([getCellKey(rowIdx, col)]);
            setSelectedCells(newSet);
            computeStats(newSet);
            lastClickedCell.current = { row: rowIdx, col };
        }
    }, [buildRectSelection, computeStats]);

    // Track mouse movement for tooltip position
    const handleMouseMoveOnTable = useCallback((e: React.MouseEvent) => {
        if (selectionStats) {
            setTooltipPos({ x: e.clientX, y: e.clientY });
        }
    }, [selectionStats]);

    // Clear selection when clicking outside numeric cells
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('[data-selectable-cell]')) {
                setSelectedCells(new Set());
                setSelectionStats(null);
                lastClickedCell.current = null;
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Clear selection when data changes
    useEffect(() => {
        setSelectedCells(new Set());
        setSelectionStats(null);
        lastClickedCell.current = null;
    }, [rows]);

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
                            <div className="flex-1 overflow-auto" ref={containerRef} onMouseMove={handleMouseMoveOnTable}>
                                <table ref={tableRef} className="w-full text-[11px] border-collapse min-w-[1200px]">
                                    <thead className="sticky top-0 z-10">
                                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[70px]">วันที่สั่ง</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[110px]">เลขออเดอร์</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[90px]">ผู้ขาย</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-600 border-r border-gray-200 w-[55px]">ประเภท</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[70px]">ตะกร้า</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-600 border-r border-gray-200 w-[60px]">ช่องทาง</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-600 border-r border-gray-200 w-[50px]">ชำระ</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[110px]">ชื่อลูกค้า</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[85px]">เบอร์โทร</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200">ที่อยู่</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[65px]">รหัส</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[140px]">ชื่อสินค้า</th>
                                            <th className="px-2 py-2 text-right font-semibold text-gray-600 border-r border-gray-200 w-[40px]">จำนวน</th>
                                            <th className="px-2 py-2 text-right font-semibold text-gray-600 border-r border-gray-200 w-[75px]">ยอดรวม</th>
                                            <th className="px-2 py-2 text-left font-semibold text-gray-600 border-r border-gray-200 w-[65px]">วันส่ง</th>
                                            <th className="px-2 py-2 text-center font-semibold text-gray-600 w-[70px]">สถานะ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row, idx) => (
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
                                                <td className="px-2 py-1.5 text-gray-500 border-r border-gray-100 truncate text-[10px]" title={row.address || ""}>{row.address || "-"}</td>
                                                <td className="px-2 py-1.5 text-gray-500 border-r border-gray-100 text-[10px] font-mono">{row.product_sku || "-"}</td>
                                                <td className="px-2 py-1.5 text-gray-700 border-r border-gray-100 truncate" title={row.product_name}>
                                                    {row.is_freebie ? <span className="text-orange-500 mr-0.5">🎁</span> : null}
                                                    {row.product_name || "-"}
                                                </td>
                                                <td
                                                    data-selectable-cell
                                                    className={`px-2 py-1.5 text-right text-gray-700 border-r border-gray-100 font-medium cursor-cell ${selectedCells.has(getCellKey(idx, 'quantity')) ? 'bg-blue-100 ring-1 ring-blue-400 ring-inset' : ''}`}
                                                    onClick={e => handleCellClick(e, idx, 'quantity')}
                                                >{row.quantity}</td>
                                                <td
                                                    data-selectable-cell
                                                    className={`px-2 py-1.5 text-right border-r border-gray-100 font-medium cursor-cell ${selectedCells.has(getCellKey(idx, 'net_total')) ? 'bg-blue-100 ring-1 ring-blue-400 ring-inset' : ''}`}
                                                    onClick={e => handleCellClick(e, idx, 'net_total')}
                                                >
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
                                        {rows.length === 0 && (
                                            <tr>
                                                <td colSpan={16} className="px-4 py-10 text-center text-gray-400 text-sm">
                                                    ไม่พบข้อมูลสำหรับเดือนที่เลือก
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            <div className="px-3 py-2 bg-gray-50 border-t flex items-center justify-between flex-shrink-0">
                                <div className="text-[11px] text-gray-500">
                                    แสดง {rows.length > 0 ? ((page - 1) * pageSize) + 1 : 0} - {Math.min(page * pageSize, pagination.total)} จาก {pagination.total.toLocaleString()} รายการ
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

                            {/* Floating Tooltip (follows cursor) */}
                            {selectionStats && (
                                <div
                                    className="fixed z-50 pointer-events-none"
                                    style={{
                                        left: tooltipPos.x + 16,
                                        top: tooltipPos.y - 60,
                                    }}
                                >
                                    <div className="bg-gray-900/95 text-white rounded-lg shadow-xl px-3 py-2 text-xs backdrop-blur-sm border border-gray-700">
                                        <div className="flex items-center gap-3 whitespace-nowrap">
                                            <span>
                                                <span className="text-blue-300 font-semibold">SUM:</span>{' '}
                                                <span className="text-white font-bold">{formatMoney(selectionStats.sum)}</span>
                                            </span>
                                            <span className="w-px h-3 bg-gray-600" />
                                            <span>
                                                <span className="text-purple-300 font-semibold">AVG:</span>{' '}
                                                <span className="text-white font-bold">{formatMoney(selectionStats.avg)}</span>
                                            </span>
                                            <span className="w-px h-3 bg-gray-600" />
                                            <span>
                                                <span className="text-green-300 font-semibold">COUNT:</span>{' '}
                                                <span className="text-white font-bold">{selectionStats.count}</span>
                                            </span>
                                        </div>
                                        <div className="text-[9px] text-gray-400 mt-0.5 text-center">Shift+Click เลือกช่วง · Ctrl+Click เลือกเพิ่ม</div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SalesSheetPage;
