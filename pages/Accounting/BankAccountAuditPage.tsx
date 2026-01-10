import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { User, Customer, Activity, LineItem, Order } from '../../types';
import { Search, Loader2, ExternalLink, Filter, CheckSquare, Download } from 'lucide-react';
import OrderDetailModal from '../../components/OrderDetailModal';

interface AuditLog {
    id: number;
    reconcile_id?: number | null;
    transfer_at: string;
    statement_amount: number;
    channel: string;
    description: string;
    order_id: string | null;
    order_display?: string | null;
    order_amount: number | null;
    payment_method: string | null;
    status: 'Unmatched' | 'Short' | 'Exact' | 'Over';
    diff: number;
    confirmed_at?: string | null;
    confirmed_action?: string | null;
    note?: string | null;
}

interface BankAccount {
    id: number;
    bank: string;
    bank_number: string;
    account_name: string;
}

interface BankAccountAuditPageProps {
    currentUser: User;
}

const BankAccountAuditPage: React.FC<BankAccountAuditPageProps> = ({ currentUser }) => {
    const [banks, setBanks] = useState<BankAccount[]>([]);
    const [selectedBankId, setSelectedBankId] = useState<string>('');
    // Default to the first day of last month so seeded sample data shows up immediately
    const [startDate, setStartDate] = useState<string>(() => {
        const today = new Date();
        const firstOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        // Adjust for timezone offset to ensure we get the correct local date part
        const offset = today.getTimezoneOffset();
        const adjustedDate = new Date(firstOfCurrentMonth.getTime() - (offset * 60 * 1000));
        return adjustedDate.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    // For viewing order detail
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

    useEffect(() => {
        fetchBanks();
    }, []);

    const fetchBanks = async () => {
        try {
            const res = await apiFetch(`bank_accounts?companyId=${currentUser.companyId || currentUser.company_id}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            // API returns the array directly, not wrapped in a data property
            if (Array.isArray(res)) {
                setBanks(res);
                if (res.length > 0) {
                    setSelectedBankId(String(res[0].id));
                }
            } else if (res && res.data && Array.isArray(res.data)) {
                // Fallback in case API structure changes
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
            const res = await apiFetch('Statement_DB/get_bank_statement_audit.php', {
                method: 'POST',
                body: JSON.stringify({
                    // API expects snake_case; fall back to camelCase if that's what we have in session
                    company_id: currentUser.company_id ?? (currentUser as any).companyId,
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

    const openOrderModal = (orderId: string) => {
        setSelectedOrderId(orderId);
        setIsOrderModalOpen(true);
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
            case 'Suspense': return 'text-orange-600 bg-orange-100 px-2 py-1 rounded-full text-xs font-bold';
            case 'Deposit': return 'text-purple-600 bg-purple-100 px-2 py-1 rounded-full text-xs font-bold';
            default: return 'text-gray-500 bg-gray-100 px-2 py-1 rounded-full text-xs';
        }
    };

    const handleActionChange = async (log: AuditLog, action: string) => {
        if (!action) return;

        const label = action === 'Suspense' ? 'พักรับ (Suspense)' : 'มัดจำรับ (Deposit)';
        // Prompt for note
        const note = window.prompt(`ระบุหมายเหตุสำหรับการ${label}:`);
        if (note === null) return; // Cancelled

        try {
            const res = await apiFetch('Statement_DB/reconcile_save.php', {
                method: 'POST',
                body: JSON.stringify({
                    company_id: currentUser.company_id || (currentUser as any).companyId,
                    user_id: currentUser.id,
                    bank_account_id: parseInt(selectedBankId),
                    start_date: startDate,
                    end_date: endDate,
                    items: [{
                        statement_id: log.id,
                        reconcile_type: action, // Suspense or Deposit
                        confirmed_amount: log.statement_amount,
                        note: note
                    }]
                })
            });

            if (res.ok) {
                fetchAuditLogs();
            } else {
                alert('บันทึกไม่สำเร็จ: ' + (res.error || 'Server error'));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleUnpause = async (log: AuditLog) => {
        if (!log.reconcile_id) return;
        if (!window.confirm('ยืนยันยกเลิกการพักรับ? รายการจะกลับไปสถานะ Unmatched')) {
            return;
        }

        try {
            const res = await apiFetch('Statement_DB/reconcile_cancel.php', {
                method: 'POST',
                body: JSON.stringify({
                    id: log.reconcile_id,
                    company_id: currentUser.company_id || (currentUser as any).companyId
                })
            });

            if (res.ok) {
                fetchAuditLogs();
            } else {
                alert('ยกเลิกไม่สำเร็จ: ' + (res.error || 'Server error'));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleConfirmReconcile = async (log: AuditLog) => {
        if (!log.order_id || !log.reconcile_id || !window.confirm('ยืนยันความถูกต้องของรายการนี้? การยืนยันแล้วจะไม่สามารถแก้ไขได้อีก')) {
            return;
        }

        try {
            const res = await apiFetch('Statement_DB/confirm_reconcile.php', {
                method: 'POST',
                body: JSON.stringify({
                    id: log.reconcile_id,
                    order_id: log.order_id,
                    order_amount: log.order_amount,
                    payment_method: log.payment_method
                })
            });

            if (res.ok) {
                // Refresh records
                fetchAuditLogs();
            } else {
                alert('ยืนยันไม่สำเร็จ: ' + (res.error || 'Server error'));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    const handleToggleSelect = (id: number) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBatchConfirm = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`ยืนยันความถูกต้องของรายการที่เลือก ${selectedIds.length} รายการ?`)) return;

        setLoading(true);
        try {
            // Process in parallel
            await Promise.all(selectedIds.map(async (id) => {
                const log = logs.find(l => l.id === id);
                if (!log || !log.order_id || !log.reconcile_id) return;

                await apiFetch('Statement_DB/confirm_reconcile.php', {
                    method: 'POST',
                    body: JSON.stringify({
                        id: log.reconcile_id,
                        order_id: log.order_id,
                        order_amount: log.order_amount,
                        payment_method: log.payment_method
                    })
                });
            }));

            setSelectedIds([]);
            fetchAuditLogs();
        } catch (error) {
            console.error(error);
            alert("เกิดข้อผิดพลาดในการบันทึก");
        } finally {
            setLoading(false);
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const selectable = logs.filter(l => l.order_id && !l.confirmed_at && l.reconcile_id).map(l => l.id);
            setSelectedIds(selectable);
        } else {
            setSelectedIds([]);
        }
    };

    const handleExportCSV = () => {
        if (logs.length === 0) {
            alert("ไม่พบข้อมูลสำหรับส่งออก");
            return;
        }

        const selectedBank = banks.find(b => String(b.id) === selectedBankId);
        const bankName = selectedBank ? `${selectedBank.bank} ${selectedBank.bank_number} (${selectedBank.account_name})` : '';

        const headers = [
            "ID",
            "Bank Account",
            "Statement Date/Time",
            "Statement Amount",
            "Channel",
            "Description",
            "Order ID",
            "Order Amount",
            "Payment Method",
            "Status",
            "Confirmed At",
            "Note"
        ];

        const csvContent = [
            headers.join(","),
            ...logs.map(log => [
                log.id,
                `"${(bankName || '').replace(/"/g, '""')}"`,
                `"${formatDate(log.transfer_at)}"`,
                log.statement_amount,
                `"${log.channel || ''}"`,
                `"${(log.description || '').replace(/"/g, '""')}"`,
                `"${log.order_id || ''}"`,
                log.order_amount || '',
                `"${log.payment_method || ''}"`,
                `"${log.status === 'Unmatched' ? 'ยังไม่จับคู่' :
                    log.status === 'Exact' ? 'พอดี' :
                        log.status === 'Over' ? 'เกิน' :
                            log.status === 'Short' ? 'ขาด' :
                                log.status === 'Suspense' ? 'พักรับ' :
                                    log.status === 'Deposit' ? 'มัดจำรับ' :
                                        log.status
                }"`,
                `"${log.confirmed_at ? formatDate(log.confirmed_at) : ''}"`,
                `"${(log.note || '').replace(/"/g, '""')}"`
            ].join(","))
        ].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `bank_audit_${startDate}_${endDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <>
            <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">ตรวจสอบบัญชีธนาคาร (Bank Audit)</h1>
                        <p className="text-gray-500">ตรวจสอบรายการเงินเข้าเทียบกับยอดออเดอร์</p>
                    </div>
                </div>

                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="p-4 border-b">
                        <div className="flex flex-wrap gap-4 items-end justify-between">
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

                                <button
                                    onClick={handleExportCSV}
                                    disabled={logs.length === 0 || loading}
                                    className="mb-[1px] px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                                >
                                    <Download className="w-4 h-4 mr-2" />
                                    Export CSV
                                </button>
                            </div>

                            {selectedIds.length > 0 && (
                                <button
                                    onClick={handleBatchConfirm}
                                    disabled={loading}
                                    className="mb-[1px] px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center shadow-sm"
                                >
                                    <CheckSquare className="w-4 h-4 mr-2" />
                                    ยืนยัน ({selectedIds.length}) รายการ
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-100 text-gray-700 font-semibold border-b text-center">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-16">#</th>
                                        <th className="px-4 py-3 w-40">วัน/เวลา (Statement)</th>
                                        <th className="px-4 py-3 text-right">ยอดเงิน (Statement)</th>
                                        <th className="px-4 py-3">Channel</th>
                                        <th className="px-4 py-3 w-64">รายละเอียด</th>
                                        <th className="px-4 py-3 w-56">เลขที่ออเดอร์</th>
                                        <th className="px-4 py-3 text-right">ยอดออเดอร์</th>
                                        <th className="px-4 py-3">วิธีชำระ</th>
                                        <th className="px-4 py-3 text-center">สถานะ</th>
                                        <th className="px-4 py-3 text-center w-20">
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                    onChange={handleSelectAll}
                                                    checked={logs.length > 0 && logs.some(l => l.order_id && !l.confirmed_at) && selectedIds.length === logs.filter(l => l.order_id && !l.confirmed_at).length}
                                                />
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 text-left">
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
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    {log.status === 'Suspense' ? (
                                                        <span className="text-orange-500 italic font-medium">พักรับ (Suspense)</span>
                                                    ) : log.order_id ? (
                                                        <span className="font-medium text-indigo-600 hover:underline cursor-pointer inline-block max-w-[11rem] truncate align-middle" onClick={() => openOrderModal(log.order_id!)}>
                                                            {log.order_display || log.order_id}
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
                                                    <div className="flex flex-col gap-1 items-center" title={log.note || ''}>
                                                        {log.status !== 'Unmatched' && (
                                                            <span className={`${getStatusColor(log.status)} shadow-sm cursor-help`}>
                                                                {log.status === 'Exact' ? 'พอดี' :
                                                                    log.status === 'Over' ? `เกิน (+${log.diff.toLocaleString()})` :
                                                                        log.status === 'Short' ? `ขาด (${log.diff.toLocaleString()})` :
                                                                            log.status === 'Suspense' ? 'พักรับ' :
                                                                                log.status === 'Deposit' ? 'มัดจำรับ' :
                                                                                    'รอจับคู่'}
                                                            </span>
                                                        )}

                                                        {log.status === 'Unmatched' && (
                                                            <div className="relative">
                                                                <select
                                                                    className="text-xs border border-gray-300 rounded-full px-3 py-1 focus:outline-none focus:border-blue-500 bg-white shadow-sm appearance-none pr-8 cursor-pointer hover:bg-gray-50 transition-colors"
                                                                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: `right 0.2rem center`, backgroundSize: `1.2em 1.2em`, backgroundRepeat: 'no-repeat' }}
                                                                    onChange={(e) => {
                                                                        handleActionChange(log, e.target.value);
                                                                        e.target.value = ""; // Reset
                                                                    }}
                                                                    defaultValue=""
                                                                >
                                                                    <option value="" disabled>เลือกสถานะ...</option>
                                                                    <option value="Suspense">พักรับ</option>
                                                                    <option value="Deposit">มัดจำรับ</option>
                                                                </select>
                                                            </div>
                                                        )}
                                                        {(log.status === 'Suspense' || log.status === 'Deposit') && (
                                                            <button
                                                                onClick={() => handleUnpause(log)}
                                                                className="text-xs text-red-600 hover:text-white hover:bg-red-500 bg-white border border-red-200 px-2 py-0.5 rounded-full transition-all shadow-sm font-medium mt-1"
                                                            >
                                                                ยกเลิก
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 text-center">
                                                    {log.confirmed_at ? (
                                                        <div className="flex justify-center" title={`ยืนยันแล้วเมื่อ ${formatDate(log.confirmed_at)}`}>
                                                            <i className="fa-solid fa-square-check" style={{ color: '#63E6BE', fontSize: '16px' }}></i>
                                                        </div>
                                                    ) : (
                                                        log.order_id && (
                                                            <div className="flex justify-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                                                    checked={selectedIds.includes(log.id)}
                                                                    onChange={() => handleToggleSelect(log.id)}
                                                                />
                                                            </div>
                                                        )
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

            </div>

            {
                isOrderModalOpen && selectedOrderId && (
                    <OrderDetailModal
                        isOpen={isOrderModalOpen}
                        onClose={() => {
                            setIsOrderModalOpen(false);
                            setSelectedOrderId(null);
                        }}
                        orderId={selectedOrderId}
                    />
                )
            }
        </>
    );
};

export default BankAccountAuditPage;
