

import React, { useState, useMemo } from 'react';
import { Customer, Order, User, Address } from '../types';
import { Search, Trash2, User as UserIcon, Calendar } from 'lucide-react';

interface CustomerServiceSearchPageProps {
  customers: Customer[];
  orders: Order[];
  users: User[];
}

const CustomerServiceSearchPage: React.FC<CustomerServiceSearchPageProps> = ({ customers, orders, users }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedCustomer, setSearchedCustomer] = useState<Customer | null>(null);

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setSearchedCustomer(null);
      return;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    const foundCustomer = customers.find(
      // FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the customer object.
      c => c.phone.includes(searchTerm) || (`${c.firstName} ${c.lastName}`).toLowerCase().includes(lowercasedTerm)
    );
    setSearchedCustomer(foundCustomer || null);
  };

  const handleClear = () => {
    setSearchTerm('');
    setSearchedCustomer(null);
  };
  
  const customerDetails = useMemo(() => {
    if (!searchedCustomer) return null;

    const customerOrders = orders.filter(o => o.customerId === searchedCustomer.id).sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    const totalPurchase = customerOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const assignedUser = users.find(u => u.id === searchedCustomer.assignedTo);
    
    return {
      ...searchedCustomer,
      orders: customerOrders,
      totalPurchase,
      orderCount: customerOrders.length,
      // FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the user object.
      assignedManager: assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : 'ไม่มีผู้ดูแล',
    };
  }, [searchedCustomer, orders, users]);

  const isOrderRecent = (orderDate: string) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return new Date(orderDate) > ninetyDaysAgo;
  }
  
  const formatAddress = (address?: Address) => {
    if (!address) return '-';
    // Example: 154 ม. 6 ต.วังเพลง อ.วังเพลง จ.ราชบุรี
    return `${address.street}, ต.${address.subdistrict}, อ.${address.district}, จ.${address.province}`;
  }

  const getThaiBuddhistDate = (isoDate: string) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
  };

  return (
    <div className="p-6 bg-[#EBF4FA] min-h-full">
      <div className="max-w-4xl mx-auto">
        {/* Search Box */}
        <div className="bg-white p-6 rounded-2xl shadow-lg">
            <div className="flex items-center space-x-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder="ค้นหาด้วยชื่อ, ชื่อ Facebook, หรือเบอร์โทรศัพท์..."
                        className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 text-base"
                    />
                </div>
                <button
                    onClick={handleSearch}
                    className="bg-[#0079C1] text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                    ค้นหา
                </button>
                <button
                    onClick={handleClear}
                    className="bg-gray-200 text-gray-600 p-3.5 rounded-lg hover:bg-gray-300 transition-colors"
                    aria-label="Clear search"
                >
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>
            <div className="mt-4 flex items-center space-x-4 text-sm">
                <span className="text-gray-600">แสดงผล:</span>
                <button className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full font-medium">ดูข้อมูลทั้งหมด</button>
                <button className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded-full">ดูย้อนหลัง 3 เดือน</button>
            </div>
        </div>
        
        {/* Search Result */}
        {customerDetails ? (
            <div className="mt-6">
                {/* Customer Card */}
                <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 flex justify-between items-start">
                    <div className="flex items-center">
                        <div className="bg-blue-100 p-4 rounded-full mr-5">
                            <UserIcon className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
                            {/* FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the customer object. */}
                            <h2 className="text-2xl font-bold text-gray-800">{`${customerDetails.firstName} ${customerDetails.lastName}`}</h2>
                            <p className="text-gray-600 mt-1">{customerDetails.phone}</p>
                            <p className="text-gray-500 text-sm mt-1">{formatAddress(customerDetails.address)}</p>
                        </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-4">
                         <p className="text-sm text-gray-500">ยอดรวม</p>
                         <p className="text-2xl font-bold text-green-600">{customerDetails.totalPurchase.toLocaleString('th-TH')} บาท</p>
                         <p className="text-sm text-gray-500 mt-2">จำนวนครั้งที่สั่ง</p>
                         <p className="text-lg font-semibold text-blue-600">{customerDetails.orderCount}</p>
                    </div>
                </div>
                
                {/* Additional Info */}
                <div className="bg-white p-6 rounded-2xl shadow-lg mb-6">
                     <p className="text-gray-700"><span className="font-medium text-gray-800">ผู้ดูแลปัจจุบัน:</span> {customerDetails.assignedManager}</p>
                </div>
                
                {/* Order History */}
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                     <h3 className="text-xl font-semibold text-gray-800 p-6 flex items-center border-b"><Calendar className="w-6 h-6 mr-3 text-gray-500"/>ประวัติการสั่งซื้อ</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="px-6 py-3 font-medium">วันที่ขาย</th>
                                    <th className="px-6 py-3 font-medium">สินค้า</th>
                                    <th className="px-6 py-3 font-medium text-center">จำนวน</th>
                                    <th className="px-6 py-3 font-medium text-right">ราคา</th>
                                    <th className="px-6 py-3 font-medium">พนักงานขาย</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customerDetails.orders.flatMap(order => {
                                    const creator = users.find(u => u.id === order.creatorId);
                                    const isRecent = isOrderRecent(order.orderDate);
                                    return order.items.map(item => (
                                        <tr key={`${order.id}-${item.id}`} className={`border-t ${isRecent ? 'bg-blue-50' : 'bg-white'}`}>
                                            <td className="px-6 py-4">{getThaiBuddhistDate(order.orderDate)}</td>
                                            <td className="px-6 py-4">{item.productName}</td>
                                            <td className="px-6 py-4 text-center">{item.quantity}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-gray-800">{((item.quantity * item.pricePerUnit) - item.discount).toLocaleString()}</td>
                                            {/* FIX: Replaced non-existent 'name' property with 'firstName' and 'lastName' for the user object. */}
                                            <td className="px-6 py-4">{creator ? `${creator.firstName} ${creator.lastName}` : 'N/A'}</td>
                                        </tr>
                                    ))
                                })}
                                {customerDetails.orders.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center p-8 text-gray-500">ไม่มีประวัติการสั่งซื้อ</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : (
            <div className="mt-6 text-center text-gray-500">
                {/* This is the initial state before search */}
            </div>
        )}

         {/* Footer */}
        <footer className="text-center mt-10 text-xs text-gray-500">
            <p>Powered by Thanu Suriwong</p>
            <p>© 2025 Customer Service. All rights reserved.</p>
            <p>อัปเดตล่าสุด: 20/09/2568 15:15 • เวอร์ชั่น 0.1.0</p>
        </footer>
      </div>
    </div>
  );
};
export default CustomerServiceSearchPage;