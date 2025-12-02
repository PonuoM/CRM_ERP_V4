import React, { useState, useMemo } from 'react';
import { User, Order, Customer, ModalType } from '../types';
import OrderTable from '../components/OrderTable';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import usePersistentState from '../utils/usePersistentState';

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100, 500];

interface AllSalesPageProps {
  user: User;
  orders: Order[];
  customers: Customer[];
  openModal: (type: ModalType, data: Order) => void;
}

const AllSalesPage: React.FC<AllSalesPageProps> = ({ user, orders, customers, openModal }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [itemsPerPage, setItemsPerPage] = usePersistentState<number>('allSales:itemsPerPage', PAGE_SIZE_OPTIONS[1]);
  const [currentPage, setCurrentPage] = usePersistentState<number>('allSales:currentPage', 1);

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      // Match customer by pk (customer_id) or id (string)
      const customer = customers.find(c => {
        if (c.pk && typeof order.customerId === 'number') {
          return c.pk === order.customerId;
        }
        return String(c.id) === String(order.customerId) || 
               String(c.pk) === String(order.customerId);
      });
      const searchTermLower = searchTerm.toLowerCase();
      return (
        order.id.toLowerCase().includes(searchTermLower) ||
        (customer && `${customer.firstName} ${customer.lastName}`.toLowerCase().includes(searchTermLower))
      );
    });
  }, [orders, customers, searchTerm]);

  // Pagination calculation
  const safeItemsPerPage = itemsPerPage && itemsPerPage > 0 ? itemsPerPage : PAGE_SIZE_OPTIONS[1];
  const totalItems = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeItemsPerPage));
  const effectivePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (effectivePage - 1) * safeItemsPerPage;
  const endIndex = startIndex + safeItemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, setCurrentPage]);

  const displayStart = totalItems === 0 ? 0 : startIndex + 1;
  const displayEnd = Math.min(endIndex, totalItems);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">ยอดขายทั้งหมด</h2>
          <p className="text-gray-600">{`ทั้งหมด ${totalItems} รายการ`}</p>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="ค้นหา Order ID หรือชื่อลูกค้า..." 
              className="w-full md:w-1/3 pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-700 whitespace-nowrap">แสดง:</label>
            <select
              value={safeItemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size} รายการ</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow">
        <OrderTable orders={paginatedOrders} customers={customers} openModal={openModal} allOrders={orders} />
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              แสดง {displayStart} - {displayEnd} จาก {totalItems} รายการ
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={effectivePage === 1}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-700">
                หน้า {effectivePage} จาก {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={effectivePage === totalPages}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllSalesPage;