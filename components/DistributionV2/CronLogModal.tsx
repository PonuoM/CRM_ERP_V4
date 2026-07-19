import React, { useState, useEffect } from 'react';
import { Loader2, X, ChevronDown, ChevronUp, CalendarClock, Download } from 'lucide-react';
import { apiFetch } from '../../services/api';

interface CronLog {
    id: number;
    started_at: string;
    finished_at: string;
    status: string;
    transferred_count: number;
    dist_diff: number;
    dist_total_after: number;
    dist_breakdown: {
        basket_key: string;
        basket_name: string;
        before: number;
        after: number;
        diff: number;
    }[];
}

interface CronLogModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: number | undefined;
}

const CronLogModal: React.FC<CronLogModalProps> = ({ isOpen, onClose, companyId }) => {
    const [logs, setLogs] = useState<CronLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && companyId) {
            fetchLogs();
        }
    }, [isOpen, companyId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`distribution_export?action=get_cron_logs&companyId=${companyId}&limit=20`);
            if (res.ok) {
                setLogs(res.data || []);
            }
        } catch (error) {
            console.error('Failed to fetch cron logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const toggleExpand = (id: number) => {
        setExpandedLogId(prev => prev === id ? null : id);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('th-TH', {
            day: '2-digit', month: 'short', year: '2-digit',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const exportCSV = () => {
        if (!logs.length) return;

        let csvContent = "เวลาที่ดำเนินการ,สถานะ,ยอดโอนย้ายรวม(ทุกบริษัท),ส่วนต่างยอดเข้าถังกลาง(บริษัทคุณ),ยอดถังกลางรวมล่าสุด\n";
        
        logs.forEach(log => {
            const dateStr = formatDate(log.started_at).replace(/,/g, '');
            const status = log.status.toUpperCase();
            const diff = log.dist_diff > 0 ? `+${log.dist_diff}` : log.dist_diff;
            
            csvContent += `${dateStr},${status},${log.transferred_count},"${diff}",${log.dist_total_after}\n`;
            
            if (log.dist_breakdown.length > 0) {
                csvContent += ",ตะกร้า,ก่อนหน้า,หลังทำ,ส่วนต่าง\n";
                log.dist_breakdown.forEach(item => {
                    const itemDiff = item.diff > 0 ? `+${item.diff}` : item.diff;
                    csvContent += `,${item.basket_name},${item.before},${item.after},"${itemDiff}"\n`;
                });
                csvContent += ",,,,\n"; // empty line separator
            }
        });

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `cron_execution_logs_company_${companyId}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl sticky top-0 z-10">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                            <CalendarClock size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">ประวัติโอนย้ายสิ้นเดือน</h2>
                            <p className="text-sm text-gray-500">
                                (Monthly Basket Transfer)
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={exportCSV}
                            disabled={logs.length === 0 || loading}
                            className="px-3 py-1.5 text-sm bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50"
                            title="ดาวน์โหลดเป็น CSV"
                        >
                            <Download size={16} />
                            Export
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                            <p className="text-gray-500">กำลังโหลดประวัติ...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-dashed border-gray-300">
                            ไม่พบประวัติการรัน Cron
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {logs.map((log) => (
                                <div key={log.id} className="bg-white border rounded-lg shadow-sm overflow-hidden">
                                    {/* Main Row */}
                                    <div 
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                        onClick={() => toggleExpand(log.id)}
                                    >
                                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">เวลาที่ดำเนินการ</div>
                                                <div className="font-medium text-gray-900">{formatDate(log.started_at)}</div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">สถานะ</div>
                                                <div>
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                        log.status === 'success' ? 'bg-green-100 text-green-800' : 
                                                        log.status === 'running' ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'
                                                    }`}>
                                                        {log.status.toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-sm text-gray-500 mb-1">ยอดเข้าถังกลาง (บริษัทคุณ)</div>
                                                <div className="font-bold text-blue-600">
                                                    {log.dist_diff > 0 ? `+${log.dist_diff.toLocaleString()}` : log.dist_diff.toLocaleString()}
                                                    <span className="text-sm font-normal text-gray-400 ml-1">
                                                        (รวม {log.dist_total_after.toLocaleString()})
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-gray-400">
                                            {expandedLogId === log.id ? <ChevronUp /> : <ChevronDown />}
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {expandedLogId === log.id && (
                                        <div className="border-t bg-gray-50 p-4">
                                            <h4 className="font-medium text-gray-700 mb-3 text-sm">รายละเอียดการเปลี่ยนแปลง (ถังกลาง)</h4>
                                            {log.dist_breakdown.length > 0 ? (
                                                <div className="bg-white rounded border overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-gray-100/50">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left font-medium text-gray-600">ตะกร้า</th>
                                                                <th className="px-4 py-2 text-right font-medium text-gray-600">ก่อนหน้า</th>
                                                                <th className="px-4 py-2 text-right font-medium text-gray-600">หลังทำ</th>
                                                                <th className="px-4 py-2 text-right font-medium text-gray-600">ส่วนต่าง</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {log.dist_breakdown.map((item, i) => (
                                                                <tr key={i}>
                                                                    <td className="px-4 py-2 text-gray-800">{item.basket_name}</td>
                                                                    <td className="px-4 py-2 text-right text-gray-500">{item.before.toLocaleString()}</td>
                                                                    <td className="px-4 py-2 text-right text-gray-800 font-medium">{item.after.toLocaleString()}</td>
                                                                    <td className={`px-4 py-2 text-right font-bold ${
                                                                        item.diff > 0 ? 'text-green-600' : 'text-red-500'
                                                                    }`}>
                                                                        {item.diff > 0 ? '+' : ''}{item.diff.toLocaleString()}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500 italic">ไม่มีการเปลี่ยนแปลงข้อมูลถังกลางในรอบนี้</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                    >
                        ปิด
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CronLogModal;
