import React, { useState } from 'react';
import { Customer, Appointment } from '../types';
import Modal from './Modal';

interface AppointmentModalProps {
  customer: Customer;
  onSave: (appointment: Omit<Appointment, 'id' | 'status'>) => void;
  onClose: () => void;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ customer, onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    if (!title || !date) {
      alert('กรุณากรอกหัวข้อและวันที่นัดหมาย');
      return;
    }
    onSave({
      customerId: customer.id,
      title,
      date,
      notes: notes || undefined,
    });
  };

  const nowForInput = new Date().toISOString().slice(0, 16);

  return (
    <Modal title={`สร้างนัดหมายสำหรับ: ${customer.firstName} ${customer.lastName}`} onClose={onClose}>
      <div className="space-y-4 text-sm">
        <div>
          <label className="block text-gray-700 font-medium mb-1">หัวข้อการนัดหมาย</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="เช่น โทรติดตามผล, นัดสาธิตสินค้า"
            style={{ colorScheme: 'light' }}
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-1">วันที่นัดหมาย</label>
          <input
            type="datetime-local"
            min={nowForInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
            style={{ colorScheme: 'light' }}
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-1">หมายเหตุ (ถ้ามี)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-md"
            placeholder="รายละเอียดเพิ่มเติม..."
            style={{ colorScheme: 'light' }}
          ></textarea>
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
        <button
          onClick={onClose}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-[#2E7D32] text-white font-semibold rounded-lg hover:bg-green-800"
        >
          บันทึกนัดหมาย
        </button>
      </div>
    </Modal>
  );
};

export default AppointmentModal;