import React, { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../services/api';
import { Save, Loader2, Settings, AlertCircle, Plus, Trash2, RefreshCw, Users, Calendar, Package } from 'lucide-react';
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
    }
];

const BasketSettingsPage: React.FC<BasketSettingsPageProps> = ({ currentUser }) => {
    const user = currentUser;
    const [baskets, setBaskets] = useState<BasketConfig[]>([]);
    const [returnConfig, setReturnConfig] = useState<ReturnConfig>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeGroup, setActiveGroup] = useState<string>('dashboard_v2');
    const [editingBasket, setEditingBasket] = useState<BasketConfig | null>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [basketsResponse, returnResponse] = await Promise.all([
                apiFetch(`basket_config.php?companyId=${user?.companyId}`),
                apiFetch(`basket_config.php?action=return_config&companyId=${user?.companyId}`)
            ]);
            setBaskets(basketsResponse || []);
            setReturnConfig(returnResponse || {});
        } catch (error) {
            console.error('Failed to fetch basket config:', error);
            setMessage({ type: 'error', text: 'ไม่สามารถโหลดข้อมูลได้' });
        } finally {
            setLoading(false);
        }
    }, [user?.companyId]);

    useEffect(() => {
        if (user?.companyId) {
            fetchData();
        }
    }, [user?.companyId, fetchData]);

    const handleSaveBasket = async (basket: BasketConfig) => {
        setSaving(true);
        try {
            if (basket.id) {
                await apiFetch(`basket_config.php?id=${basket.id}&companyId=${user?.companyId}`, {
                    method: 'PUT',
                    body: JSON.stringify(basket)
                });
            } else {
                await apiFetch(`basket_config.php?companyId=${user?.companyId}`, {
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
            await apiFetch(`basket_config.php?id=${id}&companyId=${user?.companyId}`, {
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

            await apiFetch(`basket_config.php?action=return_config&companyId=${user?.companyId}`, {
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
                    <div className="flex items-center gap-3">
                        <Settings className="w-8 h-8 text-blue-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">ตั้งค่าถัง (Basket Settings)</h1>
                            <p className="text-gray-500">จัดการเงื่อนไขการจัดกลุ่มลูกค้าและการคืน Pool</p>
                        </div>
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
                        {activeGroup === 'return_pool' ? (
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
                                                    <span className="text-gray-400">Order Count:</span>
                                                    <br />
                                                    {basket.min_order_count ?? '-'} - {basket.max_order_count ?? '∞'}
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Days Since Order:</span>
                                                    <br />
                                                    {basket.min_days_since_order ?? '-'} - {basket.max_days_since_order ?? '∞'}
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">First Order:</span>
                                                    <br />
                                                    {basket.days_since_first_order ?? '-'} วัน
                                                </div>
                                                <div>
                                                    <span className="text-gray-400">Registered:</span>
                                                    <br />
                                                    {basket.days_since_registered ?? '-'} วัน
                                                </div>
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Basket Key</label>
                                    <input
                                        type="text"
                                        value={editingBasket.basket_key}
                                        onChange={(e) => setEditingBasket({ ...editingBasket, basket_key: e.target.value })}
                                        className="w-full border rounded-lg p-2"
                                        placeholder="e.g., new_customer"
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

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Order Count</label>
                                        <input
                                            type="number"
                                            value={editingBasket.min_order_count ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, min_order_count: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full border rounded-lg p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Order Count</label>
                                        <input
                                            type="number"
                                            value={editingBasket.max_order_count ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, max_order_count: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full border rounded-lg p-2"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Min Days Since Order</label>
                                        <input
                                            type="number"
                                            value={editingBasket.min_days_since_order ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, min_days_since_order: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full border rounded-lg p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Max Days Since Order</label>
                                        <input
                                            type="number"
                                            value={editingBasket.max_days_since_order ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, max_days_since_order: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full border rounded-lg p-2"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Days Since First Order</label>
                                        <input
                                            type="number"
                                            value={editingBasket.days_since_first_order ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, days_since_first_order: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full border rounded-lg p-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Days Since Registered</label>
                                        <input
                                            type="number"
                                            value={editingBasket.days_since_registered ?? ''}
                                            onChange={(e) => setEditingBasket({ ...editingBasket, days_since_registered: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full border rounded-lg p-2"
                                        />
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
