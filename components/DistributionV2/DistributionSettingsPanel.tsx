import React from 'react';
import { RefreshCw, ShieldCheck, Clock } from 'lucide-react';
import { BasketConfig } from '../../types/distribution';

interface DistributionSettingsPanelProps {
    baskets: BasketConfig[];
    basketCounts: Record<string, number>;
    activeBasket: string;
    setActiveBasket: (basketKey: string) => void;
    totalToDistribute: string;
    setTotalToDistribute: (val: string) => void;
    availableCount: number;
    loadingCustomers: boolean;
    fetchAllBasketCounts: () => void;
    fetchCustomers: () => void;
    fetchAgents: () => void;
    poolReadyCount: number;
    poolCooldownCount: number;
    poolCooldownDays: number;
}

const DistributionSettingsPanel: React.FC<DistributionSettingsPanelProps> = ({
    baskets,
    basketCounts,
    activeBasket,
    setActiveBasket,
    totalToDistribute,
    setTotalToDistribute,
    availableCount,
    loadingCustomers,
    fetchAllBasketCounts,
    fetchCustomers,
    fetchAgents,
    poolReadyCount,
    poolCooldownCount,
    poolCooldownDays
}) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                ตั้งค่าการแจก
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label className="block text-sm text-gray-500 mb-2">สถานะการแจก</label>
                    <select
                        value={activeBasket}
                        onChange={(e) => setActiveBasket(e.target.value)}
                        className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                        {baskets.map(basket => (
                            <option key={basket.basket_key} value={basket.basket_key}>
                                {basket.basket_name} ({basketCounts[basket.basket_key] || 0})
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm text-gray-500 mb-2">จำนวนรวมที่ต้องการแจก</label>
                    <input
                        type="number"
                        value={totalToDistribute}
                        onChange={(e) => setTotalToDistribute(e.target.value)}
                        className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min={1}
                        max={availableCount || 1000}
                        placeholder={`มี ${availableCount} พร้อมแจก`}
                    />
                </div>
                <div className="flex items-end">
                    <button
                        onClick={() => { fetchAllBasketCounts(); fetchCustomers(); fetchAgents(); }}
                        className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
                    >
                        <RefreshCw size={16} className={loadingCustomers ? 'animate-spin' : ''} />
                        รีเฟรช
                    </button>
                </div>
            </div>
            <div className="mt-4 border-t pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                    <ShieldCheck size={16} />
                    Smart Allocation เปิดอยู่เสมอ
                    <span className="font-normal text-gray-500">— ไม่แจกรายชื่อซ้ำให้พนักงานคนเดิม</span>
                </span>
                {poolCooldownCount > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-amber-700">
                        <Clock size={16} />
                        พร้อมแจก <strong>{poolReadyCount.toLocaleString()}</strong>
                        <span className="text-gray-500">· เพิ่งโทรติดใน {poolCooldownDays} วัน {poolCooldownCount.toLocaleString()} ราย (อยู่ท้ายคิว)</span>
                    </span>
                )}
            </div>
        </div>
    );
};

export default DistributionSettingsPanel;
