import React, { useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { PieChart, CheckCircle, Truck, XCircle, RefreshCw } from 'lucide-react';

interface ReportsPageProps {
  orders: Order[];
}

const StatCard: React.FC<{ title: string; value: number; icon: React.ElementType, color: string }> = ({ title, value, icon: Icon, color }) => (
    <div className={`bg-white p-6 rounded-lg shadow border-l-4 ${color}`}>
        <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 uppercase">{title}</p>
                <p className="text-3xl font-bold text-gray-800">{value}</p>
            </div>
            <Icon className="w-8 h-8 text-gray-300" />
        </div>
    </div>
);

const ReportsPage: React.FC<ReportsPageProps> = ({ orders }) => {

  const orderStats = useMemo(() => {
    return orders.reduce((acc, order) => {
      acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
      return acc;
    }, {} as Record<OrderStatus, number>);
  }, [orders]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">รายงานสรุป</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="จัดส่งสำเร็จ" 
          value={orderStats[OrderStatus.Delivered] || 0} 
          icon={CheckCircle}
          color="border-green-500"
        />
        <StatCard 
          title="กำลังจัดส่ง" 
          value={(orderStats[OrderStatus.Shipping] || 0) + (orderStats[OrderStatus.Picking] || 0)} 
          icon={Truck}
          color="border-blue-500"
        />
        <StatCard 
          title="ตีกลับ" 
          value={orderStats[OrderStatus.Returned] || 0} 
          icon={XCircle}
          color="border-red-500"
        />
         <StatCard 
          title="รอดำเนินการ" 
          value={orderStats[OrderStatus.Pending] || 0} 
          icon={RefreshCw}
          color="border-yellow-500"
        />
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <PieChart className="mr-3 text-indigo-500"/>
            สรุปสถานะออเดอร์ทั้งหมด
        </h3>
        <div className="space-y-4">
            {Object.entries(orderStats).map(([status, count]) => {
                const percentage = (count / orders.length) * 100;
                return (
                    <div key={status}>
                        <div className="flex justify-between mb-1">
                            <span className="text-base font-medium text-gray-700">{status}</span>
                            <span className="text-sm font-medium text-gray-500">{count} รายการ</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                        </div>
                    </div>
                )
            })}
        </div>
        {orders.length === 0 && (
             <div className="text-center py-10 text-gray-500">
                ไม่พบข้อมูลสำหรับสร้างรายงาน
            </div>
        )}
      </div>

    </div>
  );
};

export default ReportsPage;
