import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { Save, Loader2, Settings, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { User } from '../types';

interface OrderTabSettingsPageProps {
    currentUser?: User | null;
}

interface TabRule {
    id: number;
    tab_key: string;
    payment_method: string | null;
    payment_status: string | null;
    order_status: string | null;
    description: string | null;
    display_order: number;
    company_id: number;
}

const TABS = [
    { key: 'waitingVerifySlip', label: 'รอตรวจสอบสลิป' },
    { key: 'waitingExport', label: 'รอดึงข้อมูล' },
    { key: 'preparing', label: 'กำลังเตรียมสินค้า' },
    { key: 'shipping', label: 'กำลังจัดส่ง' },
    { key: 'awaiting_account', label: 'รอตรวจสอบจากบัญชี' },
    { key: 'completed', label: 'เสร็จสิ้น' },
    { key: 'cancelled', label: 'ยกเลิก' },
];

const ORDER_STATUSES = [
    '',
    'Pending',
    'AwaitingVerification',
    'Confirmed',
    'Preparing',
    'Picking',
    'Shipping',
    'PreApproved',
    'Delivered',
    'Returned',
    'Cancelled',
    'Claiming',
    'BadDebt'
];

const PAYMENT_METHODS = [
    'Transfer',
    'COD',
    'PayAfter',
    'Claim',
    'FreeGift'
];

const PAYMENT_STATUSES = [
    '',
    'Unpaid',
    'PendingVerification',
    'Verified',
    'PreApproved',
    'Approved',
    'Paid'
];

const OrderTabSettingsPage: React.FC<OrderTabSettingsPageProps> = ({ currentUser }) => {
    const user = currentUser;
    const [rules, setRules] = useState<TabRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTabKey, setActiveTabKey] = useState(TABS[0].key);

    // Matrix State: paymentMethod -> Array of { orderStatus, paymentStatus, ruleId }
    const [matrix, setMatrix] = useState<Record<string, { orderStatus: string; paymentStatus: string; ruleId?: number }[]>>({});
    const [saving, setSaving] = useState<boolean>(false);

    const fetchRules = async () => {
        setLoading(true);
        try {
            const response = await apiFetch('tab_rules');
            if (response.ok) {
                setRules(response.rules);
            }
        } catch (error) {
            console.error('Failed to fetch rules:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRules();
    }, []);

    // Rebuild matrix when rules or activeTab changes
    useEffect(() => {
        const newMatrix: Record<string, { orderStatus: string; paymentStatus: string; ruleId?: number }[]> = {};

        // Initialize with empry arrays
        PAYMENT_METHODS.forEach(pm => {
            newMatrix[pm] = [];
        });

        // Fill from rules
        if (rules) {
            rules.filter(r => r.tab_key === activeTabKey).forEach(r => {
                if (r.payment_method && PAYMENT_METHODS.includes(r.payment_method)) {
                    newMatrix[r.payment_method].push({
                        orderStatus: r.order_status || '',
                        paymentStatus: r.payment_status || '',
                        ruleId: r.id
                    });
                }
            });
        }

        // Ensure at least one row per Payment Method for easy editing
        PAYMENT_METHODS.forEach(pm => {
            if (newMatrix[pm].length === 0) {
                newMatrix[pm].push({ orderStatus: '', paymentStatus: '', ruleId: undefined });
            }
        });

        setMatrix(newMatrix);
    }, [rules, activeTabKey]);

    const handleSaveAll = async () => {
        setLoading(true);
        setSaving(true);
        try {
            // Logic to calculate diffs
            const promises: Promise<any>[] = [];

            PAYMENT_METHODS.forEach(pm => {
                const currentConditions = matrix[pm] || [];
                // Original rules in DB for this PM
                const dbRules = rules.filter(r => r.tab_key === activeTabKey && r.payment_method === pm);

                // 1. Identify DELETE (In DB but not in current matrix list of ruleIds)
                const currentRuleIds = new Set(currentConditions.map(c => c.ruleId).filter(Boolean));
                const toDelete = dbRules.filter(dbR => !currentRuleIds.has(dbR.id));

                toDelete.forEach(dbR => {
                    promises.push(apiFetch(`tab_rules?id=${dbR.id}`, { method: 'DELETE' }));
                });

                // 2. Identify UPSERT (Update existing or Create new)
                currentConditions.forEach(cond => {
                    // Check if it's completely empty? 
                    // If it has no ruleId and is empty, skip create.
                    // If it has ruleId and is empty, we keep it (update to empty) OR delete?
                    // Previous logic: both empty -> delete. 
                    // Current logic: We have explicit remove button. So if it's in the list, we save it.
                    // EXCEPT if it's a NEW row (no ruleId) and completely empty, we typically ignore it to prevent spamming empty rules.
                    const isEmpty = !cond.orderStatus && !cond.paymentStatus;

                    if (!cond.ruleId && isEmpty) {
                        return; // Skip creating empty rules
                    }

                    // Note: If an existing rule (cond.ruleId) becomes empty, we UPDATE it to empty values 
                    // (which effectively means "ANY" in some logic, or "NONE" depending on implementation).
                    // In previous implementation: "Case 1: Both empty -> Delete rule if exists".
                    // Let's stick to that for consistency?
                    // " หากไม่เลือกทั้ง Order Status และ Payment Status ระบบจะไม่แสดงออเดอร์ของช่องทางชำระเงินนั้นในแท็บนี้"
                    // So effectively it deletes the logic.
                    // If user manually removed content but didn't click trash, maybe we should delete it?
                    // Let's enforce the "Delete if both empty" rule for existing as well, to keep DB clean.

                    if (cond.ruleId && isEmpty) {
                        // It was already added to delete list above? NO, because ruleId is IN currentConditions.
                        // So we need to explicitly delete it here.
                        promises.push(apiFetch(`tab_rules?id=${cond.ruleId}`, { method: 'DELETE' }));
                        return;
                    }

                    const payload = {
                        tab_key: activeTabKey,
                        payment_method: pm,
                        payment_status: cond.paymentStatus || null,
                        order_status: cond.orderStatus || null,
                        description: 'Matrix configured',
                        display_order: 0,
                        company_id: user?.companyId
                    };

                    if (cond.ruleId) {
                        // Update
                        // Check if actually changed
                        const dbR = dbRules.find(r => r.id === cond.ruleId);
                        const isDirty = dbR && (dbR.order_status !== (cond.orderStatus || null) || dbR.payment_status !== (cond.paymentStatus || null));
                        if (isDirty) {
                            promises.push(apiFetch('tab_rules', {
                                method: 'PUT',
                                body: JSON.stringify({ ...payload, id: cond.ruleId })
                            }));
                        }
                    } else {
                        // Create
                        promises.push(apiFetch('tab_rules', {
                            method: 'POST',
                            body: JSON.stringify(payload)
                        }));
                    }
                });
            });

            await Promise.all(promises);
            await fetchRules();
            alert('บันทึกข้อมูลเรียบร้อยแล้ว');
        } catch (error) {
            console.error('Failed to save rules:', error);
            alert('Failed to save changes');
        } finally {
            setLoading(false);
            setSaving(false);
        }
    };

    const handleUpdateLocalMatrix = (paymentMethod: string, index: number, field: 'orderStatus' | 'paymentStatus', value: string) => {
        setMatrix(prev => {
            const newList = [...(prev[paymentMethod] || [])];
            if (newList[index]) {
                newList[index] = { ...newList[index], [field]: value };
            }
            return { ...prev, [paymentMethod]: newList };
        });
    };

    const handleAddCondition = (paymentMethod: string) => {
        setMatrix(prev => ({
            ...prev,
            [paymentMethod]: [...(prev[paymentMethod] || []), { orderStatus: '', paymentStatus: '', ruleId: undefined }]
        }));
    };

    const handleRemoveCondition = (paymentMethod: string, index: number) => {
        setMatrix(prev => {
            const newList = [...(prev[paymentMethod] || [])];
            newList.splice(index, 1);
            return { ...prev, [paymentMethod]: newList };
        });
    };

    // Calculate changes
    const hasAnyChanges = PAYMENT_METHODS.some(pm => {
        const currentConditions = matrix[pm] || [];
        const dbRules = rules.filter(r => r.tab_key === activeTabKey && r.payment_method === pm);

        // Check count mismatch (indicates add or remove)
        // Note: We might have added empty defaults that don't exist in DB.
        // So we filter currentConditions that are NOT (new AND empty).
        const effectiveCurrent = currentConditions.filter(c => c.ruleId || c.orderStatus || c.paymentStatus);

        if (effectiveCurrent.length !== dbRules.length) return true;

        // Check content mismatch
        for (const cond of effectiveCurrent) {
            if (!cond.ruleId) return true; // New non-empty rule
            const dbR = dbRules.find(r => r.id === cond.ruleId);
            if (!dbR) return true; // Should not happen if logic matches
            if ((dbR.order_status || '') !== cond.orderStatus) return true;
            if ((dbR.payment_status || '') !== cond.paymentStatus) return true;
        }

        return false;
    });

    return (
        <div className="p-6">
            <div className="flex items-center gap-3 mb-6">
                <Settings className="text-gray-600" size={24} />
                <h1 className="text-2xl font-bold text-gray-800">ตั้งค่าจัดการคำสั่งซื้อ (Order Tab Rules)</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar Tabs */}
                <div className="bg-white rounded-lg shadow-sm border p-2">
                    <h3 className="font-semibold text-gray-500 text-sm uppercase px-3 py-2 mb-2">Tabs</h3>
                    <div className="space-y-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTabKey(tab.key)}
                                className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${activeTabKey === tab.key
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className="md:col-span-3 bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-semibold text-gray-800">
                            เงื่อนไขสำหรับ: <span className="text-blue-600">{TABS.find(t => t.key === activeTabKey)?.label}</span>
                        </h2>
                        <button
                            onClick={handleSaveAll}
                            disabled={loading || saving || !hasAnyChanges}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${hasAnyChanges && !loading && !saving
                                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {loading || saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            บันทึกการเปลี่ยนแปลง
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin text-gray-400" size={32} />
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-1/4 border-b">Payment Method</th>
                                        <th className="px-4 py-3 w-1/3 border-b">Order Status</th>
                                        <th className="px-4 py-3 w-1/3 border-b hidden md:table-cell">Payment Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {PAYMENT_METHODS.map(pm => {
                                        const conditions = matrix[pm] || [];
                                        const isEmpty = conditions.length === 0;

                                        // Should not happen due to useEffect, but handle gracefully
                                        if (isEmpty) return null;

                                        return conditions.map((cond, index) => {
                                            const ruleInDb = rules.find(r => r.id === cond.ruleId);
                                            const isDirty = cond.ruleId
                                                ? (ruleInDb && (ruleInDb.order_status !== (cond.orderStatus || null) || ruleInDb.payment_status !== (cond.paymentStatus || null)))
                                                : (cond.orderStatus || cond.paymentStatus);

                                            return (
                                                <tr key={`${pm}-${index}`} className={`hover:bg-gray-50 transition-colors ${isDirty ? 'bg-blue-50/30' : ''}`}>
                                                    {index === 0 && (
                                                        <td
                                                            rowSpan={conditions.length}
                                                            className="px-4 py-3 font-medium text-gray-700 border-r md:border-r-0 align-top border-b"
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span>{pm}</span>
                                                                <button
                                                                    onClick={() => handleAddCondition(pm)}
                                                                    className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                                                                    title="Add another condition"
                                                                >
                                                                    <Plus size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}

                                                    <td className="px-4 py-2 align-top border-b">
                                                        <select
                                                            value={cond.orderStatus}
                                                            onChange={e => handleUpdateLocalMatrix(pm, index, 'orderStatus', e.target.value)}
                                                            className="w-full p-2 border rounded-md text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                        >
                                                            <option value="" className="text-gray-400">- เลือก -</option>
                                                            <option value="ALL" className="text-gray-800">ทั้งหมด</option>
                                                            {ORDER_STATUSES.map(st => st && (
                                                                <option key={st} value={st}>{st}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="px-4 py-2 hidden md:table-cell align-top border-b">
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={cond.paymentStatus}
                                                                onChange={e => handleUpdateLocalMatrix(pm, index, 'paymentStatus', e.target.value)}
                                                                className="w-full p-2 border rounded-md text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                            >
                                                                <option value="" className="text-gray-400">- เลือก -</option>
                                                                <option value="ALL" className="text-gray-800">ทั้งหมด</option>
                                                                {PAYMENT_STATUSES.map(st => st && (
                                                                    <option key={st} value={st}>{st}</option>
                                                                ))}
                                                            </select>

                                                            {conditions.length > 1 && (
                                                                <button
                                                                    onClick={() => handleRemoveCondition(pm, index)}
                                                                    className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors"
                                                                    title="Remove condition"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {/* Mobile View: PaymentStatus stacked (if needed, but hidden md:table-cell handles it) */}
                                                        {/* Actually for mobile we might need to rethink, but fitting current structure */}
                                                        <div className="md:hidden mt-2">
                                                            {/* Duplicate Select for Mobile if hidden above? No, the TH is hidden too. */}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })}
                                </tbody>
                            </table>
                            <div className="bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5" />
                                <p>สามารถเพิ่มเงื่อนไขได้มากกว่า 1 ข้อต่อช่องทางชำระเงิน หากเงื่อนไขใดเงื่อนไขหนึ่งเป็นจริง ออเดอร์จะแสดงในแท็บนี้</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderTabSettingsPage;
