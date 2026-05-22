import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiFetch } from "../services/api";
import { Download, Calendar, BarChart2, DollarSign, Package, Settings, FileText, Upload } from "lucide-react";
import ExportTypeModal from '../components/ExportTypeModal';
import { downloadDataFile } from '../utils/exportUtils';
import APP_BASE_PATH from '../appBasePath';

import MarketplaceDashboard from "./Marketplace/MarketplaceDashboard";
import MarketplaceSalesData from "./Marketplace/MarketplaceSalesData";
import MarketplaceInvoices from "./Marketplace/MarketplaceInvoices";
import { useToast } from "../components/Toast";

interface MarketplacePageProps {
    currentUser: any;
    view: "dashboard" | "adsInput" | "salesImport" | "settings" | "invoices";
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

const PLATFORMS = ["Shopee", "Lazada", "TikTok Shop", "LINE MyShop", "Facebook Shop", "อื่นๆ"];

const MarketplacePage: React.FC<MarketplacePageProps> = ({ currentUser, view }) => {
    const toast = useToast();
    // Internal Tab State (Synced with Sidebar View initially, but allows internal navigation)
    const [activeTab, setActiveTab] = useState<string>("dashboard");

    useEffect(() => {
        if (view === "dashboard") setActiveTab("dashboard");
        if (view === "adsInput") setActiveTab("adsInput");
        if (view === "salesImport") setActiveTab("salesData");
        if (view === "settings") setActiveTab("settings");
        if (view === "invoices") setActiveTab("invoices");
    }, [view]);

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
    const [adsCsvImporting, setAdsCsvImporting] = useState(false);

    // CSV Sales Import
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [csvPreview, setCsvPreview] = useState<string[][]>([]);
    const [csvImporting, setCsvImporting] = useState(false);
    const [csvResult, setCsvResult] = useState<any>(null);

    // JST Sales Import
    const [jstFile, setJstFile] = useState<File | null>(null);
    const [jstImporting, setJstImporting] = useState(false);

    const [importBatches, setImportBatches] = useState<any[]>([]);
    const [viewBatchId, setViewBatchId] = useState<number | null>(null);
    const [batchOrders, setBatchOrders] = useState<any[]>([]);
    const [batchSummary, setBatchSummary] = useState<any>(null);

    const companyId = currentUser?.company_id || currentUser?.companyId;

    // Load stores
    const loadStores = useCallback(async () => {
        try {
            const json = await apiFetch(`Marketplace/stores_list.php?company_id=${companyId}&active_only=false`);
            if (json && json.success) setStores(json.data || []);
        } catch (e) { console.error("Load stores error", e); }
    }, [companyId]);

    // Load users
    const loadUsers = useCallback(async () => {
        try {
            const json = await apiFetch(`Marketplace/users_list.php?company_id=${companyId}`);
            if (json && json.success) setUsers(json.data || []);
        } catch (e) { console.error("Load users error", e); }
    }, [companyId]);

    useEffect(() => { loadStores(); loadUsers(); }, [loadStores, loadUsers]);

    // ==================== SETTINGS VIEW ====================
    const handleSaveStore = async () => {
        if (!storeForm.name || !storeForm.platform) {
            toast.warning("กรุณากรอกชื่อร้านค้าและแพลตฟอร์ม");
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
            if (json && json.success) {
                setShowStoreForm(false);
                setStoreForm({});
                setEditingStoreId(null);
                loadStores();
            } else {
                toast.warning(json.error || "Error saving store");
            }
        } catch (e) { toast.warning("Error saving store"); }
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
            if (json && json.success) loadStores();
            else toast.warning(json?.error || "Error");
        } catch (e: any) { toast.warning(e?.message || "Error toggling store"); }
    };

    const activeStores = useMemo(() => stores.filter(s => s.active), [stores]);

    const adsActiveStores = useMemo(() => {
        const roleStr = String(currentUser?.role || '').toLowerCase();
        const isSysAdmin = currentUser?.is_system === 1 || currentUser?.is_system === true || currentUser?.isSystem || 
                           roleStr === 'super admin' || roleStr === 'admin control' || roleStr === 'ceo';

        if (isSysAdmin) {
            return activeStores;
        }

        const myId = String(currentUser?.id);
        return activeStores.filter(s => {
            if (!s.manager_user_id) return false;
            const managerIds = String(s.manager_user_id).split(',').map(id => id.trim());
            return managerIds.includes(myId);
        });
    }, [activeStores, currentUser]);

    // ==================== ADS INPUT (V2 Style) ====================
    const loadAdsData = useCallback(async () => {
        if (!adsDate || adsActiveStores.length === 0) { setAdsRows([]); setAdsOriginalRows([]); return; }
        setAdsLoadingData(true);
        setAdsSaveResult(null);
        try {
            const json = await apiFetch(`Marketplace/ads_log_list.php?date_from=${adsDate}&date_to=${adsDate}&company_id=${companyId}`);
            const existingLogs: any[] = json.success && Array.isArray(json.data) ? json.data : [];
            const logsMap = new Map<number, any>();
            for (const log of existingLogs) logsMap.set(Number(log.store_id), log);

            const newRows = adsActiveStores.map(s => {
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
    }, [adsDate, adsActiveStores, companyId]);

    useEffect(() => {
        if (activeTab === 'adsInput') loadAdsData();
    }, [activeTab, adsDate, loadAdsData]);

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
            if (json && json.success) {
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

    const parseDateStr = (dateStr: string) => {
        if (!dateStr) return null;
        dateStr = dateStr.trim();
        if (!isNaN(Number(dateStr))) {
            const serial = parseFloat(dateStr);
            if (serial < 1) return null;
            const date = new Date((serial - 25569) * 86400 * 1000);
            return date.toISOString().split('T')[0];
        }
        
        const parts = dateStr.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }
        const time = Date.parse(dateStr);
        if (!isNaN(time)) {
            return new Date(time).toISOString().split('T')[0];
        }
        return null;
    };

    const handleAdsCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAdsCsvImporting(true);
        setAdsSaveResult(null);

        const reader = new FileReader();
        reader.onload = async (ev) => {
            try {
                let text = ev.target?.result as string;
                if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);
                const lines = text.split(/\r?\n/).filter(l => l.trim());
                if (lines.length <= 1) throw new Error("ไฟล์ CSV ว่างเปล่าหรือไม่มีข้อมูล");

                const recordsMap = new Map<string, any>();
                const errors: string[] = [];

                for (let i = 1; i < lines.length; i++) {
                    const l = lines[i];
                    const cols: string[] = [];
                    let inQuote = false, cur = '';
                    for (const ch of l) {
                        if (ch === '"') { inQuote = !inQuote; }
                        else if (ch === ',' && !inQuote) { cols.push(cur); cur = ''; }
                        else cur += ch;
                    }
                    cols.push(cur);

                    if (cols.length < 3) continue;

                    const dateStr = cols[0];
                    const storeName = cols[1]?.trim();
                    const adsCostStr = cols[2]?.replace(/,/g, '');
                    const impressionsStr = cols[3]?.replace(/,/g, '') || '0';
                    const clicksStr = cols[4]?.replace(/,/g, '') || '0';

                    const parsedDate = parseDateStr(dateStr);
                    if (!parsedDate) {
                        errors.push(`บรรทัด ${i+1}: รูปแบบวันที่ไม่ถูกต้อง (${dateStr})`);
                        continue;
                    }

                    const store = adsActiveStores.find(s => s.name.toLowerCase() === storeName.toLowerCase());
                    if (!store) {
                        errors.push(`บรรทัด ${i+1}: ไม่พบร้านค้าชื่อ "${storeName}" ในระบบ (หรือคุณไม่มีสิทธิ์เข้าถึง)`);
                        continue;
                    }

                    const adsCost = parseFloat(adsCostStr) || 0;
                    const impressions = parseInt(impressionsStr) || 0;
                    const clicks = parseInt(clicksStr) || 0;

                    const key = `${store.id}_${parsedDate}`;
                    if (recordsMap.has(key)) {
                        const existing = recordsMap.get(key);
                        existing.ads_cost += adsCost;
                        existing.impressions += impressions;
                        existing.clicks += clicks;
                    } else {
                        recordsMap.set(key, {
                            store_id: store.id,
                            date: parsedDate,
                            user_id: currentUser?.id,
                            ads_cost: adsCost,
                            impressions: impressions,
                            clicks: clicks
                        });
                    }
                }

                const parsedRecords = Array.from(recordsMap.values());

                if (parsedRecords.length === 0) {
                    throw new Error("ไม่มีข้อมูลที่สามารถนำเข้าได้\\n" + errors.join('\\n'));
                }

                const json = await apiFetch('Marketplace/ads_log_upsert.php', {
                    method: 'POST', body: JSON.stringify({ records: parsedRecords }),
                });

                if (json && json.success) {
                    const d = json.data || {};
                    let msg = `นำเข้าสำเร็จ! (เพิ่มใหม่ ${d.inserted || 0}, อัปเดต ${d.updated || 0})`;
                    if (errors.length > 0) msg += `\n* มีบางรายการถูกข้ามไป:\n` + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '\n...' : '');
                    setAdsSaveResult({ type: 'success', text: msg });
                    await loadAdsData();
                } else {
                    setAdsSaveResult({ type: 'error', text: json.error || 'เกิดข้อผิดพลาดในการบันทึก' });
                }
            } catch (err: any) {
                setAdsSaveResult({ type: 'error', text: err?.message || 'Error parsing CSV' });
            } finally {
                setAdsCsvImporting(false);
                e.target.value = '';
            }
        };
        reader.readAsText(file, 'utf-8');
    };

    // ==================== CSV SALES IMPORT ====================
    const handleCsvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setCsvFile(file);
        setCsvResult(null);
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
            if (json && json.success) { loadImportBatches(); loadStores(); setCsvFile(null); setCsvPreview([]); }
        } catch (e: any) {
            setCsvResult({ success: false, error: e?.message || 'Error' });
        } finally { setCsvImporting(false); }
    };

    const handleJstSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setJstFile(file);
        setCsvResult(null);
    };

    const handleJstImport = async () => {
        if (!jstFile) return;
        setJstImporting(true);
        setCsvResult(null);
        try {
            const formData = new FormData();
            formData.append('jst_file', jstFile);
            formData.append('company_id', String(companyId));
            formData.append('user_id', String(currentUser?.id));

            const res = await apiFetch(`Marketplace/sales_jst_import.php`, {
                method: 'POST',
                body: formData
            });

            setCsvResult(res);
            if (res && res.success) {
                loadImportBatches(); 
                loadStores(); 
                setJstFile(null);
            }
        } catch (e: any) {
            setCsvResult({ success: false, error: e?.message || 'Error uploading JST file' });
        } finally {
            setJstImporting(false);
        }
    };

    const loadImportBatches = useCallback(async () => {
        try {
            const json = await apiFetch(`Marketplace/import_batches_list.php?company_id=${companyId}`);
            if (json && json.success) setImportBatches(json.data || []);
        } catch (e) { /* ignore */ }
    }, [companyId]);

    const loadBatchOrders = useCallback(async (batchId: number) => {
        try {
            const json = await apiFetch(`Marketplace/sales_orders_list.php?batch_id=${batchId}&company_id=${companyId}&limit=200`);
            if (json && json.success) { setBatchOrders(json.data || []); setBatchSummary(json.summary || null); }
        } catch (e) { /* ignore */ }
    }, [companyId]);

    const handleDeleteBatch = async (batch: any) => {
        if (!confirm(`ต้องการลบ Batch "${batch.filename}" (${batch.imported_rows} รายการ)? ข้อมูลจะถูกลบทั้งหมดและไม่สามารถกู้คืนได้`)) return;
        try {
            const json = await apiFetch(`Marketplace/import_batch_delete.php`, {
                method: 'POST',
                body: JSON.stringify({ batch_id: batch.id, company_id: companyId }),
            });
            if (json && json.success) {
                if (viewBatchId === batch.id) { setViewBatchId(null); setBatchOrders([]); setBatchSummary(null); }
                loadImportBatches();
            } else { toast.warning(json.error || 'Error'); }
        } catch (e: any) { toast.warning(e?.message || 'Error deleting batch'); }
    };

    useEffect(() => {
        if (activeTab === 'salesData') loadImportBatches();
    }, [activeTab, loadImportBatches]);

    useEffect(() => {
        if (viewBatchId) loadBatchOrders(viewBatchId);
    }, [viewBatchId, loadBatchOrders]);

    const downloadCsvTemplate = () => {
        window.open(`${window.location.origin}${APP_BASE_PATH}api/Marketplace/sales_csv_template.php`, '_blank');
    };

    const filteredUsers = users.filter((u: any) => {
        const rid = Number(u.role_id || 0);
        const isSys = u.isSystem || u.is_system;
        return rid === 5 || isSys === true || isSys === 1 || isSys === '1';
    });
    const labelClass = "block text-sm font-medium text-gray-600 mb-1";
    const inputClass = "w-full border border-gray-300 rounded-md p-2 text-sm h-[42px]";

    // Navigation Tabs
    const TABS = [
        { id: 'dashboard', label: 'Dashboard', icon: <BarChart2 size={16}/> },
        { id: 'salesData', label: 'ยอดขาย (Sales Data)', icon: <Package size={16}/> },
        { id: 'adsInput', label: 'ค่าโฆษณา (Ads)', icon: <DollarSign size={16}/> },
        { id: 'invoices', label: 'สลิป / การเงิน (Invoices)', icon: <FileText size={16}/> },
        { id: 'settings', label: 'ตั้งค่าร้านค้า (Settings)', icon: <Settings size={16}/> }
    ];

    return (
        <div className="p-4 sm:p-6 w-full max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Marketplace Analytics</h1>

            {/* Sub-navigation Tabs */}
            <div className="flex space-x-1 border-b border-gray-200 mb-6 overflow-x-auto">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                            activeTab === tab.id 
                            ? 'border-blue-600 text-blue-600 bg-blue-50/50' 
                            : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Contents */}
            
            {activeTab === "dashboard" && (
                <MarketplaceDashboard companyId={companyId} activeStores={activeStores} />
            )}

            {activeTab === "salesData" && (
                <MarketplaceSalesData 
                    companyId={companyId} currentUser={currentUser} activeStores={activeStores}
                    csvFile={csvFile} jstFile={jstFile} csvPreview={csvPreview}
                    csvImporting={csvImporting} jstImporting={jstImporting} csvResult={csvResult}
                    handleCsvSelect={handleCsvSelect} handleCsvImport={handleCsvImport}
                    handleJstSelect={handleJstSelect} handleJstImport={handleJstImport}
                    importBatches={importBatches} viewBatchId={viewBatchId} setViewBatchId={setViewBatchId}
                    batchOrders={batchOrders} batchSummary={batchSummary} handleDeleteBatch={handleDeleteBatch}
                    downloadTemplate={downloadCsvTemplate}
                />
            )}

            {activeTab === "invoices" && (
                <MarketplaceInvoices companyId={companyId} currentUser={currentUser} activeStores={activeStores} />
            )}

            {/* ==================== ADS INPUT (V2 Style) ==================== */}
            {activeTab === "adsInput" && (
                <div className="bg-white rounded-lg shadow min-h-[500px]">
                    <div className="px-5 py-4 border-b flex flex-wrap gap-4 items-center justify-between bg-gray-50 rounded-t-lg">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">บันทึกค่าโฆษณารายวัน</h2>
                            <p className="text-xs text-gray-500">กรอกค่าโฆษณาแยกตามร้านค้า (ต้องเลือกวันที่ก่อน)</p>
                        </div>
                        <div className="mt-6 flex flex-wrap gap-2 items-center">
                            <button onClick={() => window.open(`${window.location.origin}${APP_BASE_PATH}api/Marketplace/ads_csv_template.php`, '_blank')} className="flex items-center gap-1 px-3 py-2 border border-gray-300 text-gray-700 bg-white rounded-md hover:bg-gray-50 text-sm font-medium shadow-sm transition-colors">
                                <Download size={16} /> โหลด Template
                            </button>
                            <label 
                                className={`flex items-center gap-1 px-3 py-2 text-white rounded-md text-sm font-medium shadow-sm whitespace-nowrap transition-colors ${adsCsvImporting || adsActiveStores.length === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 cursor-pointer'}`}
                                title={adsActiveStores.length === 0 ? "ต้องมีการตั้งค่าร้านค้าก่อนถึงจะสามารถนำเข้าค่าโฆษณาได้" : ""}
                            >
                                <Upload size={14} />
                                {adsCsvImporting ? "กำลังนำเข้า..." : "Import CSV"}
                                <input type="file" accept=".csv" className="hidden" onChange={handleAdsCsvImport} disabled={adsCsvImporting || adsActiveStores.length === 0} />
                            </label>
                            <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>
                            <input type="date" className="border rounded-md px-3 py-2 text-sm" value={adsDate} onChange={e => setAdsDate(e.target.value)} />
                            <button onClick={handleAdsSaveAll} disabled={adsSaving || adsRows.length === 0} className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 text-sm font-medium shadow-sm">
                                {adsSaving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                            </button>
                        </div>
                    </div>

                    {adsSaveResult && (
                        <div className={`mx-5 mt-4 p-3 rounded-md text-sm ${adsSaveResult.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {adsSaveResult.text}
                        </div>
                    )}

                    <div className="p-5">
                        {!adsDate ? (
                            <div className="text-center py-12 border-2 border-dashed rounded-lg text-gray-400 bg-gray-50">
                                <Calendar className="mx-auto mb-2 opacity-50" size={32} />
                                <p>กรุณาเลือกวันที่ เพื่อแสดงรายการร้านค้า</p>
                            </div>
                        ) : adsLoadingData ? (
                            <div className="text-center py-10 text-gray-500">กำลังโหลดข้อมูล...</div>
                        ) : adsActiveStores.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">คุณไม่มีสิทธิ์เข้าถึงร้านค้าใดๆ หรือยังไม่มีร้านค้าเปิดใช้งาน</div>
                        ) : (
                            <div className="overflow-x-auto border rounded">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100 border-b">
                                        <tr>
                                            <th className="px-4 py-3">ร้านค้า</th>
                                            <th className="px-4 py-3">แพลตฟอร์ม</th>
                                            <th className="px-4 py-3 text-right">ค่าโฆษณา (฿)</th>
                                            <th className="px-4 py-3 text-right text-gray-400 font-normal text-xs">ข้อมูลล่าสุด</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {adsRows.map((r, i) => {
                                            const orig = adsOriginalRows[i]?.adsCost;
                                            const changed = r.adsCost !== orig;
                                            return (
                                                <tr key={r.storeId} className={`border-b hover:bg-gray-50 transition-colors ${changed ? 'bg-yellow-50/30' : ''}`}>
                                                    <td className="px-4 py-3 font-medium text-gray-800">{r.storeName}</td>
                                                    <td className="px-4 py-3 text-gray-600">{r.platform}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            step="0.01" 
                                                            className={`border rounded px-3 py-1.5 w-32 text-right transition-all ${changed ? 'border-yellow-400 bg-yellow-50 focus:ring-yellow-400' : 'focus:ring-blue-500'}`} 
                                                            placeholder="0.00" 
                                                            value={r.adsCost} 
                                                            onChange={e => handleAdsChange(i, 'adsCost', e.target.value)} 
                                                        />
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-xs text-gray-400">
                                                        {r.existingId ? <span className="text-green-600">บันทึกแล้ว ({r.lastUser})</span> : <span className="text-gray-300">-</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ==================== SETTINGS ==================== */}
            {activeTab === "settings" && (
                <div className="bg-white rounded-lg shadow min-h-[500px]">
                    <div className="px-5 py-4 border-b flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">จัดการร้านค้า (Stores)</h2>
                            <p className="text-xs text-gray-500">เพิ่ม แก้ไข หรือปิดการใช้งานร้านค้าแต่ละแพลตฟอร์ม</p>
                        </div>
                        <button onClick={() => { setStoreForm({ active: 1 }); setEditingStoreId(null); setShowStoreForm(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
                            + เพิ่มร้านค้า
                        </button>
                    </div>

                    {showStoreForm && (
                        <div className="p-5 border-b bg-gray-50">
                            <h3 className="font-semibold mb-4 text-gray-700">{editingStoreId ? 'แก้ไขร้านค้า' : 'เพิ่มร้านค้าใหม่'}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className={labelClass}>ชื่อร้านค้า *</label>
                                    <input type="text" className={inputClass} value={storeForm.name || ''} onChange={e => setStoreForm({ ...storeForm, name: e.target.value })} placeholder="เช่น Shopee Shop 1" />
                                </div>
                                <div>
                                    <label className={labelClass}>แพลตฟอร์ม *</label>
                                    <select className={inputClass} value={storeForm.platform || ''} onChange={e => setStoreForm({ ...storeForm, platform: e.target.value })}>
                                        <option value="">เลือก...</option>
                                        {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>URL (ตัวเลือก)</label>
                                    <input type="text" className={inputClass} value={storeForm.url || ''} onChange={e => setStoreForm({ ...storeForm, url: e.target.value })} placeholder="https://..." />
                                </div>
                                <div>
                                    <label className={labelClass}>ผู้ดูแล (แอดมิน)</label>
                                    <select className={inputClass} value={storeForm.manager_user_id || ''} onChange={e => setStoreForm({ ...storeForm, manager_user_id: e.target.value })}>
                                        <option value="">-- ไม่ระบุ --</option>
                                        {filteredUsers.map((u: any) => (
                                            <option key={u.id || u.user_id} value={u.id || u.user_id}>{u.first_name} {u.last_name || ''}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={handleSaveStore} className="px-5 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm">บันทึก</button>
                                <button onClick={() => setShowStoreForm(false)} className="px-5 py-2 border rounded-md hover:bg-gray-100 text-sm">ยกเลิก</button>
                            </div>
                        </div>
                    )}

                    <div className="p-5">
                        <div className="overflow-x-auto border rounded">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-100 border-b">
                                    <tr>
                                        <th className="px-4 py-3">ID</th>
                                        <th className="px-4 py-3">ชื่อร้านค้า</th>
                                        <th className="px-4 py-3">แพลตฟอร์ม</th>
                                        <th className="px-4 py-3">แอดมินดูแล</th>
                                        <th className="px-4 py-3 text-center">สถานะ</th>
                                        <th className="px-4 py-3 text-center">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stores.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-6 text-gray-500">ยังไม่มีข้อมูลร้านค้า</td></tr>
                                    ) : stores.map(s => (
                                        <tr key={s.id} className={`border-b hover:bg-gray-50 ${!Number(s.active) ? 'bg-gray-50 opacity-60' : ''}`}>
                                            <td className="px-4 py-3 text-gray-500">#{s.id}</td>
                                            <td className="px-4 py-3 font-medium text-gray-800">
                                                {s.name}
                                                {s.url && <a href={s.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-500 hover:underline">Link</a>}
                                            </td>
                                            <td className="px-4 py-3"><span className="bg-gray-200 px-2 py-1 rounded text-xs">{s.platform}</span></td>
                                            <td className="px-4 py-3 text-gray-600">{s.manager_name || '-'}</td>
                                            <td className="px-4 py-3 text-center">
                                                {Number(s.active) === 1 ? <span className="text-green-600 font-medium">เปิดใช้งาน</span> : <span className="text-red-500">ปิดใช้งาน</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => { setStoreForm(s); setEditingStoreId(s.id); setShowStoreForm(true); }} className="text-blue-600 hover:text-blue-800 mr-4 font-medium">แก้ไข</button>
                                                <button onClick={() => handleToggleStoreActive(s)} className={`font-medium ${Number(s.active) === 1 ? 'text-orange-500 hover:text-orange-700' : 'text-green-600 hover:text-green-800'}`}>
                                                    {Number(s.active) === 1 ? 'ปิด' : 'เปิด'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MarketplacePage;
