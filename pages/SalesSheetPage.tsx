import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Download, ChevronLeft, ChevronRight, Search, FileSpreadsheet, Loader2, X, ChevronDown, Check } from "lucide-react";

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
        "New Customer": "ใหม่", "Reorder Customer": "รีออเดอร์", "Reorder": "รีออเดอร์", "Mined Lead": "ลูกค้าขุด",
    };
    return map[type] || type;
};

// ============ Multi-Select Filter Dropdown (Portal, Buffered) ============
interface MultiSelectFilterProps {
    label: string;
    colKey: string;
    allValues: string[];
    selectedValues: Set<string> | null; // null = all selected (committed)
    onApplyFilter: (colKey: string, selected: Set<string> | null) => void;
    openFilter: string | null;
    setOpenFilter: (key: string | null) => void;
    width?: string;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
    label, colKey, allValues, selectedValues, onApplyFilter, openFilter, setOpenFilter, width
}) => {
    const [search, setSearch] = useState('');
    // Pending = buffered selection that only applies on OK
    const [pending, setPending] = useState<Set<string> | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const isOpen = openFilter === colKey;
    const isFiltered = selectedValues !== null;

    // Initialize pending from committed when opening
    useEffect(() => {
        if (isOpen) {
            setPending(selectedValues === null ? null : new Set(selectedValues));
            setSearch('');
            // Calculate position from button
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                const dropdownWidth = 240;
                let left = rect.left;
                // If dropdown would go off screen right, align from right
                if (left + dropdownWidth > window.innerWidth) {
                    left = rect.right - dropdownWidth;
                }
                // If still off screen left
                if (left < 4) left = 4;
                setDropdownPos({ top: rect.bottom + 2, left });
            }
        }
    }, [isOpen, selectedValues]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                dropdownRef.current && !dropdownRef.current.contains(target) &&
                buttonRef.current && !buttonRef.current.contains(target)
            ) {
                setOpenFilter(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen, setOpenFilter]);

    const filteredValues = useMemo(() => {
        if (!search) return allValues;
        const s = search.toLowerCase();
        return allValues.filter(v => v.toLowerCase().includes(s));
    }, [allValues, search]);

    const isAllSelected = pending === null || pending.size === allValues.length;
    const pendingCount = pending === null ? allValues.length : pending.size;

    const toggleAll = () => {
        setPending(isAllSelected ? new Set() : null);
    };

    const toggleValue = (val: string) => {
        const currentSet = pending === null ? new Set(allValues) : new Set(pending);
        if (currentSet.has(val)) currentSet.delete(val);
        else currentSet.add(val);
        setPending(currentSet.size === allValues.length ? null : currentSet);
    };

    const isValueChecked = (val: string) => pending === null || pending.has(val);

    const handleOK = () => {
        // Apply the pending selection
        if (pending === null || pending.size === allValues.length) {
            onApplyFilter(colKey, null); // all = no filter
        } else {
            onApplyFilter(colKey, new Set(pending));
        }
        setOpenFilter(null);
    };

    const handleClear = () => {
        onApplyFilter(colKey, null);
        setOpenFilter(null);
    };

    const handleCancel = () => {
        setOpenFilter(null);
    };

    return (
        <th className={`px-1 py-1.5 font-semibold text-gray-600 border-r border-gray-200 ${width || ''}`}>
            <button
                ref={buttonRef}
                onClick={() => setOpenFilter(isOpen ? null : colKey)}
                className={`w-full flex items-center gap-0.5 text-[11px] hover:text-green-700 transition-colors ${isFiltered ? 'text-green-700' : 'text-gray-600'}`}
                title={`กรอง ${label}`}
            >
                <span className="truncate flex-1 text-left">{label}</span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''} ${isFiltered ? 'text-green-600' : 'text-gray-400'}`} />
                {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
            </button>
            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[9999] bg-white border border-gray-300 rounded-lg shadow-2xl"
                    style={{
                        top: dropdownPos.top,
                        left: dropdownPos.left,
                        width: 240,
                        maxHeight: 360,
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Search box */}
                    <div className="p-1.5 border-b border-gray-200 flex-shrink-0">
                        <div className="relative">
                            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="ค้นหา..."
                                className="w-full pl-6 pr-2 py-1 text-[11px] border border-gray-200 rounded focus:ring-1 focus:ring-green-400 focus:outline-none bg-gray-50"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Select All */}
                    <div className="border-b border-gray-100 flex-shrink-0">
                        <label className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 cursor-pointer">
                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${isAllSelected ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                                {isAllSelected && <Check className="w-2.5 h-2.5 text-white" />}
                            </div>
                            <span className="text-[11px] font-medium text-gray-700">(เลือกทั้งหมด)</span>
                            <span className="text-[10px] text-gray-400 ml-auto">{allValues.length}</span>
                            <input type="checkbox" checked={isAllSelected} onChange={toggleAll} className="sr-only" />
                        </label>
                    </div>

                    {/* Values list */}
                    <div className="overflow-y-auto flex-1" style={{ maxHeight: '220px' }}>
                        {filteredValues.length === 0 ? (
                            <div className="px-3 py-3 text-[11px] text-gray-400 text-center">ไม่พบรายการ</div>
                        ) : (
                            filteredValues.map(val => {
                                const checked = isValueChecked(val);
                                return (
                                    <label key={val} className="flex items-center gap-2 px-2 py-1 hover:bg-blue-50 cursor-pointer" title={val}>
                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 ${checked ? 'bg-green-600 border-green-600' : 'border-gray-300'}`}>
                                            {checked && <Check className="w-2.5 h-2.5 text-white" />}
                                        </div>
                                        <span className="text-[11px] text-gray-700 truncate">{val || '(ว่าง)'}</span>
                                        <input type="checkbox" checked={checked} onChange={() => toggleValue(val)} className="sr-only" />
                                    </label>
                                );
                            })
                        )}
                    </div>

                    {/* Footer: count + Cancel/Clear/OK */}
                    <div className="border-t border-gray-200 px-2 py-1.5 flex items-center justify-between bg-gray-50 rounded-b-lg flex-shrink-0">
                        <span className="text-[10px] text-gray-500">เลือก {pendingCount}/{allValues.length}</span>
                        <div className="flex gap-1">
                            <button onClick={handleCancel} className="px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded font-medium">
                                ยกเลิก
                            </button>
                            {isFiltered && (
                                <button onClick={handleClear} className="px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50 rounded font-medium">
                                    ล้าง
                                </button>
                            )}
                            <button onClick={handleOK} className="px-2.5 py-0.5 text-[10px] bg-green-600 text-white rounded font-medium hover:bg-green-700">
                                ตกลง
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </th>
    );
};

// ============ Main Page ============
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

    // --- Multi-Select Column Filters ---
    // null = all selected (no filter), Set = specific values selected
    const [colFilters, setColFilters] = useState<Record<string, Set<string> | null>>({});
    const [openFilter, setOpenFilter] = useState<string | null>(null);

    const onChangeFilter = useCallback((key: string, selected: Set<string> | null) => {
        setColFilters(prev => {
            const next = { ...prev };
            if (selected === null) {
                delete next[key]; // null means all — remove filter
            } else {
                next[key] = selected;
            }
            return next;
        });
    }, []);

    const clearAllFilters = useCallback(() => {
        setColFilters({});
        setOpenFilter(null);
    }, []);

    const hasActiveFilters = useMemo(() => Object.keys(colFilters).length > 0, [colFilters]);
    const activeFilterCount = useMemo(() => Object.keys(colFilters).length, [colFilters]);

    // Build unique value lists for each column (from loaded rows) — display in Thai
    const colUniqueValues = useMemo(() => {
        const getUnique = (getter: (r: SheetRow) => string | null | undefined): string[] =>
            [...new Set(rows.map(r => getter(r) || '-'))].sort();
        return {
            order_date: [...new Set(rows.map(r => formatDate(r.order_date)))].sort(),
            order_number: getUnique(r => r.order_number),
            seller_name: [...new Set(rows.map(r => r.seller_name?.trim() || '-'))].sort(),
            customer_type: [...new Set(rows.map(r => getCustomerTypeThai(r.customer_type)))].sort(),
            basket: getUnique(r => r.basket_key_at_sale),
            sales_channel: getUnique(r => r.sales_channel),
            payment_method: [...new Set(rows.map(r => getPaymentThai(r.payment_method)))].sort(),
            customer_name: [...new Set(rows.map(r => r.customer_name?.trim() || '-'))].sort(),
            customer_phone: getUnique(r => r.customer_phone),
            province: getUnique(r => r.province),
            product_sku: getUnique(r => r.product_sku),
            product_name: getUnique(r => r.product_name),
            quantity: [...new Set(rows.map(r => String(r.quantity)))].sort((a, b) => Number(a) - Number(b)),
            net_total: [...new Set(rows.map(r => r.is_freebie ? '0' : formatMoney(r.net_total)))].sort(),
            delivery_date: [...new Set(rows.map(r => formatDate(r.delivery_date)))].sort(),
            order_status: [...new Set(rows.map(r => getStatusThai(r.order_status)))].sort(),
        };
    }, [rows]);

    // Getter functions that produce the display value for each column (must match dropdown values)
    const colGetters: Record<string, (r: SheetRow) => string> = useMemo(() => ({
        order_date: r => formatDate(r.order_date),
        order_number: r => r.order_number || '-',
        seller_name: r => r.seller_name?.trim() || '-',
        customer_type: r => getCustomerTypeThai(r.customer_type),
        basket: r => r.basket_key_at_sale || '-',
        sales_channel: r => r.sales_channel || '-',
        payment_method: r => getPaymentThai(r.payment_method),
        customer_name: r => r.customer_name?.trim() || '-',
        customer_phone: r => r.customer_phone || '-',
        province: r => r.province || '-',
        product_sku: r => r.product_sku || '-',
        product_name: r => r.product_name || '-',
        quantity: r => String(r.quantity),
        net_total: r => r.is_freebie ? '0' : formatMoney(r.net_total),
        delivery_date: r => formatDate(r.delivery_date),
        order_status: r => getStatusThai(r.order_status),
    }), []);

    // Client-side filtering of loaded rows
    const filteredRows = useMemo(() => {
        if (!hasActiveFilters) return rows;
        return rows.filter(row => {
            for (const [key, selectedSet] of Object.entries(colFilters)) {
                if (selectedSet === null) continue; // null = all
                if (selectedSet.size === 0) return false; // empty = nothing selected
                const getter = colGetters[key];
                if (getter && !selectedSet.has(getter(row))) return false;
            }
            return true;
        });
    }, [rows, colFilters, hasActiveFilters, colGetters]);

    // Compute stats for filtered rows
    const filteredStats = useMemo(() => {
        const totalQty = filteredRows.reduce((s, r) => s + (Number(r.quantity) || 0), 0);
        const totalNet = filteredRows.reduce((s, r) => s + (r.is_freebie ? 0 : (Number(r.net_total) || 0)), 0);
        const uniqueOrders = new Set(filteredRows.map(r => r.order_id)).size;
        return { totalQty, totalNet, count: filteredRows.length, uniqueOrders };
    }, [filteredRows]);

    // Reset column filters when top-level filters change
    useEffect(() => {
        setColFilters({});
        setOpenFilter(null);
    }, [month, year, sellerId, orderStatus, customerType, debouncedSearch]);

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
                const s = result.summary || {};
                setSummary({
                    total_orders: Number(s.total_orders) || 0,
                    total_items: Number(s.total_items) || 0,
                    total_revenue: Number(s.total_revenue) || 0,
                });
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

    // CSV Export (exports filtered rows)
    const exportCSV = () => {
        const exportRows = hasActiveFilters ? filteredRows : rows;
        const headers = [
            "วันที่สั่ง", "เลขออเดอร์", "ผู้ขาย", "ประเภทลูกค้า", "ตะกร้าขาย",
            "ช่องทาง", "การชำระ", "ชื่อลูกค้า", "เบอร์โทร", "จังหวัด",
            "รหัสสินค้า", "ชื่อสินค้า", "จำนวน", "ยอดรวม (net)", "วันจัดส่ง", "สถานะ"
        ];
        const csvRows = exportRows.map(r => [
            formatDate(r.order_date), r.order_number, r.seller_name.trim(),
            getCustomerTypeThai(r.customer_type), r.basket_key_at_sale || "-",
            r.sales_channel || "-", getPaymentThai(r.payment_method),
            r.customer_name.trim(), r.customer_phone || "-", r.province || "-",
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

    // Column definitions for the filter headers
    const columns = useMemo(() => [
        { key: 'order_date', label: 'วันที่สั่ง', width: 'w-[70px]', align: 'left' as const },
        { key: 'order_number', label: 'เลขออเดอร์', width: 'w-[110px]', align: 'left' as const },
        { key: 'seller_name', label: 'ผู้ขาย', width: 'w-[90px]', align: 'left' as const },
        { key: 'customer_type', label: 'ประเภท', width: 'w-[55px]', align: 'left' as const },
        { key: 'basket', label: 'ตะกร้า', width: 'w-[70px]', align: 'left' as const },
        { key: 'sales_channel', label: 'ช่องทาง', width: 'w-[60px]', align: 'left' as const },
        { key: 'payment_method', label: 'ชำระ', width: 'w-[50px]', align: 'left' as const },
        { key: 'customer_name', label: 'ชื่อลูกค้า', width: 'w-[110px]', align: 'left' as const },
        { key: 'customer_phone', label: 'เบอร์โทร', width: 'w-[85px]', align: 'left' as const },
        { key: 'province', label: 'จังหวัด', width: '', align: 'left' as const },
        { key: 'product_sku', label: 'รหัส', width: 'w-[65px]', align: 'left' as const },
        { key: 'product_name', label: 'ชื่อสินค้า', width: 'w-[140px]', align: 'left' as const },
        { key: 'quantity', label: 'จำนวน', width: 'w-[50px]', align: 'right' as const },
        { key: 'net_total', label: 'ยอดรวม', width: 'w-[75px]', align: 'right' as const },
        { key: 'delivery_date', label: 'วันส่ง', width: 'w-[65px]', align: 'left' as const },
        { key: 'order_status', label: 'สถานะ', width: 'w-[70px]', align: 'left' as const },
    ], []);

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
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <button
                                onClick={clearAllFilters}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md border border-red-200 font-medium transition-colors"
                            >
                                <X className="w-3 h-3" />
                                ล้างตัวกรอง ({activeFilterCount})
                            </button>
                        )}
                        <button
                            onClick={exportCSV}
                            disabled={rows.length === 0}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            {hasActiveFilters ? `ดาวน์โหลด (${filteredRows.length})` : 'ดาวน์โหลด CSV'}
                        </button>
                    </div>
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
                </div>
            </div>

            {/* Summary Cards — show filtered stats when filters active */}
            <div className="px-4 py-2 flex-shrink-0">
                <div className="grid grid-cols-3 gap-3">
                    <div className={`rounded-lg border px-3 py-2 ${hasActiveFilters ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">ออเดอร์</div>
                        <div className="text-lg font-bold text-gray-800">
                            {hasActiveFilters ? filteredStats.uniqueOrders.toLocaleString() : summary.total_orders.toLocaleString()}
                        </div>
                        {hasActiveFilters && <div className="text-[10px] text-blue-500">จาก {summary.total_orders.toLocaleString()}</div>}
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${hasActiveFilters ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">รายการสินค้า</div>
                        <div className="text-lg font-bold text-gray-800">
                            {hasActiveFilters ? filteredStats.count.toLocaleString() : summary.total_items.toLocaleString()}
                        </div>
                        {hasActiveFilters && <div className="text-[10px] text-blue-500">จาก {summary.total_items.toLocaleString()}</div>}
                    </div>
                    <div className={`rounded-lg border px-3 py-2 ${hasActiveFilters ? 'bg-blue-50 border-blue-200' : 'bg-white'}`}>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">ยอดขายรวม (net)</div>
                        <div className="text-lg font-bold text-emerald-700">
                            ฿{formatMoney(hasActiveFilters ? filteredStats.totalNet : summary.total_revenue)}
                        </div>
                        {hasActiveFilters && <div className="text-[10px] text-blue-500">จาก ฿{formatMoney(summary.total_revenue)}</div>}
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
                                    <thead className="sticky top-0 z-20">
                                        <tr className="bg-gray-100 border-b border-gray-300">
                                            {columns.map((col, i) => (
                                                <MultiSelectFilter
                                                    key={col.key}
                                                    label={col.label}
                                                    colKey={col.key}
                                                    allValues={(colUniqueValues as any)[col.key] || []}
                                                    selectedValues={colFilters[col.key] ?? null}
                                                    onApplyFilter={onChangeFilter}
                                                    openFilter={openFilter}
                                                    setOpenFilter={setOpenFilter}
                                                    width={col.width}
                                                />
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRows.map((row, idx) => (
                                            <tr
                                                key={`${row.order_id}-${idx}`}
                                                className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"
                                                    }`}
                                            >
                                                <td className="px-1.5 py-1 text-gray-600 border-r border-gray-100 text-[10px] whitespace-nowrap">{formatDate(row.order_date)}</td>
                                                <td className="px-1.5 py-1 text-blue-600 font-medium border-r border-gray-100 text-[10px] truncate whitespace-nowrap max-w-[110px]" title={row.order_number}>{row.order_number}</td>
                                                <td className="px-1.5 py-1 text-gray-700 border-r border-gray-100 text-[10px] truncate whitespace-nowrap max-w-[90px]" title={row.seller_name.trim()}>{row.seller_name.trim() || "-"}</td>
                                                <td className="px-1.5 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                                                    {row.customer_type ? (
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${row.customer_type === "New Customer" ? "bg-green-100 text-green-700" : row.customer_type === "Mined Lead" ? "bg-orange-100 text-orange-700" : "bg-purple-100 text-purple-700"
                                                            }`}>
                                                            {getCustomerTypeThai(row.customer_type)}
                                                        </span>
                                                    ) : "-"}
                                                </td>
                                                <td className="px-1.5 py-1 text-gray-500 border-r border-gray-100 truncate whitespace-nowrap text-[10px] max-w-[70px]" title={row.basket_key_at_sale || ""}>{row.basket_key_at_sale || "-"}</td>
                                                <td className="px-1.5 py-1 text-center text-gray-500 border-r border-gray-100 text-[10px] whitespace-nowrap">{row.sales_channel || "-"}</td>
                                                <td className="px-1.5 py-1 text-center text-gray-600 border-r border-gray-100 text-[10px] whitespace-nowrap">{getPaymentThai(row.payment_method)}</td>
                                                <td className="px-1.5 py-1 text-gray-700 border-r border-gray-100 truncate whitespace-nowrap text-[10px] max-w-[110px]" title={row.customer_name.trim()}>{row.customer_name.trim() || "-"}</td>
                                                <td className="px-1.5 py-1 text-gray-600 border-r border-gray-100 text-[10px] whitespace-nowrap">{row.customer_phone || "-"}</td>
                                                <td className="px-1.5 py-1 text-gray-500 border-r border-gray-100 truncate whitespace-nowrap text-[10px] max-w-[80px]" title={row.province || ""}>{row.province || "-"}</td>
                                                <td className="px-1.5 py-1 text-gray-500 border-r border-gray-100 text-[10px] font-mono whitespace-nowrap">{row.product_sku || "-"}</td>
                                                <td className="px-1.5 py-1 text-gray-700 border-r border-gray-100 truncate whitespace-nowrap text-[10px] max-w-[140px]" title={row.product_name}>
                                                    {row.is_freebie ? <span className="text-orange-500 mr-0.5">🎁</span> : null}
                                                    {row.product_name || "-"}
                                                </td>
                                                <td className="px-1.5 py-1 text-right text-gray-700 border-r border-gray-100 font-medium text-[10px] whitespace-nowrap">{row.quantity}</td>
                                                <td className="px-1.5 py-1 text-right border-r border-gray-100 font-medium text-[10px] whitespace-nowrap">
                                                    <span className={row.is_freebie ? "text-gray-400" : "text-gray-800"}>
                                                        {row.is_freebie ? "0" : formatMoney(row.net_total)}
                                                    </span>
                                                </td>
                                                <td className="px-1.5 py-1 text-gray-500 border-r border-gray-100 text-[10px] whitespace-nowrap">{formatDate(row.delivery_date)}</td>
                                                <td className="px-1.5 py-1 text-center whitespace-nowrap">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${getStatusColor(row.order_status)}`}>
                                                        {getStatusThai(row.order_status)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {filteredRows.length === 0 && (
                                            <tr>
                                                <td colSpan={16} className="px-4 py-10 text-center text-gray-400 text-sm">
                                                    {hasActiveFilters ? 'ไม่พบข้อมูลตามตัวกรองที่เลือก' : 'ไม่พบข้อมูลสำหรับเดือนที่เลือก'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="px-3 py-2 bg-gray-50 border-t flex items-center justify-between flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <span className="text-[11px] text-gray-500">
                                        แสดง {filteredRows.length > 0 ? ((page - 1) * pageSize) + 1 : 0} - {Math.min(page * pageSize, pagination.total)} จาก {pagination.total.toLocaleString()} รายการ
                                    </span>
                                    {hasActiveFilters && (
                                        <span className="text-[11px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                            กรอง: {filteredStats.count} รายการ · ฿{formatMoney(filteredStats.totalNet)} · จำนวน {filteredStats.totalQty.toLocaleString()}
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
        </div >
    );
};

export default SalesSheetPage;
