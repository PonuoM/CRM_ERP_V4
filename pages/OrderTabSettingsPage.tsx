import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { Save, Loader2, Settings, AlertCircle } from 'lucide-react';
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

    // Matrix State: paymentMethod -> { orderStatus, paymentStatus, ruleId }
    const [matrix, setMatrix] = useState<Record<string, { orderStatus: string; paymentStatus: string; ruleId?: number }>>({});
    const [saving, setSaving] = useState<Record<string, boolean>>({});

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
        const newMatrix: Record<string, { orderStatus: string; paymentStatus: string; ruleId?: number }> = {};

        // Initialize with defaults
        PAYMENT_METHODS.forEach(pm => {
            newMatrix[pm] = { orderStatus: '', paymentStatus: '', ruleId: undefined };
        });

        // Fill from rules
        if (rules) {
            rules.filter(r => r.tab_key === activeTabKey).forEach(r => {
                if (r.payment_method && PAYMENT_METHODS.includes(r.payment_method)) {
                    newMatrix[r.payment_method] = {
                        orderStatus: r.order_status || '',
                        paymentStatus: r.payment_status || '',
                        ruleId: r.id
                    };
                }
            });
        }

        setMatrix(newMatrix);
    }, [rules, activeTabKey]);

    const handleSaveCell = async (paymentMethod: string) => {
        const cell = matrix[paymentMethod];
        setSaving(prev => ({ ...prev, [paymentMethod]: true }));

        try {
            // Case 1: Both empty -> Delete rule if exists
            if (!cell.orderStatus && !cell.paymentStatus) {
                if (cell.ruleId) {
                    await apiFetch(`tab_rules?id=${cell.ruleId}`, { method: 'DELETE' });
                }
            }
            // Case 2: Has values -> Create or Update
            else {
                const payload = {
                    tab_key: activeTabKey,
                    payment_method: paymentMethod,
                    payment_status: cell.paymentStatus || null,
                    order_status: cell.orderStatus || null,
                    description: 'Matrix configured',
                    display_order: 0,
                    company_id: user?.companyId
                };

                if (cell.ruleId) {
                    // Update
                    await apiFetch('tab_rules', {
                        method: 'PUT',
                        body: JSON.stringify({ ...payload, id: cell.ruleId })
                    });
                } else {
                    // Create
                    await apiFetch('tab_rules', {
                        method: 'POST',
                        body: JSON.stringify(payload)
                    });
                }
            }
            // Refresh rules to get new IDs etc.
            await fetchRules();
        } catch (error) {
            console.error('Failed to save rule:', error);
            alert('Failed to save changes');
        } finally {
            setSaving(prev => ({ ...prev, [paymentMethod]: false }));
        }
    };

    const handleUpdateLocalMatrix = (paymentMethod: string, field: 'orderStatus' | 'paymentStatus', value: string) => {
        setMatrix(prev => ({
            ...prev,
            [paymentMethod]: {
                ...prev[paymentMethod],
                [field]: value
            }
        }));
    };

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
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="animate-spin text-gray-400" size={32} />
                        </div>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-1/4">Payment Method</th>
                                        <th className="px-4 py-3 w-1/3">Order Status</th>
                                        <th className="px-4 py-3 w-1/3">Payment Status</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {PAYMENT_METHODS.map(pm => {
                                        const cell = matrix[pm] || { orderStatus: '', paymentStatus: '' };
                                        const ruleInDb = rules.find(r => r.tab_key === activeTabKey && r.payment_method === pm);
                                        // A cell is "saved" (clean) if the local state matches the DB state
                                        // DB state for a non-existent rule is empty strings
                                        const dbOrderStatus = ruleInDb?.order_status || '';
                                        const dbPaymentStatus = ruleInDb?.payment_status || '';

                                        const isDirty = cell.orderStatus !== dbOrderStatus || cell.paymentStatus !== dbPaymentStatus;

                                        return (
                                            <tr key={pm} className="hover:bg-gray-50">
                                                <td className="px-4 py-3 font-medium text-gray-700">
                                                    {pm}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={cell.orderStatus}
                                                        onChange={e => handleUpdateLocalMatrix(pm, 'orderStatus', e.target.value)}
                                                        className="w-full p-2 border rounded-md text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="" className="text-gray-400">- ไม่เลือก -</option>
                                                        {ORDER_STATUSES.map(st => st && (
                                                            <option key={st} value={st}>{st}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <select
                                                        value={cell.paymentStatus}
                                                        onChange={e => handleUpdateLocalMatrix(pm, 'paymentStatus', e.target.value)}
                                                        className="w-full p-2 border rounded-md text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                                                    >
                                                        <option value="" className="text-gray-400">- ไม่เลือก -</option>
                                                        {PAYMENT_STATUSES.map(st => st && (
                                                            <option key={st} value={st}>{st}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleSaveCell(pm)}
                                                        disabled={saving[pm] || !isDirty}
                                                        className={`p-2 rounded-md transition-colors ${saving[pm] ? 'bg-gray-100 text-gray-400' :
                                                            isDirty ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm' : 'text-gray-300 hover:text-gray-500 bg-gray-50'
                                                            }`}
                                                        title={isDirty ? "Save Changes" : "No Changes"}
                                                    >
                                                        {saving[pm] ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="bg-blue-50 p-3 text-xs text-blue-800 flex items-start gap-2">
                                <AlertCircle size={14} className="mt-0.5" />
                                <p>หากไม่เลือกทั้ง Order Status และ Payment Status ระบบจะไม่แสดงออเดอร์ของช่องทางชำระเงินนั้นในแท็บนี้</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderTabSettingsPage;
