import React, { useMemo } from 'react';
import { User, Order, Customer, OrderStatus, CustomerGrade } from '../types';
import StatCard from '../components/StatCard';
import { MonthlyOrdersChart, CustomerGradeChart } from '../components/Charts';
import { Users, ShoppingCart, BarChart2, DollarSign, List, Award, PlusCircle } from 'lucide-react';

interface AdminDashboardProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  openCreateOrderModal: () => void;
}

const SummaryTable: React.FC<{title: string, data: {label: string, value: number, total: number}[], icon: React.ElementType, header: string[]}> = ({ title, data, icon: Icon, header }) => (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-full">
        <h3 className="text-md font-semibold text-gray-700 mb-4 flex items-center"><Icon className="w-5 h-5 mr-2 text-gray-400" />{title}</h3>
        <table className="w-full text-sm">
            <thead>
                <tr className="border-b">
                    {header.map(h => <th key={h} className="text-left font-medium text-gray-500 pb-2">{h}</th>)}
                </tr>
            </thead>
            <tbody>
                {data.map(item => (
                    <tr key={item.label} className="border-b last:border-0">
                        <td className="py-2.5 text-gray-600">{item.label}</td>
                        <td className="py-2.5 text-gray-800 font-medium">{item.value}</td>
                        <td className="py-2.5 text-gray-500">{((item.value / item.total) * 100).toFixed(1)}%</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);


const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, orders, customers, openCreateOrderModal }) => {
  const stats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalOrders = orders.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalCustomers: customers.length,
      totalOrders,
      totalRevenue,
      avgOrderValue,
    };
  }, [orders, customers]);

  const orderStatusData = useMemo(() => {
    const statusCounts = orders.reduce((acc, order) => {
        acc[order.orderStatus] = (acc[order.orderStatus] || 0) + 1;
        return acc;
    }, {} as Record<OrderStatus, number>);
    
    return Object.entries(statusCounts).map(([label, value]) => ({ label, value, total: orders.length }));
  }, [orders]);
  
  const customerGradeData = useMemo(() => {
    const gradeCounts = customers.reduce((acc, customer) => {
        acc[customer.grade] = (acc[customer.grade] || 0) + 1;
        return acc;
    }, {} as Record<CustomerGrade, number>);

    return Object.entries(gradeCounts)
        .sort(([g1], [g2]) => g1.localeCompare(g2)) // Sort grades alphabetically
        .map(([label, value]) => ({ label, value, total: customers.length }));
  }, [customers]);

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
            <StatCard title="ลูกค้าทั้งหมด" value={stats.totalCustomers.toLocaleString()} subtext="ลูกค้าทั้งหมดในระบบ" icon={Users} />
            <StatCard title="คำสั่งซื้อทั้งหมด" value={stats.totalOrders.toLocaleString()} subtext="คำสั่งซื้อทั้งหมด" icon={ShoppingCart} />
            <StatCard title="รายได้รวม" value={`฿${stats.totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2})}`} subtext="รายได้รวมทั้งหมด" icon={DollarSign} />
            <StatCard title="ยอดเฉลี่ย/คำสั่ง" value={`฿${stats.avgOrderValue.toLocaleString('en-US', {minimumFractionDigits: 2})}`} subtext="ยอดเฉลี่ยต่อคำสั่ง" icon={BarChart2} />
        </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <MonthlyOrdersChart />
          <CustomerGradeChart grades={customerGradeData} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SummaryTable title="สถานะคำสั่งซื้อ" data={orderStatusData} icon={List} header={['สถานะ', 'จำนวน', 'เปอร์เซ็นต์']} />
          <SummaryTable title="เกรดลูกค้า" data={customerGradeData} icon={Award} header={['เกรด', 'จำนวน', 'เปอร์เซ็นต์']} />
      </div>

    </div>
  );
};

export default AdminDashboard;