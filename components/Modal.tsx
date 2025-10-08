import React from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  // Optional size: default 'md'. 'fullscreen' makes it almost full-screen.
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children, size = 'md' }) => {
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
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-40 flex justify-center items-center" 
      aria-modal="true" 
      role="dialog"
      onClick={onClose}
    >
      <div 
        className={`bg-white rounded-lg shadow-xl w-full ${sizeClass} ${heightClass} flex flex-col`}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button 
            onClick={onClose} 
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
  );
};

export default Modal;
