import React from 'react';
import { AlertTriangle, X, ExternalLink } from 'lucide-react';

export interface TokenError {
  pageName: string;
  pageId: string;
  message: string;
}

interface PancakeTokenErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  errors: TokenError[];
  successCount: number;
}

const PancakeTokenErrorModal: React.FC<PancakeTokenErrorModalProps> = ({
  isOpen,
  onClose,
  errors,
  successCount
}) => {
  if (!isOpen || errors.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">เพจบางส่วนไม่สามารถดึงข้อมูลได้</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                สำเร็จ {successCount} เพจ · ล้มเหลว {errors.length} เพจ
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-amber-100 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error List */}
        <div className="px-5 py-4 max-h-72 overflow-y-auto">
          <div className="space-y-2.5">
            {errors.map((err, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 px-3.5 py-3 bg-red-50 border border-red-100 rounded-lg"
              >
                <div className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <X className="w-3 h-3 text-red-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{err.pageName}</p>
                  <p className="text-xs text-red-600 mt-0.5">{err.message}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-mono">ID: {err.pageId}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-gray-50 border-t flex items-center justify-between">
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <ExternalLink className="w-3 h-3" />
            ตรวจสอบสิทธิ์เพจใน Pancake
          </p>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
          >
            รับทราบ
          </button>
        </div>
      </div>
    </div>
  );
};

export default PancakeTokenErrorModal;
