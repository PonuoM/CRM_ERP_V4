import React, { useMemo, useState, useEffect } from 'react';
import { User, Order, Customer, ModalType } from '../types';
import OrderTable from '../components/OrderTable';
import { DollarSign, Users, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { listOrders } from '../services/api';

interface DebtCollectionPageProps {
  user: User;
  customers: Customer[];
  users: User[];
  openModal: (type: ModalType, data: Order) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const DebtCollectionPage: React.FC<DebtCollectionPageProps> = ({ user, customers, users, openModal }) => {
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalOrders, setTotalOrders] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(PAGE_SIZE_OPTIONS[0]); // Default 10
  const [totalPages, setTotalPages] = useState(1);

  // Fetch orders using debtCollection tab rules
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user?.companyId) return;

      setLoading(true);
      try {
        const response = await listOrders({
          companyId: user.companyId,
          tab: 'debtCollection', // Use the debtCollection tab key
          page: currentPage,
          pageSize: itemsPerPage,
        });

        if (response.ok) {
          const mappedOrders = (response.orders || []).map((r: any) => ({
            id: r.id,
            customerId: r.customer_id,
            companyId: r.company_id,
            creatorId: r.creator_id,
            orderDate: r.order_date,
            deliveryDate: r.delivery_date,
            shippingAddress: {
              recipientFirstName: r.recipient_first_name || '',
              recipientLastName: r.recipient_last_name || '',
              street: r.street || '',
              subdistrict: r.subdistrict || '',
              district: r.district || '',
              province: r.province || '',
              postalCode: r.postal_code || '',
            },
            shippingProvider: r.shipping_provider,
            shippingCost: Number(r.shipping_cost || 0),
            billDiscount: Number(r.bill_discount || 0),
            totalAmount: Number(r.total_amount || 0),
            paymentMethod: r.payment_method,
            paymentStatus: r.payment_status,
            orderStatus: r.order_status,
            trackingNumbers: r.tracking_numbers ? r.tracking_numbers.split(',').map((t: string) => t.trim()) : [],
            amountPaid: r.amount_paid !== undefined && r.amount_paid !== null ? Number(r.amount_paid) : undefined,
            codAmount: r.cod_amount ? Number(r.cod_amount) : undefined,
            slipUrl: r.slip_url,
            salesChannel: r.sales_channel,
            salesChannelPageId: r.sales_channel_page_id,
            warehouseId: r.warehouse_id,
            bankAccountId: r.bank_account_id,
            transferDate: r.transfer_date,
            items: (r.items || []).map((it: any) => ({
              ...it,
              pricePerUnit: Number(it.price_per_unit ?? it.price ?? 0),
              quantity: Number(it.quantity ?? 0),
              discount: Number(it.discount ?? 0),
              netTotal: Number(it.net_total ?? it.netTotal ?? 0),
              isPromotionParent: !!(it.is_promotion_parent ?? 0),
              parentItemId: it.parent_item_id ?? it.parentItemId,
            })),
            slips: r.slips || [],
            trackingDetails: r.tracking_details || r.trackingDetails || [],
            boxes: r.boxes || [],
            reconcileAction: r.reconcile_action,
            customerInfo: (r.customer_id || r.customer_phone || r.phone) ? {
              firstName: r.customer_first_name || '',
              lastName: r.customer_last_name || '',
              phone: r.phone || r.customer_phone || '',
              street: r.customer_street || '',
              subdistrict: r.customer_subdistrict || '',
              district: r.customer_district || '',
              province: r.customer_province || '',
              postalCode: r.customer_postal_code || '',
            } : undefined,
          }));

          setOrders(mappedOrders);
          setTotalOrders(response.pagination?.total || 0);
          setTotalPages(response.pagination?.totalPages || 1);
        }
      } catch (error) {
        console.error("Failed to fetch orders for debt collection:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user?.companyId, currentPage, itemsPerPage]);

  // Calculate total debt amount and unique customer count
  const { totalDebt, uniqueCustomerCount } = useMemo(() => {
    const paidAmount = (o: Order) => (o.amountPaid ?? (o as any).codAmount ?? 0) as number;
    const shortfall = (o: Order) => Math.max(0, o.totalAmount - paidAmount(o));

    const debt = orders.reduce((sum, order) => sum + shortfall(order), 0);
    const uniqueCustomers = new Set(orders.map(o => o.customerId)).size;

    return {
      totalDebt: debt,
      uniqueCustomerCount: uniqueCustomers
    };
  }, [orders]);

  const handlePageChange = (page: number) => {
    const next = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(next);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const getPageNumbers = () => {
    const pages: Array<number | '...'> = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else if (currentPage <= 3) {
      for (let i = 1; i <= 4; i += 1) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 3; i <= totalPages; i += 1) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i += 1) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalOrders);
  const displayStart = totalOrders === 0 ? 0 : startIndex + 1;
  const displayEnd = totalOrders === 0 ? 0 : endIndex;

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">ติดตามหนี้</h2>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg shadow-sm border border-red-200 p-6">
              <div className="flex items-center gap-4">
                <div className="bg-red-200 p-3 rounded-full">
                  <DollarSign className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">ยอดค้างชำระทั้งหมด (หน้านี้)</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {totalDebt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm border border-blue-200 p-6">
              <div className="flex items-center gap-4">
                <div className="bg-blue-200 p-3 rounded-full">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">จำนวนลูกค้า (หน้านี้)</p>
                  <p className="text-2xl font-bold text-gray-900">{uniqueCustomerCount} คน</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pagination Controls - Top */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mb-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>แสดง</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                >
                  {PAGE_SIZE_OPTIONS.map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
                <span>รายการต่อหน้า</span>
                <span className="ml-4">
                  แสดง {displayStart}-{displayEnd} จาก {totalOrders} รายการ
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={18} />
                </button>

                {getPageNumbers().map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page as number)}
                      className={`px-3 py-1 rounded-md border text-sm font-medium ${currentPage === page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      {page}
                    </button>
                  )
                ))}

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-lg shadow">
            <OrderTable
              orders={orders}
              customers={customers}
              openModal={openModal}
              users={users}
            />
          </div>

          {/* Pagination Controls - Bottom */}
          <div className="bg-white rounded-lg shadow-sm border p-4 mt-4">
            <div className="flex justify-center items-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>

              {getPageNumbers().map((page, idx) => (
                page === '...' ? (
                  <span key={`ellipsis-bottom-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={`bottom-${page}`}
                    onClick={() => handlePageChange(page as number)}
                    className={`px-3 py-1 rounded-md border text-sm font-medium ${currentPage === page
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    {page}
                  </button>
                )
              ))}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DebtCollectionPage;
