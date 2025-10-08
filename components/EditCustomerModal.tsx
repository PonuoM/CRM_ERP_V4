import React, { useState, useEffect } from 'react';
import { Customer } from '../types';
import Modal from './Modal';
import { Facebook, MessageSquare } from 'lucide-react';

interface EditCustomerModalProps {
  customer: Customer;
  onSave: (customer: Customer) => void;
  onClose: () => void;
}

const EditCustomerModal: React.FC<EditCustomerModalProps> = ({ customer, onSave, onClose }) => {
  const [formData, setFormData] = useState<Customer>(customer);

  useEffect(() => {
    setFormData(customer);
  }, [customer]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    onSave(formData);
  };

  return (
    <Modal title={`แก้ไขข้อมูล: ${customer.firstName} ${customer.lastName}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 font-medium mb-1">ชื่อ</label>
            <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">นามสกุล</label>
            <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
          </div>
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-1">เบอร์โทร</label>
          <input type="text" name="phone" value={formData.phone} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
        </div>
        <div>
          <label className="flex items-center text-gray-700 font-medium mb-1">
              <Facebook size={16} className="text-blue-600" />
              <span className="ml-2">ชื่อใน Facebook</span>
          </label>
          <input type="text" name="facebookName" value={formData.facebookName || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
        </div>
        <div>
          <label className="flex items-center text-gray-700 font-medium mb-1">
              <MessageSquare size={16} className="text-green-500" />
              <span className="ml-2">LINE ID</span>
          </label>
          <input type="text" name="lineId" value={formData.lineId || ''} onChange={handleChange} className="w-full p-2 border border-gray-300 rounded-md" />
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
        <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">ยกเลิก</button>
        <button onClick={handleSave} className="px-4 py-2 bg-green-100 text-green-700 font-semibold rounded-lg hover:bg-green-200">บันทึก</button>
      </div>
    </Modal>
  );
};

export default EditCustomerModal;