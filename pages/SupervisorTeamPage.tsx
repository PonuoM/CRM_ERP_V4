import React from 'react';
import { User, Customer, Order, UserRole } from '../types';
import { Users, ShoppingCart, DollarSign, Phone } from 'lucide-react';

interface SupervisorTeamPageProps {
  user: User;
  allUsers: User[];
  allCustomers: Customer[];
  allOrders: Order[];
}

const SupervisorTeamPage: React.FC<SupervisorTeamPageProps> = ({ user, allUsers, allCustomers, allOrders }) => {
  const teamMembers = allUsers.filter(u => u.teamId === user.teamId && u.role === UserRole.Telesale);

  const getTeamMemberStats = (memberId: number) => {
    const assignedCustomers = allCustomers.filter(c => c.assignedTo === memberId);
    const memberOrders = allOrders.filter(o => o.creatorId === memberId);
    const totalSales = memberOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const totalCalls = assignedCustomers.reduce((sum, customer) => sum + customer.totalCalls, 0);

    return {
      assignedCustomersCount: assignedCustomers.length,
      ordersCount: memberOrders.length,
      totalSales,
      totalCalls
    };
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">ดูแลทีม</h2>
      <p className="text-gray-600 mb-6">ภาพรวมประสิทธิภาพของสมาชิกในทีมของคุณ</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamMembers.map(member => {
          const stats = getTeamMemberStats(member.id);
          return (
            <div key={member.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-xl">
                  {member.firstName.charAt(0)}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-800">{`${member.firstName} ${member.lastName}`}</h3>
                  <p className="text-sm text-gray-500">{member.role}</p>
                </div>
              </div>
              <div className="space-y-3">
                 <div className="flex items-center text-gray-600">
                    <Users size={16} className="mr-3 text-blue-500" />
                    <span>ลูกค้าในมือ:</span>
                    <span className="font-semibold ml-auto">{stats.assignedCustomersCount} คน</span>
                 </div>
                 <div className="flex items-center text-gray-600">
                    <ShoppingCart size={16} className="mr-3 text-green-500" />
                    <span>จำนวนออเดอร์:</span>
                    <span className="font-semibold ml-auto">{stats.ordersCount} รายการ</span>
                 </div>
                 <div className="flex items-center text-gray-600">
                    <DollarSign size={16} className="mr-3 text-yellow-500" />
                    <span>ยอดขายรวม:</span>
                    <span className="font-semibold ml-auto">฿{stats.totalSales.toLocaleString()}</span>
                 </div>
                 <div className="flex items-center text-gray-600">
                    <Phone size={16} className="mr-3 text-purple-500" />
                    <span>จำนวนการโทร:</span>
                    <span className="font-semibold ml-auto">{stats.totalCalls} ครั้ง</span>
                 </div>
              </div>
            </div>
          )
        })}
      </div>
      {teamMembers.length === 0 && (
         <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow">
            ไม่พบข้อมูลสมาชิกในทีม
        </div>
      )}
    </div>
  );
};

export default SupervisorTeamPage;