import React, { useState, useEffect, useCallback } from "react";
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

    // Ads Input
    const [adsStoreId, setAdsStoreId] = useState<string>("");
    const [adsDate, setAdsDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [adsForm, setAdsForm] = useState({ ads_cost: "", impressions: "", clicks: "" });
    const [adsSaveMsg, setAdsSaveMsg] = useState("");

    // Sales Import
    const [salesStoreId, setSalesStoreId] = useState<string>("");
    const [salesDate, setSalesDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [salesForm, setSalesForm] = useState({ total_sales: "", total_orders: "", returns_amount: "", cancelled_amount: "" });
    const [salesSaveMsg, setSalesSaveMsg] = useState("");

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

    const handleDeleteStore = async (id: number) => {
        if (!confirm("ต้องการลบร้านค้านี้?")) return;
        try {
            await apiFetch(`Marketplace/stores_delete.php`, {
                method: "POST",
                body: JSON.stringify({ id, company_id: companyId }),
            });
            loadStores();
        } catch (e) { alert("Error deleting store"); }
    };

    // ==================== ADS INPUT ====================
    const handleSaveAds = async () => {
        if (!adsStoreId || !adsDate) {
            alert("กรุณาเลือกร้านค้าและวันที่");
            return;
        }
        try {
            const json = await apiFetch(`Marketplace/ads_log_upsert.php`, {
                method: "POST",
                body: JSON.stringify({
                    store_id: adsStoreId,
                    date: adsDate,
                    ads_cost: adsForm.ads_cost || 0,
                    impressions: adsForm.impressions || 0,
                    clicks: adsForm.clicks || 0,
                    user_id: currentUser?.id,
                }),
            });
            if (json.success) {
                setAdsSaveMsg("✅ บันทึกเรียบร้อย");
                setTimeout(() => setAdsSaveMsg(""), 3000);
            } else {
                alert(json.error || "Error");
            }
        } catch (e) { alert("Error saving ads"); }
    };

    // Load existing ads data when store/date changes
    useEffect(() => {
        if (!adsStoreId || !adsDate || view !== "adsInput") return;
        (async () => {
            try {
                const json = await apiFetch(`Marketplace/ads_log_list.php?store_id=${adsStoreId}&date_from=${adsDate}&date_to=${adsDate}`);
                if (json.success && json.data?.length > 0) {
                    const row = json.data[0];
                    setAdsForm({
                        ads_cost: String(row.ads_cost || ""),
                        impressions: String(row.impressions || ""),
                        clicks: String(row.clicks || ""),
                    });
                } else {
                    setAdsForm({ ads_cost: "", impressions: "", clicks: "" });
                }
            } catch (e) { /* ignore */ }
        })();
    }, [adsStoreId, adsDate, view]);

    // ==================== SALES IMPORT ====================
    const handleSaveSales = async () => {
        if (!salesStoreId || !salesDate) {
            alert("กรุณาเลือกร้านค้าและวันที่");
            return;
        }
        try {
            const json = await apiFetch(`Marketplace/sales_import_upsert.php`, {
                method: "POST",
                body: JSON.stringify({
                    store_id: salesStoreId,
                    date: salesDate,
                    total_sales: salesForm.total_sales || 0,
                    total_orders: salesForm.total_orders || 0,
                    returns_amount: salesForm.returns_amount || 0,
                    cancelled_amount: salesForm.cancelled_amount || 0,
                    user_id: currentUser?.id,
                }),
            });
            if (json.success) {
                setSalesSaveMsg("✅ บันทึกเรียบร้อย");
                setTimeout(() => setSalesSaveMsg(""), 3000);
            } else {
                alert(json.error || "Error");
            }
        } catch (e) { alert("Error saving sales"); }
    };

    // Load existing sales data
    useEffect(() => {
        if (!salesStoreId || !salesDate || view !== "salesImport") return;
        (async () => {
            try {
                const json = await apiFetch(`Marketplace/sales_import_list.php?store_id=${salesStoreId}&date_from=${salesDate}&date_to=${salesDate}`);
                if (json.success && json.data?.length > 0) {
                    const row = json.data[0];
                    setSalesForm({
                        total_sales: String(row.total_sales || ""),
                        total_orders: String(row.total_orders || ""),
                        returns_amount: String(row.returns_amount || ""),
                        cancelled_amount: String(row.cancelled_amount || ""),
                    });
                } else {
                    setSalesForm({ total_sales: "", total_orders: "", returns_amount: "", cancelled_amount: "" });
                }
            } catch (e) { /* ignore */ }
        })();
    }, [salesStoreId, salesDate, view]);

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

    const activeStores = stores.filter(s => s.active);
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
                                            checked={storeForm.active === 1}
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
                                                    setStoreForm(s);
                                                    setEditingStoreId(s.id);
                                                    setShowStoreForm(true);
                                                }}
                                                className="text-blue-600 hover:underline text-xs mr-3"
                                            >
                                                แก้ไข
                                            </button>
                                            <button
                                                onClick={() => handleDeleteStore(s.id)}
                                                className="text-red-600 hover:underline text-xs"
                                            >
                                                ลบ
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ==================== ADS INPUT ==================== */}
            {view === "adsInput" && (
                <section>
                    <h2 className="text-lg font-semibold mb-4">กรอกค่า Ads (Marketplace)</h2>
                    <div className="bg-white rounded-lg shadow p-6 max-w-xl">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className={labelClass}>ร้านค้า *</label>
                                <select className={inputClass} value={adsStoreId} onChange={e => setAdsStoreId(e.target.value)}>
                                    <option value="">เลือกร้านค้า...</option>
                                    {activeStores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.platform})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>วันที่ *</label>
                                <input type="date" className={inputClass} value={adsDate} onChange={e => setAdsDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div>
                                <label className={labelClass}>ค่าแอด</label>
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={adsForm.ads_cost}
                                    onChange={e => setAdsForm(p => ({ ...p, ads_cost: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Impressions</label>
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={adsForm.impressions}
                                    onChange={e => setAdsForm(p => ({ ...p, impressions: e.target.value }))}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Clicks</label>
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={adsForm.clicks}
                                    onChange={e => setAdsForm(p => ({ ...p, clicks: e.target.value }))}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveAds}
                                disabled={!adsStoreId || !adsDate}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                            >
                                บันทึก
                            </button>
                            {adsSaveMsg && <span className="text-green-600 text-sm">{adsSaveMsg}</span>}
                        </div>
                    </div>
                </section>
            )}

            {/* ==================== SALES IMPORT ==================== */}
            {view === "salesImport" && (
                <section>
                    <h2 className="text-lg font-semibold mb-4">นำเข้ายอดขาย (Marketplace)</h2>
                    <div className="bg-white rounded-lg shadow p-6 max-w-xl">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className={labelClass}>ร้านค้า *</label>
                                <select className={inputClass} value={salesStoreId} onChange={e => setSalesStoreId(e.target.value)}>
                                    <option value="">เลือกร้านค้า...</option>
                                    {activeStores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.platform})</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelClass}>วันที่ *</label>
                                <input type="date" className={inputClass} value={salesDate} onChange={e => setSalesDate(e.target.value)} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className={labelClass}>ยอดขาย</label>
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={salesForm.total_sales}
                                    onChange={e => setSalesForm(p => ({ ...p, total_sales: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>จำนวนออเดอร์</label>
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={salesForm.total_orders}
                                    onChange={e => setSalesForm(p => ({ ...p, total_orders: e.target.value }))}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>ตีกลับ</label>
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={salesForm.returns_amount}
                                    onChange={e => setSalesForm(p => ({ ...p, returns_amount: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>ยกเลิก</label>
                                <input
                                    type="number"
                                    className={inputClass}
                                    value={salesForm.cancelled_amount}
                                    onChange={e => setSalesForm(p => ({ ...p, cancelled_amount: e.target.value }))}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveSales}
                                disabled={!salesStoreId || !salesDate}
                                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm"
                            >
                                บันทึก
                            </button>
                            {salesSaveMsg && <span className="text-green-600 text-sm">{salesSaveMsg}</span>}
                        </div>
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
