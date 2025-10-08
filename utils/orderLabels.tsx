import React from 'react';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@/types';

export const StatusChip: React.FC<{ status: OrderStatus }> = ({ status }) => {
  switch (status) {
    case OrderStatus.Picking:
      return <span className="bg-yellow-100 text-yellow-800 text-xs font-medium px-2.5 py-0.5 rounded-full">กำลังแพ็ค</span>;
    case OrderStatus.Shipping:
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">กำลังจัดส่ง</span>;
    case OrderStatus.Delivered:
      return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">ส่งสำเร็จ</span>;
    case OrderStatus.Returned:
      return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">ตีกลับ</span>;
    case OrderStatus.Cancelled:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">ยกเลิก</span>;
    default:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">รอดำเนินการ</span>;
  }
};

export const PaymentMethodChip: React.FC<{ method: PaymentMethod }> = ({ method }) => {
  switch (method) {
    case PaymentMethod.COD:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">COD</span>;
    case PaymentMethod.Transfer:
      return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">โอนเงิน</span>;
    case PaymentMethod.PayAfter:
      return <span className="bg-purple-100 text-purple-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">จ่ายปลายทาง</span>;
    default:
      return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full whitespace-nowrap">-</span>;
  }
};

export const PaymentStatusChip: React.FC<{ status?: PaymentStatus | null }> = ({ status }) => {
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

export const OrderStatusPipelineNew: React.FC<{ status: OrderStatus }> = ({ status }) => {
  const pipelineSteps: { status: OrderStatus; label: string }[] = [
    { status: OrderStatus.Pending, label: 'รอดำเนินการ' },
    { status: OrderStatus.Picking, label: 'กำลังแพ็ค' },
    { status: OrderStatus.Shipping, label: 'กำลังจัดส่ง' },
    { status: OrderStatus.Delivered, label: 'ส่งสำเร็จ' },
  ];
  const currentStepIndex = pipelineSteps.findIndex((p) => p.status === status);
  if (currentStepIndex === -1) {
    return <StatusChip status={status} />;
  }
  const stepsLeft = pipelineSteps.length - 1 - currentStepIndex;
  return (
    <div className="min-w-[200px]">
      <div className="flex items-center">
        {pipelineSteps.map((step, index) => (
          <React.Fragment key={step.status}>
            <div className={`w-4 h-4 rounded-full ${index <= currentStepIndex ? 'bg-green-500' : 'bg-gray-300'}`}></div>
            {index < pipelineSteps.length - 1 && (
              <div className={`h-1 flex-1 mx-1 ${index < currentStepIndex ? 'bg-green-400' : 'bg-gray-200'}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>
      {stepsLeft > 0 && currentStepIndex !== -1 && (
        <div className="text-xs text-gray-500 mt-1">(เหลือ {stepsLeft} ขั้นตอน)</div>
      )}
    </div>
  );
};

