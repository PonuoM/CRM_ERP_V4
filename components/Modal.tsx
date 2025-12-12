import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  // Optional size: default 'md'. 'fullscreen' makes it almost full-screen.
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  // Optional: require confirmation before closing
  requireConfirmation?: boolean;
  confirmationMessage?: string;
  // Optional: allow closing by clicking backdrop (default: false)
  closeOnBackdropClick?: boolean;
}

const Modal: React.FC<ModalProps> = ({
  title,
  onClose,
  children,
  size = 'md',
  requireConfirmation = false,
  confirmationMessage = 'คุณต้องการปิดหน้าต่างนี้หรือไม่? ข้อมูลที่ยังไม่ได้บันทึกจะหายไป',
  closeOnBackdropClick = false
}) => {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleClose = () => {
    if (requireConfirmation) {
      setShowConfirmation(true);
    } else {
      onClose();
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmation(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowConfirmation(false);
  };

  const sizeClass = (() => {
    switch (size) {
      case 'sm': return 'max-w-md';
      case 'lg': return 'max-w-4xl';
      case 'xl': return 'max-w-6xl';
      case 'fullscreen': return 'w-[96vw] h-[90vh] max-w-none';
      case 'md':
      default: return 'max-w-2xl';
    }
  })();
  const heightClass = size === 'fullscreen' ? 'h-[90vh]' : 'max-h-[90vh]';

  // Prevent background scroll while modal is open
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-start md:pt-8 pt-4 pb-4"
        aria-modal="true"
        role="dialog"
        onClick={closeOnBackdropClick ? handleClose : undefined}
      >
        <div
          className={`bg-white rounded-lg shadow-xl w-full ${sizeClass} ${heightClass} flex flex-col`}
          onClick={e => e.stopPropagation()}
        >
          <header className="flex items-center justify-between p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100"
              aria-label="Close modal"
            >
              <X size={20} />
            </button>
          </header>
          <main className="p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">ยืนยันการปิด</h3>
              <p className="text-gray-600 mb-6">{confirmationMessage}</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCancelClose}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleConfirmClose}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Modal;
