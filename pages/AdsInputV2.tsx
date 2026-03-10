import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Calendar, Save, Loader2, RefreshCw, AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { User } from "@/types";
import { apiFetch, listProducts } from "@/services/api";
import { listRoles, Role } from "@/services/roleApi";
import resolveApiBasePath from "@/utils/apiBasePath";
import { isSystemCheck } from "@/utils/isSystemCheck";

const API_BASE = resolveApiBasePath();

// Helper: format Date to YYYY-MM-DD (local timezone)
const formatDateLocal = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

interface AdsInputV2Props {
    currentUser: User;
}

interface PageInfo {
    id: number;
    name: string;
    platform: string;
    active: boolean;
}

interface AdsRow {
    pageId: number;
    pageName: string;
    platform: string;
    adsCost: string;
    impressions: string;
    reach: string;
    clicks: string;
    existingId?: number; // id of existing record (for display purposes)
    lastUpdatedBy?: string; // who last updated (display name)
    lastUpdatedByUserId?: number; // user_id of who last updated
    adsGroup?: string; // ads_group name (product mode only)
    productIds?: number[]; // product ids in this group (product mode only)
}

const AdsInputV2: React.FC<AdsInputV2Props> = ({ currentUser }) => {
    // --- State ---
    const [selectedDate, setSelectedDate] = useState<string>("");
    const [userPages, setUserPages] = useState<PageInfo[]>([]);
    const [rows, setRows] = useState<AdsRow[]>([]);
    const [originalRows, setOriginalRows] = useState<AdsRow[]>([]); // snapshot for change detection
    const [loading, setLoading] = useState(true);
    const [loadingData, setLoadingData] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);

    // Double-click protection
    const saveLockRef = useRef(false);

    // Mode: page or product
    const [mode, setMode] = useState<"page" | "product">("page");
    const [userProducts, setUserProducts] = useState<any[]>([]);
    const [selectedPageId, setSelectedPageId] = useState<string>("");

    // Per-row edit unlock for system admin
    const [editingRows, setEditingRows] = useState<Set<number>>(new Set());

    // --- Check system access ---
    const hasSystemAccess = useMemo(() => isSystemCheck(currentUser.role, roles), [roles, currentUser.role]);

    // --- Load initial data ---
    useEffect(() => {
        let cancelled = false;
        async function init() {
            setLoading(true);
            try {
                const [rolesData] = await Promise.all([listRoles()]);
                if (cancelled) return;
                const fetchedRoles = rolesData?.roles || [];
                setRoles(fetchedRoles);
                const isSys = isSystemCheck(currentUser.role, fetchedRoles);

                // Load pages user has access to
                const pagesRes = await fetch(`${API_BASE}/Marketing_DB/get_pages_with_user_access.php`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId: currentUser.id }),
                });
                const pagesData = await pagesRes.json();
                if (cancelled) return;

                const accessible: PageInfo[] = pagesData.success && Array.isArray(pagesData.data?.accessible_pages)
                    ? pagesData.data.accessible_pages.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        platform: p.platform || "",
                        active: Boolean(p.active),
                    }))
                    : [];
                setUserPages(accessible);

                // Load products
                let loadedProducts: any[] = [];
                if (isSys) {
                    loadedProducts = await listProducts(currentUser.companyId);
                    if (!Array.isArray(loadedProducts)) loadedProducts = [];
                } else {
                    try {
                        const res = await fetch(`${API_BASE}/Marketing_DB/get_user_products.php?user_id=${currentUser.id}`);
                        const d = await res.json();
                        if (d.success && Array.isArray(d.data)) loadedProducts = d.data;
                    } catch { /* ignore */ }
                }
                setUserProducts(loadedProducts);
            } catch (e) {
                console.error("Init failed:", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        init();
        return () => { cancelled = true; };
    }, [currentUser.id, currentUser.companyId, currentUser.role]);

    // --- Load existing ads data when date or pages change ---
    const loadExistingData = useCallback(async () => {
        if (!selectedDate) return;
        if (mode === "page" && userPages.length === 0) {
            setRows([]);
            setOriginalRows([]);
            return;
        }
        if (mode === "product" && userProducts.length === 0) {
            setRows([]);
            setOriginalRows([]);
            return;
        }
        if (mode === "product" && !selectedPageId) {
            setRows([]);
            setOriginalRows([]);
            return;
        }

        setLoadingData(true);
        setSaveResult(null);
        setEditingRows(new Set());
        try {
            if (mode === "page") {
                // Fetch existing ads logs for this date
                const params = new URLSearchParams();
                params.append("date_from", selectedDate);
                params.append("date_to", selectedDate);
                params.append("company_id", String(currentUser.companyId));
                params.append("limit", "100000");

                const res = await apiFetch(`Marketing_DB/ads_log_get.php?${params.toString()}`);
                const existingLogs: any[] = res.success && Array.isArray(res.data) ? res.data : [];

                // Build a map: page_id (Number) -> log
                const logsMap = new Map<number, any>();
                for (const log of existingLogs) {
                    logsMap.set(Number(log.page_id), log);
                }

                // Create rows for each user page
                const newRows: AdsRow[] = userPages.map((page) => {
                    const existing = logsMap.get(Number(page.id));
                    return {
                        pageId: page.id,
                        pageName: page.name,
                        platform: page.platform,
                        adsCost: existing?.ads_cost ? String(existing.ads_cost) : "",
                        impressions: existing?.impressions ? String(existing.impressions) : "",
                        reach: existing?.reach ? String(existing.reach) : "",
                        clicks: existing?.clicks ? String(existing.clicks) : "",
                        existingId: existing?.id,
                        lastUpdatedBy: existing?.user_fullname || (existing?.user_id ? `ID: ${existing.user_id}` : undefined),
                        lastUpdatedByUserId: existing?.user_id ? Number(existing.user_id) : undefined,
                    };
                });
                setRows(newRows);
                setOriginalRows(JSON.parse(JSON.stringify(newRows)));
            } else {
                // Product mode — group products by ads_group
                // Only show products that have an ads_group set
                const groupedProducts = new Map<string, any[]>();
                for (const product of userProducts) {
                    const adsGroup = product.ads_group || product.adsGroup;
                    if (!adsGroup) continue; // skip products without ads_group
                    if (!groupedProducts.has(adsGroup)) {
                        groupedProducts.set(adsGroup, []);
                    }
                    groupedProducts.get(adsGroup)!.push(product);
                }

                // Fetch existing ads logs for this date + page
                const params = new URLSearchParams();
                params.append("start_date", selectedDate);
                params.append("end_date", selectedDate);
                params.append("limit", "100000");
                if (selectedPageId) params.append("page_id", selectedPageId);

                const response = await fetch(`${API_BASE}/Marketing_DB/product_ads_log_get_history.php?${params.toString()}`);
                const result = await response.json();
                const existingLogs: any[] = result.success && Array.isArray(result.data) ? result.data : [];

                // Build map: ads_group -> log (for grouped rows)
                const adsGroupLogsMap = new Map<string, any>();
                for (const log of existingLogs) {
                    if (log.ads_group) {
                        adsGroupLogsMap.set(log.ads_group, log);
                    }
                }

                // Build rows: one per ads_group
                const newRows: AdsRow[] = [];
                for (const [adsGroup, products] of groupedProducts.entries()) {
                    const existing = adsGroupLogsMap.get(adsGroup);
                    const productNames = products.map((p: any) => p.name).join(', ');
                    newRows.push({
                        pageId: products[0].id, // use first product id as reference
                        pageName: adsGroup,
                        platform: `${products.length} สินค้า`,
                        adsCost: existing?.ads_cost ? String(existing.ads_cost) : "",
                        impressions: existing?.impressions ? String(existing.impressions) : "",
                        reach: existing?.reach ? String(existing.reach) : "",
                        clicks: existing?.clicks ? String(existing.clicks) : "",
                        existingId: existing?.id,
                        lastUpdatedBy: existing?.user_fullname || (existing?.user_id ? `ID: ${existing.user_id}` : undefined),
                        lastUpdatedByUserId: existing?.user_id ? Number(existing.user_id) : undefined,
                        adsGroup: adsGroup,
                        productIds: products.map((p: any) => p.id),
                    });
                }
                setRows(newRows);
                setOriginalRows(JSON.parse(JSON.stringify(newRows)));
            }
        } catch (e) {
            console.error("Load existing data failed:", e);
        } finally {
            setLoadingData(false);
        }
    }, [selectedDate, userPages, userProducts, mode, currentUser.companyId, selectedPageId]);

    // Auto-load when date or mode changes
    useEffect(() => {
        if (!loading) {
            loadExistingData();
        }
    }, [selectedDate, mode, selectedPageId, loadExistingData, loading]);

    // --- Handle input change ---
    const handleChange = (index: number, field: keyof AdsRow, value: string) => {
        setRows((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: value };
            return updated;
        });
        setSaveResult(null);
    };

    // --- Handle save ---
    const handleSave = async () => {
        if (saveLockRef.current || saving) return;
        saveLockRef.current = true;
        setSaving(true);
        setSaveResult(null);

        try {
            // Validate: if any field is filled, all 4 must be filled (page mode only)
            // Product mode: auto-fill empty fields with "0"
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                const filled = [row.adsCost, row.impressions, row.reach, row.clicks].filter(
                    (v) => v !== undefined && v !== null && v.toString().trim() !== ""
                );
                if (filled.length > 0 && filled.length < 4) {
                    if (mode === "product") {
                        // Auto-fill empty fields with "0"
                        setRows((prev) => {
                            const updated = [...prev];
                            updated[i] = {
                                ...updated[i],
                                adsCost: updated[i].adsCost?.trim() || "0",
                                impressions: updated[i].impressions?.trim() || "0",
                                reach: updated[i].reach?.trim() || "0",
                                clicks: updated[i].clicks?.trim() || "0",
                            };
                            return updated;
                        });
                    } else {
                        setSaveResult({
                            type: "error",
                            text: `กรุณากรอกข้อมูลให้ครบ 4 ช่องสำหรับ "${row.pageName}"`,
                        });
                        return;
                    }
                }
            }

            // Filter to only rows that have data AND are actually changed/new
            const dataRows = rows.filter((r, idx) => {
                const hasData = (
                    (r.adsCost && r.adsCost.trim() !== "") ||
                    (r.impressions && r.impressions.trim() !== "") ||
                    (r.reach && r.reach.trim() !== "") ||
                    (r.clicks && r.clicks.trim() !== "")
                );
                if (!hasData) return false;

                // New row (no existing data) — always send
                if (!r.existingId) return true;

                // Existing row — only send if values actually changed
                const orig = originalRows[idx];
                if (!orig) return true;
                return (
                    r.adsCost !== orig.adsCost ||
                    r.impressions !== orig.impressions ||
                    r.reach !== orig.reach ||
                    r.clicks !== orig.clicks
                );
            });

            if (dataRows.length === 0) {
                setSaveResult({ type: "error", text: "ไม่มีข้อมูลที่เปลี่ยนแปลง" });
                return;
            }

            // Build records for upsert
            const records = dataRows.map((r) => {
                const base: any = {
                    user_id: currentUser.id,
                    date: selectedDate,
                    ads_cost: r.adsCost ? parseFloat(r.adsCost) : null,
                    impressions: r.impressions ? parseInt(r.impressions) : null,
                    reach: r.reach ? parseInt(r.reach) : null,
                    clicks: r.clicks ? parseInt(r.clicks) : null,
                };
                if (mode === "page") {
                    base.page_id = r.pageId;
                } else {
                    // Product mode: use ads_group + page_id for grouping
                    base.ads_group = r.adsGroup;
                    if (selectedPageId) base.page_id = parseInt(selectedPageId);
                }
                return base;
            });

            const endpoint = mode === "page"
                ? "Marketing_DB/ads_log_upsert.php"
                : "Marketing_DB/product_ads_log_upsert.php";

            const res = await apiFetch(endpoint, {
                method: "POST",
                body: JSON.stringify({ records }),
            });

            if (res.success) {
                const d = res.data || {};
                setSaveResult({
                    type: "success",
                    text: `บันทึกสำเร็จ! (เพิ่มใหม่ ${d.inserted || 0}, อัปเดต ${d.updated || 0}, ข้าม ${d.skipped || 0})`,
                });
                // Reload to get fresh IDs
                await loadExistingData();
            } else {
                setSaveResult({ type: "error", text: `บันทึกไม่สำเร็จ: ${res.error || "Unknown error"}` });
            }
        } catch (e: any) {
            console.error("Save failed:", e);
            setSaveResult({ type: "error", text: `เกิดข้อผิดพลาด: ${e.message || "Unknown"}` });
        } finally {
            setSaving(false);
            saveLockRef.current = false;
        }
    };


    // Format display date in Thai
    const displayDate = useMemo(() => {
        if (!selectedDate) return "";
        const d = new Date(selectedDate + "T00:00:00");
        const dayNames = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
        return `วัน${dayNames[d.getDay()]}ที่ ${d.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}`;
    }, [selectedDate]);

    // --- Render ---
    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="ml-3 text-gray-600">กำลังโหลดข้อมูล...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">กรอกค่า Ads V2</h2>
                        <p className="text-sm text-gray-500 mt-0.5">กรอกข้อมูลค่าโฆษณาประจำวัน • 1 เพจ 1 วัน ลงได้ 1 ครั้ง</p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${mode === "page"
                                ? "bg-white shadow-sm text-blue-600"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                            onClick={() => setMode("page")}
                        >
                            📄 รายเพจ
                        </button>
                        <button
                            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-all ${mode === "product"
                                ? "bg-white shadow-sm text-blue-600"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                            onClick={() => setMode("product")}
                        >
                            📦 รายสินค้า
                        </button>
                    </div>
                </div>
            </div>

            {/* Date Selector + Action Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-blue-500" />
                            <input
                                type="date"
                                className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>

                        {/* Page selector for product mode */}
                        {mode === "product" && userPages.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-500">เพจ:</span>
                                <select
                                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-w-[160px]"
                                    value={selectedPageId}
                                    onChange={(e) => setSelectedPageId(e.target.value)}
                                >
                                    <option value="">-- เลือกเพจ --</option>
                                    {userPages.map((p) => (
                                        <option key={p.id} value={String(p.id)}>
                                            {p.name} {p.platform ? `(${p.platform})` : ""}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <span className="text-sm text-gray-600 font-medium hidden sm:inline">{displayDate}</span>
                    </div>

                    <div className="flex items-center gap-3">
                        {saveResult && (
                            <div className={`flex items-center gap-2 text-sm ${saveResult.type === "success" ? "text-green-600" : "text-red-600"}`}>
                                {saveResult.type === "success" ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <AlertCircle className="w-4 h-4" />
                                )}
                                <span>{saveResult.text}</span>
                            </div>
                        )}

                        <button
                            onClick={loadExistingData}
                            disabled={loadingData}
                            className="inline-flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingData ? "animate-spin" : ""}`} />
                            โหลดใหม่
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={saving || loadingData || (mode === "product" && !selectedPageId)}
                            className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {saving ? "กำลังบันทึก..." : "💾 บันทึกทั้งหมด"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loadingData ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span className="ml-2 text-gray-500">กำลังโหลดข้อมูล...</span>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
                                        <th className="px-2 py-3 text-left font-semibold text-gray-700" style={{ width: '140px', maxWidth: '140px' }}>
                                            {mode === "page" ? "เพจ" : "กลุ่ม Ads"}
                                        </th>
                                        <th className="px-2 py-3 text-left font-semibold text-gray-700 w-20">
                                            {mode === "page" ? "แพลตฟอร์ม" : "จำนวนสินค้า"}
                                        </th>
                                        <th className="px-2 py-3 text-center font-semibold text-gray-700 w-16">
                                            ไม่มียอด
                                        </th>
                                        <th className="px-2 py-3 text-left font-semibold text-gray-700 w-28">
                                            💰 ค่า Ads
                                        </th>
                                        <th className="px-2 py-3 text-left font-semibold text-gray-700 w-28">
                                            👁 อิมเพรสชั่น
                                        </th>
                                        <th className="px-2 py-3 text-left font-semibold text-gray-700 w-28">
                                            📢 การเข้าถึง
                                        </th>
                                        <th className="px-2 py-3 text-left font-semibold text-gray-700 w-24">
                                            👆 ทัก/คลิก
                                        </th>
                                        <th className="px-2 py-3 text-center font-semibold text-gray-700 w-44">
                                            สถานะ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length > 0 ? rows.map((row, idx) => {
                                        // Determine if this row is editable
                                        const isOwnData = row.lastUpdatedByUserId === currentUser.id;
                                        const hasExistingData = !!row.existingId;
                                        // All users: existing data starts locked
                                        // Non-system: only empty rows can be filled
                                        // System: can unlock per-row with edit button
                                        const isUnlockedByAdmin = editingRows.has(row.pageId);
                                        const isRowEditable = !hasExistingData || (hasSystemAccess && isUnlockedByAdmin);
                                        const isNoData = !hasExistingData && row.adsCost === "0" && row.impressions === "0" && row.reach === "0" && row.clicks === "0";
                                        const inputBaseClass = "w-full px-2 py-1.5 border rounded-lg text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
                                        const inputClass = (isRowEditable && !isNoData)
                                            ? `${inputBaseClass} border-gray-200 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-colors bg-white`
                                            : `${inputBaseClass} border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed`;

                                        return (
                                            <tr key={row.pageId} className={`border-b border-gray-50 transition-colors ${row.existingId ? "bg-green-50/30" : "hover:bg-gray-50"
                                                }`}>
                                                <td className="px-2 py-2" style={{ width: '140px', maxWidth: '140px' }}>
                                                    <span className={`font-medium text-gray-800 block truncate ${row.pageName.length > 20 ? 'text-xs' : 'text-sm'}`} title={row.pageName}>{row.pageName}</span>
                                                </td>
                                                <td className="px-2 py-2 text-gray-600 text-xs">{row.platform}</td>
                                                <td className="px-2 py-2 text-center">
                                                    {isRowEditable && !hasExistingData && (
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-400 cursor-pointer"
                                                            checked={row.adsCost === "0" && row.impressions === "0" && row.reach === "0" && row.clicks === "0"}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setRows(prev => {
                                                                        const updated = [...prev];
                                                                        updated[idx] = { ...updated[idx], adsCost: "0", impressions: "0", reach: "0", clicks: "0" };
                                                                        return updated;
                                                                    });
                                                                } else {
                                                                    setRows(prev => {
                                                                        const updated = [...prev];
                                                                        updated[idx] = { ...updated[idx], adsCost: "", impressions: "", reach: "", clicks: "" };
                                                                        return updated;
                                                                    });
                                                                }
                                                            }}
                                                            title="ติ๊กเพื่อบันทึกยอดเป็น 0 (ไม่มียอดวันนี้)"
                                                        />
                                                    )}
                                                    {hasExistingData && row.adsCost === "0" && row.impressions === "0" && row.reach === "0" && row.clicks === "0" && (
                                                        <span className="text-[10px] text-gray-400">ไม่มียอด</span>
                                                    )}
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        className={inputClass}
                                                        placeholder="0.00"
                                                        value={row.adsCost}
                                                        onChange={(e) => handleChange(idx, "adsCost", e.target.value)}
                                                        disabled={!isRowEditable || isNoData}
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className={inputClass}
                                                        placeholder="0"
                                                        value={row.impressions}
                                                        onChange={(e) => handleChange(idx, "impressions", e.target.value)}
                                                        disabled={!isRowEditable || isNoData}
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className={inputClass}
                                                        placeholder="0"
                                                        value={row.reach}
                                                        onChange={(e) => handleChange(idx, "reach", e.target.value)}
                                                        disabled={!isRowEditable || isNoData}
                                                    />
                                                </td>
                                                <td className="px-2 py-2">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        className={inputClass}
                                                        placeholder="0"
                                                        value={row.clicks}
                                                        onChange={(e) => handleChange(idx, "clicks", e.target.value)}
                                                        disabled={!isRowEditable || isNoData}
                                                    />
                                                </td>
                                                <td className="px-2 py-2 text-center">
                                                    {row.existingId ? (
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium whitespace-nowrap">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                มีข้อมูล
                                                                {row.lastUpdatedBy && (
                                                                    <span className={`${isOwnData ? 'text-green-600' : 'text-blue-600'}`}>
                                                                        {isOwnData ? '(คุณ)' : `(${row.lastUpdatedBy})`}
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {hasSystemAccess && !isUnlockedByAdmin && (
                                                                <button
                                                                    onClick={() => setEditingRows(prev => new Set(prev).add(row.pageId))}
                                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded text-[10px] font-medium transition-colors"
                                                                    title="ปลดล็อคเพื่อแก้ไข"
                                                                >
                                                                    <Pencil className="w-3 h-3" />
                                                                    แก้ไข
                                                                </button>
                                                            )}
                                                            {hasSystemAccess && isUnlockedByAdmin && (
                                                                <span className="text-[10px] text-orange-500 font-medium">✏️ กำลังแก้ไข</span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-500 rounded-full text-xs">
                                                            ว่าง
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>);
                                    }) : (
                                        <tr>
                                            <td colSpan={8} className="text-center py-12 text-gray-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <AlertCircle className="w-8 h-8" />
                                                    <span>
                                                        {mode === "page" ? "ไม่มีเพจที่คุณมีสิทธิ์จัดการ" : "ไม่พบกลุ่ม Ads (กรุณาตั้ง 'กลุ่ม Ads' ในหน้าจัดการสินค้า)"}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>


                    </>
                )}
            </div>
        </div>
    );
};

export default AdsInputV2;
