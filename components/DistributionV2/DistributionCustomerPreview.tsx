import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Customer, BasketConfig } from '../../types/distribution';

// ป้ายอธิบายว่าทำไมรายชื่อนี้ถึงอยู่ลำดับนี้ (backend เป็นคนจัดกลุ่มมาให้ - ดู handleBasketCustomers)
const LEAD_GROUP_BADGE: Record<string, { label: string; className: string }> = {
    A1: { label: 'ยังไม่เคยโทร', className: 'bg-emerald-100 text-emerald-700' },
    B: { label: 'เคยโทรติด', className: 'bg-blue-100 text-blue-700' },
    A2: { label: 'โทรแล้วไม่ติด', className: 'bg-gray-100 text-gray-600' },
    cooldown: { label: 'เพิ่งโทรติด', className: 'bg-orange-100 text-orange-700' }
};

interface DistributionCustomerPreviewProps {
    activeBasketInfo: BasketConfig | undefined;
    availableCount: number;
    customers: (Customer & { lead_group?: string; days_since_talk?: number | null })[];
    loadingCustomers: boolean;
    fetchCustomers: () => void;
}

const DistributionCustomerPreview: React.FC<DistributionCustomerPreviewProps> = ({
    activeBasketInfo,
    availableCount,
    customers,
    loadingCustomers,
    fetchCustomers
}) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-700">
                    รายชื่อพร้อมแจก: {activeBasketInfo?.basket_name}
                    <span className="ml-2 text-gray-400">({availableCount} รายชื่อ)</span>
                </h3>
                <button
                    onClick={fetchCustomers}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    title="รีเฟรช"
                >
                    <RefreshCw size={18} className={loadingCustomers ? 'animate-spin' : ''} />
                </button>
            </div>

            {loadingCustomers ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
            ) : customers.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    ไม่พบลูกค้าในถังนี้
                </div>
            ) : (
                <div className="overflow-auto max-h-80">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                            <tr>
                                <th className="text-left p-3 font-medium">ลำดับ</th>
                                <th className="text-left p-3 font-medium">ชื่อ</th>
                                <th className="text-left p-3 font-medium">เบอร์โทร</th>
                                <th className="text-left p-3 font-medium">จังหวัด</th>
                                <th className="text-left p-3 font-medium">Order ล่าสุด</th>
                                <th className="text-right p-3 font-medium">ยอดซื้อ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.slice(0, 50).map((customer, idx) => {
                                const badge = LEAD_GROUP_BADGE[customer.lead_group || ''];
                                return (
                                <tr key={customer.id} className="border-t hover:bg-gray-50">
                                    <td className="p-3 whitespace-nowrap">
                                        <span className="text-gray-400 mr-2">{idx + 1}</span>
                                        {badge && (
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                                                {badge.label}
                                                {customer.days_since_talk !== null && customer.days_since_talk !== undefined
                                                    ? ` ${customer.days_since_talk} วัน`
                                                    : ''}
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-3">{customer.firstName} {customer.lastName}</td>
                                    <td className="p-3">{customer.phone}</td>
                                    <td className="p-3">{customer.province || '-'}</td>
                                    <td className="p-3">
                                        {customer.lastOrderDate
                                            ? new Date(customer.lastOrderDate).toLocaleDateString('th-TH')
                                            : '-'}
                                    </td>
                                    <td className="p-3 text-right">฿{(customer.totalPurchases || 0).toLocaleString()}</td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {availableCount > 50 && (
                        <div className="text-center py-3 text-gray-400 text-sm">
                            แสดง 50 รายแรกตามลำดับที่จะแจกจริง จากทั้งหมด {availableCount.toLocaleString()} รายการ
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DistributionCustomerPreview;
