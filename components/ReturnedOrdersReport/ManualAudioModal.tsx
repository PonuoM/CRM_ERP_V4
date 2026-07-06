import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';

interface ManualAudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { order_id: string; audio_url: string; audio_date: string; notes: string }) => void;
  orderId: string;
}

const ManualAudioModal: React.FC<ManualAudioModalProps> = ({ isOpen, onClose, onSubmit, orderId }) => {
  const [audioUrl, setAudioUrl] = useState('');
  const [audioDate, setAudioDate] = useState('');
  const [notes, setNotes] = useState('');

  // Reset fields when opened for a new order
  useEffect(() => {
    if (isOpen) {
      setAudioUrl('');
      setAudioDate('');
      setNotes('');
    }
  }, [isOpen, orderId]);

  const handleSubmit = () => {
    onSubmit({
      order_id: orderId,
      audio_url: audioUrl,
      audio_date: audioDate,
      notes
    });
  };

  if (!isOpen) return null;

  return (
    <Modal title="แนบลิงก์ไฟล์เสียง (Manual)" onClose={onClose} size="md">
      <div className="p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          ลิงก์ไฟล์เสียง (เช่น Google Drive)
        </label>
        <input 
          type="url"
          value={audioUrl}
          onChange={e => setAudioUrl(e.target.value)}
          placeholder="https://drive.google.com/..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          วันที่และเวลาของไฟล์เสียง (ไม่บังคับ)
        </label>
        <input 
          type="datetime-local"
          value={audioDate}
          onChange={e => setAudioDate(e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">
          หมายเหตุเพิ่มเติม (ไม่บังคับ)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="เช่น โทรยืนยันออเดอร์, ลูกค้าขอเปลี่ยนไซส์..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          rows={3}
        />

        <div className="flex justify-end gap-2 mt-4">
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
            แนบไฟล์เสียง
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ManualAudioModal;
