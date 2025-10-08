import React from 'react';
import { Customer, Order } from '../types';
import Modal from './Modal';
import { User, MapPin, Phone, Hash, DollarSign, ShoppingCart } from 'lucide-react';

interface CustomerDetailModalProps {
  customer: Customer;
  orders: Order[];
  onClose: () => void;
}

const InfoPill: React.FC<{ icon: React.ElementType, label: string, value: string | number }> = ({ icon: Icon, label, value }) => (
    <div className="flex items-center bg-gray-50 p-3 rounded-lg">
        <Icon className="w-5 h-5 text-gray-500 mr-3" />
        <div>
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-medium text-gray-800">{value}</p>
        </div>
    </div>
);

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ customer, orders, onClose }) => {
  return (
    // FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the customer object.
    <Modal title={`ข้อมูลลูกค้า: ${customer.firstName} ${customer.lastName}`} onClose={onClose}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <InfoPill icon={User} label="เกรด" value={customer.grade} />
            <InfoPill icon={Phone} label="เบอร์โทร" value={customer.phone} />
            <InfoPill icon={MapPin} label="จังหวัด" value={customer.province} />
            <InfoPill icon={Hash} label="รหัสลูกค้า" value={customer.id} />
        </div>
        
        <div className="mb-6">
             <h3 className="text-md font-semibold text-gray-700 mb-2 border-b pb-2">สถิติ</h3>
             <div className="flex space-x-4">
                <div className="flex items-center text-sm text-gray-600"><ShoppingCart className="w-4 h-4 mr-2 text-blue-500" /> ยอดสั่งซื้อทั้งหมด: <span className="font-bold ml-1">฿{customer.totalPurchases.toLocaleString()}</span></div>
                <div className="flex items-center text-sm text-gray-600"><Phone className="w-4 h-4 mr-2 text-green-500" /> จำนวนการโทร: <span className="font-bold ml-1">{customer.totalCalls} ครั้ง</span></div>
             </div>
        </div>

        <div>
            <h3 className="text-md font-semibold text-gray-700 mb-2 border-b pb-2">ประวัติคำสั่งซื้อ ({orders.length})</h3>
            {orders.length > 0 ? (
                <div className="space-y-3">
                    {orders.map(order => (
                        <div key={order.id} className="bg-white border border-gray-200 p-3 rounded-lg">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-800">Order ID: {order.id}</p>
                                    <p className="text-sm text-gray-500">วันที่สั่ง: {new Date(order.orderDate).toLocaleDateString('th-TH')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg text-blue-600">฿{order.totalAmount.toLocaleString()}</p>
                                    <p className="text-xs text-gray-500">{order.orderStatus}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <p className="text-gray-500">ไม่มีประวัติคำสั่งซื้อ</p>
                </div>
            )}
        </div>
    </Modal>
  );
};

export default CustomerDetailModal;