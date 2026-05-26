import React from 'react';
import Modal from './Modal';
import { AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';

export type ConfirmModalType = 'danger' | 'warning' | 'info' | 'success';

interface ConfirmModalProps {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  type?: ConfirmModalType;
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  title, 
  message, 
  confirmText = 'ยืนยัน', 
  cancelText = 'ยกเลิก', 
  type = 'warning',
  onConfirm, 
  onClose 
}) => {
  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100"><AlertTriangle className="h-6 w-6 text-red-600" /></div>;
      case 'warning':
        return <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100"><AlertCircle className="h-6 w-6 text-yellow-600" /></div>;
      case 'info':
        return <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100"><Info className="h-6 w-6 text-blue-600" /></div>;
      case 'success':
        return <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100"><CheckCircle className="h-6 w-6 text-green-600" /></div>;
    }
  };

  const getConfirmButtonClass = () => {
    switch (type) {
      case 'danger': return 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
      case 'warning': return 'bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400';
      case 'info': return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500';
      case 'success': return 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
      default: return 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500';
    }
  };

  return (
    <Modal title={title} onClose={onClose} size="sm">
      <div className="text-center">
        {getIcon()}
        <div className="mt-3 text-center sm:mt-5">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            {title}
          </h3>
          <div className="mt-2">
            <p className="text-sm text-gray-500">
              {message}
            </p>
          </div>
        </div>
      </div>
      <div className="mt-5 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3 sm:grid-flow-row-dense">
        <button
          type="button"
          className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:col-start-2 sm:text-sm ${getConfirmButtonClass()}`}
          onClick={onConfirm}
        >
          {confirmText}
        </button>
        <button
          type="button"
          className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:col-start-1 sm:text-sm"
          onClick={onClose}
        >
          {cancelText}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
