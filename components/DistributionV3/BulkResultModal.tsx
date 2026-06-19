import React from 'react';
import { Check, ArrowRight } from 'lucide-react';
import { BasketConfig } from '../../types/distribution';

export interface BulkResultModalState {
    isOpen: boolean;
    title: string;
    total: number;
    results: any[];
    fromAgentName?: string;
    toName?: string;
}

interface BulkResultModalProps {
    modalState: BulkResultModalState;
    dashboardBaskets: BasketConfig[];
    onClose: () => void;
}

const BulkResultModal: React.FC<BulkResultModalProps> = ({ modalState, dashboardBaskets, onClose }) => {
    if (!modalState || !modalState.isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[80] p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                            <Check size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-800 text-lg">{modalState.title}</h3>
                            <p className="text-sm text-gray-500">ดำเนินการเสร็จสิ้น</p>
                        </div>
                    </div>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex flex-col items-center justify-center">
                        <div className="text-3xl font-black text-blue-700">{modalState.total.toLocaleString()}</div>
                        <div className="text-sm text-blue-600/80 font-medium mt-1">รายชื่อทั้งหมด</div>
                    </div>
                    
                    {modalState.results && modalState.results.length > 0 && (
                        <div>
                            <h4 className="text-sm font-bold text-gray-700 mb-3">รายละเอียดการทำรายการ</h4>
                            <div className="space-y-3">
                                {modalState.results.map((r, i) => {
                                    const bname = dashboardBaskets.find(b => b.basket_key === r.basket_key)?.basket_name || r.basket_key;
                                    const val = r.reclaimed || r.transferred || 0;
                                    return (
                                        <div key={i} className="flex flex-col p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-sm font-bold text-gray-800">ตะกร้า: {bname}</span>
                                                <span className="text-sm font-bold text-blue-600">{val.toLocaleString()} รายชื่อ</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                                <div className="bg-white px-2 py-1.5 border rounded flex-1 truncate shadow-sm">
                                                    จาก: <span className="font-semibold text-gray-700">{modalState.fromAgentName}</span>
                                                </div>
                                                <ArrowRight size={14} className="text-gray-400 shrink-0" />
                                                <div className="bg-white px-2 py-1.5 border rounded flex-1 truncate shadow-sm">
                                                    ไปที่: <span className="font-semibold text-gray-700">{modalState.toName}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t bg-white flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkResultModal;
