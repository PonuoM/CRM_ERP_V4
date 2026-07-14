import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { User } from "../types";
import { apiFetch } from "../services/api";
import { Download, ChevronLeft, ChevronRight, Search, Phone, Loader2, X, ChevronDown, Check } from "lucide-react";
import ExportTypeModal from "../components/ExportTypeModal";
import { downloadDataFile } from "../utils/exportUtils";

interface TelesaleCallReportPageProps {
    currentUser: User;
}

interface CallRow {
    id: number;
    call_date: string;
    customer_phone: string | null;
    customer_name: string;
    call_status: string | null;
    call_result: string | null;
    caller_name: string;
    caller_id: number;
    basket_name: string | null;
    basket_id: number | null;
    notes: string | null;
    duration: number | null;
    customer_id: number | null;
}

interface Agent {
    id: number;
    name: string;
    role_id: number;
}

const THAI_MONTHS_SHORT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

// Canonical values from LogCallModal.tsx (must match how telesales record calls)
const CALL_STATUS_OPTIONS = ['รับสาย', 'ได้คุย', 'ไม่รับสาย', 'สายไม่ว่าง', 'ติดสายซ้อน', 'ไม่มีสัญญาณ', 'ตัดสายทิ้ง'];
const CALL_RESULT_OPTIONS = ['สินค้ายังไม่หมด', 'ใช้แล้วไม่เห็นผล', 'ยังไม่ได้ลองใช้', 'ยังไม่ถึงรอบใช้งาน', 'สั่งช่องทางอื่นแล้ว', 'ไม่สะดวกคุย', 'ติดสายซ้อน', 'ฝากส่งไม่ได้ใช้เอง', 'คนอื่นรับสายแทน', 'เลิกทำสวน', 'ไม่สนใจ', 'ห้ามติดต่อ', 'ได้คุย', 'ขายได้', 'ตัดสายทิ้ง', 'ไม่รับสาย', 'สายไม่ว่าง', 'ไม่มีสัญญาณ'];

const formatDateTime = (iso: string | null): string => {
    if (!iso) return "-";
    const d = new Date(iso.replace(" ", "T"));
    if (isNaN(d.getTime())) return iso || "-";
    return d.toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const getStatusColor = (status: string | null): string => {
    switch (status) {
        case "ได้คุย": return "bg-emerald-100 text-emerald-700";
        case "รับสาย": return "bg-sky-100 text-sky-700";
        case "ไม่รับสาย": return "bg-gray-100 text-gray-600";
        case "ไม่มีสัญญาณ": return "bg-amber-100 text-amber-700";
        case "ตัดสายทิ้ง": return "bg-red-100 text-red-600";
        case "สายไม่ว่าง": return "bg-orange-100 text-orange-700";
        case "ติดสายซ้อน": return "bg-purple-100 text-purple-700";
        default: return "bg-gray-100 text-gray-600";
    }
};

const getResultColor = (result: string | null): string => {
    switch (result) {
        case "ขายได้": return "bg-emerald-100 text-emerald-700";
        case "ได้คุย": return "bg-sky-100 text-sky-700";
        case "ไม่สนใจ":
        case "เลิกทำสวน":
        case "ห้ามติดต่อ": return "bg-red-100 text-red-600";
        default: return "bg-gray-100 text-gray-600";
    }
};

// ============ Multi-Select Column Filter (Excel-style, portal, buffered) ============
interface MultiSelectFilterProps {
    label: string;
    colKey: string;
    allValues: string[];
    selectedValues: Set<string> | null;
    onApplyFilter: (colKey: string, selected: Set<string> | null) => void;
    openFilter: string | null;
    setOpenFilter: (key: string | null) => void;
    width?: string;
    sortDir: 'asc' | 'desc' | null;
    onSort: (colKey: string, dir: 'asc' | 'desc' | null) => void;
}

const MultiSelectFilter: React.FC<MultiSelectFilterProps> = ({
    label, colKey, allValues, selectedValues, onApplyFilter, openFilter, setOpenFilter, width, sortDir, onSort
}) => {
    const [search, setSearch] = useState('');
    const [pending, setPending] = useState<Set<string> | null>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
    const isOpen = openFilter === colKey;
    const isFiltered = selectedValues !== null;

    useEffect(() => {
        if (isOpen) {
            setPending(selectedValues === null ? null : new Set(selectedValues));
            setSearch('');
            if (buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                const dropdownWidth = 240;
                let left = rect.left;
                if (left + dropdownWidth > window.innerWidth) left = rect.right - dropdownWidth;
                if (left < 4) left = 4;
                setDropdownPos({ top: rect.bottom + 2, left });
            }
        }
    }, [isOpen, selectedValues]);

    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (dropdownRef.current && !dropdownRef.current.contains(target) &&
                buttonRef.current && !buttonRef.current.contains(target)) {
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

    const toggleAll = () => setPending(isAllSelected ? new Set() : null);
    const toggleValue = (val: string) => {
        const currentSet = pending === null ? new Set(allValues) : new Set(pending);
        if (currentSet.has(val)) currentSet.delete(val); else currentSet.add(val);
        setPending(currentSet.size === allValues.length ? null : currentSet);
    };
    const isValueChecked = (val: string) => pending === null || pending.has(val);

    const handleOK = () => {
        if (pending === null || pending.size === allValues.length) onApplyFilter(colKey, null);
        else onApplyFilter(colKey, new Set(pending));
        setOpenFilter(null);
    };
    const handleClear = () => { onApplyFilter(colKey, null); setOpenFilter(null); };
    const handleCancel = () => setOpenFilter(null);

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
                    style={{ top: dropdownPos.top, left: dropdownPos.left, width: 240, maxHeight: 360, display: 'flex', flexDirection: 'column' }}
                >
                    <div className="flex border-b border-gray-200 flex-shrink-0">
                        <button onClick={() => onSort(colKey, sortDir === 'asc' ? null : 'asc')}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium transition-colors ${sortDir === 'asc' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <span>A→Z</span><span className="text-[9px]">↑</span>
                        </button>
                        <button onClick={() => onSort(colKey, sortDir === 'desc' ? null : 'desc')}
                            className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-[10px] font-medium transition-colors border-l border-gray-200 ${sortDir === 'desc' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <span>Z→A</span><span className="text-[9px]">↓</span>
                        </button>
                    </div>
                    <div className="p-1.5 border-b border-gray-200 flex-shrink-0">
                        <div className="relative">
                            <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา..."
                                className="w-full pl-6 pr-2 py-1 text-[11px] border border-gray-200 rounded focus:ring-1 focus:ring-green-400 focus:outline-none bg-gray-50" autoFocus />
                        </div>
                    </div>
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
                    <div className="border-t border-gray-200 px-2 py-1.5 flex items-center justify-between bg-gray-50 rounded-b-lg flex-shrink-0">
                        <span className="text-[10px] text-gray-500">เลือก {pendingCount}/{allValues.length}</span>
                        <div className="flex gap-1">
                            <button onClick={handleCancel} className="px-2 py-0.5 text-[10px] text-gray-500 hover:bg-gray-100 rounded font-medium">ยกเลิก</button>
                            {isFiltered && <button onClick={handleClear} className="px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50 rounded font-medium">ล้าง</button>}
                            <button onClick={handleOK} className="px-2.5 py-0.5 text-[10px] bg-green-600 text-white rounded font-medium hover:bg-green-700">ตกลง</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </th>
    );
};

// ============ Main Page ============
const TelesaleCallReportPage: React.FC<TelesaleCallReportPageProps> = ({ currentUser }) => {
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [agentId, setAgentId] = useState(0);
    const [callStatus, setCallStatus] = useState("");
    const [callResult, setCallResult] = useState("");
    const [searchText, setSearchText] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(200);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<CallRow[]>([]);
    const [agents, setAgents] = useState<Agent[]>([]);
    const [summary, setSummary] = useState({ total_calls: 0, talked_calls: 0, unique_customers: 0, active_agents: 0 });
    const [pagination, setPagination] = useState({ page: 1, pageSize: 200, total: 0, totalPages: 0 });
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Per-column Excel-style filters (client-side, on loaded rows)
    const [colFilters, setColFilters] = useState<Record<string, Set<string> | null>>({});
    const [openFilter, setOpenFilter] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
    const [allDataLoaded, setAllDataLoaded] = useState(false);

    const onChangeFilter = useCallback((key: string, selected: Set<string> | null) => {
        setColFilters(prev => {
            const next = { ...prev };
            if (selected === null) delete next[key]; else next[key] = selected;
            const hasFilters = Object.keys(next).length > 0;
            if (hasFilters && !allDataLoaded) setAllDataLoaded(true);
            return next;
        });
    }, [allDataLoaded]);

    const onSort = useCallback((key: string, dir: 'asc' | 'desc' | null) => {
        setSortConfig(dir === null ? null : { key, dir });
    }, []);

    const clearAllFilters = useCallback(() => {
        setColFilters({});
        setOpenFilter(null);
        setSortConfig(null);
        setAllDataLoaded(false);
    }, []);

    const hasActiveFilters = useMemo(() => Object.keys(colFilters).length > 0, [colFilters]);
    const activeFilterCount = useMemo(() => Object.keys(colFilters).length, [colFilters]);

    // Display getters per column (must match dropdown values)
    const colGetters: Record<string, (r: CallRow) => string> = useMemo(() => ({
        call_date: r => formatDateTime(r.call_date),
        customer_phone: r => r.customer_phone || '-',
        customer_name: r => r.customer_name?.trim() || '-',
        call_status: r => r.call_status || '-',
        caller_name: r => r.caller_name?.trim() || '-',
        call_result: r => r.call_result || '-',
        basket_name: r => r.basket_name || '-',
        notes: r => r.notes?.trim() || '-',
    }), []);

    const colUniqueValues = useMemo(() => {
        const uniq = (key: string) => [...new Set(rows.map(r => colGetters[key](r)))].sort((a, b) => a.localeCompare(b, 'th'));
        return {
            customer_phone: uniq('customer_phone'),
            customer_name: uniq('customer_name'),
            call_status: uniq('call_status'),
            caller_name: uniq('caller_name'),
            call_result: uniq('call_result'),
            basket_name: uniq('basket_name'),
        };
    }, [rows, colGetters]);

    const filteredRows = useMemo(() => {
        if (!hasActiveFilters) return rows;
        return rows.filter(row => {
            for (const [key, selectedSet] of Object.entries(colFilters)) {
                if (selectedSet === null) continue;
                if (selectedSet.size === 0) return false;
                const getter = colGetters[key];
                if (getter && !selectedSet.has(getter(row))) return false;
            }
            return true;
        });
    }, [rows, colFilters, hasActiveFilters, colGetters]);

    const sortedRows = useMemo(() => {
        if (!sortConfig) return filteredRows;
        const { key, dir } = sortConfig;
        const getter = colGetters[key];
        if (!getter) return filteredRows;
        return [...filteredRows].sort((a, b) => {
            const va = getter(a), vb = getter(b);
            return dir === 'asc' ? va.localeCompare(vb, 'th') : vb.localeCompare(va, 'th');
        });
    }, [filteredRows, sortConfig, colGetters]);

    // Reset column filters when top-level filters change
    useEffect(() => {
        setColFilters({});
        setOpenFilter(null);
        setAllDataLoaded(false);
    }, [month, year, agentId, callStatus, callResult, debouncedSearch]);

    const yearOptions = useMemo(() => {
        const cur = new Date().getFullYear();
        return [cur, cur - 1, cur - 2];
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchText), 400);
        return () => clearTimeout(timer);
    }, [searchText]);

    useEffect(() => { setPage(1); }, [month, year, agentId, callStatus, callResult, debouncedSearch]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                month: String(month),
                year: String(year),
                page: String(allDataLoaded ? 1 : page),
                pageSize: String(allDataLoaded ? 10000 : pageSize),
            });
            if (agentId > 0) params.set("agent_id", String(agentId));
            if (callStatus) params.set("call_status", callStatus);
            if (callResult) params.set("call_result", callResult);
            if (debouncedSearch) params.set("search", debouncedSearch);

            const result = await apiFetch(`Reports/telesale_call_report.php?${params}`);
            if (result?.success) {
                setRows(result.rows || []);
                const s = result.summary || {};
                setSummary({
                    total_calls: Number(s.total_calls) || 0,
                    talked_calls: Number(s.talked_calls) || 0,
                    unique_customers: Number(s.unique_customers) || 0,
                    active_agents: Number(s.active_agents) || 0,
                });
                setPagination(result.pagination || { page: 1, pageSize, total: 0, totalPages: 0 });
                if (result.agents) setAgents(result.agents);
            } else {
                setRows([]);
            }
        } catch (err) {
            console.error("Telesale call report fetch error:", err);
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [month, year, agentId, callStatus, callResult, debouncedSearch, page, pageSize, allDataLoaded]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExport = async (type: 'csv' | 'xlsx') => {
        setIsExportModalOpen(false);
        setIsExporting(true);
        try {
            const params = new URLSearchParams({
                month: String(month),
                year: String(year),
                export: "1"
            });
            if (agentId > 0) params.set("agent_id", String(agentId));
            if (callStatus) params.set("call_status", callStatus);
            if (callResult) params.set("call_result", callResult);
            if (debouncedSearch) params.set("search", debouncedSearch);

            const res = await apiFetch(`Reports/telesale_call_report.php?${params}`);
            if (!res?.success) throw new Error(res?.message || "Failed to fetch export data");
            
            let exportData = res.rows || [];
            
            if (hasActiveFilters) {
                exportData = exportData.filter((r: CallRow) => {
                    for (const col of Object.keys(colFilters)) {
                        const allowed = colFilters[col];
                        if (allowed && !allowed.has(colGetters[col](r))) return false;
                    }
                    return true;
                });
            }

            const headers = ["วันเวลาโทร", "เบอร์", "ชื่อลูกค้า", "สถานะการโทร", "ผู้โทร", "ผลการโทร", "สถานะถังลูกค้า", "หมายเหตุการโทร"];
            const dataRows = exportData.map((r: CallRow) => [
                formatDateTime(r.call_date),
                r.customer_phone || "-",
                r.customer_name?.trim() || "-",
                r.call_status || "-",
                r.caller_name?.trim() || "-",
                r.call_result || "-",
                r.basket_name || "-",
                (r.notes || "").replace(/\r?\n/g, " ").trim() || "-",
            ]);
            downloadDataFile([headers, ...dataRows], `telesale_call_report_${year}_${String(month).padStart(2, "0")}`, type);
        } catch (err) {
            console.error("Export error:", err);
            alert("เกิดข้อผิดพลาดในการดึงข้อมูล Export โปรดลองอีกครั้ง");
        } finally {
            setIsExporting(false);
        }
    };

    const columns = useMemo(() => [
        { key: 'call_date', label: 'วันเวลาโทร', width: 'w-[95px]', filterable: false },
        { key: 'customer_phone', label: 'เบอร์', width: 'w-[95px]', filterable: true },
        { key: 'customer_name', label: 'ชื่อลูกค้า', width: 'w-[140px]', filterable: true },
        { key: 'call_status', label: 'สถานะการโทร', width: 'w-[90px]', filterable: true },
        { key: 'caller_name', label: 'ผู้โทร', width: 'w-[110px]', filterable: true },
        { key: 'call_result', label: 'ผลการโทร', width: 'w-[110px]', filterable: true },
        { key: 'basket_name', label: 'ถังลูกค้า', width: 'w-[110px]', filterable: true },
        { key: 'notes', label: 'หมายเหตุการโทร', width: 'w-[280px]', filterable: false },
    ], []);

    const answerRate = summary.total_calls > 0 ? Math.round((summary.talked_calls / summary.total_calls) * 100) : 0;

    return (
        <div className="flex flex-col h-full bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-4 py-3 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <Phone className="w-5 h-5 text-green-600" />
                        <h1 className="text-lg font-bold text-gray-800">รายงานการโทร (Telesale)</h1>
                        <span className="text-xs text-gray-400 ml-1">• {THAI_MONTHS_SHORT[month - 1]} {year + 543}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <button onClick={clearAllFilters}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-md border border-red-200 font-medium transition-colors">
                                <X className="w-3 h-3" />ล้างตัวกรอง ({activeFilterCount})
                            </button>
                        )}
                        <button onClick={() => setIsExportModalOpen(true)} disabled={rows.length === 0 || isExporting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors">
                            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            {isExporting ? 'กำลังดึงข้อมูล...' : (hasActiveFilters ? `ดาวน์โหลดแบบมีตัวกรอง` : 'ดาวน์โหลดทั้งหมด')}
                        </button>
                    </div>
                </div>

                {/* Month / Year */}
                <div className="flex items-center gap-1 mb-3">
                    <select value={year} onChange={e => setYear(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1 text-xs mr-2 bg-white">
                        {yearOptions.map(y => <option key={y} value={y}>{y + 543}</option>)}
                    </select>
                    <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 flex-wrap">
                        {THAI_MONTHS_SHORT.map((m, idx) => (
                            <button key={idx} onClick={() => setMonth(idx + 1)}
                                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${month === idx + 1 ? "bg-green-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"}`}>
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex items-center gap-2 flex-wrap">
                    <select value={agentId} onChange={e => setAgentId(Number(e.target.value))}
                        className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white min-w-[150px]">
                        <option value={0}>พนักงานทั้งหมด ({agents.length})</option>
                        {agents.map(a => <option key={a.id} value={a.id}>{a.name}{a.role_id === 6 ? ' (Sup)' : ''}</option>)}
                    </select>
                    <select value={callStatus} onChange={e => setCallStatus(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
                        <option value="">ทุกสถานะการโทร</option>
                        {CALL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select value={callResult} onChange={e => setCallResult(e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
                        <option value="">ทุกผลการโทร</option>
                        {CALL_RESULT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="relative flex-1 min-w-[180px] max-w-[280px]">
                        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                            placeholder="ค้นหา เบอร์, ชื่อลูกค้า, หมายเหตุ..."
                            className="w-full pl-7 pr-7 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-green-500" />
                        {searchText && (
                            <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="px-4 py-2 flex-shrink-0">
                <div className="grid grid-cols-4 gap-3">
                    <div className="rounded-lg border bg-white px-3 py-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">การโทรทั้งหมด</div>
                        <div className="text-lg font-bold text-gray-800">{summary.total_calls.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border bg-white px-3 py-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">ได้คุย</div>
                        <div className="text-lg font-bold text-emerald-700">{summary.talked_calls.toLocaleString()}</div>
                    </div>
                    <div className="rounded-lg border bg-white px-3 py-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">อัตราได้คุย</div>
                        <div className="text-lg font-bold text-sky-700">{answerRate}%</div>
                    </div>
                    <div className="rounded-lg border bg-white px-3 py-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">ลูกค้า (ไม่ซ้ำ)</div>
                        <div className="text-lg font-bold text-gray-800">{summary.unique_customers.toLocaleString()}</div>
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
                                <table className="w-full text-[11px] border-collapse min-w-[1000px]">
                                    <thead className="sticky top-0 z-20">
                                        <tr className="bg-gray-100 border-b border-gray-300">
                                            {columns.map(col => col.filterable ? (
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
                                                    sortDir={sortConfig?.key === col.key ? sortConfig.dir : null}
                                                    onSort={onSort}
                                                />
                                            ) : (
                                                <th key={col.key} className={`px-1.5 py-1.5 font-semibold text-gray-600 border-r border-gray-200 text-left text-[11px] ${col.width}`}>
                                                    {col.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedRows.map((row, idx) => (
                                            <tr key={row.id} className={`border-b border-gray-100 hover:bg-blue-50/40 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/60"}`}>
                                                <td className="px-1.5 py-1 text-gray-600 border-r border-gray-100 text-[10px] whitespace-nowrap">{formatDateTime(row.call_date)}</td>
                                                <td className="px-1.5 py-1 text-gray-700 border-r border-gray-100 text-[10px] font-mono whitespace-nowrap">{row.customer_phone || "-"}</td>
                                                <td className="px-1.5 py-1 text-gray-700 border-r border-gray-100 truncate whitespace-nowrap text-[10px] max-w-[140px]" title={row.customer_name?.trim()}>{row.customer_name?.trim() || "-"}</td>
                                                <td className="px-1.5 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                                                    {row.call_status ? (
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${getStatusColor(row.call_status)}`}>{row.call_status}</span>
                                                    ) : "-"}
                                                </td>
                                                <td className="px-1.5 py-1 text-gray-700 border-r border-gray-100 truncate whitespace-nowrap text-[10px] max-w-[110px]" title={row.caller_name?.trim()}>{row.caller_name?.trim() || "-"}</td>
                                                <td className="px-1.5 py-1 text-center border-r border-gray-100 whitespace-nowrap">
                                                    {row.call_result ? (
                                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-medium ${getResultColor(row.call_result)}`}>{row.call_result}</span>
                                                    ) : "-"}
                                                </td>
                                                <td className="px-1.5 py-1 text-gray-500 border-r border-gray-100 truncate whitespace-nowrap text-[10px] max-w-[110px]" title={row.basket_name || ""}>{row.basket_name || "-"}</td>
                                                <td className="px-1.5 py-1 text-gray-600 text-[10px] max-w-[280px] truncate" title={row.notes || ""}>{row.notes?.trim() || "-"}</td>
                                            </tr>
                                        ))}
                                        {sortedRows.length === 0 && (
                                            <tr>
                                                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                                                    {hasActiveFilters ? 'ไม่พบข้อมูลตามตัวกรองที่เลือก' : 'ไม่พบข้อมูลการโทรสำหรับเดือนที่เลือก'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Footer */}
                            <div className="px-3 py-2 bg-gray-50 border-t flex items-center justify-between flex-shrink-0">
                                <span className="text-[11px] text-gray-500">
                                    {hasActiveFilters
                                        ? `กรองได้ ${sortedRows.length.toLocaleString()} จาก ${pagination.total.toLocaleString()} รายการ`
                                        : `แสดง ${sortedRows.length > 0 ? ((page - 1) * pageSize) + 1 : 0} - ${Math.min(page * pageSize, pagination.total)} จาก ${pagination.total.toLocaleString()} รายการ`}
                                </span>
                                {pagination.totalPages > 1 && !allDataLoaded && (
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors">
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <div className="flex items-center gap-0.5">
                                            {Array.from({ length: Math.min(pagination.totalPages, 7) }, (_, i) => {
                                                let pageNum: number;
                                                if (pagination.totalPages <= 7) pageNum = i + 1;
                                                else if (page <= 4) pageNum = i + 1;
                                                else if (page >= pagination.totalPages - 3) pageNum = pagination.totalPages - 6 + i;
                                                else pageNum = page - 3 + i;
                                                return (
                                                    <button key={pageNum} onClick={() => setPage(pageNum)}
                                                        className={`w-7 h-7 rounded text-xs font-medium transition-colors ${page === pageNum ? "bg-green-600 text-white" : "text-gray-600 hover:bg-gray-200"}`}>
                                                        {pageNum}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages}
                                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-40 transition-colors">
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <ExportTypeModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} onConfirm={handleExport} />
        </div>
    );
};

export default TelesaleCallReportPage;
