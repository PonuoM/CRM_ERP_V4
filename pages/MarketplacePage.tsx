import React, { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "../services/api";

interface MarketplacePageProps {
    currentUser: any;
    view: "dashboard" | "adsInput" | "salesImport" | "settings";
}

interface Store {
    id: number;
    name: string;
    platform: string;
    url: string | null;
    manager_user_id: string | null;
    manager_name: string | null;
    company_id: number;
    active: number;
}

interface DashboardRow {
    store_id: number;
    store_name: string;
    platform: string;
    ads_cost: string;
    impressions: string;
    clicks: string;
    total_sales: string;
    total_orders: string;
    returns_amount: string;
    cancelled_amount: string;
}

const PLATFORMS = ["Shopee", "Lazada", "TikTok Shop", "LINE MyShop", "Facebook Shop", "อื่นๆ"];

const MarketplacePage: React.FC<MarketplacePageProps> = ({ currentUser, view }) => {

    // Stores
    const [stores, setStores] = useState<Store[]>([]);
    const [users, setUsers] = useState<any[]>([]);
    const [storeForm, setStoreForm] = useState<Partial<Store>>({});
    const [editingStoreId, setEditingStoreId] = useState<number | null>(null);
    const [showStoreForm, setShowStoreForm] = useState(false);

    // Ads Input V2 style
    const [adsDate, setAdsDate] = useState("");
    const [adsRows, setAdsRows] = useState<{ storeId: number; storeName: string; platform: string; adsCost: string; impressions: string; clicks: string; existingId?: number; lastUser?: string; }[]>([]);
    const [adsOriginalRows, setAdsOriginalRows] = useState<typeof adsRows>([]);
    const [adsLoadingData, setAdsLoadingData] = useState(false);
    const [adsSaving, setAdsSaving] = useState(false);
    const [adsSaveResult, setAdsSaveResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // CSV Sales Import
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvPreview, setCsvPreview] = useState<string[][]>([]);
    const [csvImporting, setCsvImporting] = useState(false);
    const [csvResult, setCsvResult] = useState<any>(null);
    const [importBatches, setImportBatches] = useState<any[]>([]);
    const [viewBatchId, setViewBatchId] = useState<number | null>(null);
    const [batchOrders, setBatchOrders] = useState<any[]>([]);
    const [batchSummary, setBatchSummary] = useState<any>(null);

    // Dashboard
    const [dashDateFrom, setDashDateFrom] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
    });
    const [dashDateTo, setDashDateTo] = useState(() => new Date().toISOString().slice(0, 10));
    const [dashStoreFilter, setDashStoreFilter] = useState("all");
    const [dashboardData, setDashboardData] = useState<DashboardRow[]>([]);
    const [dashLoading, setDashLoading] = useState(false);

    const companyId = currentUser?.company_id || currentUser?.companyId;

    // Load stores
    const loadStores = useCallback(async () => {
        try {
            const json = await apiFetch(`Marketplace/stores_list.php?company_id=${companyId}&active_only=false`);
            if (json.success) setStores(json.data || []);
        } catch (e) { console.error("Load stores error", e); }
    }, [companyId]);

    // Load users (with role_id and is_system from DB)
    const loadUsers = useCallback(async () => {
        try {
            const json = await apiFetch(`Marketplace/users_list.php?company_id=${companyId}`);
            if (json.success) setUsers(json.data || []);
        } catch (e) { console.error("Load users error", e); }
    }, [companyId]);

    useEffect(() => { loadStores(); loadUsers(); }, [loadStores, loadUsers]);

    // ==================== SETTINGS VIEW ====================
    const handleSaveStore = async () => {
        if (!storeForm.name || !storeForm.platform) {
            alert("กรุณากรอกชื่อร้านค้าและแพลตฟอร์ม");
            return;
        }
        try {
            const json = await apiFetch(`Marketplace/stores_upsert.php`, {
                method: "POST",
                body: JSON.stringify({
                    ...storeForm,
                    id: editingStoreId,
                    company_id: companyId,
                }),
            });
            if (json.success) {
                setShowStoreForm(false);
                setStoreForm({});
                setEditingStoreId(null);
                loadStores();
            } else {
                alert(json.error || "Error saving store");
            }
        } catch (e) { alert("Error saving store"); }
    };

    const handleToggleStoreActive = async (store: Store) => {
        const newActive = Number(store.active) === 1 ? 0 : 1;
        const action = newActive ? "เปิดใช้งาน" : "ปิดใช้งาน";
        if (!confirm(`ต้องการ${action}ร้านค้า "${store.name}"?`)) return;
        try {
            const json = await apiFetch(`Marketplace/stores_upsert.php`, {
                method: "POST",
                body: JSON.stringify({
                    id: store.id,
                    name: store.name,
                    platform: store.platform,
                    url: store.url,
                    manager_user_id: store.manager_user_id,
                    active: newActive,
                    company_id: companyId,
                }),
            });
            if (json.success) loadStores();
            else alert(json.error || "Error");
        } catch (e: any) { alert(e?.message || "Error toggling store"); }
    };

    const activeStores = useMemo(() => stores.filter(s => s.active), [stores]);

    // ==================== ADS INPUT (V2 Style) ====================
    const loadAdsData = useCallback(async () => {
        if (!adsDate || activeStores.length === 0) { setAdsRows([]); setAdsOriginalRows([]); return; }
        setAdsLoadingData(true);
        setAdsSaveResult(null);
        try {
            const json = await apiFetch(`Marketplace/ads_log_list.php?date_from=${adsDate}&date_to=${adsDate}&company_id=${companyId}`);
            const existingLogs: any[] = json.success && Array.isArray(json.data) ? json.data : [];
            const logsMap = new Map<number, any>();
            for (const log of existingLogs) logsMap.set(Number(log.store_id), log);

            const newRows = activeStores.map(s => {
                const existing = logsMap.get(Number(s.id));
                return {
                    storeId: s.id, storeName: s.name, platform: s.platform,
                    adsCost: existing?.ads_cost ? String(existing.ads_cost) : '',
                    impressions: existing?.impressions ? String(existing.impressions) : '',
                    clicks: existing?.clicks ? String(existing.clicks) : '',
                    existingId: existing?.id ? Number(existing.id) : undefined,
                    lastUser: existing?.user_id ? `ID:${existing.user_id}` : undefined,
                };
            });
            setAdsRows(newRows);
            setAdsOriginalRows(JSON.parse(JSON.stringify(newRows)));
        } catch (e) { console.error(e); }
        finally { setAdsLoadingData(false); }
    }, [adsDate, activeStores, companyId]);

    useEffect(() => {
        if (view === 'adsInput') loadAdsData();
    }, [view, adsDate, loadAdsData]);

    const handleAdsChange = (index: number, field: string, value: string) => {
        setAdsRows(prev => { const u = [...prev]; u[index] = { ...u[index], [field]: value }; return u; });
        setAdsSaveResult(null);
    };

    const handleAdsSaveAll = async () => {
        if (adsSaving) return;
        setAdsSaving(true);
        setAdsSaveResult(null);
        try {
            const changed = adsRows.filter((r, i) => {
                const hasData = r.adsCost.trim();
                if (!hasData) return false;
                if (!r.existingId) return true; // new
                const orig = adsOriginalRows[i];
                return !orig || r.adsCost !== orig.adsCost;
            });
            if (changed.length === 0) { setAdsSaveResult({ type: 'error', text: 'ไม่มีข้อมูลที่เปลี่ยนแปลง' }); return; }

            const records = changed.map(r => ({
                store_id: r.storeId, date: adsDate, user_id: currentUser?.id,
                ads_cost: r.adsCost ? parseFloat(r.adsCost) : 0,
                impressions: 0,
                clicks: 0,
            }));

            const json = await apiFetch('Marketplace/ads_log_upsert.php', {
                method: 'POST', body: JSON.stringify({ records }),
            });
            if (json.success) {
                const d = json.data || {};
                setAdsSaveResult({ type: 'success', text: `บันทึกสำเร็จ! (เพิ่มใหม่ ${d.inserted || 0}, อัปเดต ${d.updated || 0})` });
                await loadAdsData();
            } else {
                setAdsSaveResult({ type: 'error', text: json.error || 'Error' });
            }
        } catch (e: any) {
            setAdsSaveResult({ type: 'error', text: e?.message || 'Error' });
        } finally { setAdsSaving(false); }
    };

    // ==================== CSV SALES IMPORT ====================
    const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);
        setCsvResult(null);
        // Preview first 10 rows
        const reader = new FileReader();
        reader.onload = (ev) => {
            let text = ev.target?.result as string;
            if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            const rows = lines.slice(0, 11).map(l => {
                const cols: string[] = [];
                let inQuote = false, cur = '';
                for (const ch of l) {
                    if (ch === '"') { inQuote = !inQuote; }
                    else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
                    else cur += ch;
                }
                cols.push(cur);
                return cols;
            });
            setCsvPreview(rows);
        };
        reader.readAsText(file, 'utf-8');
    };

    const handleCsvImport = async () => {
        if (!csvFile) return;
        setCsvImporting(true);
        setCsvResult(null);
        try {
            const formData = new FormData();
            formData.append('csv_file', csvFile);
            formData.append('company_id', String(companyId));
            formData.append('user_id', String(currentUser?.id));
            const res = await fetch(`${window.location.origin}${(await import('../appBasePath')).default}api/Marketplace/sales_csv_import.php`, {
                method: 'POST', body: formData
            });
            const json = await res.json();
            setCsvResult(json);
            if (json.success) { loadImportBatches(); loadStores(); setCsvFile(null); setCsvPreview([]); }
        } catch (e: any) {
            setCsvResult({ success: false, error: e?.message || 'Error' });
        } finally { setCsvImporting(false); }
    };

    const loadImportBatches = useCallback(async () => {
        try {
            const json = await apiFetch(`Marketplace/import_batches_list.php?company_id=${companyId}`);
            if (json.success) setImportBatches(json.data || []);
        } catch (e) { /* ignore */ }
    }, [companyId]);

    const loadBatchOrders = useCallback(async (batchId: number) => {
        try {
            const json = await apiFetch(`Marketplace/sales_orders_list.php?batch_id=${batchId}&company_id=${companyId}&limit=200`);
            if (json.success) { setBatchOrders(json.data || []); setBatchSummary(json.summary || null); }
        } catch (e) { /* ignore */ }
    }, [companyId]);

    const handleDeleteBatch = async (batch: any) => {
        if (!confirm(`ต้องการลบ Batch "${batch.filename}" (${batch.imported_rows} รายการ)? ข้อมูลจะถูกลบทั้งหมดและไม่สามารถกู้คืนได้`)) return;
        try {
            const json = await apiFetch(`Marketplace/import_batch_delete.php`, {
                method: 'POST',
                body: JSON.stringify({ batch_id: batch.id, company_id: companyId }),
            });
            if (json.success) {
                if (viewBatchId === batch.id) { setViewBatchId(null); setBatchOrders([]); setBatchSummary(null); }
                loadImportBatches();
            } else { alert(json.error || 'Error'); }
        } catch (e: any) { alert(e?.message || 'Error deleting batch'); }
    };

    useEffect(() => {
        if (view === 'salesImport') loadImportBatches();
    }, [view, loadImportBatches]);

    useEffect(() => {
        if (viewBatchId) loadBatchOrders(viewBatchId);
    }, [viewBatchId, loadBatchOrders]);

    const downloadTemplate = () => {
        window.open(`${window.location.origin}${(window as any).__APP_BASE || '/beta_test/'}api/Marketplace/sales_csv_template.php`, '_blank');
    };

    // ==================== DASHBOARD ====================
    const loadDashboard = useCallback(async () => {
        setDashLoading(true);
        try {
            const params = new URLSearchParams({
                date_from: dashDateFrom,
                date_to: dashDateTo,
                company_id: String(companyId),
            });
            if (dashStoreFilter !== "all") params.append("store_id", dashStoreFilter);

            const json = await apiFetch(`Marketplace/dashboard_data.php?${params.toString()}`);
            if (json.success) setDashboardData(json.data || []);
        } catch (e) { console.error("Dashboard error", e); }
        setDashLoading(false);
    }, [companyId, dashDateFrom, dashDateTo, dashStoreFilter]);

    // Only show users with role_id 5 or is_system = 1
    const filteredUsers = users.filter((u: any) => {
        const rid = Number(u.role_id || 0);
        const isSys = u.isSystem || u.is_system;
        return rid === 5 || isSys === true || isSys === 1 || isSys === '1';
    });
    const labelClass = "block text-sm font-medium text-gray-600 mb-1";
    const inputClass = "w-full border border-gray-300 rounded-md p-2 text-sm h-[42px]";

    const fmtNum = (v: string | number) =>
        Number(v || 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // ==================== RENDER ====================
    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Marketplace</h1>

            {/* ==================== SETTINGS ==================== */}
            {view === "settings" && (
                <section>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold">จัดการร้านค้า</h2>
                        <button
                            onClick={() => {
                                setStoreForm({ active: 1 });
                                setEditingStoreId(null);
                                setShowStoreForm(true);
                            }}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                        >
                            + เพิ่มร้านค้า
                        </button>
                    </div>

                    {/* Store Form Modal */}
                    {showStoreForm && (
                        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
                            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
                                <h3 className="text-lg font-bold mb-4">
                                    {editingStoreId ? "แก้ไขร้านค้า" : "เพิ่มร้านค้าใหม่"}
                                </h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className={labelClass}>ชื่อร้านค้า *</label>
                                        <input
                                            className={inputClass}
                                            value={storeForm.name || ""}
                                            onChange={e => setStoreForm(p => ({ ...p, name: e.target.value }))}
                                            placeholder="ชื่อร้าน..."
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>แพลตฟอร์ม *</label>
                                        <select
                                            className={inputClass}
                                            value={storeForm.platform || ""}
                                            onChange={e => setStoreForm(p => ({ ...p, platform: e.target.value }))}
                                        >
                                            <option value="">เลือกแพลตฟอร์ม...</option>
                                            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>URL ร้านค้า</label>
                                        <input
                                            className={inputClass}
                                            value={storeForm.url || ""}
                                            onChange={e => setStoreForm(p => ({ ...p, url: e.target.value }))}
                                            placeholder="https://..."
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>ผู้ดูแลร้าน (เลือกได้หลายคน)</label>
                                        <div className="max-h-52 overflow-y-auto border border-gray-300 rounded-md p-2">
                                            {filteredUsers.length === 0 ? (
                                                <p className="text-gray-400 text-xs">ไม่มีผู้ใช้</p>
                                            ) : (() => {
                                                // Group by role
                                                const grouped: Record<string, any[]> = {};
                                                filteredUsers.forEach((u: any) => {
                                                    const role = u.role_name || u.role || 'ไม่ระบุ';
                                                    if (!grouped[role]) grouped[role] = [];
                                                    grouped[role].push(u);
                                                });
                                                // Sort roles alphabetically
                                                const sortedRoles = Object.keys(grouped).sort();
                                                return sortedRoles.map((role, idx) => (
                                                    <div key={role}>
                                                        {idx > 0 && <hr className="my-1 border-gray-200" />}
                                                        <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded mb-1 sticky top-0">
                                                            {role} ({grouped[role].length})
                                                        </div>
                                                        {grouped[role].map((u: any) => {
                                                            const selectedIds = (storeForm.manager_user_id || "").split(",").filter(Boolean);
                                                            const isChecked = selectedIds.includes(String(u.id));
                                                            return (
                                                                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-0.5 rounded">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={isChecked}
                                                                        onChange={() => {
                                                                            const ids = (storeForm.manager_user_id || "").split(",").filter(Boolean);
                                                                            const newIds = isChecked
                                                                                ? ids.filter(id => id !== String(u.id))
                                                                                : [...ids, String(u.id)];
                                                                            setStoreForm(p => ({ ...p, manager_user_id: newIds.join(",") || null }));
                                                                        }}
                                                                    />
                                                                    {u.first_name} {u.last_name || ""}
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={Number(storeForm.active) === 1}
                                            onChange={e => setStoreForm(p => ({ ...p, active: e.target.checked ? 1 : 0 }))}
                                        />
                                        <label className="text-sm">เปิดใช้งาน</label>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2 mt-6">
                                    <button
                                        onClick={() => setShowStoreForm(false)}
                                        className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        onClick={handleSaveStore}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
                                    >
                                        บันทึก
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stores Table */}
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-700">
                                <tr>
                                    <th className="px-4 py-3 text-left">ชื่อร้านค้า</th>
                                    <th className="px-4 py-3 text-left">แพลตฟอร์ม</th>
                                    <th className="px-4 py-3 text-left">ผู้ดูแล</th>
                                    <th className="px-4 py-3 text-center">สถานะ</th>
                                    <th className="px-4 py-3 text-center">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stores.length === 0 ? (
                                    <tr><td colSpan={5} className="text-center py-8 text-gray-500">ยังไม่มีร้านค้า</td></tr>
                                ) : stores.map(s => (
                                    <tr key={s.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 font-medium">{s.name}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{s.platform}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{s.manager_name || "-"}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${s.active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                                {s.active ? "เปิด" : "ปิด"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => {
                                                    setStoreForm({
                                                        name: s.name,
                                                        platform: s.platform,
                                                        url: s.url,
                                                        manager_user_id: s.manager_user_id ? String(s.manager_user_id) : null,
                                                        active: Number(s.active),
                                                    });
                                                    setEditingStoreId(s.id);
                                                    setShowStoreForm(true);
                                                }}
                                                className="text-blue-600 hover:underline text-xs mr-3"
                                            >
                                                แก้ไข
                                            </button>
                                            <button
                                                onClick={() => handleToggleStoreActive(s)}
                                                className={`text-xs ${Number(s.active) === 1 ? "text-orange-600 hover:underline" : "text-green-600 hover:underline"}`}
                                            >
                                                {Number(s.active) === 1 ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ==================== ADS INPUT (V2 Style) ==================== */}
            {view === "adsInput" && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-semibold">กรอกค่า Ads (Marketplace)</h2>
                            <p className="text-xs text-gray-500">กรอกข้อมูลค่าโฆษณาประจำวัน • 1 ร้านค้า 1 วัน ลงได้ 1 ครั้ง</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button onClick={loadAdsData} disabled={adsLoadingData} className="px-3 py-2 border rounded-md text-sm hover:bg-gray-100 disabled:opacity-50">
                                โหลดใหม่
                            </button>
                            <button
                                onClick={handleAdsSaveAll}
                                disabled={adsSaving || adsLoadingData}
                                className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 text-sm font-medium"
                            >
                                {adsSaving ? 'กำลังบันทึก...' : '💾 บันทึกทั้งหมด'}
                            </button>
                        </div>
                    </div>

                    {/* Date picker */}
                    <div className="bg-white rounded-lg shadow px-4 py-3 mb-4 flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-600">📅 วันที่:</span>
                        <input type="date" className={inputClass + ' w-44'} value={adsDate} onChange={e => setAdsDate(e.target.value)} />
                        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); setAdsDate(d.toISOString().slice(0, 10)); }} className="px-3 py-1.5 text-xs border rounded hover:bg-gray-100">เมื่อวาน</button>
                        <button onClick={() => setAdsDate(new Date().toISOString().slice(0, 10))} className="px-3 py-1.5 text-xs border rounded hover:bg-gray-100">วันนี้</button>
                    </div>

                    {/* Save result */}
                    {adsSaveResult && (
                        <div className={`p-3 rounded-md text-sm mb-4 ${adsSaveResult.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {adsSaveResult.type === 'success' ? '✅' : '❌'} {adsSaveResult.text}
                        </div>
                    )}

                    {/* Table */}
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        {adsLoadingData ? (
                            <div className="py-12 text-center text-gray-400">กำลังโหลด...</div>
                        ) : adsRows.length === 0 ? (
                            <div className="py-12 text-center text-gray-400">ไม่มีร้านค้า กรุณาเพิ่มร้านค้าก่อน</div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-700">
                                    <tr>
                                        <th className="px-3 py-2.5 text-left">ร้านค้า</th>
                                        <th className="px-3 py-2.5 text-left">แพลตฟอร์ม</th>
                                        <th className="px-3 py-2.5 text-right">💰 ค่า Ads</th>
                                        <th className="px-3 py-2.5 text-center">สถานะ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adsRows.map((row, idx) => {
                                        const orig = adsOriginalRows[idx];
                                        const isChanged = orig && row.adsCost !== orig.adsCost;
                                        const hasData = row.adsCost.trim();
                                        const isLocked = !!row.existingId && !isChanged;
                                        return (
                                            <tr key={row.storeId} className={`border-b hover:bg-gray-50 ${isLocked ? 'bg-green-50/50' : ''}`}>
                                                <td className="px-3 py-2 font-medium">{row.storeName}</td>
                                                <td className="px-3 py-2 text-gray-500 text-xs">{row.platform}</td>
                                                <td className="px-2 py-1.5">
                                                    <input type="number" step="0.01" className={`w-full text-right px-2 py-1.5 border rounded text-sm ${isLocked ? 'bg-gray-50 text-gray-500' : ''}`}
                                                        value={row.adsCost} onChange={e => handleAdsChange(idx, 'adsCost', e.target.value)} placeholder="0.00" />
                                                </td>
                                                <td className="px-3 py-2 text-center text-xs">
                                                    {isLocked ? (
                                                        <span className="text-green-600 font-medium">✅ บันทึกแล้ว</span>
                                                    ) : isChanged ? (
                                                        <span className="text-amber-600 font-medium">✏️ แก้ไข</span>
                                                    ) : hasData ? (
                                                        <span className="text-blue-600">ใหม่</span>
                                                    ) : (
                                                        <span className="text-gray-300">—</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </section>
            )}

            {/* ==================== CSV SALES IMPORT ==================== */}
            {view === "salesImport" && (
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">นำเข้ายอดขาย (CSV)</h2>
                        <button onClick={downloadTemplate} className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">
                            📥 ดาวน์โหลด Template
                        </button>
                    </div>

                    {/* Upload Area */}
                    <div className="bg-white rounded-lg shadow p-6 mb-4">
                        <div className="flex items-center gap-4 mb-4">
                            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md text-sm font-medium text-gray-700 transition-colors">
                                📁 เลือกไฟล์ CSV
                                <input type="file" accept=".csv" onChange={handleCsvSelect} className="hidden" />
                            </label>
                            {csvFile && <span className="text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded border">{csvFile.name}</span>}
                            <button
                                onClick={handleCsvImport}
                                disabled={!csvFile || csvImporting}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                            >
                                {csvImporting ? "กำลังนำเข้า..." : "📤 นำเข้าข้อมูล"}
                            </button>
                        </div>

                        {/* Result */}
                        {csvResult && (
                            <div className={`p-3 rounded-md text-sm mb-4 ${csvResult.success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {csvResult.success ? (
                                    <div>
                                        <p>✅ นำเข้าสำเร็จ — <b>{csvResult.imported_rows}</b> รายการ
                                            {csvResult.skipped_rows > 0 && <span className="text-amber-600"> (ข้าม {csvResult.skipped_rows} รายการ)</span>}</p>
                                        {csvResult.created_stores?.length > 0 && (
                                            <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-200 text-blue-700">
                                                <p className="font-medium">🏪 สร้างร้านค้าใหม่อัตโนมัติ {csvResult.created_stores.length} ร้าน:</p>
                                                <ul className="list-disc list-inside mt-1">
                                                    {csvResult.created_stores.map((s: any, i: number) => (
                                                        <li key={i}>{s.name} ({s.platform})</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <p className="font-medium mb-2">❌ {csvResult.error}</p>
                                        {csvResult.unknown_products?.length > 0 && (
                                            <div className="mt-2">
                                                <p className="text-xs font-medium mb-2">รหัสสินค้าที่ไม่พบในระบบ:</p>
                                                <div className="space-y-1.5">
                                                    {csvResult.unknown_products.slice(0, 5).map((item: any, i: number) => (
                                                        <div key={i} className="flex items-start gap-2 bg-white rounded px-3 py-1.5 text-xs border border-red-100">
                                                            <span className="font-mono font-bold text-red-700 whitespace-nowrap">{item.sku}</span>
                                                            <span className="text-gray-500">— บรรทัดที่ {item.line_display} ({item.count} แถว)</span>
                                                        </div>
                                                    ))}
                                                    {csvResult.unknown_products.length > 5 && (
                                                        <p className="text-xs text-red-500 italic mt-1">และยังมีอีก {csvResult.unknown_products.length - 5} รายการ...</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* CSV Preview */}
                        {csvPreview.length > 0 && (
                            <div>
                                <h3 className="text-sm font-medium text-gray-600 mb-2">ตัวอย่างข้อมูล ({csvPreview.length - 1} แถวแรก)</h3>
                                <div className="overflow-x-auto border rounded-md">
                                    <table className="text-xs whitespace-nowrap">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                {csvPreview[0]?.map((h, i) => (
                                                    <th key={i} className="px-2 py-1 text-left font-medium text-gray-600 border-b">{h || `Col${i + 1}`}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {csvPreview.slice(1).map((row, ri) => (
                                                <tr key={ri} className="border-b hover:bg-gray-50">
                                                    {row.map((cell, ci) => (
                                                        <td key={ci} className="px-2 py-1">{cell.length > 30 ? cell.slice(0, 30) + '...' : cell}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Import History */}
                    <div className="bg-white rounded-lg shadow">
                        <div className="px-4 py-3 border-b">
                            <h3 className="font-semibold text-sm">ประวัติการนำเข้า</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-2 text-left">วันที่</th>
                                        <th className="px-3 py-2 text-left">ไฟล์</th>
                                        <th className="px-3 py-2 text-right">นำเข้า</th>
                                        <th className="px-3 py-2 text-right">ข้าม</th>
                                        <th className="px-3 py-2 text-left">ผู้นำเข้า</th>
                                        <th className="px-3 py-2 text-center">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {importBatches.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-6 text-gray-400">ยังไม่มีข้อมูลการนำเข้า</td></tr>
                                    ) : importBatches.map((b: any) => (
                                        <tr key={b.id} className="border-b hover:bg-gray-50">
                                            <td className="px-3 py-2 text-xs text-gray-500">{new Date(b.created_at).toLocaleString('th-TH')}</td>
                                            <td className="px-3 py-2 text-xs">{b.filename}</td>
                                            <td className="px-3 py-2 text-right font-medium text-green-600">{b.imported_rows}</td>
                                            <td className="px-3 py-2 text-right text-amber-600">{b.skipped_rows || 0}</td>
                                            <td className="px-3 py-2 text-xs">{b.first_name} {b.last_name || ''}</td>
                                            <td className="px-3 py-2 text-center">
                                                <button onClick={() => setViewBatchId(viewBatchId === b.id ? null : b.id)} className="text-blue-600 hover:underline text-xs mr-2">
                                                    {viewBatchId === b.id ? 'ซ่อน' : 'ดูรายการ'}
                                                </button>
                                                <button onClick={() => handleDeleteBatch(b)} className="text-red-500 hover:underline text-xs">
                                                    ลบ
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Batch Detail */}
                        {viewBatchId && (
                            <div className="px-4 py-3 border-t bg-blue-50">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold text-blue-800">รายการ Batch #{viewBatchId}</h4>
                                    {batchSummary && (
                                        <div className="flex gap-4 text-xs">
                                            <span>ยอดรวม: <b className="text-green-700">{Number(batchSummary.sum_sales || 0).toLocaleString()}</b> ฿</span>
                                            <span>ออเดอร์: <b>{batchSummary.unique_orders}</b></span>
                                            <span>จัดส่ง: <b className="text-blue-600">{batchSummary.shipped_count}</b></span>
                                            <span>ยกเลิก: <b className="text-red-600">{batchSummary.cancelled_count}</b></span>
                                        </div>
                                    )}
                                </div>
                                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                    <table className="w-full text-xs">
                                        <thead className="bg-white sticky top-0">
                                            <tr>
                                                <th className="px-2 py-1 text-left">รหัส</th>
                                                <th className="px-2 py-1 text-left">สินค้า</th>
                                                <th className="px-2 py-1 text-right">จำนวน</th>
                                                <th className="px-2 py-1 text-right">ราคา</th>
                                                <th className="px-2 py-1 text-left">วันสั่ง</th>
                                                <th className="px-2 py-1 text-left">สถานะ</th>
                                                <th className="px-2 py-1 text-left">เลขพัสดุ</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batchOrders.map((o: any) => (
                                                <tr key={o.id} className={`border-b ${o.order_status === 'ยกเลิกแล้ว' ? 'bg-red-50 text-red-400' : ''}`}>
                                                    <td className="px-2 py-1">{o.product_code}</td>
                                                    <td className="px-2 py-1 max-w-[200px] truncate">{o.product_name}</td>
                                                    <td className="px-2 py-1 text-right">{o.quantity}</td>
                                                    <td className="px-2 py-1 text-right">{Number(o.total_price).toLocaleString()}</td>
                                                    <td className="px-2 py-1">{o.order_date || '-'}</td>
                                                    <td className="px-2 py-1">
                                                        <span className={`px-1.5 py-0.5 rounded text-xs ${o.order_status === 'จัดส่งแล้ว' ? 'bg-green-100 text-green-700' : o.order_status === 'ยกเลิกแล้ว' ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
                                                            {o.order_status || o.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1 text-gray-500">{o.tracking_number || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* ==================== DASHBOARD ==================== */}
            {view === "dashboard" && (
                <section>
                    <h2 className="text-lg font-semibold mb-4">แดชบอร์ด Marketplace</h2>
                    <div className="bg-white rounded-lg shadow p-4 mb-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <div>
                                <label className={labelClass}>วันที่เริ่ม</label>
                                <input type="date" className={inputClass} value={dashDateFrom} onChange={e => setDashDateFrom(e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>วันที่สิ้นสุด</label>
                                <input type="date" className={inputClass} value={dashDateTo} onChange={e => setDashDateTo(e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>ร้านค้า</label>
                                <select className={inputClass} value={dashStoreFilter} onChange={e => setDashStoreFilter(e.target.value)}>
                                    <option value="all">ทุกร้าน</option>
                                    {activeStores.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
                                </select>
                            </div>
                            <button
                                onClick={loadDashboard}
                                disabled={dashLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm h-[42px]"
                            >
                                {dashLoading ? "กำลังโหลด..." : "ค้นหา"}
                            </button>
                        </div>
                    </div>

                    {/* Dashboard Table */}
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-700">
                                <tr>
                                    <th className="px-3 py-2 text-left">ร้านค้า</th>
                                    <th className="px-3 py-2 text-left">แพลตฟอร์ม</th>
                                    <th className="px-3 py-2 text-right">ค่าแอด</th>
                                    <th className="px-3 py-2 text-right bg-blue-50 text-blue-700">ยอดขาย</th>
                                    <th className="px-3 py-2 text-right">ออเดอร์</th>
                                    <th className="px-3 py-2 text-right text-amber-600">ตีกลับ</th>
                                    <th className="px-3 py-2 text-right text-red-600">ยกเลิก</th>
                                    <th className="px-3 py-2 text-right">%Ads</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(() => {
                                    const filtered = dashboardData.filter(row =>
                                        Number(row.ads_cost || 0) > 0 ||
                                        Number(row.total_sales || 0) > 0 ||
                                        Number(row.returns_amount || 0) > 0 ||
                                        Number(row.cancelled_amount || 0) > 0
                                    );
                                    return filtered.length > 0 ? (
                                        <>
                                            {filtered.map((row, i) => {
                                                const pctAds = Number(row.total_sales || 0) > 0
                                                    ? (Number(row.ads_cost) / Number(row.total_sales)) * 100 : 0;
                                                return (
                                                    <tr key={i} className="border-b hover:bg-gray-50">
                                                        <td className="px-3 py-2 font-medium">{row.store_name}</td>
                                                        <td className="px-3 py-2">
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{row.platform}</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right">{fmtNum(row.ads_cost)}</td>
                                                        <td className="px-3 py-2 text-right font-semibold text-blue-700">{fmtNum(row.total_sales)}</td>
                                                        <td className="px-3 py-2 text-right">{Number(row.total_orders || 0).toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right text-amber-600">{fmtNum(row.returns_amount)}</td>
                                                        <td className="px-3 py-2 text-right text-red-600">{fmtNum(row.cancelled_amount)}</td>
                                                        <td className="px-3 py-2 text-right">{pctAds.toFixed(2)}%</td>
                                                    </tr>
                                                );
                                            })}
                                            {/* Summary */}
                                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                                                <td className="px-3 py-2" colSpan={2}>รวมทั้งสิ้น</td>
                                                <td className="px-3 py-2 text-right">{fmtNum(filtered.reduce((a, r) => a + Number(r.ads_cost || 0), 0))}</td>
                                                <td className="px-3 py-2 text-right text-blue-700">
                                                    {fmtNum(filtered.reduce((a, r) => a + Number(r.total_sales || 0), 0))}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {filtered.reduce((a, r) => a + Number(r.total_orders || 0), 0).toLocaleString()}
                                                </td>
                                                <td className="px-3 py-2 text-right text-amber-600">
                                                    {fmtNum(filtered.reduce((a, r) => a + Number(r.returns_amount || 0), 0))}
                                                </td>
                                                <td className="px-3 py-2 text-right text-red-600">
                                                    {fmtNum(filtered.reduce((a, r) => a + Number(r.cancelled_amount || 0), 0))}
                                                </td>
                                                <td className="px-3 py-2 text-right">
                                                    {(() => {
                                                        const totalAds = filtered.reduce((a, r) => a + Number(r.ads_cost || 0), 0);
                                                        const totalSales = filtered.reduce((a, r) => a + Number(r.total_sales || 0), 0);
                                                        return totalSales > 0 ? ((totalAds / totalSales) * 100).toFixed(2) + "%" : "0.00%";
                                                    })()}
                                                </td>
                                            </tr>
                                        </>
                                    ) : (
                                        <tr>
                                            <td colSpan={8} className="text-center py-8 text-gray-500">
                                                {dashboardData.length === 0 ? "กดค้นหาเพื่อดูข้อมูล" : "ไม่พบข้อมูลในช่วงที่เลือก"}
                                            </td>
                                        </tr>
                                    )
                                })()}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
};

export default MarketplacePage;
