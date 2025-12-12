import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { BankAccount, User } from '../../types';
import { Search, Loader2, ExternalLink, Filter } from 'lucide-react';
import OrderManagementModal from '../../components/OrderManagementModal';

interface AuditLog {
    id: number;
    transfer_at: string;
    statement_amount: number;
    channel: string;
    description: string;
    order_id: string | null;
    order_amount: number | null;
    payment_method: string | null;
    status: 'Unmatched' | 'Short' | 'Exact' | 'Over';
    diff: number;
}

interface BankAccountAuditPageProps {
    currentUser: User;
}

const BankAccountAuditPage: React.FC<BankAccountAuditPageProps> = ({ currentUser }) => {
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    const [startDate, setStartDate] = useState<string>(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    );
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);

    // For viewing order detail
    const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any | null>(null);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

    useEffect(() => {
        fetchBanks();
    }, []);

    const fetchBanks = async () => {
        try {
            const res = await apiFetch('/bank_accounts', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.data) {
                setBanks(res.data);
                if (res.data.length > 0) {
                    setSelectedBankId(String(res.data[0].id));
                }
            }
        } catch (error) {
            console.error("Failed to fetch banks", error);
        }
    };

    const fetchAuditLogs = async () => {
        if (!selectedBankId) return;

        setLoading(true);
        try {
            const res = await apiFetch('/Statement_DB/get_bank_statement_audit.php', {
                method: 'POST',
                body: JSON.stringify({
                    company_id: currentUser.company_id,
                    bank_account_id: parseInt(selectedBankId),
                    start_date: startDate,
                    end_date: endDate
                })
            });

            if (res.ok && res.data) {
                setLogs(res.data);
            } else {
                setLogs([]);
            }
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
            setLogs([]);
        } finally {
            setLoading(false);
        }
    };

    const openOrderModal = async (orderId: string) => {
        try {
            // Fetch full order details
            const res = await apiFetch(`/orders/${orderId}`);
            if (res) {
                setSelectedOrderForEdit(res);
                setIsOrderModalOpen(true);
            }
        } catch (e) {
            console.error("Failed to load order", e);
            alert("Could not load order details.");
        }
    };

    const formatCurrency = (amount: number | null) => {
        if (amount === null) return '-';
        return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(amount);
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('th-TH');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Exact': return 'text-green-600 bg-green-100 px-2 py-1 rounded-full text-xs font-bold';
            case 'Over': return 'text-blue-600 bg-blue-100 px-2 py-1 rounded-full text-xs font-bold';
            case 'Short': return 'text-red-600 bg-red-100 px-2 py-1 rounded-full text-xs font-bold';
            default: return 'text-gray-500 bg-gray-100 px-2 py-1 rounded-full text-xs';
        }
    };

    return (
        <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">ตรวจสอบบัญชีธนาคาร (Bank Audit)</h1>
                    <p className="text-gray-500">ตรวจสอบรายการเงินเข้าเทียบกับยอดออเดอร์</p>
                </div>
            </div>

            <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-4 border-b">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="w-64">
                            <label className="text-sm font-medium text-gray-700 block mb-1">เลือกธนาคาร</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={selectedBankId}
                                onChange={(e) => setSelectedBankId(e.target.value)}
                            >
                                <option value="" disabled>เลือกธนาคาร</option>
                                {banks.map((bank) => (
                                    <option key={bank.id} value={String(bank.id)}>
                                        {bank.bank} - {bank.bank_number} ({bank.account_name})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">ตั้งแต่วันที่</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">ถึงวันที่</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border rounded-md text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        <button
                            onClick={fetchAuditLogs}
                            disabled={!selectedBankId || loading}
                            className="mb-[1px] px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                            ค้นหา
                        </button>
                    </div>
                </div>
                <div className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-700 font-semibold border-b">
                                <tr>
                                    <th className="px-4 py-3 text-center w-16">#</th>
                                    <th className="px-4 py-3">วัน/เวลา (Statement)</th>
                                    <th className="px-4 py-3 text-right">ยอดเงิน (Statement)</th>
                                    <th className="px-4 py-3">Channel</th>
                                    <th className="px-4 py-3 w-64">รายละเอียด</th>
                                    <th className="px-4 py-3 w-40">เลขที่ออเดอร์</th>
                                    <th className="px-4 py-3 text-right">ยอดออเดอร์</th>
                                    <th className="px-4 py-3">วิธีชำระ</th>
                                    <th className="px-4 py-3 text-center">สถานะ</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                                            {loading ? 'กำลังโหลดข้อมูล...' : 'ไม่พบข้อมูล หรือยังไม่ได้ค้นหา'}
                                        </td>
                                    </tr>
                                ) : (
                                    logs.map((log, index) => (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-3 text-center text-gray-500">{index + 1}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">{formatDate(log.transfer_at)}</td>
                                            <td className="px-4 py-3 text-right font-medium">{formatCurrency(log.statement_amount)}</td>
                                            <td className="px-4 py-3 text-gray-600">{log.channel || '-'}</td>
                                            <td className="px-4 py-3 text-gray-600 truncate max-w-xs" title={log.description}>{log.description || '-'}</td>

                                            {/* Order Info */}
                                            <td className="px-4 py-3">
                                                {log.order_id ? (
                                                    <span className="font-medium text-indigo-600 hover:underline cursor-pointer" onClick={() => openOrderModal(log.order_id!)}>
                                                        {log.order_id}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400 italic">Unmatched</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {log.order_amount ? formatCurrency(log.order_amount) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-600">
                                                {log.payment_method || '-'}
                                            </td>

                                            {/* Status */}
                                            <td className="px-4 py-3 text-center">
                                                <span className={getStatusColor(log.status)}>
                                                    {log.status === 'Unmatched' ? 'ยังไม่จับคู่' :
                                                        log.status === 'Exact' ? 'พอดี' :
                                                            log.status === 'Over' ? `เกิน (+${log.diff.toLocaleString()})` :
                                                                `ขาด (${log.diff.toLocaleString()})`
                                                    }
                                                </span>
                                            </td>

                                            <td className="px-4 py-3 text-center">
                                                {log.order_id && (
                                                    <button className="p-1 hover:bg-gray-200 rounded-full" onClick={() => openOrderModal(log.order_id!)}>
                                                        <ExternalLink className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {isOrderModalOpen && selectedOrderForEdit && (
                <OrderManagementModal
                    isOpen={isOrderModalOpen}
                    onClose={() => {
                        setIsOrderModalOpen(false);
                        setSelectedOrderForEdit(null);
                    }}
                    order={selectedOrderForEdit}
                    currentUser={currentUser}
                    onSave={() => {
                        fetchAuditLogs(); // Refresh logs if order changed
                        setIsOrderModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

export default BankAccountAuditPage;
