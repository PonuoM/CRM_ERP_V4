import React from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  itemName: string;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ itemName, onConfirm, onClose }) => {
  return (
    <Modal title="ยืนยันการลบ" onClose={onClose}>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
          <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
        </div>
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            คุณแน่ใจหรือไม่?
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              คุณต้องการลบ "{itemName}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
        <button
          type="button"
          className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:col-start-2 sm:text-sm"
          onClick={onConfirm}
        >
          ยืนยันการลบ
        </button>
        <button
          type="button"
          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:col-start-1 sm:text-sm"
          onClick={onClose}
        >
          ยกเลิก
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDeleteModal;