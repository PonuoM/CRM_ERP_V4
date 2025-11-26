import React from 'react';
import { Order, Customer, ModalType, OrderStatus, PaymentStatus, PaymentMethod, User, UserRole } from '../types';
import { ShoppingCart } from 'lucide-react';

// Upsell tag with orange-red gradient
const UpsellTag: React.FC = () => {
  return (
    <span 
      className="inline-flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-bold text-white uppercase shadow-md"
      style={{
        background: 'linear-gradient(90deg, #f97316 0%, #ef4444 100%)',
      }}
    >
      <ShoppingCart size={12} className="mr-1.5" />
      UPSell
    </span>
  );
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.Pending]: 'รอ Export',
  [OrderStatus.AwaitingVerification]: 'รอตรวจสอบสลิป',
  [OrderStatus.Confirmed]: 'ยืนยันแล้ว',
  [OrderStatus.Preparing]: 'กำลังจัดเตรียม',
  [OrderStatus.Picking]: 'กำลังจัดสินค้า',
  [OrderStatus.Shipping]: 'กำลังจัดส่ง',
  [OrderStatus.PreApproved]: 'รอตรวจสอบจากบัญชี',
  [OrderStatus.Delivered]: 'เสร็จสิ้น',
  [OrderStatus.Returned]: 'ตีกลับ',
  [OrderStatus.Cancelled]: 'ยกเลิก',
};

const ORDER_STATUS_FLOW: OrderStatus[] = [
  OrderStatus.Pending,
  OrderStatus.AwaitingVerification,
  OrderStatus.Preparing,
  OrderStatus.Picking,
  OrderStatus.Shipping,
  OrderStatus.PreApproved,
  OrderStatus.Delivered,
];

const STATUS_CHIP_BASE = 'text-xs font-medium px-2.5 py-0.5 rounded-full';

export interface OrderTableProps {
  orders: Order[];
  customers: Customer[];
  openModal: (type: ModalType, data: Order) => void;
  user?: User;
  users?: User[];
  onCancelOrder?: (orderId: string) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (newSelectedIds: string[]) => void;
  showShippingColumn?: boolean;
  shippingEditable?: boolean;
  shippingOptions?: string[];
  shippingSavingIds?: string[];
  onShippingChange?: (orderId: string, provider: string) => void;
}

// Exported helpers (used by other components)
export const getStatusChip = (status: OrderStatus) => {
  const label = ORDER_STATUS_LABELS[status] ?? status;
  switch (status) {
    case OrderStatus.Preparing:
    case OrderStatus.Picking:
      return <span className={`bg-yellow-100 text-yellow-800 ${STATUS_CHIP_BASE}`}>{label}</span>;
    case OrderStatus.Shipping:
      return <span className={`bg-blue-100 text-blue-800 ${STATUS_CHIP_BASE}`}>{label}</span>;
    case OrderStatus.PreApproved:
      return <span className={`bg-orange-100 text-orange-800 ${STATUS_CHIP_BASE}`}>{label}</span>;
    case OrderStatus.Delivered:
      return <span className={`bg-green-100 text-green-800 ${STATUS_CHIP_BASE}`}>{label}</span>;
    case OrderStatus.Returned:
      return <span className={`bg-red-100 text-red-800 ${STATUS_CHIP_BASE}`}>{label}</span>;
    case OrderStatus.Cancelled:
      return <span className={`bg-gray-200 text-gray-700 ${STATUS_CHIP_BASE}`}>{label}</span>;
    default:
      return <span className={`bg-gray-100 text-gray-800 ${STATUS_CHIP_BASE}`}>{label}</span>;
  }
};


export const getPaymentMethodChip = (method: PaymentMethod | undefined | null) => {
  if (!method) {
    return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">-</span>;
  }
  
  // Handle both enum value and string comparison
  const methodStr = String(method);
  
  if (method === PaymentMethod.COD || methodStr === "COD" || methodStr === "cod") {
    return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">COD</span>;
  }
  if (method === PaymentMethod.Transfer || methodStr === "Transfer" || methodStr === "transfer") {
    return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">โอนเงิน</span>;
  }
  if (method === PaymentMethod.PayAfter || methodStr === "PayAfter" || methodStr === "payafter" || 
      methodStr === "หลังจากรับสินค้า" || methodStr === "รับสินค้าก่อน" || methodStr === "ผ่อนชำระ") {
    return <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">จ่ายหลังส่ง</span>;
  }
  
  return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">-</span>;
};

export const getPaymentStatusChip = (status: PaymentStatus, _method: PaymentMethod, amountPaid?: number, totalAmount?: number) => {
  if (!status) return <span className={`bg-gray-100 text-gray-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>-</span>;

  // Check for Overpaid
  if (amountPaid !== undefined && totalAmount !== undefined && amountPaid > totalAmount) {
    return <span className={`bg-purple-100 text-purple-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>ชำระเกิน</span>;
  }

  switch (status) {
    case PaymentStatus.Paid:
      return <span className={`bg-green-100 text-green-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>ชำระแล้ว</span>;
    case PaymentStatus.Approved:
      return <span className={`bg-emerald-100 text-emerald-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>อนุมัติแล้ว</span>;
    case PaymentStatus.PreApproved:
      return <span className={`bg-orange-100 text-orange-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>รอตรวจสอบ</span>;
    case PaymentStatus.Verified:
      return <span className={`bg-blue-100 text-blue-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>ตรวจสอบแล้ว</span>;
    case PaymentStatus.PendingVerification:
      return <span className={`bg-yellow-100 text-yellow-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>รอแจ้งโอน</span>;
    case PaymentStatus.Unpaid:
      return <span className={`bg-red-100 text-red-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>ยังไม่ชำระ</span>;
    default:
      return <span className={`bg-gray-100 text-gray-800 ${STATUS_CHIP_BASE} whitespace-nowrap`}>-</span>;
  }
};


const OrderStatusPipeline: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const idx = ORDER_STATUS_FLOW.findIndex((s) => s === status);
  if (idx === -1) {
    return (
      <div className="min-w-[200px]">
        {getStatusChip(status)}
        <div className="text-xs text-gray-500 mt-1">{ORDER_STATUS_LABELS[status] ?? status}</div>
      </div>
    );
  }
  return (
    <div className="min-w-[220px]">
      <div className="flex items-center">
        {ORDER_STATUS_FLOW.map((step, i) => {
          const isCompleted = i < idx;
          const isCurrent = i === idx;
          return (
            <React.Fragment key={step}>
              <div
                className={`w-4 h-4 rounded-full border ${isCurrent
                  ? 'bg-blue-600 border-blue-600'
                  : isCompleted
                    ? 'bg-blue-300 border-blue-300'
                    : 'bg-white border-gray-300'
                  }`}
              ></div>
              {i < ORDER_STATUS_FLOW.length - 1 && (
                <div className={`h-1 flex-1 mx-1 ${i < idx ? 'bg-blue-400' : 'bg-gray-200'}`}></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="text-xs text-gray-600 mt-1 font-medium">
        {ORDER_STATUS_LABELS[status] ?? status}
      </div>
    </div>
  );
};


const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  customers,
  openModal,
  user,
  users,
  onCancelOrder,
  selectable,
  selectedIds,
  onSelectionChange,
  showShippingColumn = false,
  shippingEditable = false,
  shippingOptions = [],
  shippingSavingIds = [],
  onShippingChange,
}) => {
  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds && selectedIds.length === orders.length) onSelectionChange([]);
    else onSelectionChange(orders.map((o) => o.id));
  };
  const handleSelectOne = (orderId: string) => {
    if (!onSelectionChange || !selectedIds) return;
    if (selectedIds.includes(orderId)) onSelectionChange(selectedIds.filter((id) => id !== orderId));
    else onSelectionChange([...selectedIds, orderId]);
  };

  // Check if order has upsell items (items with creatorId different from order.creatorId)
  const isUpsellOrder = (order: Order): boolean => {
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      return false;
    }
    // Check if any item has a creatorId that differs from the order's creatorId
    return order.items.some((item) => {
      if (item.creatorId === undefined || item.creatorId === null) {
        return false;
      }
      // Compare creatorId of item with order's creatorId
      const itemCreatorId = typeof item.creatorId === 'number' ? item.creatorId : Number(item.creatorId);
      const orderCreatorId = typeof order.creatorId === 'number' ? order.creatorId : Number(order.creatorId);
      return itemCreatorId !== orderCreatorId;
    });
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              {selectable && (
                <th className="p-4">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    checked={selectedIds?.length === orders.length && orders.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              <th className="px-6 py-3">ORDER ID</th>
              <th className="px-6 py-3">ชื่อลูกค้า</th>
              <th className="px-6 py-3 min-w-[140px]">ผู้ขาย</th>
              <th className="px-6 py-3">วันที่ส่ง</th>
              <th className="px-6 py-3">ราคา</th>
              <th className="px-6 py-3">ช่องทางการชำระ</th>
              <th className="px-6 py-3">สถานะชำระ</th>
              <th className="px-6 py-3 text-center">ยอดชำระ</th>
              {showShippingColumn && <th className="px-6 py-3 text-center">ขนส่ง</th>}
              <th className="px-6 py-3">TRACKING</th>
              <th className="px-6 py-3">จัดการ</th>
              <th className="px-6 py-3">สถานะออเดอร์</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              // Match customer by pk (customer_id) or id (string)
              const customer = customers.find((c) => {
                // Try matching by pk (number) first, then by id (string)
                if (c.pk && typeof order.customerId === 'number') {
                  return c.pk === order.customerId;
                }
                // Fallback to string comparison
                return String(c.id) === String(order.customerId) || 
                       String(c.pk) === String(order.customerId);
              });
              // Match seller by id (ensure type compatibility)
              const seller = users?.find((u) => {
                if (!order.creatorId) {
                  console.warn('Order missing creatorId:', order.id);
                  return false;
                }
                // Try number comparison first
                if (typeof u.id === 'number' && typeof order.creatorId === 'number') {
                  return u.id === order.creatorId;
                }
                // Fallback to string comparison
                const match = String(u.id) === String(order.creatorId);
                if (!match && order.creatorId) {
                  console.debug('Seller not found:', {
                    orderId: order.id,
                    creatorId: order.creatorId,
                    creatorIdType: typeof order.creatorId,
                    userId: u.id,
                    userIdType: typeof u.id,
                    usersCount: users?.length,
                    availableUserIds: users?.map(u => u.id).slice(0, 5)
                  });
                }
                return match;
              });
              const paid = (order.amountPaid ?? 0) as number;
              const diff = order.totalAmount - paid;
              const paidText = `฿${(paid || 0).toLocaleString()}`;
              const isSavingShipping = shippingSavingIds?.includes(order.id);
              return (
                <tr key={order.id} className="bg-white border-b hover:bg-gray-50">
                  {selectable && (
                    <td className="p-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                        checked={selectedIds?.includes(order.id)}
                        onChange={() => handleSelectOne(order.id)}
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 font-mono text-xs text-gray-600">{order.id}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {customer ? (
                      <div>
                        <div>{`${customer.firstName} ${customer.lastName}`}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {customer.phone} | {customer.address ? `${customer.address.subdistrict} ${customer.address.district} ${customer.address.province} ${customer.address.postalCode}` : ''}
                        </div>
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-600 min-w-[140px]">
                    <div className="flex flex-col gap-1">
                      <span>{seller ? `${seller.firstName} ${seller.lastName}` : '-'}</span>
                      {isUpsellOrder(order) && <UpsellTag />}
                    </div>
                  </td>
                  <td className="px-6 py-4">{new Date(order.deliveryDate).toLocaleDateString('th-TH')}</td>
                  <td className="px-6 py-4 font-semibold">฿{order.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4">{getPaymentMethodChip(order.paymentMethod)}</td>
                  <td className="px-6 py-4">{getPaymentStatusChip(order.paymentStatus, order.paymentMethod, order.amountPaid, order.totalAmount)}</td>
                  <td className="px-6 py-4 font-medium min-w-[170px] paid-break text-center">
                    {paid === 0 ? (
                      <span className="text-gray-500">{paidText}</span>
                    ) : diff > 0 ? (
                      <span>{paidText} <span className="text-red-600">(ขาด ฿{diff.toLocaleString()})</span></span>
                    ) : diff < 0 ? (
                      <span>{paidText} <span className="text-purple-600">(เกิน ฿{Math.abs(diff).toLocaleString()})</span></span>
                    ) : (
                      <span>{paidText} <span className="text-green-600">(ครบ)</span></span>
                    )}
                  </td>
                  {showShippingColumn && (
                    <td className="px-6 py-4 text-center">
                      {shippingEditable && onShippingChange ? (
                        <select
                          value={order.shippingProvider || ''}
                          onChange={(e) => onShippingChange(order.id, e.target.value)}
                          disabled={isSavingShipping}
                          className="w-full px-3 py-1.5 text-sm rounded-full border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 shadow-sm transition"
                        >
                          <option value="">เลือกขนส่ง</option>
                          {shippingOptions.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-700">{order.shippingProvider || '-'}</span>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 font-mono text-xs">{order.trackingNumbers.join(', ') || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {/* Always allow managing (e.g., upload slip) */}
                    <button onClick={() => openModal('manageOrder', order)} className="font-medium text-blue-600 hover:underline">จัดการ</button>
                    {order.orderStatus === OrderStatus.Pending && (
                      <span className="text-gray-400 text-sm ml-2">รอ Export</span>
                    )}
                    {(user?.role === UserRole.Telesale || user?.role === UserRole.Supervisor) &&
                      order.orderStatus === OrderStatus.Pending && onCancelOrder && (
                        <button onClick={() => onCancelOrder(order.id)} className="font-medium text-red-600 hover:underline ml-2">ยกเลิก</button>
                      )}
                  </td>
                  <td className="px-6 py-4"><OrderStatusPipeline status={order.orderStatus} /></td>
                </tr>
              );
            })}
            {orders.length === 0 && (
              <tr>
                <td colSpan={selectable ? (showShippingColumn ? 13 : 12) : (showShippingColumn ? 12 : 11)} className="text-center py-10 text-gray-500">ไม่มีข้อมูลออเดอร์</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderTable;
