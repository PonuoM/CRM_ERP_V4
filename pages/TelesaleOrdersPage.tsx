
import React, { useState, useMemo } from 'react';
import { User, Order, Customer, ModalType, PaymentMethod, PaymentStatus } from '../types';
import OrderTable from '../components/OrderTable';
import { CreditCard, List } from 'lucide-react';

interface TelesaleOrdersPageProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  openModal: (type: ModalType, data: Order) => void;
  onCancelOrder: (orderId: string) => void;
  title?: string;
}

const TelesaleOrdersPage: React.FC<TelesaleOrdersPageProps> = ({ user, orders, customers, openModal, onCancelOrder, title }) => {
  const [activeTab, setActiveTab] = useState<'all' | 'pendingSlip'>('all');
  
  const myOrders = useMemo(() => {
    return orders.filter(order => order.creatorId === user.id);
  }, [orders, user.id]);

  const pendingSlipOrders = useMemo(() => {
    return myOrders.filter(o => o.paymentMethod === PaymentMethod.Transfer && o.paymentStatus !== PaymentStatus.Paid);
  }, [myOrders]);

  const displayedOrders = activeTab === 'pendingSlip' ? pendingSlipOrders : myOrders;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">{title || 'จัดการคำสั่งซื้อของฉัน'}</h2>
      
      <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'all'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <List size={16} />
            <span>ออเดอร์ทั้งหมด</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'all' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'
            }`}>{myOrders.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('pendingSlip')}
            className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'pendingSlip'
                ? 'border-b-2 border-orange-600 text-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CreditCard size={16} />
            <span>รอสลิป</span>
             <span className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'pendingSlip' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'
            }`}>{pendingSlipOrders.length}</span>
          </button>
      </div>

      <div className="bg-white rounded-lg shadow">
        <OrderTable 
            orders={displayedOrders} 
            customers={customers} 
            openModal={openModal} 
            user={user}
            onCancelOrder={onCancelOrder}
        />
      </div>
    </div>
  );
};

export default TelesaleOrdersPage;
