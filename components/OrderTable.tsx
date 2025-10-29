﻿import React from 'react';
import { Order, Customer, ModalType, OrderStatus, PaymentStatus, PaymentMethod, User, UserRole } from '../types';

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
}

// Exported helpers (used by other components)
export const getStatusChip = (status: OrderStatus) => {
  switch (status) {
    case OrderStatus.Picking:
      return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">กำลังจัดสินค้า</span>;
    case OrderStatus.Shipping:
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">กำลังจัดส่ง</span>;
    case OrderStatus.Delivered:
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">จัดส่งแล้ว</span>;
    case OrderStatus.Returned:
      return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">คืนสินค้า</span>;
    case OrderStatus.Cancelled:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">ยกเลิก</span>;
    default:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">รอการดำเนินการ</span>;
  }
};

export const getPaymentMethodChip = (method: PaymentMethod) => {
  switch (method) {
    case PaymentMethod.COD:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">COD</span>;
    case PaymentMethod.Transfer:
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">โอนเงิน</span>;
    case PaymentMethod.PayAfter:
      return <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">จ่ายหลังส่ง</span>;
    default:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">-</span>;
  }
};

export const getPaymentStatusChip = (status: PaymentStatus, _method: PaymentMethod) => {
  if (!status) return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">-</span>;
  switch (status) {
    case PaymentStatus.Paid:
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">ชำระแล้ว</span>;
    case PaymentStatus.PendingVerification:
      return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">รอตรวจสอบ</span>;
    case PaymentStatus.Unpaid:
      return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">ยังไม่ชำระ</span>;
    default:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">-</span>;
  }
};

const OrderStatusPipeline: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const steps: { status: OrderStatus; label: string }[] = [
    { status: OrderStatus.Pending, label: 'รอการดำเนินการ' },
    { status: OrderStatus.Picking, label: 'กำลังจัดสินค้า' },
    { status: OrderStatus.Shipping, label: 'กำลังจัดส่ง' },
    { status: OrderStatus.Delivered, label: 'จัดส่งแล้ว' },
  ];
  const idx = steps.findIndex((s) => s.status === status);
  if (idx === -1) return getStatusChip(status);
  const stepsLeft = steps.length - 1 - idx;
  return (
    <div className="min-w-[200px]">
      <div className="flex items-center">
        {steps.map((s, i) => (
          <React.Fragment key={s.status}>
            <div className={`w-4 h-4 rounded-full ${i <= idx ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            {i < steps.length - 1 && (
              <div className={`h-1 flex-1 mx-1 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>
      {stepsLeft > 0 && idx !== -1 && (
        <div className="text-xs text-gray-500 mt-1">(เหลือ {stepsLeft} ขั้นตอน)</div>
      )}
    </div>
  );
};

const OrderTable: React.FC<OrderTableProps> = ({ orders, customers, openModal, user, users, onCancelOrder, selectable, selectedIds, onSelectionChange }) => {
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
              <th className="px-6 py-3">ผู้ขาย</th>
              <th className="px-6 py-3">วันที่ส่ง</th>
              <th className="px-6 py-3">ราคา</th>
              <th className="px-6 py-3">ช่องทางการชำระ</th>
              <th className="px-6 py-3">สถานะชำระ</th>
              <th className="px-6 py-3">ยอดชำระ</th>
              <th className="px-6 py-3">TRACKING</th>
              <th className="px-6 py-3">จัดการ</th>
              <th className="px-6 py-3">สถานะออเดอร์</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => {
              const customer = customers.find((c) => c.id === order.customerId);
              const seller = users?.find((u) => u.id === order.creatorId);
              const paid = (order.amountPaid ?? (order as any).codAmount ?? 0) as number;
              const diff = order.totalAmount - paid;
              const paidText = `฿${(paid || 0).toLocaleString()}`;
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
                  <td className="px-6 py-4 text-gray-600">{seller ? `${seller.firstName} ${seller.lastName}` : '-'}</td>
                  <td className="px-6 py-4">{new Date(order.deliveryDate).toLocaleDateString('th-TH')}</td>
                  <td className="px-6 py-4 font-semibold">฿{order.totalAmount.toLocaleString()}</td>
                  <td className="px-6 py-4">{getPaymentMethodChip(order.paymentMethod)}</td>
                  <td className="px-6 py-4">{getPaymentStatusChip(order.paymentStatus, order.paymentMethod)}</td>
                  <td className="px-6 py-4 font-medium min-w-[170px] paid-break">
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
                <td colSpan={selectable ? 12 : 11} className="text-center py-10 text-gray-500">ไม่มีข้อมูลออเดอร์</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrderTable;
