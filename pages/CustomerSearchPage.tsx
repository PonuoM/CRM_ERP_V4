
import React, { useState, useMemo } from 'react';
import { Customer, Order, User, Address, UserRole } from '../types';
import { Search, Trash2, User as UserIcon, Calendar, Facebook, MessageSquare, UserPlus, ExternalLink } from 'lucide-react';

interface CustomerSearchPageProps {
  customers: Customer[];
  orders: Order[];
  users: User[];
  currentUser?: User;
  onTakeCustomer?: (customer: Customer) => void;
}

const CustomerSearchPage: React.FC<CustomerSearchPageProps> = ({ customers, orders, users, currentUser, onTakeCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const handleSearch = () => {
    setSelectedCustomer(null);
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    const foundCustomers = customers.filter(
      c => c.phone.includes(searchTerm) || (`${c.firstName} ${c.lastName}`).toLowerCase().includes(lowercasedTerm)
    );

    if (foundCustomers.length === 1) {
        setSelectedCustomer(foundCustomers[0]);
        setSearchResults([]);
    } else {
        setSearchResults(foundCustomers);
    }
  };

  const handleClear = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSelectedCustomer(null);
  };
  
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
  }

  const customerDetails = useMemo(() => {
    if (!selectedCustomer) return null;

    const customerOrders = orders.filter(o => o.customerId === selectedCustomer.id).sort((a,b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
    const totalPurchase = customerOrders.reduce((sum, order) => sum + order.totalAmount, 0);
    const assignedUser = users.find(u => u.id === selectedCustomer.assignedTo);
    
    const assignedManagerName = assignedUser 
        ? `${assignedUser.firstName} ${assignedUser.lastName}` 
        : 'ไม่มีผู้ดูแล';

    return {
      ...selectedCustomer,
      orders: customerOrders,
      totalPurchase,
      orderCount: customerOrders.length,
      assignedManager: assignedManagerName,
    };
  }, [selectedCustomer, orders, users]);

  const isOrderRecent = (orderDate: string) => {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    return new Date(orderDate) > ninetyDaysAgo;
  }
  
  const formatAddress = (address?: Address) => {
    if (!address) return '-';
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

  const openNewTab = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const openSearchInNewTab = () => {
    // เปิดหน้าค้นหาในแท็บใหม่โดยใช้ URL parameter และซ่อน sidebar
    const currentUrl = window.location.origin + window.location.pathname + '?page=search&nosidebar=true';
    window.open(currentUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="p-6 bg-[#EBF4FA] min-h-full">
      <div className="">
        {/* Header with New Tab Button */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">ค้นหาลูกค้า</h1>
          <button
            onClick={openSearchInNewTab}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <ExternalLink size={16} />
            <span>เปิดในแท็บใหม่</span>
          </button>
        </div>

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
        
        {searchResults.length > 0 && (
            <div className="mt-6 bg-white p-4 rounded-2xl shadow-lg">
                <h3 className="font-semibold text-gray-700 mb-2">พบผลลัพธ์หลายรายการ กรุณาเลือก:</h3>
                <ul className="space-y-2">
                    {searchResults.map(customer => (
                        <li 
                            key={customer.id} 
                            onClick={() => handleSelectCustomer(customer)}
                            className="p-3 hover:bg-blue-50 rounded-lg cursor-pointer border"
                        >
                            <p className="font-bold text-blue-700" style={{color: '#000000'}}>{`${customer.firstName} ${customer.lastName}`}</p>
                            <p className="text-sm text-gray-600" style={{color: '#000000'}}>{customer.phone}</p>
                        </li>
                    ))}
                </ul>
            </div>
        )}

        {/* Search Result */}
        {customerDetails && selectedCustomer ? (
            <div className="mt-6">
                {/* Customer Card */}
                <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 flex justify-between items-start">
                    <div className="flex items-center">
                        <div className="bg-blue-100 p-4 rounded-full mr-5">
                            <UserIcon className="w-8 h-8 text-blue-600" />
                        </div>
                        <div>
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
                         {currentUser && currentUser.role !== UserRole.Backoffice && onTakeCustomer && !customerDetails.assignedTo && (
                             <button
                                 onClick={() => onTakeCustomer(selectedCustomer)}
                                 className="mt-4 bg-green-100 text-green-700 font-semibold text-sm rounded-md py-2 px-4 flex items-center hover:bg-green-200 shadow-sm"
                             >
                                 <UserPlus size={16} className="mr-2" />
                                 รับลูกค้า
                             </button>
                         )}
                    </div>
                </div>
                
                {/* Additional Info */}
                <div className="bg-white p-6 rounded-2xl shadow-lg mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                     <p className="text-gray-700 md:col-span-1"><strong className="font-medium text-gray-800">ผู้ดูแลปัจจุบัน:</strong> {customerDetails.assignedManager}</p>
                     <p className="text-gray-700 flex items-center"><Facebook size={16} className="text-blue-600 mr-2" /> <strong className="font-medium text-gray-800 mr-2">Facebook:</strong> {customerDetails.facebookName || '-'}</p>
                     <p className="text-gray-700 flex items-center"><MessageSquare size={16} className="text-green-500 mr-2" /> <strong className="font-medium text-gray-800 mr-2">LINE:</strong> {customerDetails.lineId || '-'}</p>
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
                                    <th className="px-6 py-3 font-medium">แผนก</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customerDetails.orders.flatMap(order => {
                                    const creator = users.find(u => u.id === order.creatorId);
                                    const creatorName = creator ? `${creator.firstName} ${creator.lastName}` : 'N/A';
                                    const isRecent = isOrderRecent(order.orderDate);
                                    return order.items.map(item => (
                                        <tr key={`${order.id}-${item.id}`} className={`border-t ${isRecent ? 'bg-blue-50' : 'bg-white'}`}>
                                            <td className="px-6 py-4 text-gray-800">{getThaiBuddhistDate(order.orderDate)}</td>
                                            <td className="px-6 py-4 text-gray-800">{item.productName}</td>
                                            <td className="px-6 py-4 text-center text-gray-800">{item.quantity}</td>
                                            <td className="px-6 py-4 text-right font-semibold text-gray-800">{((item.quantity * item.pricePerUnit) - item.discount).toLocaleString()}</td>
                                            <td className="px-6 py-4 text-gray-800">{creatorName}</td>
                                            <td className="px-6 py-4 text-gray-800">{creator?.role || 'N/A'}</td>
                                        </tr>
                                    ))
                                })}
                                {customerDetails.orders.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-gray-500">ไม่มีประวัติการสั่งซื้อ</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        ) : (
             searchResults.length === 0 && (
                <div className="mt-6 text-center text-gray-500">
                    {/* This is the initial state before search */}
                </div>
            )
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
export default CustomerSearchPage;