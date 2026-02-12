import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';
import { Save, Loader2, Settings, AlertCircle, Plus, Trash2, X, CheckCircle } from 'lucide-react';
import { User } from '../types';

// MultiSelect Component
const MultiSelect: React.FC<{
    options: string[];
    value: string[]; // Array of selected values
    onChange: (selected: string[]) => void;
    placeholder?: string;
}> = ({ options, value, onChange, placeholder = "Select..." }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleOption = (option: string) => {
        const newValue = value.includes(option)
            ? value.filter(v => v !== option)
            : [...value, option];
        onChange(newValue);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div
                className="w-full min-h-[38px] p-2 border rounded-md text-sm bg-white focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 cursor-pointer flex flex-wrap gap-1 items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                {value.length === 0 && <span className="text-gray-400">{placeholder}</span>}
                {value.map(v => (
                    <span key={v} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                        {v}
                        <X size={12} className="cursor-pointer hover:text-blue-900" onClick={(e) => { e.stopPropagation(); toggleOption(v); }} />
                    </span>
                ))}
            </div>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {options.map(opt => (
                        <div
                            key={opt}
                            className={`px-3 py-2 cursor-pointer text-sm flex items-center gap-2 hover:bg-gray-50 ${value.includes(opt) ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
                            onClick={() => toggleOption(opt)}
                        >
                            <div className={`w-4 h-4 border rounded flex items-center justify-center ${value.includes(opt) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                                {value.includes(opt) && <CheckCircle size={12} className="text-white" />}
                            </div>
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

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

const TAB_GROUPS = [
    {
        label: 'Order Management',
        tabs: [
            { key: 'waitingVerifySlip', label: 'รอตรวจสอบสลิป' },
            { key: 'waitingExport', label: 'รอดึงข้อมูล' },
            { key: 'preparing', label: 'กำลังเตรียมสินค้า' },
            { key: 'shipping', label: 'กำลังจัดส่ง' },
            { key: 'awaiting_account', label: 'รอตรวจสอบจากบัญชี' },
            { key: 'completed', label: 'เสร็จสิ้น' },
            { key: 'returned', label: 'ตีกลับ' },
            { key: 'cancelled', label: 'ยกเลิก' },
        ]
    },
    {
        label: 'Debt Collection',
        tabs: [
            { key: 'debtCollection', label: 'ติดตามหนี้' },
        ]
    }
];

// Flatten for backward compatibility
const TABS = TAB_GROUPS.flatMap(group => group.tabs);

const ORDER_STATUSES = [
    'ALL',
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
    'ALL',
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
    const [activeTabKey, setActiveTabKey] = useState<string>(TABS[0].key);

    // Matrix State: paymentMethod -> Array of { orderStatus: string[]; paymentStatus: string[] }
    const [matrix, setMatrix] = useState<Record<string, { orderStatus: string[]; paymentStatus: string[] }[]>>({});
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
        const newMatrix: Record<string, { orderStatus: string[]; paymentStatus: string[] }[]> = {};

        // Initialize with empty arrays
        PAYMENT_METHODS.forEach(pm => {
            newMatrix[pm] = [];
        });

        // Compression Logic:
        // 1. Filter rules for this Tab
        const tabRules = rules.filter(r => r.tab_key === activeTabKey);

        // 2. Group by Payment Method
        PAYMENT_METHODS.forEach(pm => {
            const pmRules = tabRules.filter(r => r.payment_method === pm);
            if (pmRules.length === 0) return;

            // Normalize 'ALL' or null values for consistent grouping
            const normalize = (val: string | null) => (!val || val === 'ALL') ? 'ALL' : val;

            // Map: normalized OS -> Set of normalized PS values
            const mapOsToPs = new Map<string, Set<string>>();

            pmRules.forEach(r => {
                const os = normalize(r.order_status);
                const ps = normalize(r.payment_status);

                if (!mapOsToPs.has(os)) mapOsToPs.set(os, new Set());
                mapOsToPs.get(os)!.add(ps);
            });

            // Invert: sorted PS values CSV -> List of OS values
            const mapPsSetToOsList = new Map<string, string[]>();

            mapOsToPs.forEach((psSet, os) => {
                const psKey = Array.from(psSet).sort().join(',');
                if (!mapPsSetToOsList.has(psKey)) mapPsSetToOsList.set(psKey, []);
                mapPsSetToOsList.get(psKey)!.push(os);
            });

            // Build Matrix Rows
            mapPsSetToOsList.forEach((osList, psKey) => {
                const psArray = psKey ? psKey.split(',') : [];

                newMatrix[pm].push({
                    orderStatus: osList,
                    paymentStatus: psArray
                });
            });
        });

        // Ensure at least one row per Payment Method for easy editing
        PAYMENT_METHODS.forEach(pm => {
            if (newMatrix[pm].length === 0) {
                newMatrix[pm].push({ orderStatus: [], paymentStatus: [] });
            }
        });

        setMatrix(newMatrix);
    }, [rules, activeTabKey]);

    const handleSaveAll = async () => {
        setLoading(true);
        setSaving(true);
        try {
            const promises: Promise<any>[] = [];

            // Identify rules to delete (ALL rules for displayed Payment Methods in this Tab)
            const currentTabRules = rules.filter(r => r.tab_key === activeTabKey && PAYMENT_METHODS.includes(r.payment_method || ''));
            currentTabRules.forEach(r => {
                promises.push(apiFetch(`tab_rules?id=${r.id}`, { method: 'DELETE' }));
            });

            // Create New Rules
            PAYMENT_METHODS.forEach(pm => {
                const conditions = matrix[pm] || [];
                conditions.forEach(cond => {
                    // Filter empty conditions (both empty array)
                    if (cond.orderStatus.length === 0 && cond.paymentStatus.length === 0) return;

                    // Explode
                    // If an array is empty, it means 'ALL'. We represent this as an empty string for DB.
                    // If 'ALL' is explicitly selected, we save 'ALL'.
                    const osList = cond.orderStatus.length > 0 ? cond.orderStatus : [''];
                    const psList = cond.paymentStatus.length > 0 ? cond.paymentStatus : [''];

                    osList.forEach(os => {
                        psList.forEach(ps => {
                            promises.push(apiFetch('tab_rules', {
                                method: 'POST',
                                body: JSON.stringify({
                                    tab_key: activeTabKey,
                                    payment_method: pm,
                                    payment_status: ps === 'ALL' ? 'ALL' : (ps || null), // If ps is '', it becomes null. If 'ALL', it's 'ALL'.
                                    order_status: os === 'ALL' ? 'ALL' : (os || null), // If os is '', it becomes null. If 'ALL', it's 'ALL'.
                                    description: 'Exploded rule',
                                    display_order: 0,
                                    company_id: user?.companyId
                                })
                            }));
                        });
                    });
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

    const handleUpdateLocalMatrix = (paymentMethod: string, index: number, field: 'orderStatus' | 'paymentStatus', value: string[]) => {
        setMatrix(prev => {
            const newList = [...(prev[paymentMethod] || [])];
            if (newList[index]) {
                let newValue = value;
                const prevArr = newList[index][field] || [];
                const hasAll = value.includes('ALL');

                if (hasAll && !prevArr.includes('ALL')) {
                    // Just clicked ALL, clear others
                    newValue = ['ALL'];
                } else if (prevArr.includes('ALL') && value.length > 1) {
                    // Had ALL, clicked something else, remove ALL
                    newValue = value.filter(v => v !== 'ALL');
                }

                newList[index] = { ...newList[index], [field]: newValue };
            }
            return { ...prev, [paymentMethod]: newList };
        });
    };

    const handleAddCondition = (paymentMethod: string) => {
        setMatrix(prev => ({
            ...prev,
            [paymentMethod]: [...(prev[paymentMethod] || []), { orderStatus: [], paymentStatus: [] }]
        }));
    };

    const handleRemoveCondition = (paymentMethod: string, index: number) => {
        setMatrix(prev => {
            const newList = [...(prev[paymentMethod] || [])];
            newList.splice(index, 1);
            return { ...prev, [paymentMethod]: newList };
        });
    };

    // Calculate changes (Simplistic check: Just always allow save if matrix !empty?)
    // Hard to check diff with exploded views without fetching fresh.
    // Let's assume always dirty if matrix has content, or implementation is stateless.
    // Allow save always for simplicity in this refactor.
    const hasAnyChanges = true;

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
                    <div className="space-y-4">
                        {TAB_GROUPS.map((group, groupIndex) => (
                            <div key={groupIndex}>
                                <div className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                                    {group.label}
                                </div>
                                <div className="space-y-1 mt-1">
                                    {group.tabs.map(tab => (
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
                                {groupIndex < TAB_GROUPS.length - 1 && (
                                    <div className="border-t border-gray-200 my-2"></div>
                                )}
                            </div>
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
                            disabled={loading || saving}
                            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-colors ${!loading && !saving
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
                        <div className="border rounded-lg overflow-visible pb-20">
                            {/* Increased pb to handle dropdown overflow, overflow-hidden removed */}
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-gray-50 text-gray-600 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-1/4 border-b">Payment Method</th>
                                        <th className="px-4 py-3 w-1/3 border-b">Order Status (Multi-Select)</th>
                                        <th className="px-4 py-3 w-1/3 border-b hidden md:table-cell">Payment Status (Multi-Select)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {PAYMENT_METHODS.map(pm => {
                                        const conditions = matrix[pm] || [];
                                        const isEmpty = conditions.length === 0;

                                        if (isEmpty) return null;

                                        return conditions.map((cond, index) => {
                                            // Dirty check logic removed as we rebuild rows

                                            // Ensure default values for components if undefined
                                            const osVal = cond.orderStatus || [];
                                            const psVal = cond.paymentStatus || [];

                                            return (
                                                <tr key={`${pm}-${index}`} className="hover:bg-gray-50 transition-colors">
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
                                                        <MultiSelect
                                                            options={ORDER_STATUSES}
                                                            value={osVal}
                                                            onChange={val => handleUpdateLocalMatrix(pm, index, 'orderStatus', val)}
                                                            placeholder="เลือกสถานะออเดอร์ (ว่าง=ทั้งหมด)"
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2 hidden md:table-cell align-top border-b">
                                                        <div className="flex items-start gap-2">
                                                            <div className="flex-grow">
                                                                <MultiSelect
                                                                    options={PAYMENT_STATUSES}
                                                                    value={psVal}
                                                                    onChange={val => handleUpdateLocalMatrix(pm, index, 'paymentStatus', val)}
                                                                    placeholder="เลือกสถานะการเงิน (ว่าง=ทั้งหมด)"
                                                                />
                                                            </div>

                                                            {conditions.length > 1 && (
                                                                <button
                                                                    onClick={() => handleRemoveCondition(pm, index)}
                                                                    className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition-colors mt-1"
                                                                    title="Remove condition"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            )}
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
                                <p>สามารถเพิ่มเงื่อนไขได้มากกว่า 1 ข้อต่อช่องทางชำระเงิน และสามารถเลือกสถานะได้หลายค่า (ระบบจะบันทึกแยกเป็นรายการย่อยอัตโนมัติ)</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OrderTabSettingsPage;
