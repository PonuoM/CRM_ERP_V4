import React, { useState } from 'react';
import { Customer } from '@/types';
import { createCustomer } from '@/services/api';

interface AddCustomerSimpleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  companyId: number;
}

const AddCustomerSimpleModal: React.FC<AddCustomerSimpleModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  companyId,
}) => {
  const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', phone: '' });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!newCustomer.firstName || !newCustomer.phone) {
      alert('กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }
    if (newCustomer.phone.length < 9) {
      alert('เบอร์โทรศัพท์ต้องมีอย่างน้อย 9 หลัก');
      return;
    }
    setIsCreatingCustomer(true);
    try {
      await createCustomer({
        firstName: newCustomer.firstName,
        lastName: newCustomer.lastName,
        phone: newCustomer.phone,
        companyId: companyId,
        lifecycleStatus: 'New',
        behavioralStatus: 'Warm',
        grade: 'D',
      });
      onSuccess();
      onClose();
      setNewCustomer({ firstName: '', lastName: '', phone: '' });
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('ไม่สามารถเพิ่มลูกค้าได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900">เพิ่มลูกค้าใหม่</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อ <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newCustomer.firstName}
              onChange={e => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 border-gray-300"
              placeholder="ชื่อ"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">นามสกุล</label>
            <input
              type="text"
              value={newCustomer.lastName}
              onChange={e => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 border-gray-300"
              placeholder="นามสกุล"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={newCustomer.phone}
              onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setNewCustomer({ ...newCustomer, phone: val });
              }}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 border-gray-300"
              placeholder="เบอร์โทรศัพท์ (10 หลัก)"
              maxLength={10}
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border text-gray-700 rounded-md hover:bg-gray-50 font-medium text-sm"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={isCreatingCustomer}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm disabled:opacity-50"
          >
            {isCreatingCustomer ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddCustomerSimpleModal;
