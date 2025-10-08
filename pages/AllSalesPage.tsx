import React, { useState } from 'react';
import { User, Order, Customer, ModalType } from '../types';
import OrderTable from '../components/OrderTable';
import { Search } from 'lucide-react';

interface AllSalesPageProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  openModal: (type: ModalType, data: Order) => void;
}

const AllSalesPage: React.FC<AllSalesPageProps> = ({ user, orders, customers, openModal }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrders = orders.filter(order => {
    const customer = customers.find(c => c.id === order.customerId);
    const searchTermLower = searchTerm.toLowerCase();
    return (
      order.id.toLowerCase().includes(searchTermLower) ||
      (customer && `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(searchTermLower))
    );
  });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">ยอดขายทั้งหมด</h2>
      <p className="text-gray-600 mb-6">ภาพรวมคำสั่งซื้อทั้งหมดในบริษัทของคุณ</p>
      
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="ค้นหา Order ID หรือชื่อลูกค้า..." 
            className="w-full md:w-1/3 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      <OrderTable orders={filteredOrders} customers={customers} openModal={openModal} />
    </div>
  );
};

export default AllSalesPage;