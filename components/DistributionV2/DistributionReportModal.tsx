import React, { useState, useEffect } from 'react';
import { Loader2, Download, History } from 'lucide-react';
import ExcelJS from 'exceljs';
import { toast } from 'react-hot-toast';

interface DistributionReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface CustomerDetail {
    id: number;
    code: string;
    name: string;
    phone: string;
}

interface AgentDetail {
    agent_id: number;
    agent_name: string;
    customers: CustomerDetail[];
}

interface DistributionSession {
    id: number;
    company_id: number;
    distribution_mode: string;
    total_customers: number;
    created_at: string;
    distributed_by_name: string;
    details: AgentDetail[];
}

const DistributionReportModal: React.FC<DistributionReportModalProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<DistributionSession[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchSessions();
        }
    }, [isOpen]);

    const fetchSessions = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/Distribution/index.php?action=get_sessions&companyId=1');
            const data = await res.json();
            if (data.ok) {
                setSessions(data.sessions);
            } else {
                toast.error(data.error || 'Failed to load sessions');
            }
        } catch (error) {
            console.error(error);
            toast.error('Network error while loading sessions');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (session: DistributionSession) => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Distribution Report');

        // Headers
        worksheet.columns = [
            { header: 'Session ID', key: 'session_id', width: 12 },
            { header: 'วันที่-เวลา', key: 'datetime', width: 20 },
            { header: 'ผู้แจก', key: 'distributed_by', width: 25 },
            { header: 'โหมด', key: 'mode', width: 15 },
            { header: 'ผู้รับ', key: 'agent_name', width: 25 },
            { header: 'รหัสลูกค้า', key: 'customer_code', width: 15 },
            { header: 'เบอร์โทรศัพท์', key: 'phone', width: 15 },
            { header: 'ชื่อลูกค้า', key: 'customer_name', width: 30 }
        ];

        // Format Header Row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
        };

        const datetime = new Date(session.created_at).toLocaleString('th-TH');

        session.details.forEach(agent => {
            agent.customers.forEach(customer => {
                worksheet.addRow({
                    session_id: session.id,
                    datetime: datetime,
                    distributed_by: session.distributed_by_name,
                    mode: session.distribution_mode,
                    agent_name: agent.agent_name,
                    customer_code: customer.code,
                    phone: customer.phone,
                    customer_name: customer.name
                });
            });
        });

        // Generate file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Distribution_Report_${session.id}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] flex flex-col animate-in fade-in duration-200">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <History className="text-blue-500" />
                        <h3 className="text-xl font-bold text-gray-800">ประวัติการแจกงาน (Distribution Report)</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                    {loading ? (
                        <div className="flex flex-col justify-center items-center h-48">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                            <span className="text-sm text-gray-500">กำลังโหลดประวัติ...</span>
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            ไม่มีประวัติการแจกงาน
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {sessions.map(session => (
                                <div key={session.id} className="bg-white border rounded-lg p-5 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b">
                                        <div>
                                            <div className="font-bold text-gray-800 flex items-center gap-2">
                                                <span>Session #{session.id}</span>
                                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                                    {session.distribution_mode}
                                                </span>
                                            </div>
                                            <div className="text-sm text-gray-500 mt-1">
                                                แจกเมื่อ: {new Date(session.created_at).toLocaleString('th-TH')} • โดย: {session.distributed_by_name || 'ระบบ'}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="text-sm text-gray-500">รวมทั้งหมด</div>
                                                <div className="font-bold text-lg text-green-600">{session.total_customers} <span className="text-sm font-normal text-gray-500">รายการ</span></div>
                                            </div>
                                            <button 
                                                onClick={() => handleExport(session)}
                                                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors shadow-sm"
                                            >
                                                <Download className="w-4 h-4" />
                                                Export Excel
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {session.details.map((agent) => (
                                            <div key={agent.agent_id} className="bg-gray-50 rounded border p-3 flex justify-between items-center">
                                                <span className="text-sm font-medium text-gray-700 truncate mr-2" title={agent.agent_name}>
                                                    {agent.agent_name}
                                                </span>
                                                <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                    {agent.customers.length} คน
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DistributionReportModal;
