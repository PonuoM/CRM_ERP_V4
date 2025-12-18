import React, { useMemo } from 'react';
import { User, Order, Customer, OrderStatus, CustomerGrade } from '../types';
import StatCard from '../components/StatCard';
import { MonthlyOrdersChart, CustomerGradeChart } from '../components/Charts';
import { Users, ShoppingCart, BarChart2, DollarSign, List, Award, PlusCircle } from 'lucide-react';
import { getCustomerStats } from '../services/api';

interface AdminDashboardProps {
    user: User;
    orders: Order[];
    customers: Customer[];
    openCreateOrderModal: () => void;
}

import Spinner from '../components/Spinner';

const SummaryTable: React.FC<{ title: string, data: { label: string, value: number, total: number }[], icon: React.ElementType, header: string[], loading?: boolean }> = ({ title, data, icon: Icon, header, loading }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
        <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center"><Icon className="w-5 h-5 mr-2 text-gray-400" />{title}</h3>
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b">
                    {header.map(h => <th key={h} className="text-left font-medium text-gray-500 pb-2">{h}</th>)}
                </tr>
            </thead>
            <tbody>
                {loading ? (
                    <tr>
                        <td colSpan={3} className="py-8 text-center text-gray-500">
                            <div className="flex justify-center items-center gap-2">
                                <Spinner />
                                <span>กำลังโหลด...</span>
                            </div>
                        </td>
                    </tr>
                ) : (
                    data.map(item => (
                        <tr key={item.label} className="border-b last:border-0">
                            <td className="py-2.5 text-gray-600">{item.label}</td>
                            <td className="py-2.5 text-gray-800 font-medium">{item.value}</td>
                            <td className="py-2.5 text-gray-500">{((item.value / item.total) * 100).toFixed(1)}%</td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);


const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, orders, customers, openCreateOrderModal }) => {
    console.log("AdminDashboard: Rendered with user:", user);
    const [dbStats, setDbStats] = React.useState<{ totalCustomers: number; grades: Record<string, number> } | null>(null);
    const [loadingStats, setLoadingStats] = React.useState(false);

    React.useEffect(() => {
        if (user.companyId) {
            setLoadingStats(true);
            console.log("AdminDashboard: fetching customer stats for company", user.companyId);
            getCustomerStats(user.companyId).then(res => {
                console.log("AdminDashboard: retrieved stats", res);
                if (res.ok && res.stats) {
                    setDbStats(res.stats);
                }
            })
                .catch(err => console.error("Failed to load stats", err))
                .finally(() => setLoadingStats(false));
        } else {
            console.warn("AdminDashboard: no companyId to fetch stats", user);
        }
    }, [user.companyId]);

    const stats = useMemo(() => {
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalOrders = orders.length;
        const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        return {
            totalCustomers: dbStats ? dbStats.totalCustomers : (loadingStats ? 0 : customers.length),
            totalOrders,
            totalRevenue,
            avgOrderValue,
        };
    }, [orders, customers.length, dbStats, loadingStats]);

    const orderStatusData = useMemo(() => {
        const statusCounts = orders.reduce((acc, order) => {
            acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
            return acc;
        }, {} as Record<OrderStatus, number>);

        return Object.entries(statusCounts).map(([label, value]) => ({ label, value, total: orders.length }));
    }, [orders]);

    const customerGradeData = useMemo(() => {
        if (loadingStats) {
            return [];
        }
        if (dbStats?.grades) {
            const total = dbStats.totalCustomers || 1;
            return Object.entries(dbStats.grades)
                .sort(([g1], [g2]) => g1.localeCompare(g2))
                .map(([label, value]) => ({ label: label || 'Unassigned', value, total }));
        }

        const gradeCounts = customers.reduce((acc, customer) => {
            const grade = customer.grade || 'Unassigned';
            acc[grade] = (acc[grade] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        return Object.entries(gradeCounts)
            .sort(([g1], [g2]) => g1.localeCompare(g2)) // Sort grades alphabetically
            .map(([label, value]) => ({ label, value, total: customers.length }));
    }, [customers, dbStats, loadingStats]);

    return (
        <div className="p-6 bg-[#F5F5F5]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    {/* This space can be used for title if needed, but the App header already has it */}
                </div>
                <div className="flex items-center space-x-2">
                    <select className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md focus:ring-green-500 focus:border-green-500 block py-2 px-3">
                        <option>ทั้งหมด</option>
                        <option>วันนี้</option>
                        <option>เดือนนี้</option>
                    </select>
                    <button className="bg-white border border-gray-300 text-gray-700 text-sm rounded-md py-2 px-3 flex items-center">
                        <BarChart2 className="w-4 h-4 mr-2" />
                        รายงานแบบเต็ม
                    </button>
                    <button onClick={openCreateOrderModal} className="bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm">
                        <PlusCircle className="w-4 h-4 mr-2" />
                        สร้างคำสั่งซื้อ
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                <StatCard title="ลูกค้าทั้งหมด" value={loadingStats ? (
                    <div className="flex items-center">
                        <svg className="animate-spin h-5 w-5 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                ) : stats.totalCustomers.toLocaleString()} subtext="ลูกค้าทั้งหมดในระบบ" icon={Users} />
                <StatCard title="คำสั่งซื้อทั้งหมด" value={stats.totalOrders.toLocaleString()} subtext="คำสั่งซื้อทั้งหมด" icon={ShoppingCart} />
                <StatCard title="รายได้รวม" value={`฿${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} subtext="รายได้รวมทั้งหมด" icon={DollarSign} />
                <StatCard title="ยอดเฉลี่ย/คำสั่ง" value={`฿${stats.avgOrderValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}`} subtext="ยอดเฉลี่ยต่อคำสั่ง" icon={BarChart2} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <MonthlyOrdersChart />
                <CustomerGradeChart grades={customerGradeData} loading={loadingStats} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SummaryTable title="สถานะคำสั่งซื้อ" data={orderStatusData} icon={List} header={['สถานะ', 'จำนวน', 'เปอร์เซ็นต์']} />
                <SummaryTable title="เกรดลูกค้า" data={customerGradeData} icon={Award} header={['เกรด', 'จำนวน', 'เปอร์เซ็นต์']} loading={loadingStats} />
            </div>

        </div>
    );
};

export default AdminDashboard;