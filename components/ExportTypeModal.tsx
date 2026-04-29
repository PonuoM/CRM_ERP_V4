import React, { useState } from 'react';
import Modal from './Modal';
import { FileSpreadsheet, FileText, Download } from 'lucide-react';

interface ExportTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (type: 'csv' | 'xlsx') => void;
  title?: string;
  isExporting?: boolean;
}

const ExportTypeModal: React.FC<ExportTypeModalProps> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "เลือกรูปแบบไฟล์ Export",
  isExporting = false
}) => {
  const [selectedType, setSelectedType] = useState<'csv' | 'xlsx'>('xlsx'); // Default to Excel

  if (!isOpen) return null;

  return (
    <Modal onClose={onClose} title={title}>
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-600 mb-4">
          กรุณาเลือกรูปแบบไฟล์ที่คุณต้องการดาวน์โหลด
        </p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setSelectedType('xlsx')}
            className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all ${
              selectedType === 'xlsx' 
                ? 'border-green-500 bg-green-50 text-green-700 shadow-sm' 
                : 'border-gray-200 hover:border-green-300 hover:bg-green-50/50 text-gray-600'
            }`}
          >
            <FileSpreadsheet size={32} className={`mb-2 ${selectedType === 'xlsx' ? 'text-green-600' : 'text-green-500'}`} />
            <span className="font-semibold text-sm">Excel File</span>
            <span className="text-xs mt-1 opacity-75">(.xlsx)</span>
          </button>

          <button
            onClick={() => setSelectedType('csv')}
            className={`flex flex-col items-center justify-center p-4 border rounded-xl transition-all ${
              selectedType === 'csv' 
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm' 
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 text-gray-600'
            }`}
          >
            <FileText size={32} className={`mb-2 ${selectedType === 'csv' ? 'text-blue-600' : 'text-blue-500'}`} />
            <span className="font-semibold text-sm">CSV File</span>
            <span className="text-xs mt-1 opacity-75">(.csv)</span>
          </button>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={isExporting}
          >
            ยกเลิก
          </button>
          <button
            onClick={() => onConfirm(selectedType)}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                กำลังเตรียมไฟล์...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download size={16} />
                ดาวน์โหลด
              </span>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExportTypeModal;
