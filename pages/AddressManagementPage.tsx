import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2, MapPin, ChevronDown, Globe, Map, Building2, Home } from 'lucide-react';
import APP_BASE_PATH from '../appBasePath';

// ─── Types ────────────────────────────────────────────
interface Geography { id: number; name: string; child_count?: number; }
interface Province { id: number; name_th: string; name_en: string; geography_id: number; child_count?: number; }
interface District { id: number; name_th: string; name_en: string; province_id: number; child_count?: number; }
interface SubDistrict { id: number; name_th: string; name_en: string; zip_code: string; district_id: number; }

type TabKey = 'geographies' | 'provinces' | 'districts' | 'sub_districts';

const API_BASE = `${APP_BASE_PATH}api/Address_DB/get_address_data.php`;

// ─── API Helpers ──────────────────────────────────────
async function apiFetch(endpoint: string, id?: string | number) {
    const params = new URLSearchParams({ endpoint, limit: '5000' });
    if (id !== undefined) params.set('id', String(id));
    const res = await fetch(`${API_BASE}?${params}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'API Error');
    return json.data;
}

async function apiPost(endpoint: string, body: Record<string, unknown>) {
    const res = await fetch(`${API_BASE}?endpoint=${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'API Error');
    return json;
}

// ─── Shared Components ────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onCancel }: {
    open: boolean; title: string; message: string;
    onConfirm: () => void; onCancel: () => void;
}) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
                <p className="text-gray-600 text-sm mb-5">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">ยกเลิก</button>
                    <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600">ลบ</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────
export default function AddressManagementPage() {
    const [activeTab, setActiveTab] = useState<TabKey>('geographies');
    const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
        { key: 'geographies', label: 'ภาค', icon: Globe },
        { key: 'provinces', label: 'จังหวัด', icon: Map },
        { key: 'districts', label: 'อำเภอ/เขต', icon: Building2 },
        { key: 'sub_districts', label: 'ตำบล/แขวง', icon: Home },
    ];

    return (
        <div className="p-4 md:p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
                    <MapPin size={22} />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-800">จัดการข้อมูลที่อยู่</h1>
                    <p className="text-xs text-gray-500">เพิ่ม แก้ไข ลบ ข้อมูลภาค จังหวัด อำเภอ ตำบล</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {tabs.map(t => {
                    const Icon = t.icon;
                    const isActive = activeTab === t.key;
                    return (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center
                ${isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-white/50'}`}>
                            <Icon size={15} />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'geographies' && <GeographiesTab />}
            {activeTab === 'provinces' && <ProvincesTab />}
            {activeTab === 'districts' && <DistrictsTab />}
            {activeTab === 'sub_districts' && <SubDistrictsTab />}
        </div>
    );
}

// ─── Geographies Tab ──────────────────────────────────
function GeographiesTab() {
    const [items, setItems] = useState<Geography[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editItem, setEditItem] = useState<Geography | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [formName, setFormName] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try { setItems(await apiFetch('geographies')); } catch { }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = items.filter(i => i.name.includes(search));

    const handleSave = async () => {
        if (!formName.trim()) return;
        setSaving(true);
        try {
            if (editItem) {
                await apiPost('update_geography', { id: editItem.id, name: formName.trim() });
            } else {
                await apiPost('add_geography', { name: formName.trim() });
            }
            setShowAdd(false); setEditItem(null); setFormName('');
            await load();
        } catch (e: any) { alert(e.message); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (deleteId === null) return;
        try {
            await apiPost('delete_geography', { id: deleteId });
            setDeleteId(null);
            await load();
        } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาภาค..."
                        className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                </div>
                <button onClick={() => { setShowAdd(true); setEditItem(null); setFormName(''); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm">
                    <Plus size={15} /> เพิ่มภาค
                </button>
            </div>

            {/* Add/Edit Form */}
            {(showAdd || editItem) && (
                <div className="p-4 bg-emerald-50/50 border-b border-emerald-100">
                    <div className="flex items-center gap-3">
                        <input autoFocus value={formName} onChange={e => setFormName(e.target.value)} placeholder="ชื่อภาค"
                            className="flex-1 max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                            onKeyDown={e => e.key === 'Enter' && handleSave()} />
                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : editItem ? 'บันทึก' : 'เพิ่ม'}
                        </button>
                        <button onClick={() => { setShowAdd(false); setEditItem(null); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">ยกเลิก</button>
                    </div>
                </div>
            )}

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 size={24} className="animate-spin mr-2" /> กำลังโหลด...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-gray-600 text-left">
                            <th className="px-4 py-3 font-medium w-20">ID</th>
                            <th className="px-4 py-3 font-medium">ชื่อภาค</th>
                            <th className="px-4 py-3 font-medium w-32 text-center">จังหวัด</th>
                            <th className="px-4 py-3 font-medium w-28 text-right">จัดการ</th>
                        </tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>
                            ) : filtered.map(g => (
                                <tr key={g.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-4 py-3 text-gray-500">{g.id}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{g.name}</td>
                                    <td className="px-4 py-3 text-center">
                                        {(g.child_count ?? 0) > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                {g.child_count} จังหวัด
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => { setEditItem(g); setFormName(g.name); setShowAdd(false); }} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg mr-1"><Pencil size={14} /></button>
                                        <button onClick={() => setDeleteId(g.id)} disabled={(g.child_count ?? 0) > 0}
                                            title={(g.child_count ?? 0) > 0 ? `ไม่สามารถลบได้ (มี ${g.child_count} จังหวัด)` : 'ลบ'}
                                            className={`p-1.5 rounded-lg ${(g.child_count ?? 0) > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <ConfirmDialog open={deleteId !== null} title="ยืนยันการลบ" message="คุณต้องการลบภาคนี้หรือไม่?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
        </div>
    );
}

// ─── Provinces Tab ────────────────────────────────────
function ProvincesTab() {
    const [geographies, setGeographies] = useState<Geography[]>([]);
    const [items, setItems] = useState<Province[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterGeo, setFilterGeo] = useState('');
    const [editItem, setEditItem] = useState<Province | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [formNameTh, setFormNameTh] = useState('');
    const [formNameEn, setFormNameEn] = useState('');
    const [formGeoId, setFormGeoId] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    const loadGeos = useCallback(async () => {
        try { setGeographies(await apiFetch('geographies')); } catch { }
    }, []);

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const data = filterGeo ? await apiFetch('provinces', filterGeo) : await apiFetch('provinces');
            setItems(data);
        } catch { }
        setLoading(false);
    }, [filterGeo]);

    useEffect(() => { loadGeos(); }, [loadGeos]);
    useEffect(() => { loadItems(); }, [loadItems]);

    const filtered = items.filter(i =>
        i.name_th.includes(search) || i.name_en.toLowerCase().includes(search.toLowerCase())
    );

    const geoName = (geoId: number) => geographies.find(g => g.id === geoId)?.name || '-';

    const openEdit = (item: Province) => {
        setEditItem(item); setShowAdd(false);
        setFormNameTh(item.name_th); setFormNameEn(item.name_en); setFormGeoId(String(item.geography_id));
    };

    const handleSave = async () => {
        if (!formNameTh.trim()) return;
        setSaving(true);
        try {
            const payload = { name_th: formNameTh.trim(), name_en: formNameEn.trim(), geography_id: formGeoId ? Number(formGeoId) : null };
            if (editItem) {
                await apiPost('update_province', { ...payload, id: editItem.id });
            } else {
                await apiPost('add_province', payload);
            }
            setShowAdd(false); setEditItem(null); resetForm();
            await loadItems();
        } catch (e: any) { alert(e.message); }
        setSaving(false);
    };

    const resetForm = () => { setFormNameTh(''); setFormNameEn(''); setFormGeoId(''); };

    const handleDelete = async () => {
        if (deleteId === null) return;
        try { await apiPost('delete_province', { id: deleteId }); setDeleteId(null); await loadItems(); } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <div className="flex gap-2 flex-1">
                    <div className="relative max-w-xs flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาจังหวัด..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                    </div>
                    <select value={filterGeo} onChange={e => setFilterGeo(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white">
                        <option value="">ทุกภาค</option>
                        {geographies.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
                <button onClick={() => { setShowAdd(true); setEditItem(null); resetForm(); }}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm">
                    <Plus size={15} /> เพิ่มจังหวัด
                </button>
            </div>

            {(showAdd || editItem) && (
                <div className="p-4 bg-emerald-50/50 border-b border-emerald-100">
                    <div className="flex flex-wrap items-center gap-3">
                        <input autoFocus value={formNameTh} onChange={e => setFormNameTh(e.target.value)} placeholder="ชื่อจังหวัด (ไทย)"
                            className="flex-1 min-w-[160px] max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        <input value={formNameEn} onChange={e => setFormNameEn(e.target.value)} placeholder="ชื่อจังหวัด (EN)"
                            className="flex-1 min-w-[160px] max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        <select value={formGeoId} onChange={e => setFormGeoId(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                            <option value="">เลือกภาค</option>
                            {geographies.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : editItem ? 'บันทึก' : 'เพิ่ม'}
                        </button>
                        <button onClick={() => { setShowAdd(false); setEditItem(null); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">ยกเลิก</button>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 size={24} className="animate-spin mr-2" /> กำลังโหลด...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-gray-600 text-left">
                            <th className="px-4 py-3 font-medium w-20">ID</th>
                            <th className="px-4 py-3 font-medium">ชื่อ (ไทย)</th>
                            <th className="px-4 py-3 font-medium">ชื่อ (EN)</th>
                            <th className="px-4 py-3 font-medium">ภาค</th>
                            <th className="px-4 py-3 font-medium w-32 text-center">อำเภอ</th>
                            <th className="px-4 py-3 font-medium w-28 text-right">จัดการ</th>
                        </tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>
                            ) : filtered.map(p => (
                                <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-4 py-3 text-gray-500">{p.id}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{p.name_th}</td>
                                    <td className="px-4 py-3 text-gray-600">{p.name_en}</td>
                                    <td className="px-4 py-3 text-gray-600">{geoName(p.geography_id)}</td>
                                    <td className="px-4 py-3 text-center">
                                        {(p.child_count ?? 0) > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                {p.child_count} อำเภอ
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => openEdit(p)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg mr-1"><Pencil size={14} /></button>
                                        <button onClick={() => setDeleteId(p.id)} disabled={(p.child_count ?? 0) > 0}
                                            title={(p.child_count ?? 0) > 0 ? `ไม่สามารถลบได้ (มี ${p.child_count} อำเภอ)` : 'ลบ'}
                                            className={`p-1.5 rounded-lg ${(p.child_count ?? 0) > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">ทั้งหมด {filtered.length} รายการ</div>
            <ConfirmDialog open={deleteId !== null} title="ยืนยันการลบ" message="คุณต้องการลบจังหวัดนี้หรือไม่?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
        </div>
    );
}

// ─── Districts Tab ────────────────────────────────────
function DistrictsTab() {
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [items, setItems] = useState<District[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterProvince, setFilterProvince] = useState('');
    const [editItem, setEditItem] = useState<District | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [formNameTh, setFormNameTh] = useState('');
    const [formNameEn, setFormNameEn] = useState('');
    const [formProvinceId, setFormProvinceId] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    useEffect(() => { apiFetch('provinces').then(setProvinces).catch(() => { }); }, []);

    const loadItems = useCallback(async () => {
        if (!filterProvince) { setItems([]); return; }
        setLoading(true);
        try { setItems(await apiFetch('districts', filterProvince)); } catch { }
        setLoading(false);
    }, [filterProvince]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const filtered = items.filter(i =>
        i.name_th.includes(search) || i.name_en.toLowerCase().includes(search.toLowerCase())
    );

    const provinceName = (pid: number) => provinces.find(p => p.id === pid)?.name_th || '-';

    const openEdit = (item: District) => {
        setEditItem(item); setShowAdd(false);
        setFormNameTh(item.name_th); setFormNameEn(item.name_en); setFormProvinceId(String(item.province_id));
    };

    const resetForm = () => { setFormNameTh(''); setFormNameEn(''); setFormProvinceId(filterProvince); };

    const handleSave = async () => {
        if (!formNameTh.trim() || !formProvinceId) return;
        setSaving(true);
        try {
            const payload = { name_th: formNameTh.trim(), name_en: formNameEn.trim(), province_id: Number(formProvinceId) };
            if (editItem) {
                await apiPost('update_district', { ...payload, id: editItem.id });
            } else {
                await apiPost('add_district', payload);
            }
            setShowAdd(false); setEditItem(null); resetForm();
            await loadItems();
        } catch (e: any) { alert(e.message); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (deleteId === null) return;
        try { await apiPost('delete_district', { id: deleteId }); setDeleteId(null); await loadItems(); } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <div className="flex gap-2 flex-1 flex-wrap">
                    <select value={filterProvince} onChange={e => setFilterProvince(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white min-w-[180px]">
                        <option value="">-- เลือกจังหวัดก่อน --</option>
                        {provinces.map(p => <option key={p.id} value={p.id}>{p.name_th}</option>)}
                    </select>
                    {filterProvince && (
                        <div className="relative flex-1 max-w-xs">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาอำเภอ..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                        </div>
                    )}
                </div>
                {filterProvince && (
                    <button onClick={() => { setShowAdd(true); setEditItem(null); resetForm(); }}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm">
                        <Plus size={15} /> เพิ่มอำเภอ
                    </button>
                )}
            </div>

            {(showAdd || editItem) && (
                <div className="p-4 bg-emerald-50/50 border-b border-emerald-100">
                    <div className="flex flex-wrap items-center gap-3">
                        <input autoFocus value={formNameTh} onChange={e => setFormNameTh(e.target.value)} placeholder="ชื่ออำเภอ (ไทย)"
                            className="flex-1 min-w-[160px] max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        <input value={formNameEn} onChange={e => setFormNameEn(e.target.value)} placeholder="ชื่ออำเภอ (EN)"
                            className="flex-1 min-w-[160px] max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        <select value={formProvinceId} onChange={e => setFormProvinceId(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                            <option value="">เลือกจังหวัด</option>
                            {provinces.map(p => <option key={p.id} value={p.id}>{p.name_th}</option>)}
                        </select>
                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : editItem ? 'บันทึก' : 'เพิ่ม'}
                        </button>
                        <button onClick={() => { setShowAdd(false); setEditItem(null); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">ยกเลิก</button>
                    </div>
                </div>
            )}

            {!filterProvince ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                    <ChevronDown size={18} className="mr-2" /> กรุณาเลือกจังหวัดเพื่อแสดงอำเภอ
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 size={24} className="animate-spin mr-2" /> กำลังโหลด...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-gray-600 text-left">
                            <th className="px-4 py-3 font-medium w-20">ID</th>
                            <th className="px-4 py-3 font-medium">ชื่อ (ไทย)</th>
                            <th className="px-4 py-3 font-medium">ชื่อ (EN)</th>
                            <th className="px-4 py-3 font-medium">จังหวัด</th>
                            <th className="px-4 py-3 font-medium w-32 text-center">ตำบล</th>
                            <th className="px-4 py-3 font-medium w-28 text-right">จัดการ</th>
                        </tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>
                            ) : filtered.map(d => (
                                <tr key={d.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-4 py-3 text-gray-500">{d.id}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{d.name_th}</td>
                                    <td className="px-4 py-3 text-gray-600">{d.name_en}</td>
                                    <td className="px-4 py-3 text-gray-600">{provinceName(d.province_id)}</td>
                                    <td className="px-4 py-3 text-center">
                                        {(d.child_count ?? 0) > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                                                {d.child_count} ตำบล
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => openEdit(d)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg mr-1"><Pencil size={14} /></button>
                                        <button onClick={() => setDeleteId(d.id)} disabled={(d.child_count ?? 0) > 0}
                                            title={(d.child_count ?? 0) > 0 ? `ไม่สามารถลบได้ (มี ${d.child_count} ตำบล)` : 'ลบ'}
                                            className={`p-1.5 rounded-lg ${(d.child_count ?? 0) > 0 ? 'text-gray-300 cursor-not-allowed' : 'text-red-500 hover:bg-red-50'}`}><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {filterProvince && <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">ทั้งหมด {filtered.length} รายการ</div>}
            <ConfirmDialog open={deleteId !== null} title="ยืนยันการลบ" message="คุณต้องการลบอำเภอนี้หรือไม่?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
        </div>
    );
}

// ─── Sub-Districts Tab ────────────────────────────────
function SubDistrictsTab() {
    const [provinces, setProvinces] = useState<Province[]>([]);
    const [districts, setDistricts] = useState<District[]>([]);
    const [items, setItems] = useState<SubDistrict[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [filterProvince, setFilterProvince] = useState('');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [editItem, setEditItem] = useState<SubDistrict | null>(null);
    const [showAdd, setShowAdd] = useState(false);
    const [formNameTh, setFormNameTh] = useState('');
    const [formNameEn, setFormNameEn] = useState('');
    const [formZipCode, setFormZipCode] = useState('');
    const [formDistrictId, setFormDistrictId] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleteId, setDeleteId] = useState<number | null>(null);

    useEffect(() => { apiFetch('provinces').then(setProvinces).catch(() => { }); }, []);

    useEffect(() => {
        if (!filterProvince) { setDistricts([]); setFilterDistrict(''); setItems([]); return; }
        apiFetch('districts', filterProvince).then(setDistricts).catch(() => { });
        setFilterDistrict(''); setItems([]);
    }, [filterProvince]);

    const loadItems = useCallback(async () => {
        if (!filterDistrict) { setItems([]); return; }
        setLoading(true);
        try { setItems(await apiFetch('sub_districts', filterDistrict)); } catch { }
        setLoading(false);
    }, [filterDistrict]);

    useEffect(() => { loadItems(); }, [loadItems]);

    const filtered = items.filter(i =>
        i.name_th.includes(search) || i.name_en.toLowerCase().includes(search.toLowerCase()) || i.zip_code.includes(search)
    );

    const districtName = (did: number) => districts.find(d => d.id === did)?.name_th || '-';

    const openEdit = (item: SubDistrict) => {
        setEditItem(item); setShowAdd(false);
        setFormNameTh(item.name_th); setFormNameEn(item.name_en); setFormZipCode(item.zip_code); setFormDistrictId(String(item.district_id));
    };

    const resetForm = () => { setFormNameTh(''); setFormNameEn(''); setFormZipCode(''); setFormDistrictId(filterDistrict); };

    const handleSave = async () => {
        if (!formNameTh.trim() || !formDistrictId) return;
        setSaving(true);
        try {
            const payload = { name_th: formNameTh.trim(), name_en: formNameEn.trim(), zip_code: formZipCode.trim(), district_id: Number(formDistrictId) };
            if (editItem) {
                await apiPost('update_sub_district', { ...payload, id: editItem.id });
            } else {
                await apiPost('add_sub_district', payload);
            }
            setShowAdd(false); setEditItem(null); resetForm();
            await loadItems();
        } catch (e: any) { alert(e.message); }
        setSaving(false);
    };

    const handleDelete = async () => {
        if (deleteId === null) return;
        try { await apiPost('delete_sub_district', { id: deleteId }); setDeleteId(null); await loadItems(); } catch (e: any) { alert(e.message); }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
                <div className="flex gap-2 flex-1 flex-wrap">
                    <select value={filterProvince} onChange={e => setFilterProvince(e.target.value)}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white min-w-[160px]">
                        <option value="">-- เลือกจังหวัด --</option>
                        {provinces.map(p => <option key={p.id} value={p.id}>{p.name_th}</option>)}
                    </select>
                    <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)} disabled={!filterProvince}
                        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 bg-white min-w-[160px] disabled:opacity-50">
                        <option value="">-- เลือกอำเภอ --</option>
                        {districts.map(d => <option key={d.id} value={d.id}>{d.name_th}</option>)}
                    </select>
                    {filterDistrict && (
                        <div className="relative flex-1 max-w-xs">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาตำบล/รหัสไปรษณีย์..."
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
                        </div>
                    )}
                </div>
                {filterDistrict && (
                    <button onClick={() => { setShowAdd(true); setEditItem(null); resetForm(); }}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm">
                        <Plus size={15} /> เพิ่มตำบล
                    </button>
                )}
            </div>

            {(showAdd || editItem) && (
                <div className="p-4 bg-emerald-50/50 border-b border-emerald-100">
                    <div className="flex flex-wrap items-center gap-3">
                        <input autoFocus value={formNameTh} onChange={e => setFormNameTh(e.target.value)} placeholder="ชื่อตำบล (ไทย)"
                            className="flex-1 min-w-[140px] max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        <input value={formNameEn} onChange={e => setFormNameEn(e.target.value)} placeholder="ชื่อตำบล (EN)"
                            className="flex-1 min-w-[140px] max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        <input value={formZipCode} onChange={e => setFormZipCode(e.target.value)} placeholder="รหัสไปรษณีย์"
                            className="w-28 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                        <select value={formDistrictId} onChange={e => setFormDistrictId(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30">
                            <option value="">เลือกอำเภอ</option>
                            {districts.map(d => <option key={d.id} value={d.id}>{d.name_th}</option>)}
                        </select>
                        <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : editItem ? 'บันทึก' : 'เพิ่ม'}
                        </button>
                        <button onClick={() => { setShowAdd(false); setEditItem(null); }} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">ยกเลิก</button>
                    </div>
                </div>
            )}

            {!filterDistrict ? (
                <div className="flex items-center justify-center py-12 text-gray-400">
                    <ChevronDown size={18} className="mr-2" /> กรุณาเลือกจังหวัดและอำเภอเพื่อแสดงตำบล
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 size={24} className="animate-spin mr-2" /> กำลังโหลด...</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead><tr className="bg-gray-50 text-gray-600 text-left">
                            <th className="px-4 py-3 font-medium w-24">ID</th>
                            <th className="px-4 py-3 font-medium">ชื่อ (ไทย)</th>
                            <th className="px-4 py-3 font-medium">ชื่อ (EN)</th>
                            <th className="px-4 py-3 font-medium w-28">รหัสไปรษณีย์</th>
                            <th className="px-4 py-3 font-medium">อำเภอ</th>
                            <th className="px-4 py-3 font-medium w-28 text-right">จัดการ</th>
                        </tr></thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400">ไม่พบข้อมูล</td></tr>
                            ) : filtered.map(s => (
                                <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-4 py-3 text-gray-500">{s.id}</td>
                                    <td className="px-4 py-3 font-medium text-gray-800">{s.name_th}</td>
                                    <td className="px-4 py-3 text-gray-600">{s.name_en}</td>
                                    <td className="px-4 py-3 text-gray-600 font-mono">{s.zip_code}</td>
                                    <td className="px-4 py-3 text-gray-600">{districtName(s.district_id)}</td>
                                    <td className="px-4 py-3 text-right">
                                        <button onClick={() => openEdit(s)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg mr-1"><Pencil size={14} /></button>
                                        <button onClick={() => setDeleteId(s.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            {filterDistrict && <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-50">ทั้งหมด {filtered.length} รายการ</div>}
            <ConfirmDialog open={deleteId !== null} title="ยืนยันการลบ" message="คุณต้องการลบตำบลนี้หรือไม่?" onConfirm={handleDelete} onCancel={() => setDeleteId(null)} />
        </div>
    );
}
