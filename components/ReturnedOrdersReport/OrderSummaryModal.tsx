import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';

interface OrderSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (orderId: string, summary: string) => void;
  orderId: string;
  initialSummary: string;
}

const OrderSummaryModal: React.FC<OrderSummaryModalProps> = ({ isOpen, onClose, onSubmit, orderId, initialSummary }) => {
  const [summary, setSummary] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSummary(initialSummary || '');
    }
  }, [isOpen, initialSummary]);

  const handleSubmit = () => {
    onSubmit(orderId, summary);
  };

  if (!isOpen) return null;

  return (
    <Modal title="ระบุสรุปออเดอร์" onClose={onClose} size="md">
      <div className="p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          สรุปรายละเอียดของออเดอร์นี้ (ถ้ามี)
        </label>
        <textarea
          value={summary}
          onChange={e => setSummary(e.target.value)}
          placeholder="เช่น หักเงินพนักงาน เนื่องจากผิดกฏการขาย ในวันที่ 2026-07-01..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          rows={5}
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            บันทึกสรุป
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OrderSummaryModal;
