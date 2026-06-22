import React from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Customer, BasketConfig } from '../../types/distribution';

interface DistributionCustomerPreviewProps {
    activeBasketInfo: BasketConfig | undefined;
    availableCount: number;
    customers: Customer[];
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
                                <th className="text-left p-3 font-medium">ชื่อ</th>
                                <th className="text-left p-3 font-medium">เบอร์โทร</th>
                                <th className="text-left p-3 font-medium">จังหวัด</th>
                                <th className="text-left p-3 font-medium">Order ล่าสุด</th>
                                <th className="text-right p-3 font-medium">ยอดซื้อ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.slice(0, 50).map(customer => (
                                <tr key={customer.id} className="border-t hover:bg-gray-50">
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
                            ))}
                        </tbody>
                    </table>
                    {customers.length > 50 && (
                        <div className="text-center py-3 text-gray-400 text-sm">
                            แสดง 50 จาก {customers.length} รายการ
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DistributionCustomerPreview;
