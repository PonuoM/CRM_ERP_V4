import React from 'react';
import { AlertCircle } from 'lucide-react';

export interface ConfirmModalState {
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    onConfirm: () => void;
    variant?: 'warning' | 'danger' | 'info';
    confirmLabel?: string;
    confirmColor?: 'red' | 'blue' | 'orange';
}

interface ConfirmModalProps {
    modalState: ConfirmModalState;
    onClose: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ modalState, onClose }) => {
    if (!modalState.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className={`p-4 border-b flex items-center gap-3 ${modalState.variant === 'danger' ? 'bg-red-50 border-red-100' :
                    modalState.variant === 'warning' ? 'bg-orange-50 border-orange-100' :
                        'bg-gray-50'
                    }`}>
                    {modalState.variant === 'danger' && <AlertCircle className="text-red-600" />}
                    {modalState.variant === 'warning' && <AlertCircle className="text-orange-600" />}
                    <h3 className={`font-bold ${modalState.variant === 'danger' ? 'text-red-800' :
                        modalState.variant === 'warning' ? 'text-orange-800' :
                            'text-gray-800'
                        }`}>
                        {modalState.title}
                    </h3>
                </div>

                <div className="p-6 text-gray-700">
                    {modalState.message}
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border rounded-lg hover:bg-gray-100 text-gray-700 font-medium"
                    >
                        ยกเลิก
                    </button>
                    <button
                        onClick={modalState.onConfirm}
                        className={`px-4 py-2 rounded-lg text-white font-medium shadow-sm flex items-center gap-2 ${modalState.confirmColor === 'red' ? 'bg-red-600 hover:bg-red-700' :
                            modalState.confirmColor === 'orange' ? 'bg-orange-600 hover:bg-orange-700' :
                                'bg-blue-600 hover:bg-blue-700'
                            }`}
                    >
                        {modalState.confirmLabel || 'ยืนยัน'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
