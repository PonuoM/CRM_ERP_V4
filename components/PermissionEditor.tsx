import React, { useState, useEffect, useRef } from 'react';
import { Role, getRolePermissionsById, updateRolePermissionsById } from '@/services/roleApi';
import { X, Save, AlertCircle, CheckCircle2, Shield, ChevronDown, ChevronRight, Eye, MousePointer2, Layers, GripVertical, List, Layout } from 'lucide-react';

interface PermissionEditorProps {
    role: Role;
    onClose: () => void;
    onSave: () => void;
}

// Full Permission Structure mapped from Sidebar.tsx
const PERMISSION_GROUPS_DEF = {
    'Home': {
        label: 'หน้าแรก (Home)',
        items: [
            { key: 'home.dashboard', label: 'Dashboard (แดชบอร์ด)' },
            { key: 'home.talktime_dashboard', label: 'Dashboard Talk Time (แดชบอร์ดเวลาโทร)' },
            { key: 'home.sales_overview', label: 'Sales Overview (ภาพรวมยอดขาย)' },
            { key: 'accounting.report', label: 'Accounting Report (รายงานบัญชี)' },
        ]
    },
    'Orders & Customers': {
        label: 'คำสั่งซื้อและลูกค้า (Orders & Customers)',
        items: [
            { key: 'nav.customers', label: 'เมนู Customers (ลูกค้า)' },
            { key: 'home.dashboard_v2', label: 'Dashboard V2 (ตะกร้าลูกค้า)' },
            { key: 'nav.manage_customers', label: 'เมนู Manage Customers (แจกรายชื่อ)' },
            { key: 'nav.orders', label: 'เมนู Orders (คำสั่งซื้อ)' },
            { key: 'nav.manage_orders', label: 'เมนู Manage Orders (จัดการคำสั่งซื้อ - ขนส่ง)' },
            { key: 'nav.order_tab_settings', label: 'เมนู Order Tab Settings (ตั้งค่าจัดการคำสั่งซื้อ)' },
            { key: 'nav.search', label: 'เมนู Search (ค้นหาข้อมูล)' },
        ]
    },
    'Tracking & Transport': {
        label: 'จัดการขนส่ง (Tracking & Transport)',
        items: [
            { key: 'nav.debt', label: 'เมนู Debt (ติดตามหนี้)' },
            { key: 'nav.bulk_tracking', label: 'เมนู Bulk Tracking (จัดการ Tracking)' },
            { key: 'nav.cod_management', label: 'เมนู COD Management (จัดการยอด COD)' },
            { key: 'nav.google_sheet_import', label: 'เมนู Google Sheet Import (อัพสถานะ Aiport)' },
        ]
    },
    'Call Management': {
        label: 'จัดการการโทร (Call Management)',
        items: [
            { key: 'calls.overview', label: 'Calls Overview (ภาพรวมการโทร)' },
            { key: 'calls.details', label: 'Call Details (รายละเอียดการโทร)' },
            { key: 'calls.dtac', label: 'Dtac Onecall' },
        ]
    },
    'Inventory Management': {
        label: 'จัดการสต็อก (Inventory Management)',
        items: [
            { key: 'inventory.warehouses', label: 'Warehouses (คลังสินค้า)' },
            { key: 'inventory.stock', label: 'Warehouse Stock (สต็อกสินค้า)' },
            { key: 'inventory.documents', label: 'Stock Documents (รับเข้า/ปรับปรุง)' },
            { key: 'inventory.lot', label: 'Lot Tracking (ติดตามล๊อต)' },
            { key: 'inventory.allocations', label: 'Warehouse Allocation (จัดสรรคลังสินค้า)' },
            { key: 'inventory.reports', label: 'Inventory Reports (ส่งออกรายงานสต๊อค)' },
            { key: 'inventory.promotions', label: 'Active Promotions (ดูโปรโมชั่นในคลัง)' },
        ]
    },
    'Promotions': {
        label: 'โปรโมชั่น (Promotions)',
        items: [
            { key: 'promo.active', label: 'Active Promotions (โปรโมชั่นที่ใช้งาน)' },
            { key: 'promo.history', label: 'Promotion History (ประวัติโปรโมชั่น)' },
            { key: 'promo.create', label: 'Create Promotion (สร้างโปรโมชั่น)' },
        ]
    },
    'Marketing': {
        label: 'การตลาด (Marketing)',
        items: [
            { key: 'marketing.dashboard', label: 'Marketing Dashboard (แดชบอร์ด)' },
            { key: 'marketing.ads_input', label: 'Ads Input (กรอกค่า Ads)' },
            { key: 'marketing.ads_history', label: 'Ads History (ประวัติการกรอก Ads)' },
            { key: 'marketing.user_management', label: 'Marketing User Management (จัดการผู้ใช้การตลาด-เพจ)' },
        ]
    },
    'Slip Management': {
        label: 'จัดการสลิป (Slip Management)',
        items: [
            { key: 'payment_slip.upload', label: 'Slip Upload (อัปโหลดสลิป)' },
            { key: 'payment_slip.all', label: 'All Slips (สลิปทั้งหมด)' },
        ]
    },
    'Reports': {
        label: 'รายงาน (Reports)',
        items: [
            { key: 'nav.reports', label: 'เมนู Reports (รายงานทั่วไป)' },
            { key: 'reports.reports', label: 'Reports Dashboard' },
            { key: 'reports.export_history', label: 'Export History (ประวัติการส่งออก)' },
            { key: 'reports.import_export', label: 'Import Export (นำเข้า/ส่งออก)' },
        ]
    },
    'Finance': {
        label: 'การเงิน (Finance)',
        items: [
            { key: 'nav.finance_approval', label: 'Finance Approval (ตรวจสอบยอดเงิน)' },
            { key: 'nav.statement_management', label: 'Statement Management (จัดการ Statement)' },
            { key: 'finance-commission', label: 'Commission Menu (เมนูคำนวณค่าคอม)' },
        ]
    },
    'Accounting Audit': {
        label: 'ตรวจสอบจากบัญชี (Accounting Audit)',
        items: [
            { key: 'accounting.audit.bank', label: 'Bank Account Audit (ตรวจสอบบัญชีธนาคาร)' },
            { key: 'revenue_recognition', label: 'Revenue Recognition (ปิดบัญชีลูกหนี้)' },
            { key: 'accounting.audit.all_orders_sent', label: 'All Orders Sent (รายการส่งของ/บิล)' },
        ]
    },
    'Data Management': {
        label: 'จัดการข้อมูลระบบ (Data Management)',
        items: [
            { key: 'data.users', label: 'จัดการ Users (ผู้ใช้งาน)' },
            { key: 'data.products', label: 'จัดการ Products (สินค้า)' },
            { key: 'data.pages', label: 'จัดการ Pages (เพจ)' },
            { key: 'data.platforms', label: 'จัดการ Platforms' },
            { key: 'data.bank_accounts', label: 'จัดการ Bank Accounts (บัญชีธนาคาร)' },
            { key: 'data.tags', label: 'จัดการ Tags' },
            { key: 'data.companies', label: 'จัดการ Companies (บริษัท)' },
            { key: 'data.roles', label: 'จัดการ Roles (บทบาทและสิทธิ์)' },
        ]
    },
    'System': {
        label: 'ระบบ (System)',
        items: [
            { key: 'nav.change_password', label: 'เปลี่ยนรหัสผ่าน' },
        ]
    }
} as const;

type GroupKey = keyof typeof PERMISSION_GROUPS_DEF;

export default function PermissionEditor({ role, onClose, onSave }: PermissionEditorProps) {
    const [permissions, setPermissions] = useState<Record<string, { view?: boolean; use?: boolean }>>({});
    const [menuOrder, setMenuOrder] = useState<string[]>(Object.keys(PERMISSION_GROUPS_DEF));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        'Home': true,
        'Orders & Customers': true
    });
    const [activeTab, setActiveTab] = useState<'permissions' | 'menu_order'>('permissions');

    // Drag & Drop State
    const [draggingItem, setDraggingItem] = useState<string | null>(null);

    useEffect(() => {
        loadPermissions();
    }, [role.id]);

    async function loadPermissions() {
        try {
            setLoading(true);
            setError(null);
            const data = await getRolePermissionsById(role.id);
            const fetchedData = data.permissions || {};

            // Check if it's new structure { permissions: ..., menu_order: ... }
            if (fetchedData.permissions && typeof fetchedData.permissions === 'object') {
                setPermissions(fetchedData.permissions);
                if (fetchedData.menu_order && Array.isArray(fetchedData.menu_order)) {
                    // Ensure all current keys exist in the order, append new ones if any
                    const currentKeys = Object.keys(PERMISSION_GROUPS_DEF);
                    const mergedOrder = [...fetchedData.menu_order];
                    currentKeys.forEach(k => {
                        if (!mergedOrder.includes(k)) mergedOrder.push(k);
                    });
                    setMenuOrder(mergedOrder);
                }
            } else {
                // Legacy structure (flat permissions)
                setPermissions(fetchedData);
                // Default order
                setMenuOrder(Object.keys(PERMISSION_GROUPS_DEF));
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load permissions');
        } finally {
            setLoading(false);
        }
    }

    async function handleSave() {
        try {
            setSaving(true);
            setError(null);

            // Wrap in new structure
            const payload = {
                permissions: permissions,
                menu_order: menuOrder
            };

            await updateRolePermissionsById(role.id, payload);
            onSave();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save permissions');
        } finally {
            setSaving(false);
        }
    }

    // ... Toggle Functions (Keep existing logic) ...
    function togglePermission(key: string, type: 'view' | 'use') {
        setPermissions((prev) => {
            const current = prev[key] || {};
            let newView = current.view;
            let newUse = current.use;
            if (type === 'view') {
                newView = !newView;
                if (!newView) newUse = false;
            } else {
                newUse = !newUse;
                if (newUse) newView = true;
            }
            return {
                ...prev,
                [key]: { ...current, view: newView, use: newUse },
            };
        });
    }

    function toggleGroup(groupKey: string, type: 'view' | 'use', value: boolean) {
        setPermissions((prev) => {
            const updated = { ...prev };
            // @ts-ignore
            const items = PERMISSION_GROUPS_DEF[groupKey]?.items || [];
            items.forEach((item: any) => {
                const current = updated[item.key] || {};
                let newView = current.view;
                let newUse = current.use;
                if (type === 'view') {
                    newView = value;
                    if (!value) newUse = false;
                } else {
                    newUse = value;
                    if (value) newView = true;
                }
                updated[item.key] = { view: newView, use: newUse };
            });
            return updated;
        });
    }

    function toggleExpand(groupName: string) {
        setExpandedGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
    }

    function isGroupAllChecked(groupKey: string, type: 'view' | 'use') {
        // @ts-ignore
        const items = PERMISSION_GROUPS_DEF[groupKey]?.items || [];
        if (items.length === 0) return false;
        return items.every((item: any) => permissions[item.key]?.[type]);
    }

    // === Drag and Drop Handlers ===
    const handleDragStart = (e: React.DragEvent, item: string) => {
        setDraggingItem(item);
        e.dataTransfer.effectAllowed = 'move';
        // Transparent drag image or default
    };

    const handleDragOver = (e: React.DragEvent, overItem: string) => {
        e.preventDefault();
        if (!draggingItem || draggingItem === overItem) return;

        const currentOrder = [...menuOrder];
        const oldIndex = currentOrder.indexOf(draggingItem);
        const newIndex = currentOrder.indexOf(overItem);

        if (oldIndex !== -1 && newIndex !== -1) {
            // Swap logic directly on drag over for real-time feedback
            currentOrder.splice(oldIndex, 1);
            currentOrder.splice(newIndex, 0, draggingItem);
            setMenuOrder(currentOrder);
        }
    };

    const handleDragEnd = () => {
        setDraggingItem(null);
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 font-sans animate-fade-in text-slate-800">
            {/* Header Area */}
            <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm flex-shrink-0">
                {/* Title & Actions */}
                <div className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
                        >
                            <ChevronDown className="w-6 h-6 rotate-90" />
                        </button>
                        <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                {role.name}
                                <span className="text-xs font-normal text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full bg-gray-50">{role.code}</span>
                            </h1>
                            <p className="text-xs text-gray-500">จัดการสิทธิ์และการแสดงผลเมนู</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                            disabled={saving}
                        >
                            ยกเลิก
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm hover:shadow-md disabled:opacity-70 font-medium"
                        >
                            {saving ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                    บันทึก
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    บันทึก
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Top Tabs */}
                <div className="px-6 flex gap-6">
                    <button
                        onClick={() => setActiveTab('permissions')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'permissions' ? 'border-green-500 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <List className="w-4 h-4" />
                        กำหนดสิทธิ์ (Permissions)
                    </button>
                    <button
                        onClick={() => setActiveTab('menu_order')}
                        className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'menu_order' ? 'border-green-500 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                    >
                        <Layout className="w-4 h-4" />
                        จัดเรียงเมนู (Sorting)
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <div className="h-full overflow-y-auto p-6 md:p-8">
                    {loading && (
                        <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-green-500 border-t-transparent mb-3"></div>
                            <span>กำลังโหลดข้อมูล...</span>
                        </div>
                    )}

                    {!loading && !error && activeTab === 'permissions' && (
                        <div className="max-w-5xl mx-auto space-y-6">
                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-4 items-start">
                                <CheckCircle2 className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-blue-900 mb-1">คำแนะนำการใช้งาน</h4>
                                    <p className="text-sm text-blue-700 leading-relaxed">
                                        เลือก <strong>View</strong> เพื่อให้มองเห็นเมนู และ <strong>Use</strong> เพื่อใช้งานฟังก์ชั่นภายใน (เช่น ปุ่มกด, การแก้ไขข้อมูล).
                                        <br />สามารถคลิกที่หัวข้อเพื่อย่อ/ขยายดูรายการย่อยได้
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {menuOrder.map(groupKey => {
                                    // Filter only existing keys to prevent blank blocks if definition removed
                                    // @ts-ignore
                                    const group = PERMISSION_GROUPS_DEF[groupKey];
                                    if (!group) return null;

                                    const isExpanded = expandedGroups[groupKey];
                                    const hasViewAll = isGroupAllChecked(groupKey, 'view');
                                    const hasUseAll = isGroupAllChecked(groupKey, 'use');

                                    return (
                                        <div key={groupKey} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                            {/* Header */}
                                            <div
                                                className={`px-5 py-4 flex items-center justify-between cursor-pointer ${isExpanded ? 'bg-gray-50/80 border-b border-gray-100' : ''}`}
                                                onClick={() => toggleExpand(groupKey)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`p-2 rounded-lg ${isExpanded ? 'bg-white' : 'bg-gray-100'} transition-colors`}>
                                                        <Layers className="w-5 h-5 text-gray-500" />
                                                    </div>
                                                    <span className="font-bold text-gray-800 text-lg">{group.label}</span>
                                                </div>
                                                <div className="flex items-center gap-6" onClick={e => e.stopPropagation()}>
                                                    <div className="flex items-center gap-4 mr-4">
                                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                                                            <input type="checkbox" checked={hasViewAll} onChange={e => toggleGroup(groupKey, 'view', e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
                                                            <span className="text-sm font-medium text-gray-600">View All</span>
                                                        </label>
                                                        <label className="flex items-center gap-2 cursor-pointer hover:bg-green-50 px-2 py-1 rounded transition-colors">
                                                            <input type="checkbox" checked={hasUseAll} onChange={e => toggleGroup(groupKey, 'use', e.target.checked)} className="rounded text-green-600 focus:ring-green-500" />
                                                            <span className="text-sm font-medium text-gray-600">Use All</span>
                                                        </label>
                                                    </div>
                                                    {isExpanded ? <ChevronDown className="text-gray-400" /> : <ChevronRight className="text-gray-400" />}
                                                </div>
                                            </div>

                                            {/* Content */}
                                            {isExpanded && (
                                                <div className="divide-y divide-gray-50">
                                                    {group.items.map((item: any) => {
                                                        const perm = permissions[item.key] || {};
                                                        return (
                                                            <div key={item.key} className="px-5 py-3 pl-20 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                                                <div>
                                                                    <div className="font-medium text-gray-900">{item.label}</div>
                                                                    <div className="text-xs text-gray-400 font-mono mt-0.5">{item.key}</div>
                                                                </div>
                                                                <div className="flex items-center gap-8 mr-4">
                                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                                        <input type="checkbox" checked={perm.view || false} onChange={() => togglePermission(item.key, 'view')} className="rounded text-blue-600 border-gray-300" />
                                                                        <span className="text-sm text-gray-600">View</span>
                                                                    </label>
                                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                                        <input type="checkbox" checked={perm.use || false} onChange={() => togglePermission(item.key, 'use')} className="rounded text-green-600 border-gray-300" />
                                                                        <span className="text-sm text-gray-600">Use</span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {!loading && !error && activeTab === 'menu_order' && (
                        <div className="max-w-2xl mx-auto animate-fade-in-up">
                            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-6 flex gap-4 items-start">
                                <List className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-semibold text-yellow-900 mb-1">จัดเรียงเมนู (Menu Sorting)</h4>
                                    <p className="text-sm text-yellow-700 leading-relaxed">
                                        ลากและวาง (Drag & Drop) เพื่อจัดลำดับหมวดหมู่เมนูที่ต้องการให้แสดงผลใน Sidebar
                                        <br />ลำดับบนสุดจะแสดงเป็นเมนูแรก
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {menuOrder
                                    .filter(groupKey => {
                                        // @ts-ignore
                                        const group = PERMISSION_GROUPS_DEF[groupKey];
                                        if (!group) return false;
                                        // Only show groups where at least one item is viewable
                                        return group.items.some((item: any) => permissions[item.key]?.view);
                                    })
                                    .map((groupKey, index) => {
                                        // @ts-ignore
                                        const group = PERMISSION_GROUPS_DEF[groupKey];

                                        const isDragging = draggingItem === groupKey;

                                        return (
                                            <div
                                                key={groupKey}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, groupKey)}
                                                onDragOver={(e) => handleDragOver(e, groupKey)}
                                                onDragEnd={handleDragEnd}
                                                className={`
                                                    relative flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm cursor-move 
                                                    transition-all select-none group
                                                    ${isDragging ? 'opacity-50 ring-2 ring-green-500 bg-green-50 scale-[1.02]' : 'hover:border-green-300 hover:shadow-md'}
                                                `}
                                            >
                                                <div className="text-gray-300 group-hover:text-green-600 transition-colors">
                                                    <GripVertical className="w-6 h-6" />
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-sm">
                                                    {index + 1}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-bold text-gray-800">{group.label}</div>
                                                </div>
                                                <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100">
                                                    {groupKey}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-6 text-center text-red-600">
                            <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
