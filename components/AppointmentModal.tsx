import React, { useState } from 'react';
import { Customer, Appointment } from '../types';
import Modal from './Modal';

interface AppointmentModalProps {
  customer: Customer;
  onSave: (appointment: Omit<Appointment, 'id' | 'status'>) => Promise<void> | void;
  onClose: () => void;
}

const AppointmentModal: React.FC<AppointmentModalProps> = ({ customer, onSave, onClose }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!title || !date) {
      alert('กรุณากรอกหัวข้อและวันที่นัดหมาย');
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        customerId: customer.id,
        title,
        date,
        notes: notes || undefined,
      });
    } catch (error) {
      console.error("Failed to save appointment", error);
    } finally {
      setIsSaving(false);
    }
  };

  const nowForInput = new Date().toISOString().slice(0, 16);

  return (
    <Modal title={`สร้างนัดหมายสำหรับ: ${customer.firstName} ${customer.lastName}`} onClose={!isSaving ? onClose : () => { }}>
      <div className="space-y-4 text-sm">
        <div>
          <label className="block text-gray-700 font-medium mb-1">หัวข้อการนัดหมาย</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="เช่น โทรติดตามผล, นัดสาธิตสินค้า"
            style={{ colorScheme: 'light' }}
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-1">วันที่นัดหมาย</label>
          <input
            type="datetime-local"
            min={nowForInput}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500"
            style={{ colorScheme: 'light' }}
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block text-gray-700 font-medium mb-1">หมายเหตุ (ถ้ามี)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-md disabled:bg-gray-100 disabled:text-gray-500"
            placeholder="รายละเอียดเพิ่มเติม..."
            style={{ colorScheme: 'light' }}
            disabled={isSaving}
          ></textarea>
        </div>
      </div>
      <div className="flex justify-end space-x-3 pt-6 border-t mt-6">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ยกเลิก
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-[#2E7D32] text-white font-semibold rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {isSaving ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังบันทึก...
            </>
          ) : (
            "บันทึกนัดหมาย"
          )}
        </button>
      </div>
    </Modal>
  );
};

export default AppointmentModal;