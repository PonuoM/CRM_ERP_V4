import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';
import { Save, Loader2, Settings, AlertCircle, Plus, Trash2, RefreshCw, Users, Calendar, Package, ShieldCheck, Search, ArrowRight, CheckCircle2, XCircle, ChevronRight, ChevronDown, ArrowLeft, Eye, UserX, Building2, AlertTriangle } from 'lucide-react';
import { User } from '../types';

interface BasketSettingsPageProps {
    currentUser?: User | null;
}

interface BasketConfig {
    id: number;
    basket_key: string;
    basket_name: string;
    min_order_count: number | null;
    max_order_count: number | null;
    min_days_since_order: number | null;
    max_days_since_order: number | null;
    days_since_first_order: number | null;
    days_since_registered: number | null;
    target_page: 'dashboard_v2' | 'distribution';
    display_order: number;
    is_active: boolean;
    company_id: number;
    // Transition Rules
    on_sale_basket_key?: string | null;
    fail_after_days?: number | null;
    on_fail_basket_key?: string | null;
    max_distribution_count?: number | null;
    hold_days_before_redistribute?: number | null;
    linked_basket_key?: string | null;
    on_max_dist_basket_key?: string | null;
    on_fail_reevaluate?: boolean;
    has_loop?: boolean;
    blocked_target_baskets?: string | null;
}

interface ReturnConfig {
    [key: string]: {
        value: string;
        description: string;
    };
}

const BASKET_GROUPS = [
    {
        key: 'dashboard_v2',
        label: 'Dashboard V2',
        icon: Package,
        description: 'ถังที่แสดงใน Dashboard V2 สำหรับ Telesale'
    },
    {
        key: 'distribution',
        label: 'หน้าแจกงาน',
        icon: Users,
        description: 'ถังสำหรับแจกงานให้ Telesale'
    },
    {
        key: 'return_pool',
        label: 'คืน Pool',
        icon: RefreshCw,
        description: 'ตั้งค่าการคืนลูกค้ากลับ Pool อัตโนมัติ'
    },
    {
        key: 'reevaluate',
        label: 'ตรวจสอบถัง',
        icon: ShieldCheck,
        description: 'สแกนและแก้ไขลูกค้าที่อยู่ผิดถัง'
    },
    {
        key: 'misassigned',
        label: 'ลูกค้าหลงถัง',
        icon: UserX,
        description: 'คนขายจริง ≠ เจ้าของ (ถัง 39/40)'
    },
    {
        key: 'upsell_stuck',
        label: 'ค้าง Upsell',
        icon: AlertTriangle,
        description: 'ลูกค้าค้าง Basket 51 ไม่มี order Pending'
    }
];

interface ReevalSummary {
    from_basket: number;
    from_name: string;
    to_basket: number;
    to_name: string;
    count: number;
}

interface ReevalCustomer {
    customer_id: number;
    name: string;
    days_since_order: number;
    current_basket: number;
    current_basket_name: string;
    correct_basket: number;
    correct_basket_name: string;
}

interface ReevalDetailCustomer extends ReevalCustomer {
    creator_name: string;
    creator_id: number;
    owner_name: string;
    assigned_to: number;
    latest_order_date: string;
    latest_order_id: number;
    is_own_sale: boolean;
    reason: string;
}

interface ReevalResult {
    success: boolean;
    total_wrong: number;
    summary: ReevalSummary[];
    customers: ReevalCustomer[];
    scanned_at?: string;
    fixed?: number;
    errors?: number;
    fixed_at?: string;
}

const BasketSettingsPage: React.FC<BasketSettingsPageProps> = ({ currentUser }) => {
    const user = currentUser;
    const [baskets, setBaskets] = useState<BasketConfig[]>([]);
    const [returnConfig, setReturnConfig] = useState<ReturnConfig>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeGroup, setActiveGroup] = useState<string>('dashboard_v2');
    const [editingBasket, setEditingBasket] = useState<BasketConfig | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Company selector state (Super Admin only)
    const isSuperAdmin = user?.role === 'Super Admin';
    const [companies, setCompanies] = useState<{ id: number; name: string }[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
    const effectiveCompanyId = isSuperAdmin && selectedCompanyId ? selectedCompanyId : user?.companyId;

    // Re-evaluate state
    const [reevalScanning, setReevalScanning] = useState(false);
    const [reevalFixing, setReevalFixing] = useState(false);
    const [reevalResult, setReevalResult] = useState<ReevalResult | null>(null);
    const [reevalFixResult, setReevalFixResult] = useState<ReevalResult | null>(null);
    const [selectedTransitions, setSelectedTransitions] = useState<Set<string>>(new Set());
    const [detailTransition, setDetailTransition] = useState<string | null>(null);
    const [detailCustomers, setDetailCustomers] = useState<ReevalDetailCustomer[]>([]);
    const [detailLoading, setDetailLoading] = useState(false);

    // Misassigned state
    const [misScanning, setMisScanning] = useState(false);
    const [misResult, setMisResult] = useState<{ total: number; show_all: boolean; summary: { basket_id: number; basket_name: string; count: number }[]; cause_summary: { cause: string; cause_label: string; count: number }[]; customers: ReevalDetailCustomer[]; scanned_at: string } | null>(null);
    const [misSelected, setMisSelected] = useState<Set<number>>(new Set());
    const [misFixing, setMisFixing] = useState(false);
    const [misShowAll, setMisShowAll] = useState(false);

    // Upsell stuck state
    const [upScanning, setUpScanning] = useState(false);
    const [upFixing, setUpFixing] = useState(false);
    const [upResult, setUpResult] = useState<any>(null);
    const [upSelected, setUpSelected] = useState<Set<number>>(new Set());
    const [upExpanded, setUpExpanded] = useState<Set<number>>(new Set());
    const [upFixResult, setUpFixResult] = useState<any>(null);

    // Load companies list for Super Admin
    useEffect(() => {
        if (isSuperAdmin) {
            apiFetch('Order_DB/companies.php').then((res: { id: number; name: string }[]) => {
                setCompanies(res || []);
                if (!selectedCompanyId && user?.companyId) {
                    setSelectedCompanyId(user.companyId);
                }
            }).catch(console.error);
        }
    }, [isSuperAdmin]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [basketsResponse, returnResponse] = await Promise.all([
                apiFetch(`basket_config.php?companyId=${effectiveCompanyId}`),
                apiFetch(`basket_config.php?action=return_config&companyId=${effectiveCompanyId}`)
            ]);
            setBaskets(basketsResponse || []);
            setReturnConfig(returnResponse || {});
        } catch (error) {
            console.error('Failed to fetch basket config:', error);
            setMessage({ type: 'error', text: 'ไม่สามารถโหลดข้อมูลได้' });
        } finally {
            setLoading(false);
        }
    }, [effectiveCompanyId]);

    useEffect(() => {
        if (effectiveCompanyId) {
            fetchData();
        }
    }, [effectiveCompanyId, fetchData]);

    const handleSaveBasket = async (basket: BasketConfig) => {
        setSaving(true);
        try {
            if (basket.id) {
                await apiFetch(`basket_config.php?id=${basket.id}&companyId=${effectiveCompanyId}`, {
                    method: 'PUT',
                    body: JSON.stringify(basket)
                });
            } else {
                await apiFetch(`basket_config.php?companyId=${effectiveCompanyId}`, {
                    method: 'POST',
                    body: JSON.stringify(basket)
                });
            }
            setMessage({ type: 'success', text: 'บันทึกสำเร็จ' });
            setEditingBasket(null);
            fetchData();
        } catch (error) {
            console.error('Failed to save basket:', error);
            setMessage({ type: 'error', text: 'บันทึกไม่สำเร็จ' });
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteBasket = async (id: number) => {
        if (!confirm('ต้องการลบถังนี้หรือไม่?')) return;

        try {
            await apiFetch(`basket_config.php?id=${id}&companyId=${effectiveCompanyId}`, {
                method: 'DELETE'
            });
            setMessage({ type: 'success', text: 'ลบสำเร็จ' });
            fetchData();
        } catch (error) {
            console.error('Failed to delete basket:', error);
            setMessage({ type: 'error', text: 'ลบไม่สำเร็จ' });
        }
    };

    const handleSaveReturnConfig = async () => {
        setSaving(true);
        try {
            const configToSave: Record<string, string> = {};
            Object.entries(returnConfig).forEach(([key, val]) => {
                configToSave[key] = val.value;
            });

            await apiFetch(`basket_config.php?action=return_config&companyId=${effectiveCompanyId}`, {
                method: 'PUT',
                body: JSON.stringify(configToSave)
            });
            setMessage({ type: 'success', text: 'บันทึกสำเร็จ' });
        } catch (error) {
            console.error('Failed to save return config:', error);
            setMessage({ type: 'error', text: 'บันทึกไม่สำเร็จ' });
        } finally {
            setSaving(false);
        }
    };

    const handleReevalScan = async () => {
        setReevalScanning(true);
        setReevalResult(null);
        setReevalFixResult(null);
        setSelectedTransitions(new Set());
        try {
            const res = await apiFetch(`cron/basket_reevaluate_api.php?action=scan&companyId=${effectiveCompanyId}`);
            setReevalResult(res);
            // Auto-select all transitions
            const allKeys = new Set<string>(res.summary.map((s: ReevalSummary) => `${s.from_basket}→${s.to_basket}`));
            setSelectedTransitions(allKeys);
        } catch (error) {
            console.error('Scan failed:', error);
            setMessage({ type: 'error', text: 'สแกนล้มเหลว' });
        } finally {
            setReevalScanning(false);
        }
    };

    const selectedCount = reevalResult?.summary
        .filter(s => selectedTransitions.has(`${s.from_basket}→${s.to_basket}`))
        .reduce((sum, s) => sum + s.count, 0) ?? 0;

    const handleReevalFix = async () => {
        if (selectedTransitions.size === 0) return;
        const transitions = Array.from(selectedTransitions);
        if (!confirm(`ยืนยันแก้ไขลูกค้า ${selectedCount.toLocaleString()} คนที่เลือก?\n\nรายการที่เลือก:\n${transitions.join('\n')}\n\nการดำเนินการนี้จะย้ายลูกค้าไปถังที่ถูกต้องทันที`)) return;
        setReevalFixing(true);
        try {
            const res = await apiFetch(`cron/basket_reevaluate_api.php?action=fix&companyId=${effectiveCompanyId}`, {
                method: 'POST',
                body: JSON.stringify({ transitions })
            });
            setReevalFixResult(res);
            setReevalResult(null);
            setSelectedTransitions(new Set());
            setMessage({ type: 'success', text: `แก้ไขสำเร็จ ${res.fixed} คน` });
        } catch (error) {
            console.error('Fix failed:', error);
            setMessage({ type: 'error', text: 'แก้ไขล้มเหลว' });
        } finally {
            setReevalFixing(false);
        }
    };

    const handleViewDetail = async (transition: string) => {
        setDetailLoading(true);
        setDetailTransition(transition);
        try {
            const res = await apiFetch(`cron/basket_reevaluate_api.php?action=detail&companyId=${effectiveCompanyId}&transition=${encodeURIComponent(transition)}`);
            setDetailCustomers(res.customers || []);
        } catch (error) {
            console.error('Detail failed:', error);
            setMessage({ type: 'error', text: 'โหลดรายละเอียดล้มเหลว' });
            setDetailTransition(null);
        } finally {
            setDetailLoading(false);
        }
    };

    // ---- Misassigned handlers ----
    const handleMisScan = async () => {
        setMisScanning(true);
        setMisResult(null);
        setMisSelected(new Set());
        try {
            const res = await apiFetch(`cron/basket_reevaluate_api.php?action=misassigned&companyId=${effectiveCompanyId}&show_all=${misShowAll ? '1' : '0'}`);
            setMisResult(res);
            // Auto-select all
            setMisSelected(new Set<number>(res.customers.map((c: ReevalDetailCustomer) => c.customer_id)));
        } catch (error) {
            console.error('Misassigned scan failed:', error);
            setMessage({ type: 'error', text: 'สแกนลูกค้าหลงถังล้มเหลว' });
        } finally {
            setMisScanning(false);
        }
    };

    const handleMisFix = async () => {
        if (misSelected.size === 0) return;
        const ids = Array.from(misSelected);
        if (!confirm(`ยืนยันเปลี่ยนเจ้าของลูกค้า ${ids.length} คน?\n\nลูกค้าจะถูกย้ายไปให้คนที่สร้าง order ล่าสุด`)) return;
        setMisFixing(true);
        try {
            const res = await apiFetch(`cron/basket_reevaluate_api.php?action=fix_misassigned&companyId=${effectiveCompanyId}`, {
                method: 'POST',
                body: JSON.stringify({ customer_ids: ids })
            });
            setMessage({ type: 'success', text: `เปลี่ยนเจ้าของสำเร็จ ${res.fixed} คน` });
            setMisResult(null);
            setMisSelected(new Set());
        } catch (error) {
            console.error('Fix misassigned failed:', error);
            setMessage({ type: 'error', text: 'แก้ไขล้มเหลว' });
        } finally {
            setMisFixing(false);
        }
    };

    // Upsell stuck handlers
    const handleUpScan = async () => {
        setUpScanning(true);
        setUpResult(null);
        setUpFixResult(null);
        setUpSelected(new Set());
        setUpExpanded(new Set());
        try {
            const res = await apiFetch(`cron/basket_reevaluate_api.php?action=upsell_stuck&companyId=${effectiveCompanyId}`);
            setUpResult(res);
            // Auto-select all
            setUpSelected(new Set(res.customers.map((c: any) => c.customer_id)));
        } catch (error) {
            console.error('Upsell scan failed:', error);
            setMessage({ type: 'error', text: 'สแกนล้มเหลว' });
        } finally {
            setUpScanning(false);
        }
    };

    const handleUpFix = async () => {
        if (upSelected.size === 0) return;
        if (!confirm(`ยืนยันย้ายลูกค้า ${upSelected.size} คนออกจาก Basket 51 ไปถังที่ถูกต้อง?`)) return;
        setUpFixing(true);
        try {
            const res = await apiFetch(`cron/basket_reevaluate_api.php?action=fix_upsell_stuck&companyId=${effectiveCompanyId}`, {
                method: 'POST',
                body: JSON.stringify({ customer_ids: Array.from(upSelected) })
            });
            setUpFixResult(res);
            setUpResult(null);
            setUpSelected(new Set());
            setMessage({ type: 'success', text: `แก้ไขสำเร็จ ${res.fixed} คน` });
        } catch (error) {
            console.error('Upsell fix failed:', error);
            setMessage({ type: 'error', text: 'แก้ไขล้มเหลว' });
        } finally {
            setUpFixing(false);
        }
    };

    const toggleUpExpand = (id: number) => {
        setUpExpanded(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const statusColor = (s: string) => {
        switch (s) {
            case 'Delivered': return 'bg-green-100 text-green-700';
            case 'Cancelled': case 'CANCELLED': return 'bg-red-100 text-red-700';
            case 'Shipping': return 'bg-blue-100 text-blue-700';
            case 'Picking': return 'bg-yellow-100 text-yellow-700';
            case 'PreApproved': return 'bg-purple-100 text-purple-700';
            case 'Returned': return 'bg-orange-100 text-orange-700';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const filteredBaskets = baskets.filter(b => b.target_page === activeGroup);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-2xl shadow-sm border p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Settings className="w-8 h-8 text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">ตั้งค่าถัง (Basket Settings)</h1>
                                <p className="text-gray-500">จัดการเงื่อนไขการจัดกลุ่มลูกค้าและการคืน Pool</p>
                            </div>
                        </div>
                        {isSuperAdmin && companies.length > 0 && (activeGroup === 'reevaluate' || activeGroup === 'misassigned' || activeGroup === 'upsell_stuck') && (
                            <div className="flex items-center gap-2">
                                <Building2 size={20} className="text-gray-400" />
                                <select
                                    value={selectedCompanyId ?? ''}
                                    onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                                    className="px-4 py-2 border border-gray-300 rounded-xl bg-white text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* Message */}
                {message && (
                    <div className={`mb-4 p-4 rounded-xl flex items-center gap-2 ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                        <AlertCircle size={20} />
                        {message.text}
                        <button onClick={() => setMessage(null)} className="ml-auto">×</button>
                    </div>
                )}

                <div className="flex gap-6">
                    {/* Sidebar */}
                    <div className="w-64 bg-white rounded-2xl shadow-sm border p-4">
                        <h3 className="font-semibold text-gray-700 mb-4">หมวดหมู่</h3>
                        <div className="space-y-2">
                            {BASKET_GROUPS.map(group => (
                                <button
                                    key={group.key}
                                    onClick={() => setActiveGroup(group.key)}
                                    className={`w-full text-left p-3 rounded-xl transition-colors flex items-center gap-3 ${activeGroup === group.key
                                        ? 'bg-blue-100 text-blue-700 font-medium'
                                        : 'hover:bg-gray-100 text-gray-600'
                                        }`}
                                >
                                    <group.icon size={20} />
                                    <div>
                                        <div>{group.label}</div>
                                        <div className="text-xs opacity-70">{group.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 bg-white rounded-2xl shadow-sm border p-6">
                        {activeGroup === 'reevaluate' ? (
                            /* Re-evaluate Panel */
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <ShieldCheck size={24} className="text-blue-600" />
                                    ตรวจสอบ & แก้ไขถัง
                                </h2>
                                <p className="text-gray-500 text-sm mb-6">
                                    สแกนหาลูกค้าที่อยู่ผิดถัง เทียบกับ days_since_order แล้วย้ายไปถังที่ถูกต้อง
                                </p>

                                {/* Scan Button */}
                                <button
                                    onClick={handleReevalScan}
                                    disabled={reevalScanning}
                                    className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 mb-6 shadow-sm"
                                >
                                    {reevalScanning ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                                    {reevalScanning ? 'กำลังสแกน...' : 'สแกนหาลูกค้าที่ผิดถัง'}
                                </button>

                                {/* Fix Result (after fix) */}
                                {reevalFixResult && (
                                    <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-xl">
                                        <div className="flex items-center gap-3 mb-3">
                                            <CheckCircle2 size={28} className="text-green-600" />
                                            <h3 className="text-lg font-bold text-green-800">แก้ไขเรียบร้อย!</h3>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 text-center">
                                            <div className="bg-white rounded-lg p-3">
                                                <div className="text-2xl font-bold text-gray-800">{reevalFixResult.total_wrong}</div>
                                                <div className="text-xs text-gray-500">พบผิดถัง</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-3">
                                                <div className="text-2xl font-bold text-green-600">{reevalFixResult.fixed}</div>
                                                <div className="text-xs text-gray-500">แก้ไขแล้ว</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-3">
                                                <div className="text-2xl font-bold text-red-600">{reevalFixResult.errors}</div>
                                                <div className="text-xs text-gray-500">ผิดพลาด</div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-3">แก้ไขเมื่อ: {reevalFixResult.fixed_at}</p>
                                        <button
                                            onClick={handleReevalScan}
                                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-2"
                                        >
                                            <Search size={16} /> สแกนอีกครั้ง
                                        </button>
                                    </div>
                                )}

                                {/* Scan Result */}
                                {reevalResult && (
                                    <div>
                                        {/* Summary Header */}
                                        <div className={`p-5 rounded-xl mb-6 ${reevalResult.total_wrong === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                                            <div className="flex items-center gap-3">
                                                {reevalResult.total_wrong === 0
                                                    ? <CheckCircle2 size={28} className="text-green-600" />
                                                    : <AlertCircle size={28} className="text-amber-600" />
                                                }
                                                <div>
                                                    <h3 className={`text-lg font-bold ${reevalResult.total_wrong === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                                                        {reevalResult.total_wrong === 0
                                                            ? '✅ ทุกถังถูกต้อง!'
                                                            : `⚠️ พบ ${reevalResult.total_wrong.toLocaleString()} คนอยู่ผิดถัง`
                                                        }
                                                    </h3>
                                                    <p className="text-xs text-gray-500">สแกนเมื่อ: {reevalResult.scanned_at}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {reevalResult.total_wrong > 0 && (
                                            <>
                                                {/* Summary Table */}
                                                <h4 className="font-semibold text-gray-700 mb-3">สรุปการย้าย</h4>
                                                <div className="bg-white border rounded-xl overflow-hidden mb-6">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="p-3 w-10">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={selectedTransitions.size === reevalResult.summary.length}
                                                                        onChange={(e) => {
                                                                            if (e.target.checked) {
                                                                                setSelectedTransitions(new Set(reevalResult.summary.map(s => `${s.from_basket}→${s.to_basket}`)));
                                                                            } else {
                                                                                setSelectedTransitions(new Set());
                                                                            }
                                                                        }}
                                                                        className="w-4 h-4 text-blue-600 rounded"
                                                                    />
                                                                </th>
                                                                <th className="text-left p-3 font-medium text-gray-600">จากถัง</th>
                                                                <th className="text-center p-3"></th>
                                                                <th className="text-left p-3 font-medium text-gray-600">ไปถัง</th>
                                                                <th className="text-right p-3 font-medium text-gray-600">จำนวน</th>
                                                                <th className="p-3 w-10"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {reevalResult.summary.map((s, i) => {
                                                                const key = `${s.from_basket}→${s.to_basket}`;
                                                                const isChecked = selectedTransitions.has(key);
                                                                return (
                                                                    <tr key={i} className={`border-t cursor-pointer ${isChecked ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50 opacity-60'}`}
                                                                        onClick={() => {
                                                                            const next = new Set(selectedTransitions);
                                                                            if (next.has(key)) next.delete(key);
                                                                            else next.add(key);
                                                                            setSelectedTransitions(next);
                                                                        }}
                                                                    >
                                                                        <td className="p-3">
                                                                            <input type="checkbox" checked={isChecked} readOnly className="w-4 h-4 text-blue-600 rounded pointer-events-none" />
                                                                        </td>
                                                                        <td className="p-3">
                                                                            <span className="text-red-600 font-medium">{s.from_name}</span>
                                                                            <span className="text-xs text-gray-400 ml-1">(ID: {s.from_basket})</span>
                                                                        </td>
                                                                        <td className="text-center p-3"><ArrowRight size={16} className="text-gray-400 mx-auto" /></td>
                                                                        <td className="p-3">
                                                                            <span className="text-green-600 font-medium">{s.to_name}</span>
                                                                            <span className="text-xs text-gray-400 ml-1">(ID: {s.to_basket})</span>
                                                                        </td>
                                                                        <td className="p-3 text-right font-bold">{s.count.toLocaleString()}</td>
                                                                        <td className="p-3 text-center">
                                                                            <button
                                                                                onClick={(e) => { e.stopPropagation(); handleViewDetail(key); }}
                                                                                className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded"
                                                                                title="ดูรายชื่อทั้งหมด"
                                                                            >
                                                                                <Eye size={16} />
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot className="bg-gray-50 font-bold">
                                                            <tr className="border-t-2">
                                                                <td className="p-3" colSpan={5}>เลือก {selectedTransitions.size}/{reevalResult.summary.length} รายการ ({selectedCount.toLocaleString()} คน)</td>
                                                                <td className="p-3 text-right text-blue-600">{reevalResult.total_wrong.toLocaleString()}</td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>

                                                {/* Customer Preview */}
                                                <h4 className="font-semibold text-gray-700 mb-3">
                                                    ตัวอย่างลูกค้า {reevalResult.customers.length < reevalResult.total_wrong ? `(แสดง ${reevalResult.customers.length} จาก ${reevalResult.total_wrong.toLocaleString()})` : ''}
                                                </h4>
                                                <div className="bg-white border rounded-xl overflow-hidden mb-6 max-h-80 overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-50 sticky top-0">
                                                            <tr>
                                                                <th className="text-left p-2 font-medium">ID</th>
                                                                <th className="text-left p-2 font-medium">ชื่อ</th>
                                                                <th className="text-right p-2 font-medium">วัน</th>
                                                                <th className="text-left p-2 font-medium">ถังปัจจุบัน</th>
                                                                <th className="text-center p-2"></th>
                                                                <th className="text-left p-2 font-medium">ถังที่ถูก</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {reevalResult.customers.map(c => (
                                                                <tr key={c.customer_id} className="border-t hover:bg-blue-50">
                                                                    <td className="p-2 text-gray-500">{c.customer_id}</td>
                                                                    <td className="p-2 font-medium">{c.name}</td>
                                                                    <td className="p-2 text-right">{c.days_since_order}d</td>
                                                                    <td className="p-2 text-red-600">{c.current_basket_name}</td>
                                                                    <td className="p-2 text-center"><ArrowRight size={12} className="text-gray-400 mx-auto" /></td>
                                                                    <td className="p-2 text-green-600 font-medium">{c.correct_basket_name}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Detail Panel */}
                                                {detailTransition && (
                                                    <div className="mb-6 bg-gray-50 border rounded-xl p-5">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <div className="flex items-center gap-3">
                                                                <button onClick={() => setDetailTransition(null)} className="p-1 hover:bg-gray-200 rounded">
                                                                    <ArrowLeft size={20} />
                                                                </button>
                                                                <h4 className="font-bold text-gray-800">
                                                                    รายละเอียด: {detailTransition.replace('→', ' → ')}
                                                                    {!detailLoading && <span className="text-sm font-normal text-gray-500 ml-2">({detailCustomers.length.toLocaleString()} คน)</span>}
                                                                </h4>
                                                            </div>
                                                        </div>

                                                        {detailLoading ? (
                                                            <div className="flex items-center justify-center py-8">
                                                                <Loader2 className="animate-spin text-blue-500" size={32} />
                                                                <span className="ml-3 text-gray-500">กำลังโหลด...</span>
                                                            </div>
                                                        ) : (
                                                            <div className="bg-white border rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
                                                                <table className="w-full text-xs">
                                                                    <thead className="bg-gray-100 sticky top-0">
                                                                        <tr>
                                                                            <th className="text-left p-2 font-semibold">#</th>
                                                                            <th className="text-left p-2 font-semibold">ID</th>
                                                                            <th className="text-left p-2 font-semibold">ชื่อลูกค้า</th>
                                                                            <th className="text-left p-2 font-semibold">เจ้าของ (assigned)</th>
                                                                            <th className="text-left p-2 font-semibold">คนสร้าง order</th>
                                                                            <th className="text-left p-2 font-semibold">วันที่ order</th>
                                                                            <th className="text-right p-2 font-semibold">วัน</th>
                                                                            <th className="text-center p-2 font-semibold">ขายเอง?</th>
                                                                            <th className="text-left p-2 font-semibold">ถังปัจจุบัน</th>
                                                                            <th className="text-center p-2"></th>
                                                                            <th className="text-left p-2 font-semibold">ถังที่ถูก</th>
                                                                            <th className="text-left p-2 font-semibold min-w-[200px]">เหตุผล</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {detailCustomers.map((c, idx) => (
                                                                            <tr key={c.customer_id} className="border-t hover:bg-blue-50">
                                                                                <td className="p-2 text-gray-400">{idx + 1}</td>
                                                                                <td className="p-2 text-gray-500">{c.customer_id}</td>
                                                                                <td className="p-2 font-medium">{c.name}</td>
                                                                                <td className="p-2">
                                                                                    <span className="text-purple-600">{c.owner_name}</span>
                                                                                    <span className="text-gray-400 text-[10px] ml-1">(#{c.assigned_to})</span>
                                                                                </td>
                                                                                <td className="p-2">
                                                                                    <span className={c.is_own_sale ? 'text-green-600 font-medium' : 'text-orange-600'}>{c.creator_name}</span>
                                                                                    <span className="text-gray-400 text-[10px] ml-1">(#{c.creator_id})</span>
                                                                                </td>
                                                                                <td className="p-2 text-gray-600">{c.latest_order_date}</td>
                                                                                <td className="p-2 text-right font-medium">{c.days_since_order}d</td>
                                                                                <td className="p-2 text-center">
                                                                                    {c.is_own_sale
                                                                                        ? <span className="text-green-600 font-bold">✓</span>
                                                                                        : <span className="text-red-500">✗</span>
                                                                                    }
                                                                                </td>
                                                                                <td className="p-2 text-red-600">{c.current_basket_name}</td>
                                                                                <td className="p-2 text-center"><ArrowRight size={10} className="text-gray-400 mx-auto" /></td>
                                                                                <td className="p-2 text-green-600 font-medium">{c.correct_basket_name}</td>
                                                                                <td className="p-2 text-gray-500 text-[11px] leading-tight">{c.reason}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Fix Button */}
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={handleReevalFix}
                                                        disabled={reevalFixing || selectedTransitions.size === 0}
                                                        className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                                    >
                                                        {reevalFixing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                                        {reevalFixing ? 'กำลังแก้ไข...' : selectedTransitions.size === 0 ? 'เลือกรายการที่ต้องการแก้ไข' : `ยืนยันแก้ไข ${selectedCount.toLocaleString()} คน`}
                                                    </button>
                                                    <button
                                                        onClick={handleReevalScan}
                                                        disabled={reevalScanning}
                                                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        <RefreshCw size={20} /> สแกนใหม่
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : activeGroup === 'misassigned' ? (
                            /* Misassigned Panel */
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <UserX size={24} className="text-orange-600" />
                                    ลูกค้าหลงถัง (Misassigned)
                                </h2>
                                <p className="text-gray-500 text-sm mb-6">
                                    ค้นหาลูกค้าในถัง 39 (ส่วนตัว 1-2เดือน) และ 40 (โอกาสสุดท้าย) ที่คนขายจริง (Telesale) ไม่ใช่เจ้าของปัจจุบัน
                                </p>

                                <div className="flex items-center gap-4 mb-6">
                                    <button
                                        onClick={handleMisScan}
                                        disabled={misScanning}
                                        className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                    >
                                        {misScanning ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                                        {misScanning ? 'กำลังสแกน...' : 'สแกนหาลูกค้าหลงถัง'}
                                    </button>
                                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={misShowAll}
                                            onChange={(e) => setMisShowAll(e.target.checked)}
                                            className="w-4 h-4 rounded"
                                        />
                                        รวมที่ย้ายเอง (ผู้ดูแลย้าย)
                                    </label>
                                </div>

                                {misResult && (
                                    <div>
                                        {/* Summary Header */}
                                        <div className={`p-5 rounded-xl mb-6 ${misResult.total === 0 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                                            <div className="flex items-center gap-3">
                                                {misResult.total === 0
                                                    ? <CheckCircle2 size={28} className="text-green-600" />
                                                    : <UserX size={28} className="text-orange-600" />
                                                }
                                                <div>
                                                    <h3 className={`text-lg font-bold ${misResult.total === 0 ? 'text-green-800' : 'text-orange-800'}`}>
                                                        {misResult.total === 0
                                                            ? '✅ ไม่พบลูกค้าหลงถัง!'
                                                            : `⚠️ พบ ${misResult.total.toLocaleString()} คนหลงถัง`
                                                        }
                                                    </h3>
                                                    <p className="text-xs text-gray-500">สแกนเมื่อ: {misResult.scanned_at}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {misResult.total > 0 && (
                                            <>
                                                {/* Summary by basket */}
                                                <div className="flex gap-4 mb-6">
                                                    {misResult.summary.map(s => (
                                                        <div key={s.basket_id} className="bg-white border rounded-xl p-4 flex-1">
                                                            <div className="text-sm text-gray-500">{s.basket_name} (ID: {s.basket_id})</div>
                                                            <div className="text-2xl font-bold text-orange-600">{s.count.toLocaleString()}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Cause summary */}
                                                {misResult.cause_summary && misResult.cause_summary.length > 0 && (
                                                    <div className="flex gap-2 mb-6 flex-wrap">
                                                        {misResult.cause_summary.map(cs => {
                                                            const colors: Record<string, string> = {
                                                                cron: 'bg-red-100 text-red-700 border-red-200',
                                                                manual: 'bg-blue-100 text-blue-700 border-blue-200',
                                                                sale: 'bg-green-100 text-green-700 border-green-200',
                                                                reevaluate: 'bg-purple-100 text-purple-700 border-purple-200',
                                                                unknown: 'bg-gray-100 text-gray-700 border-gray-200',
                                                                other: 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                                            };
                                                            return (
                                                                <div key={cs.cause} className={`px-3 py-2 rounded-lg border text-sm font-medium ${colors[cs.cause] || colors.other}`}>
                                                                    {cs.cause_label}: <strong>{cs.count}</strong>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Customer table */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-semibold text-gray-700">
                                                        รายชื่อลูกค้า ({misResult.customers.length.toLocaleString()} คน)
                                                    </h4>
                                                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={misSelected.size === misResult.customers.length}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setMisSelected(new Set(misResult.customers.map(c => c.customer_id)));
                                                                } else {
                                                                    setMisSelected(new Set());
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded"
                                                        />
                                                        เลือกทั้งหมด
                                                    </label>
                                                </div>

                                                <div className="bg-white border rounded-xl overflow-hidden mb-6 max-h-[500px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-100 sticky top-0">
                                                            <tr>
                                                                <th className="p-2 w-8"></th>
                                                                <th className="text-left p-2 font-semibold">#</th>
                                                                <th className="text-left p-2 font-semibold">ID</th>
                                                                <th className="text-left p-2 font-semibold">ชื่อลูกค้า</th>
                                                                <th className="text-left p-2 font-semibold">ถัง</th>
                                                                <th className="text-left p-2 font-semibold">เจ้าของปัจจุบัน</th>
                                                                <th className="text-center p-2">→</th>
                                                                <th className="text-left p-2 font-semibold">คนขายจริง</th>
                                                                <th className="text-left p-2 font-semibold">วันที่ order</th>
                                                                <th className="text-left p-2 font-semibold">วันที่ assign</th>
                                                                <th className="text-right p-2 font-semibold">วัน</th>
                                                                <th className="text-left p-2 font-semibold">สาเหตุ</th>
                                                                <th className="text-left p-2 font-semibold min-w-[250px]">เหตุผล</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {misResult.customers.map((c, idx) => {
                                                                const isChecked = misSelected.has(c.customer_id);
                                                                return (
                                                                    <tr key={c.customer_id}
                                                                        className={`border-t cursor-pointer ${isChecked ? 'bg-orange-50 hover:bg-orange-100' : 'hover:bg-gray-50 opacity-60'}`}
                                                                        onClick={() => {
                                                                            const next = new Set(misSelected);
                                                                            if (next.has(c.customer_id)) next.delete(c.customer_id);
                                                                            else next.add(c.customer_id);
                                                                            setMisSelected(next);
                                                                        }}
                                                                    >
                                                                        <td className="p-2">
                                                                            <input type="checkbox" checked={isChecked} readOnly className="w-4 h-4 rounded pointer-events-none" />
                                                                        </td>
                                                                        <td className="p-2 text-gray-400">{idx + 1}</td>
                                                                        <td className="p-2 text-gray-500">{c.customer_id}</td>
                                                                        <td className="p-2 font-medium">{c.name}</td>
                                                                        <td className="p-2 text-blue-600">{c.current_basket_name}</td>
                                                                        <td className="p-2">
                                                                            <span className="text-red-600 font-medium">{c.owner_name}</span>
                                                                            <span className="text-gray-400 text-[10px] ml-1">(#{c.assigned_to})</span>
                                                                        </td>
                                                                        <td className="p-2 text-center"><ArrowRight size={12} className="text-gray-400 mx-auto" /></td>
                                                                        <td className="p-2">
                                                                            <span className="text-green-600 font-medium">{c.creator_name}</span>
                                                                            <span className="text-gray-400 text-[10px] ml-1">(#{c.creator_id})</span>
                                                                        </td>
                                                                        <td className="p-2 text-gray-600">{c.latest_order_date}</td>
                                                                        <td className="p-2 text-gray-600">{(c as any).basket_entered_date || '-'}</td>
                                                                        <td className="p-2 text-right font-medium">{c.days_since_order}d</td>
                                                                        <td className="p-2">
                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${(c as any).cause === 'cron' ? 'bg-red-100 text-red-700' :
                                                                                (c as any).cause === 'manual' ? 'bg-blue-100 text-blue-700' :
                                                                                    (c as any).cause === 'sale' ? 'bg-green-100 text-green-700' :
                                                                                        (c as any).cause === 'reevaluate' ? 'bg-purple-100 text-purple-700' :
                                                                                            'bg-gray-100 text-gray-600'
                                                                                }`}>{(c as any).cause_label || '-'}</span>
                                                                        </td>
                                                                        <td className="p-2 text-gray-500 text-[11px] leading-tight">{c.reason}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Fix Button */}
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={handleMisFix}
                                                        disabled={misFixing || misSelected.size === 0}
                                                        className="px-6 py-3 bg-orange-600 text-white rounded-xl hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                                    >
                                                        {misFixing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                                        {misFixing ? 'กำลังย้าย...' : misSelected.size === 0 ? 'เลือกลูกค้าที่ต้องการย้าย' : `ยืนยันย้ายเจ้าของ ${misSelected.size} คน`}
                                                    </button>
                                                    <button
                                                        onClick={handleMisScan}
                                                        disabled={misScanning}
                                                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        <RefreshCw size={20} /> สแกนใหม่
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : activeGroup === 'upsell_stuck' ? (
                            /* Upsell Stuck Panel */
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
                                    <AlertTriangle size={24} className="text-amber-600" />
                                    ลูกค้าค้าง Upsell (Basket 51)
                                </h2>
                                <p className="text-gray-500 text-sm mb-6">
                                    สแกนหาลูกค้าที่อยู่ใน Basket 51 (อัพเซล) แต่ไม่มี order ที่ Pending อยู่ — พร้อมหลักฐานรายการ order ทั้งหมด
                                </p>

                                <button
                                    onClick={handleUpScan}
                                    disabled={upScanning}
                                    className="px-6 py-3 bg-amber-600 text-white rounded-xl hover:bg-amber-700 disabled:opacity-50 flex items-center gap-2 mb-6 shadow-sm"
                                >
                                    {upScanning ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                                    {upScanning ? 'กำลังสแกน...' : 'สแกนหาลูกค้าค้าง Upsell'}
                                </button>

                                {/* Fix Result */}
                                {upFixResult && (
                                    <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-xl">
                                        <div className="flex items-center gap-3 mb-3">
                                            <CheckCircle2 size={28} className="text-green-600" />
                                            <h3 className="text-lg font-bold text-green-800">แก้ไขเรียบร้อย!</h3>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-center">
                                            <div className="bg-white rounded-lg p-3">
                                                <div className="text-2xl font-bold text-green-600">{upFixResult.fixed}</div>
                                                <div className="text-xs text-gray-500">แก้ไขแล้ว</div>
                                            </div>
                                            <div className="bg-white rounded-lg p-3">
                                                <div className="text-2xl font-bold text-red-600">{upFixResult.errors}</div>
                                                <div className="text-xs text-gray-500">ผิดพลาด</div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-3">แก้ไขเมื่อ: {upFixResult.fixed_at}</p>
                                        <button onClick={handleUpScan} className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm flex items-center gap-2">
                                            <Search size={16} /> สแกนอีกครั้ง
                                        </button>
                                    </div>
                                )}

                                {/* Scan Result */}
                                {upResult && (
                                    <div>
                                        {/* Summary Header */}
                                        <div className={`p-5 rounded-xl mb-6 ${upResult.total === 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                                            <div className="flex items-center gap-3">
                                                {upResult.total === 0
                                                    ? <CheckCircle2 size={28} className="text-green-600" />
                                                    : <AlertTriangle size={28} className="text-amber-600" />
                                                }
                                                <div>
                                                    <h3 className={`text-lg font-bold ${upResult.total === 0 ? 'text-green-800' : 'text-amber-800'}`}>
                                                        {upResult.total === 0
                                                            ? '✅ ไม่พบลูกค้าค้าง Upsell!'
                                                            : `⚠️ พบ ${upResult.total.toLocaleString()} คนค้างใน Basket 51`
                                                        }
                                                    </h3>
                                                    <p className="text-xs text-gray-500">สแกนเมื่อ: {upResult.scanned_at}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {upResult.total > 0 && (
                                            <>
                                                {/* Status Summary Cards */}
                                                <h4 className="font-semibold text-gray-700 mb-3">สรุปสถานะ Order</h4>
                                                <div className="flex gap-3 mb-4 flex-wrap">
                                                    {Object.entries(upResult.status_summary as Record<string, number>).map(([status, count]) => (
                                                        <div key={status} className={`px-3 py-2 rounded-lg border text-sm font-medium ${statusColor(status)}`}>
                                                            {status}: <strong>{(count as number).toLocaleString()}</strong>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Destination Summary */}
                                                <h4 className="font-semibold text-gray-700 mb-3">ถังปลายทาง</h4>
                                                <div className="flex gap-3 mb-6 flex-wrap">
                                                    {(upResult.destination_summary as { basket_id: number; basket_name: string; count: number }[]).map(d => (
                                                        <div key={d.basket_id} className="bg-white border rounded-xl p-3 min-w-[120px]">
                                                            <div className="text-xs text-gray-500">{d.basket_name}</div>
                                                            <div className="text-xl font-bold text-amber-600">{d.count.toLocaleString()}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Customer Table with Evidence */}
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="font-semibold text-gray-700">
                                                        รายชื่อลูกค้า ({upResult.customers.length.toLocaleString()} คน)
                                                    </h4>
                                                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={upSelected.size === upResult.customers.length}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setUpSelected(new Set(upResult.customers.map((c: any) => c.customer_id)));
                                                                } else {
                                                                    setUpSelected(new Set());
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded"
                                                        />
                                                        เลือกทั้งหมด
                                                    </label>
                                                </div>

                                                <div className="bg-white border rounded-xl overflow-hidden mb-6 max-h-[600px] overflow-y-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-gray-100 sticky top-0">
                                                            <tr>
                                                                <th className="p-2 w-8"></th>
                                                                <th className="p-2 w-8"></th>
                                                                <th className="text-left p-2 font-semibold">ID</th>
                                                                <th className="text-left p-2 font-semibold">ชื่อลูกค้า</th>
                                                                <th className="text-left p-2 font-semibold">เจ้าของ</th>
                                                                <th className="text-right p-2 font-semibold">วันค้าง</th>
                                                                <th className="text-left p-2 font-semibold">Orders</th>
                                                                <th className="text-left p-2 font-semibold">สถานะ Order</th>
                                                                <th className="text-center p-2"><ArrowRight size={12} /></th>
                                                                <th className="text-left p-2 font-semibold">ถังที่ถูกต้อง</th>
                                                                <th className="text-left p-2 font-semibold min-w-[150px]">เหตุผล</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {upResult.customers.map((c: any) => {
                                                                const isChecked = upSelected.has(c.customer_id);
                                                                const isExpanded = upExpanded.has(c.customer_id);
                                                                return (
                                                                    <React.Fragment key={c.customer_id}>
                                                                        <tr
                                                                            className={`border-t cursor-pointer ${isChecked ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50 opacity-70'}`}
                                                                            onClick={() => {
                                                                                const next = new Set(upSelected);
                                                                                if (next.has(c.customer_id)) next.delete(c.customer_id);
                                                                                else next.add(c.customer_id);
                                                                                setUpSelected(next);
                                                                            }}
                                                                        >
                                                                            <td className="p-2">
                                                                                <input type="checkbox" checked={isChecked} readOnly className="w-4 h-4 rounded pointer-events-none" />
                                                                            </td>
                                                                            <td className="p-2">
                                                                                <button
                                                                                    onClick={(e) => { e.stopPropagation(); toggleUpExpand(c.customer_id); }}
                                                                                    className="p-1 hover:bg-gray-200 rounded"
                                                                                    title="ดูหลักฐาน"
                                                                                >
                                                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                                </button>
                                                                            </td>
                                                                            <td className="p-2 text-gray-500">{c.customer_id}</td>
                                                                            <td className="p-2 font-medium">{c.name}</td>
                                                                            <td className="p-2">
                                                                                <span className="text-purple-600">{c.owner_name}</span>
                                                                                <span className="text-gray-400 text-[10px] ml-1">({c.owner_role})</span>
                                                                            </td>
                                                                            <td className="p-2 text-right font-bold text-red-600">{c.days_in_basket}d</td>
                                                                            <td className="p-2 text-gray-600">{c.total_orders}</td>
                                                                            <td className="p-2">
                                                                                {c.order_statuses.split(', ').map((s: string) => (
                                                                                    <span key={s} className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1 ${statusColor(s)}`}>{s}</span>
                                                                                ))}
                                                                            </td>
                                                                            <td className="p-2 text-center"><ArrowRight size={10} className="text-gray-400 mx-auto" /></td>
                                                                            <td className="p-2 text-green-600 font-medium">{c.correct_basket_name}</td>
                                                                            <td className="p-2 text-gray-500 text-[11px]">{c.correct_reason}</td>
                                                                        </tr>

                                                                        {/* Expanded Evidence */}
                                                                        {isExpanded && (
                                                                            <tr>
                                                                                <td colSpan={11} className="p-0">
                                                                                    <div className="bg-gray-50 p-4 border-t">
                                                                                        {/* Transition Info */}
                                                                                        {c.transition && (
                                                                                            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
                                                                                                <strong>เข้า Basket 51:</strong> {c.transition.date} | 
                                                                                                ประเภท: <span className="font-medium">{c.transition.type}</span> | 
                                                                                                โดย: <span className="text-blue-600">{c.transition.by_name}</span> | 
                                                                                                จาก: {c.transition.from_name}
                                                                                                {c.transition.notes && <div className="text-gray-500 mt-1">หมายเหตุ: {c.transition.notes}</div>}
                                                                                            </div>
                                                                                        )}

                                                                                        {/* Orders Table */}
                                                                                        <table className="w-full text-xs bg-white border rounded-lg">
                                                                                            <thead className="bg-gray-100">
                                                                                                <tr>
                                                                                                    <th className="text-left p-2 font-semibold">Order ID</th>
                                                                                                    <th className="text-left p-2 font-semibold">สถานะ</th>
                                                                                                    <th className="text-left p-2 font-semibold">วันที่</th>
                                                                                                    <th className="text-left p-2 font-semibold">ผู้สร้าง</th>
                                                                                                    <th className="text-left p-2 font-semibold">Role</th>
                                                                                                    <th className="text-left p-2 font-semibold">Co.</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody>
                                                                                                {c.orders.map((o: any) => (
                                                                                                    <tr key={o.id} className="border-t hover:bg-gray-50">
                                                                                                        <td className="p-2 font-mono text-gray-600">{o.id}</td>
                                                                                                        <td className="p-2">
                                                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${statusColor(o.status)}`}>{o.status}</span>
                                                                                                        </td>
                                                                                                        <td className="p-2 text-gray-600">{o.date}</td>
                                                                                                        <td className="p-2">{o.creator_name} <span className="text-gray-400 text-[10px]">#{o.creator_id}</span></td>
                                                                                                        <td className="p-2 text-gray-500">{o.creator_role}</td>
                                                                                                        <td className="p-2 text-gray-500">{o.company_id}</td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </div>
                                                                                </td>
                                                                            </tr>
                                                                        )}
                                                                    </React.Fragment>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>

                                                {/* Fix Button */}
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={handleUpFix}
                                                        disabled={upFixing || upSelected.size === 0}
                                                        className="px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 shadow-sm"
                                                    >
                                                        {upFixing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                                                        {upFixing ? 'กำลังแก้ไข...' : upSelected.size === 0 ? 'เลือกลูกค้าที่ต้องการแก้' : `ยืนยันแก้ไข ${upSelected.size} คน`}
                                                    </button>
                                                    <button
                                                        onClick={handleUpScan}
                                                        disabled={upScanning}
                                                        className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
                                                    >
                                                        <RefreshCw size={20} /> สแกนใหม่
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : activeGroup === 'return_pool' ? (
                            /* Return to Pool Config */
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <RefreshCw size={24} />
                                    ตั้งค่าคืน Pool อัตโนมัติ
                                </h2>

                                <div className="space-y-6">
                                    {Object.entries(returnConfig).map(([key, config]) => (
                                        <div key={key} className="border-b pb-4">
                                            <label className="block font-medium text-gray-700 mb-2">
                                                {config.description}
                                            </label>
                                            <input
                                                type="text"
                                                value={config.value}
                                                onChange={(e) => setReturnConfig(prev => ({
                                                    ...prev,
                                                    [key]: { ...config, value: e.target.value }
                                                }))}
                                                className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-blue-500"
                                            />
                                            <span className="text-xs text-gray-400">{key}</span>
                                        </div>
                                    ))}

                                    <button
                                        onClick={handleSaveReturnConfig}
                                        disabled={saving}
                                        className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                        บันทึก
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Basket List */
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-xl font-bold text-gray-800">
                                        {BASKET_GROUPS.find(g => g.key === activeGroup)?.label}
                                    </h2>
                                    <button
                                        onClick={() => setEditingBasket({
                                            id: 0,
                                            basket_key: '',
                                            basket_name: '',
                                            min_order_count: null,
                                            max_order_count: null,
                                            min_days_since_order: null,
                                            max_days_since_order: null,
                                            days_since_first_order: null,
                                            days_since_registered: null,
                                            target_page: activeGroup as 'dashboard_v2' | 'distribution',
                                            display_order: filteredBaskets.length + 1,
                                            is_active: true,
                                            company_id: user?.companyId || 1
                                        })}
                                        className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 flex items-center gap-2"
                                    >
                                        <Plus size={20} />
                                        เพิ่มถังใหม่
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {filteredBaskets.map(basket => (
                                        <div key={basket.id} className="border rounded-xl p-4 hover:border-blue-300 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h3 className="font-semibold text-gray-800">{basket.basket_name}</h3>
                                                    <p className="text-sm text-gray-500">{basket.basket_key}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-1 rounded text-xs ${basket.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {basket.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                                    </span>
                                                    <button
                                                        onClick={() => setEditingBasket(basket)}
                                                        className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                                                    >
                                                        <Settings size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteBasket(basket.id)}
                                                        className="p-2 hover:bg-red-100 rounded-lg text-red-600"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-400">จำนวน Order:</span>
                                                    <br />
                                                    {basket.min_order_count ?? '-'} - {basket.max_order_count ?? '∞'}
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">วันนับจาก Order ล่าสุด:</span>
                                                    <br />
                                                    {basket.min_days_since_order ?? '-'} - {basket.max_days_since_order ?? '∞'}
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">วันนับจาก Order แรก:</span>
                                                    <br />
                                                    {basket.days_since_first_order ?? '-'} วัน
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">วันนับจากลงทะเบียน:</span>
                                                    <br />
                                                    {basket.days_since_registered ?? '-'} วัน
                                                </div>
                                            </div>

                                            {/* Transition Rules Visualization */}
                                            <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs text-gray-600 bg-gray-50/50 p-2 rounded">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">ย้ายเมื่อขายได้:</span>
                                                    <span className="font-medium text-green-600 truncate ml-2" title={basket.on_sale_basket_key || ''}>
                                                        {baskets.find(b => b.basket_key === basket.on_sale_basket_key)?.basket_name || basket.on_sale_basket_key || '-'}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">กรณีขายไม่ได้:</span>
                                                    <span className="font-medium text-red-600 truncate ml-2">
                                                        {basket.fail_after_days ? (
                                                            basket.on_fail_reevaluate
                                                                ? `${basket.fail_after_days} วัน → (ตามเกณฑ์ order ล่าสุด)`
                                                                : `${basket.fail_after_days} วัน → ${baskets.find(b => b.basket_key === basket.on_fail_basket_key)?.basket_name || basket.on_fail_basket_key || 'Pool'}`
                                                        ) : '-'}
                                                    </span>
                                                </div>
                                                {basket.has_loop && (
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-500">แจกสูงสุด:</span>
                                                        <span className="font-medium">
                                                            {basket.max_distribution_count ?
                                                                `${basket.max_distribution_count} รอบ ${basket.on_fail_reevaluate
                                                                    ? '→ (ตามเกณฑ์)'
                                                                    : (basket.on_max_dist_basket_key
                                                                        ? `→ ${baskets.find(b => b.basket_key === basket.on_max_dist_basket_key)?.basket_name || basket.on_max_dist_basket_key}`
                                                                        : '(วนซ้ำ)')
                                                                }`
                                                                : 'ไม่จำกัด'}
                                                        </span>
                                                    </div>
                                                )}
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">พักรายชื่อ:</span>
                                                    <span className="font-medium">
                                                        {basket.hold_days_before_redistribute ? `${basket.hold_days_before_redistribute} วัน` : 'แจกทันที'}
                                                    </span>
                                                </div>
                                                {basket.blocked_target_baskets && (
                                                    <div className="flex justify-between col-span-2">
                                                        <span className="text-gray-500">ถัง Block:</span>
                                                        <span className="font-medium text-red-600 truncate ml-2">
                                                            {basket.blocked_target_baskets.split(',').map(id =>
                                                                baskets.find(b => b.id.toString() === id.trim())?.basket_name || id
                                                            ).join(', ')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {filteredBaskets.length === 0 && (
                                        <div className="text-center py-12 text-gray-400">
                                            ยังไม่มีถังในหมวดหมู่นี้
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Edit Modal */}
                {editingBasket && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto">
                            <h3 className="text-xl font-bold mb-6">
                                {editingBasket.id ? 'แก้ไขถัง' : 'เพิ่มถังใหม่'}
                            </h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">รหัสถัง (Basket Key)</label>
                                    <input
                                        type="text"
                                        value={editingBasket.basket_key}
                                        onChange={(e) => setEditingBasket({ ...editingBasket, basket_key: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                        placeholder="เช่น new_customer"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อถัง</label>
                                    <input
                                        type="text"
                                        value={editingBasket.basket_name}
                                        onChange={(e) => setEditingBasket({ ...editingBasket, basket_name: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                        placeholder="e.g., ลูกค้าใหม่"
                                    />
                                </div>

                                {/* Order Count Range */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">จำนวนออเดอร์</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={editingBasket.min_order_count ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, min_order_count: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-24 border rounded-lg p-2 text-center"
                                            placeholder="ขั้นต่ำ"
                                        />
                                        <span className="text-gray-500">ถึง</span>
                                        <input
                                            type="number"
                                            value={editingBasket.max_order_count ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, max_order_count: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-24 border rounded-lg p-2 text-center"
                                            placeholder="สูงสุด"
                                        />
                                        <span className="text-gray-500 text-sm">ออเดอร์</span>
                                    </div>
                                </div>

                                {/* Days Since Last Order Range */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">วันนับจาก Order ล่าสุด</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            value={editingBasket.min_days_since_order ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, min_days_since_order: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-24 border rounded-lg p-2 text-center"
                                            placeholder="ตั้งแต่"
                                        />
                                        <span className="text-gray-500">ถึง</span>
                                        <input
                                            type="number"
                                            value={editingBasket.max_days_since_order ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, max_days_since_order: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-24 border rounded-lg p-2 text-center"
                                            placeholder="ถึง"
                                        />
                                        <span className="text-gray-500 text-sm">วัน</span>
                                    </div>
                                </div>

                                {/* Days Since First Order & Registration */}
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">วันนับจาก Order แรก (ขั้นต่ำ)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={editingBasket.days_since_first_order ?? ''}
                                                onChange={(e) => setEditingBasket({ ...editingBasket, days_since_first_order: e.target.value ? parseInt(e.target.value) : null })}
                                                className="w-full border rounded-lg p-2"
                                                placeholder="ว่าง = ไม่จำกัด"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">วันนับจากลงทะเบียน (ขั้นต่ำ)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={editingBasket.days_since_registered ?? ''}
                                                onChange={(e) => setEditingBasket({ ...editingBasket, days_since_registered: e.target.value ? parseInt(e.target.value) : null })}
                                                className="w-full border rounded-lg p-2"
                                                placeholder="ว่าง = ไม่จำกัด"
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">สำหรับลูกค้าที่ไม่เคยสั่งซื้อ</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ลำดับการแสดง</label>
                                    <input
                                        type="number"
                                        value={editingBasket.display_order}
                                        onChange={(e) => setEditingBasket({ ...editingBasket, display_order: parseInt(e.target.value) || 0 })}
                                        className="w-full border rounded-lg p-2"
                                    />
                                </div>

                                {/* Transition Rules - Only for Dashboard baskets */}
                                {editingBasket.target_page !== 'distribution' && (
                                    <div className="border-t pt-4 mt-4">
                                        <h4 className="font-semibold text-gray-800 mb-3">กฎการย้ายถัง (Transition Rules)</h4>

                                        {/* Sale Success */}
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">เมื่อขายได้ ย้ายไปที่:</label>
                                            <select
                                                value={editingBasket.on_sale_basket_key || ''}
                                                onChange={(e) => setEditingBasket({ ...editingBasket, on_sale_basket_key: e.target.value || null })}
                                                className="w-full border rounded-lg p-2"
                                            >
                                                <option value="">-- ไม่ย้าย --</option>
                                                {baskets.map(b => (
                                                    <option key={b.id} value={b.basket_key}>
                                                        {b.basket_name} [{b.target_page === 'distribution' ? 'แจก' : 'Dashboard'}]
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Loop Toggle */}
                                        <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={editingBasket.has_loop || false}
                                                    onChange={(e) => setEditingBasket({ ...editingBasket, has_loop: e.target.checked })}
                                                    className="w-4 h-4 text-blue-600 rounded"
                                                />
                                                <span className="font-medium text-gray-800">มีวนซ้ำ (Distribution Loop)</span>
                                            </label>
                                        </div>

                                        {/* Fail / Timeout Section */}
                                        <div className="p-3 bg-red-50 rounded-lg mb-4">
                                            <div className="font-medium text-red-800 text-sm mb-3">กรณีขายไม่ได้ / หมดเวลา</div>

                                            <div className="grid grid-cols-2 gap-4 mb-3">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700 mb-1">ไม่ขายภายใน (วัน)</label>
                                                    <input
                                                        type="number"
                                                        value={editingBasket.fail_after_days ?? ''}
                                                        onChange={(e) => setEditingBasket({ ...editingBasket, fail_after_days: e.target.value ? parseInt(e.target.value) : null })}
                                                        className="w-full border rounded-lg p-2"
                                                        placeholder="เช่น 30"
                                                    />
                                                </div>
                                                {editingBasket.has_loop ? (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">วนกลับไปถัง</label>
                                                        <select
                                                            value={editingBasket.on_fail_basket_key || ''}
                                                            onChange={(e) => setEditingBasket({ ...editingBasket, on_fail_basket_key: e.target.value || null })}
                                                            className="w-full border rounded-lg p-2"
                                                        >
                                                            <option value="">-- ถังเดิม (Pool) --</option>
                                                            {baskets.map(b => (
                                                                <option key={b.id} value={b.basket_key}>{b.basket_name} [{b.target_page === 'distribution' ? 'แจก' : 'Dashboard'}]</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">ย้ายไปถัง</label>
                                                        <select
                                                            value={editingBasket.on_fail_basket_key || ''}
                                                            onChange={(e) => setEditingBasket({ ...editingBasket, on_fail_basket_key: e.target.value || null })}
                                                            className="w-full border rounded-lg p-2"
                                                            disabled={editingBasket.on_fail_reevaluate}
                                                        >
                                                            <option value="">-- ไม่ย้าย --</option>
                                                            {baskets.map(b => (
                                                                <option key={b.id} value={b.basket_key}>{b.basket_name} [{b.target_page === 'distribution' ? 'แจก' : 'Dashboard'}]</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Loop-specific fields */}
                                            {editingBasket.has_loop && (
                                                <div className="grid grid-cols-2 gap-4 mb-3 pt-3 border-t border-red-200">
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">วนสูงสุด (รอบ)</label>
                                                        <input
                                                            type="number"
                                                            value={editingBasket.max_distribution_count ?? ''}
                                                            onChange={(e) => setEditingBasket({ ...editingBasket, max_distribution_count: e.target.value ? parseInt(e.target.value) : 0 })}
                                                            className="w-full border rounded-lg p-2"
                                                            placeholder="0 = ไม่จำกัด"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-700 mb-1">เมื่อครบจำนวนวน ไปยังถัง</label>
                                                        <select
                                                            value={editingBasket.on_max_dist_basket_key || ''}
                                                            onChange={(e) => setEditingBasket({ ...editingBasket, on_max_dist_basket_key: e.target.value || null })}
                                                            className="w-full border rounded-lg p-2"
                                                            disabled={editingBasket.on_fail_reevaluate}
                                                        >
                                                            <option value="">-- ไม่ย้าย (วนต่อ) --</option>
                                                            {baskets.map(b => (
                                                                <option key={b.id} value={b.basket_key}>{b.basket_name} [{b.target_page === 'distribution' ? 'แจก' : 'Dashboard'}]</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Re-Evaluate Checkbox */}
                                            <div className="mt-2 pt-2 border-t border-red-200">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        id="on_fail_reevaluate"
                                                        checked={editingBasket.on_fail_reevaluate || false}
                                                        onChange={(e) => setEditingBasket({ ...editingBasket, on_fail_reevaluate: e.target.checked })}
                                                        className="w-4 h-4 text-blue-600 rounded"
                                                    />
                                                    <label htmlFor="on_fail_reevaluate" className="text-sm font-medium text-gray-700">
                                                        กลับถังตามเกณฑ์อัตโนมัติ (Re-Evaluate)
                                                    </label>
                                                </div>
                                                {editingBasket.on_fail_reevaluate && (
                                                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-700">
                                                        <strong>หมายเหตุ:</strong> ระบบจะคำนวณถังเป้าหมายโดยอัตโนมัติจาก "วันนับจาก Order ล่าสุด"<br />
                                                        • &lt;180 วัน → กลับถังแจกเดิม<br />
                                                        • 180-365 วัน → ถังกลาง 6-12 เดือน<br />
                                                        • 366-1095 วัน → ถังกลาง 1-3 ปี<br />
                                                        • &gt;1095 วัน → ถังโบราณ เก่าเก็บ
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Hold Days */}
                                        <div className="mb-4">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">พักรายชื่อก่อนแจกซ้ำ (วัน)</label>
                                            <input
                                                type="number"
                                                value={editingBasket.hold_days_before_redistribute ?? ''}
                                                onChange={(e) => setEditingBasket({ ...editingBasket, hold_days_before_redistribute: e.target.value ? parseInt(e.target.value) : 0 })}
                                                className="w-full border rounded-lg p-2"
                                                placeholder="0 = แจกทันที"
                                            />
                                        </div>

                                        {/* Linked Basket */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">เชื่อมโยงกับถัง (ในอีกหน้า)</label>
                                            <select
                                                value={editingBasket.linked_basket_key || ''}
                                                onChange={(e) => setEditingBasket({ ...editingBasket, linked_basket_key: e.target.value || null })}
                                                className="w-full border rounded-lg p-2"
                                            >
                                                <option value="">-- ไม่เชื่อมโยง --</option>
                                                {baskets.filter(b => b.target_page !== editingBasket.target_page).map(b => (
                                                    <option key={b.id} value={b.basket_key}>{b.basket_name} ({b.target_page})</option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-gray-500 mt-1">ใช้สำหรับถังที่ปรากฏทั้งใน Dashboard และ หน้าแจก</p>
                                        </div>

                                        {/* Blocked Target Baskets - Only show when re-evaluate is enabled */}
                                        {editingBasket.on_fail_reevaluate && (
                                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                                <label className="block text-sm font-medium text-red-800 mb-2">
                                                    🚫 ถังที่ห้ามย้ายไป (Blocked Targets)
                                                </label>
                                                <p className="text-xs text-red-600 mb-3">
                                                    เลือกถังที่ต้องการ Block เพื่อป้องกันลูกค้าข้ามสาย (Lane Isolation)
                                                </p>
                                                <div className="max-h-48 overflow-auto space-y-1">
                                                    {baskets.filter(b => b.target_page === 'distribution' && b.id !== editingBasket.id).map(b => {
                                                        const blockedIds = (editingBasket.blocked_target_baskets || '').split(',').filter(Boolean);
                                                        const isBlocked = blockedIds.includes(b.id.toString());
                                                        return (
                                                            <label key={b.id} className={`flex items-center gap-2 p-2 rounded cursor-pointer ${isBlocked ? 'bg-red-100' : 'hover:bg-gray-100'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isBlocked}
                                                                    onChange={(e) => {
                                                                        let ids = blockedIds;
                                                                        if (e.target.checked) {
                                                                            ids = [...ids, b.id.toString()];
                                                                        } else {
                                                                            ids = ids.filter(id => id !== b.id.toString());
                                                                        }
                                                                        setEditingBasket({ ...editingBasket, blocked_target_baskets: ids.join(',') || null });
                                                                    }}
                                                                    className="w-4 h-4 text-red-600 rounded"
                                                                />
                                                                <span className={`text-sm ${isBlocked ? 'text-red-700 font-medium' : 'text-gray-700'}`}>
                                                                    {b.basket_name}
                                                                    <span className="text-xs text-gray-400 ml-1">(ID: {b.id})</span>
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                                {editingBasket.blocked_target_baskets && (
                                                    <div className="mt-2 pt-2 border-t border-red-200 text-xs text-red-600">
                                                        <strong>IDs ที่ถูก Block:</strong> {editingBasket.blocked_target_baskets}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}  {/* End of Transition Rules conditional */}

                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={editingBasket.is_active}
                                        onChange={(e) => setEditingBasket({ ...editingBasket, is_active: e.target.checked })}
                                        className="w-4 h-4"
                                    />
                                    <label className="text-sm text-gray-700">เปิดใช้งาน</label>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setEditingBasket(null)}
                                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={() => handleSaveBasket(editingBasket)}
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                                    บันทึก
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BasketSettingsPage;
