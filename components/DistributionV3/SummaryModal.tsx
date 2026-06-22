import React from 'react';
import { AlertCircle, Download, Loader2, RefreshCw } from 'lucide-react';
import { SummaryStats } from '../../types/distribution';

interface SummaryModalProps {
    isOpen: boolean;
    summaryStats: SummaryStats | null;
    onClose: () => void;
    onExport: () => void;
    onDistributeMore: () => void;
    distributing: boolean;
}

const SummaryModal: React.FC<SummaryModalProps> = ({
    isOpen,
    summaryStats,
    onClose,
    onExport,
    onDistributeMore,
    distributing
}) => {
    if (!isOpen || !summaryStats) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col animate-in fade-in duration-200">
                {/* Header */}
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <h3 className="text-xl font-bold text-gray-800">สรุปผลการแจกงาน</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                {/* Body - Stats Table */}
                <div className="p-6 overflow-y-auto flex-1">
                    {/* Top Summary Cards */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                            <div className="text-3xl font-bold text-green-600">{summaryStats.totalSuccess}</div>
                            <div className="text-sm text-green-800">แจกสำเร็จ (รายการ)</div>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                            <div className="text-3xl font-bold text-red-600">{summaryStats.totalFailed}</div>
                            <div className="text-sm text-red-800">แจกไม่สำเร็จ (รายการ)</div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-3 text-left font-semibold text-gray-600">พนักงาน</th>
                                    <th className="p-3 text-center text-green-700 font-semibold">สำเร็จ</th>
                                    <th className="p-3 text-center text-red-700 font-semibold">ไม่สำเร็จ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {Object.values(summaryStats.agentStats).map((stat, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="p-3 font-medium text-gray-800">{stat.name}</td>
                                        <td className="p-3 text-center text-green-600 font-bold">{stat.success}</td>
                                        <td className="p-3 text-center text-red-500 font-medium">{stat.failed > 0 ? stat.failed : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Missing Alert */}
                    {summaryStats.missingTotal > 0 && (
                        <div className="mt-6 p-4 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-3">
                            <AlertCircle className="text-orange-600 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-orange-800">ยังแจกไม่ครบตามเป้าหมาย</h4>
                                <p className="text-sm text-orange-700">ขาดอีกประมาณ <span className="font-bold">{summaryStats.missingTotal}</span> รายชื่อ</p>
                                <p className="text-xs text-orange-600 mt-1">ต้องการค้นหาลูกค้าเพิ่มเติมและแจกต่อหรือไม่?</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t bg-gray-50 flex justify-between gap-3 rounded-b-xl">
                    <button
                        onClick={onExport}
                        className="px-6 py-2 border border-green-600 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-bold transition-colors flex items-center gap-2"
                    >
                        <Download size={18} />
                        Export เป็น Excel
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-6 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
                        >
                            ปิด (เสร็จสิ้น)
                        </button>
                        {summaryStats.missingTotal > 0 && (
                            <button
                                onClick={onDistributeMore}
                                disabled={distributing}
                                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                            >
                                {distributing ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
                                แจกเพิ่มส่วนที่ขาด
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SummaryModal;
