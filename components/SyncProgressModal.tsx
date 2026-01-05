import React from 'react';
import ReactDOM from 'react-dom';
import { Download } from 'lucide-react';

export interface SyncProgress {
    message: string;
    progress: number;
    totalCustomers: number;
    syncedCustomers: number;
    isComplete: boolean;
    isError: boolean;
}

interface SyncProgressModalProps {
    isOpen: boolean;
    progress: SyncProgress;
    onClose: () => void;
}

export const SyncProgressModal: React.FC<SyncProgressModalProps> = ({ isOpen, progress, onClose }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 border-2 border-dashed border-gray-200">
                {/* Circular Download Icon */}
                <div className="flex flex-col items-center mb-6">
                    <div className={`relative w-20 h-20 rounded-full flex items-center justify-center mb-4 ${progress.isError ? 'bg-red-100' : progress.isComplete ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                        {/* Spinning dots animation when loading */}
                        {!progress.isComplete && !progress.isError && (
                            <div className="absolute inset-0 rounded-full border-4 border-blue-200 border-t-blue-500 animate-spin"></div>
                        )}
                        <Download className={`w-8 h-8 ${progress.isError ? 'text-red-500' : progress.isComplete ? 'text-green-500' : 'text-blue-500'
                            }`} />
                    </div>

                    {/* Percentage */}
                    <div className={`text-3xl font-bold mb-2 ${progress.isError ? 'text-red-600' : progress.isComplete ? 'text-green-600' : 'text-gray-700'
                        }`}>
                        {Math.round(progress.progress)}%
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
                    <div
                        className={`h-2 rounded-full transition-all duration-300 ${progress.isError ? 'bg-red-500' : progress.isComplete ? 'bg-green-500' : 'bg-blue-500'
                            }`}
                        style={{ width: `${progress.progress}%` }}
                    ></div>
                </div>

                {/* Status Text */}
                <div className="text-center">
                    <div className={`font-semibold ${progress.isError ? 'text-red-600' : progress.isComplete ? 'text-green-600' : 'text-gray-700'
                        }`}>
                        {progress.isError
                            ? 'เกิดข้อผิดพลาด'
                            : progress.isComplete
                                ? 'อัปเดตข้อมูลสำเร็จ!'
                                : 'Update data Customer...'}
                    </div>
                    {progress.totalCustomers > 0 && (
                        <div className="text-sm text-gray-500 mt-1">
                            {progress.syncedCustomers.toLocaleString()} of {progress.totalCustomers.toLocaleString()}
                        </div>
                    )}
                </div>

                {/* Close Button */}
                {(progress.isComplete || progress.isError) && (
                    <div className="flex justify-center mt-6">
                        <button
                            onClick={onClose}
                            className={`px-6 py-2 text-white rounded-lg font-medium transition-colors ${progress.isError
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-green-500 hover:bg-green-600'
                                }`}
                        >
                            ตกลง
                        </button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
