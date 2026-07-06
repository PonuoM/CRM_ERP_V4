import React, { useState, useEffect } from 'react';
import Modal from '@/components/Modal';

interface AudioNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (id: number, notes: string) => void;
  audioLinkId: number;
  initialNotes: string;
}

const AudioNotesModal: React.FC<AudioNotesModalProps> = ({ isOpen, onClose, onSubmit, audioLinkId, initialNotes }) => {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes || '');
    }
  }, [isOpen, initialNotes]);

  const handleSubmit = () => {
    onSubmit(audioLinkId, notes);
  };

  if (!isOpen) return null;

  return (
    <Modal title="หมายเหตุไฟล์เสียง" onClose={onClose} size="md">
      <div className="p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ระบุหมายเหตุเพิ่มเติมสำหรับไฟล์เสียงนี้
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="เช่น ไฟล์เสียงสั้นเกินไป, ลูกค้าไม่พอใจ, โทรไม่ติด ฯลฯ"
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          rows={4}
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
            บันทึก
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AudioNotesModal;
