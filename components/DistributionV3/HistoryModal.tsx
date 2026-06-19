import React from 'react';
import { Loader2 } from 'lucide-react';
import { AssignHistory, Customer } from '../../types/distribution';

interface HistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    viewingCustomer: Customer | null;
    historyLoading: boolean;
    historyData: AssignHistory[];
}

const HistoryModal: React.FC<HistoryModalProps> = ({
    isOpen,
    onClose,
    viewingCustomer,
    historyLoading,
    historyData
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h3 className="font-bold text-gray-800">ประวัติการแจกงาน</h3>
                        <p className="text-xs text-gray-500">{viewingCustomer?.code} - {viewingCustomer?.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-0">
                    {historyLoading ? (
                        <div className="py-8 flex justify-center">
                            <Loader2 className="animate-spin text-blue-500" />
                        </div>
                    ) : historyData.length === 0 ? (
                        <div className="py-8 text-center text-gray-400 text-sm">ไม่พบประวัติ</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-medium sticky top-0">
                                <tr>
                                    <th className="p-3 text-left pl-6">พนักงานที่ได้รับ</th>
                                    <th className="p-3 text-right pr-6">วันที่ได้รับ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {historyData.map((h, i) => (
                                    <tr key={i}>
                                        <td className="p-3 pl-6 text-gray-800">{h.first_name} {h.last_name}</td>
                                        <td className="p-3 pr-6 text-right text-gray-500">
                                            {new Date(h.created_at).toLocaleDateString('th-TH', {
                                                day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                <div className="p-3 border-t bg-gray-50 text-right">
                    <button onClick={onClose} className="px-3 py-1.5 bg-white border rounded text-sm hover:bg-gray-50">ปิด</button>
                </div>
            </div>
        </div>
    );
};

export default HistoryModal;
