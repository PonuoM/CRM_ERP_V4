import React, { useMemo } from 'react';
import { User, Order, OrderStatus, PaymentStatus, PaymentMethod, Customer, ModalType, Activity } from '../types';
import { FileScan, Truck, Undo2, AlertCircle, Activity as ActivityIcon } from 'lucide-react';
import { OrderStatusChart } from '../components/Charts';

interface BackofficeDashboardProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  activities: Activity[];
  openModal: (type: ModalType, data: Order) => void;
}

const DashboardStatCard: React.FC<{ title: string; value: string; icon: React.ElementType; color: string }> = ({ title, value, icon: Icon, color }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm border flex items-start">
        <div className={`p-3 rounded-lg mr-4 ${color}`}>
            <Icon size={20} className="text-white"/>
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-sm text-gray-500">{title}</p>
        </div>
    </div>
);


const BackofficeDashboard: React.FC<BackofficeDashboardProps> = ({ user, orders, customers, activities, openModal }) => {
  
  const stats = useMemo(() => {
    const pendingVerification = orders.filter(o => o.paymentStatus === PaymentStatus.PendingVerification);
    const needsTracking = orders.filter(o => o.orderStatus === OrderStatus.Picking && o.trackingNumbers.length === 0);
    const newReturns = orders.filter(o => o.orderStatus === OrderStatus.Returned);
    const debtCollection = orders.filter(o => 
        (o.paymentMethod === PaymentMethod.PayAfter && o.paymentStatus !== PaymentStatus.Paid) ||
        (o.paymentMethod === PaymentMethod.Transfer && o.paymentStatus === PaymentStatus.Unpaid)
    );
    
    return {
        pendingVerificationCount: pendingVerification.length,
        needsTrackingCount: needsTracking.length,
        newReturnsCount: newReturns.length,
        debtCount: debtCollection.length,
        urgentItems: pendingVerification.slice(0, 5)
    }
  }, [orders]);
  
  const orderStatusData = useMemo(() => {
    const statusCounts = orders.reduce((acc, order) => {
        acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
        return acc;
    }, {} as Record<OrderStatus, number>);
    
    return Object.entries(statusCounts).map(([label, value]) => ({ label, value, total: orders.length }));
  }, [orders]);

  // ดึงกิจกรรมล่าสุดจาก activities จริง
  const recentActivities = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
      .map(activity => {
        const timeAgo = getTimeAgo(new Date(activity.timestamp));
        return {
          id: activity.id,
          text: activity.description,
          time: timeAgo
        };
      });
  }, [activities]);
  
  // Helper function สำหรับคำนวณเวลาที่ผ่านมา
  function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "เมื่อสักครู่";
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    if (diffDays === 1) return "เมื่อวานนี้";
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
    return date.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardStatCard title="รอตรวจสอบสลิป" value={stats.pendingVerificationCount.toString()} icon={FileScan} color="bg-yellow-500" />
                <DashboardStatCard title="ต้องอัปเดต Tracking" value={stats.needsTrackingCount.toString()} icon={Truck} color="bg-blue-500" />
                <DashboardStatCard title="รายการตีกลับใหม่" value={stats.newReturnsCount.toString()} icon={Undo2} color="bg-red-500" />
                <DashboardStatCard title="ค้างชำระ" value={stats.debtCount.toString()} icon={AlertCircle} color="bg-orange-500" />
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">รายการที่ต้องดำเนินการด่วน (รอตรวจสอบสลิป)</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="text-left text-gray-500">
                            <tr>
                                <th className="py-2 px-3 font-medium">Order ID</th>
                                <th className="py-2 px-3 font-medium">ลูกค้า</th>
                                <th className="py-2 px-3 font-medium">ยอดเงิน</th>
                                <th className="py-2 px-3 font-medium">วันที่สั่ง</th>
                                <th className="py-2 px-3 font-medium"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.urgentItems.map(order => {
                                // Match customer by pk (customer_id) or id (string)
                                const customer = customers.find(c => {
                                  if (c.pk && typeof order.customerId === 'number') {
                                    return c.pk === order.customerId;
                                  }
                                  return String(c.id) === String(order.customerId) || 
                                         String(c.pk) === String(order.customerId);
                                });
                                return (
                                <tr key={order.id} className="border-t hover:bg-gray-50">
                                    <td className="py-3 px-3 font-mono text-xs text-gray-600">{order.id}</td>
                                    <td className="py-3 px-3 font-medium text-gray-800">{customer ? `${customer.firstName} ${customer.lastName}` : 'N/A'}</td>
                                    <td className="py-3 px-3">฿{order.totalAmount.toLocaleString()}</td>
                                    <td className="py-3 px-3 text-gray-500">{new Date(order.orderDate).toLocaleDateString('th-TH')}</td>
                                    <td className="py-3 px-3 text-right">
                                        <button 
                                            onClick={() => openModal('manageOrder', order)}
                                            className="text-blue-600 hover:text-blue-800 font-medium"
                                        >
                                            จัดการ
                                        </button>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {stats.urgentItems.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                            ไม่มีรายการที่ต้องดำเนินการด่วน
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
            <OrderStatusChart title="ภาพรวมสถานะออเดอร์" data={orderStatusData} />

            <div className="bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                   <ActivityIcon size={20} className="mr-2 text-gray-400" /> กิจกรรมล่าสุด
                </h3>
                <div className="space-y-4">
                    {recentActivities.map(activity => (
                        <div key={activity.id} className="flex">
                             <div className="relative h-full">
                                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-0.5 h-full bg-gray-200"></div>
                                <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-400 rounded-full"></div>
                             </div>
                             <div className="pl-6 pb-2">
                                 <p className="text-sm text-gray-700">{activity.text}</p>
                                 <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
                             </div>
                        </div>
                    ))}
                    {recentActivities.length === 0 && <p className="text-sm text-gray-400 text-center py-4">ไม่มีกิจกรรมล่าสุด</p>}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default BackofficeDashboard;