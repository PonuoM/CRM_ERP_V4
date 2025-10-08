
import React, { useMemo } from 'react';
import { User, Customer, Order, CustomerLifecycleStatus, Activity } from '../types';
import { ListTodo, Clock, TrendingUp, PhoneForwarded, PlusCircle, Activity as ActivityIcon } from 'lucide-react';

interface TelesaleSummaryDashboardProps {
  user: User;
  customers: Customer[];
  orders: Order[];
  activities?: Activity[];
  openModal: () => void;
}

const StatCard: React.FC<{ title: string; value: string; icon: React.ElementType; bgColor: string; iconColor: string }> = ({ title, value, icon: Icon, bgColor, iconColor }) => (
    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 flex items-center">
        <div className={`p-3 rounded-lg mr-4 ${bgColor}`}>
            <Icon size={24} className={iconColor}/>
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
            <p className="text-sm text-gray-500">{title}</p>
        </div>
    </div>
);

const TelesaleSummaryDashboard: React.FC<TelesaleSummaryDashboardProps> = ({ user, customers, orders, activities, openModal }) => {
    
    const userCustomers = useMemo(() => {
        return customers.filter(c => c.assignedTo === user.id);
    }, [user.id, customers]);

    // Get recent activities for user's customers
    const recentActivities = useMemo(() => {
        if (!activities) return [];
        
        const userCustomerIds = userCustomers.map(c => c.id);
        const userActivities = activities
            .filter(activity => userCustomerIds.includes(activity.customerId))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, 5); // Show only latest 5 activities
            
        return userActivities;
    }, [activities, userCustomers]);

    const userOrders = useMemo(() => {
        return orders.filter(o => o.creatorId === user.id);
    }, [user.id, orders]);

    const stats = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const doCount = userCustomers.filter(c => 
            c.lifecycleStatus === CustomerLifecycleStatus.New || 
            c.lifecycleStatus === CustomerLifecycleStatus.DailyDistribution ||
            c.lifecycleStatus === CustomerLifecycleStatus.FollowUp ||
            ((new Date(c.ownershipExpires).getTime() - now.getTime()) / (1000 * 3600 * 24)) < 5 && ((new Date(c.ownershipExpires).getTime() - now.getTime()) > 0)
        ).length;

        const expiringSoonCount = userCustomers.filter(c => {
             const diffDays = ((new Date(c.ownershipExpires).getTime() - now.getTime()) / (1000 * 3600 * 24));
             return diffDays < 7 && diffDays > 0;
        }).length;

        const monthlySales = userOrders
            .filter(o => new Date(o.orderDate) >= startOfMonth)
            .reduce((sum, order) => sum + order.totalAmount, 0);
            
        const totalCalls = userCustomers.reduce((sum, customer) => sum + customer.totalCalls, 0);

        return {
            doCount,
            expiringSoonCount,
            monthlySales,
            totalCalls
        }
    }, [userCustomers, userOrders]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">แดชบอร์ดภาพรวม</h2>
                    <p className="text-gray-500">สรุปประสิทธิภาพการทำงานของคุณ</p>
                </div>
                 <button onClick={openModal} className="bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm">
                    <PlusCircle className="w-4 h-4 mr-2" />
                    สร้างคำสั่งซื้อ
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="สิ่งที่ต้องทำ (Do)" 
                    value={stats.doCount.toString()} 
                    icon={ListTodo}
                    bgColor="bg-blue-100"
                    iconColor="text-blue-600"
                />
                 <StatCard 
                    title="ลูกค้าใกล้หมดอายุ" 
                    value={stats.expiringSoonCount.toString()} 
                    icon={Clock}
                    bgColor="bg-orange-100"
                    iconColor="text-orange-600"
                />
                 <StatCard 
                    title="ยอดขายเดือนนี้" 
                    value={`฿${stats.monthlySales.toLocaleString('en-US')}`} 
                    icon={TrendingUp}
                    bgColor="bg-green-100"
                    iconColor="text-green-600"
                />
                 <StatCard 
                    title="จำนวนการโทรทั้งหมด" 
                    value={stats.totalCalls.toLocaleString()} 
                    icon={PhoneForwarded}
                    bgColor="bg-purple-100"
                    iconColor="text-purple-600"
                />
            </div>
            
            {/* Recent Activities */}
            <div className="mt-8 bg-white p-6 rounded-lg shadow-sm border">
                <h3 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
                    <ActivityIcon size={20} className="mr-2 text-gray-400" />
                    กิจกรรมล่าสุด
                </h3>
                <div className="space-y-4">
                    {recentActivities.length > 0 ? (
                        recentActivities.map(activity => (
                            <div key={activity.id} className="flex">
                                <div className="relative h-full">
                                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-0.5 h-full bg-gray-200"></div>
                                    <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-400 rounded-full"></div>
                                </div>
                                <div className="pl-6 pb-2">
                                    <p className="text-sm text-gray-700">{activity.description}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                        {new Date(activity.timestamp).toLocaleString('th-TH', {
                                            day: '2-digit',
                                            month: '2-digit',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </p>
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-4">ไม่มีกิจกรรมล่าสุด</p>
                    )}
                </div>
            </div>

        </div>
    );
};

export default TelesaleSummaryDashboard;
