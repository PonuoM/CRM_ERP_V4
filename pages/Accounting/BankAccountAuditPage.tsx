
import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { User, Customer, Activity, LineItem, Order } from '../../types';
import { Search, Loader2, ExternalLink, Filter, CheckSquare, Download } from 'lucide-react';
import OrderDetailModal from '../../components/OrderDetailModal';
import type { StatementContext } from '../../components/OrderDetailModal';
import SlipOrderSearchModal from '../../components/SlipOrderSearchModal';

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
    status: 'Unmatched' | 'Short' | 'Exact' | 'Over' | 'Suspense' | 'Deposit';
    diff: number;
    confirmed_at?: string | null;
    confirmed_action?: string | null;
    note?: string | null;
    // COD document info
    cod_document_id?: number | null;
    cod_document_number?: string | null;
    cod_total_amount?: number | null;
    cod_status?: string | null;
    is_cod_document?: boolean;
    reconcile_items?: any[];
    matched_orders?: { reconcile_id: number; order_id: string; confirmed_amount: number; confirmed_at?: string | null; payment_method?: string | null }[];
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
    const [recalculating, setRecalculating] = useState(false);
    // For viewing order detail
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [currentStatementContext, setCurrentStatementContext] = useState<StatementContext | null>(null);

    // New state for search modal
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [selectedLogForSearch, setSelectedLogForSearch] = useState<AuditLog | null>(null);
    const [addModeForLog, setAddModeForLog] = useState<AuditLog | null>(null); // For adding extra orders

    // State for COD document detail modal
    const [isCodDetailModalOpen, setIsCodDetailModalOpen] = useState(false);
    const [selectedCodLog, setSelectedCodLog] = useState<AuditLog | null>(null);

    // Function to open COD document detail modal
    const openCodDetailModal = (log: AuditLog) => {
        setSelectedCodLog(log);
        setIsCodDetailModalOpen(true);
    };

    useEffect(() => {
        fetchBanks();
    }, []);

    const fetchBanks = async () => {
        try {
            const res = await apiFetch(`bank_accounts?companyId=${currentUser.companyId || (currentUser as any).company_id}`, {
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

    const fetchAuditLogs = async (silent = false) => {
        if (!selectedBankId) return;

        if (!silent) setLoading(true);
        if (silent) setRecalculating(true);
        try {
            const res = await apiFetch('Statement_DB/get_bank_statement_audit.php', {
                method: 'POST',
                body: JSON.stringify({
                    // API expects snake_case; fall back to camelCase if that's what we have in session
                    company_id: currentUser.companyId || (currentUser as any).company_id,
                    bank_account_id: parseInt(selectedBankId),
                    start_date: startDate,
                    end_date: endDate,
                    matchStatement: true // Request auto-matching suggestions
                })
            });

            if (res.ok && res.data) {
                if (silent) {
                    // Debug: log how many suggestions were found
                    const withSuggestions = res.data.filter((d: any) => d.suggested_order_id);
                    console.log(`[Silent Refresh] ${res.data.length} rows, ${withSuggestions.length} with suggestions`);
                }
                setLogs(res.data);
            } else if (!silent) {
                setLogs([]);
            } else {
                console.warn('[Silent Refresh] Failed:', res.error || 'Unknown error');
            }
        } catch (error) {
            console.error("Failed to fetch audit logs", error);
            if (!silent) setLogs([]);
        } finally {
            if (!silent) setLoading(false);
            if (silent) setRecalculating(false);
        }
    };

    const openOrderModal = (orderId: string, log?: AuditLog) => {
        setSelectedOrderId(orderId);
        if (log) {
            setCurrentStatementContext({
                statementAmount: log.statement_amount,
                transferAt: log.transfer_at,
                channel: log.channel || undefined,
            });
        } else {
            setCurrentStatementContext(null);
        }
        setIsOrderModalOpen(true);
    };

    // Function to open search modal
    const openSearchModal = (log: AuditLog) => {
        setSelectedLogForSearch(log);
        setIsSearchModalOpen(true);
    };

    // Callback when order is selected from modal
    const handleOrderSelected = (orderId: string, orderAmount: number) => {
        if (selectedLogForSearch) {
            if (addModeForLog) {
                // Adding extra order to already-matched statement
                handleAddOrder(addModeForLog, orderId, orderAmount);
            } else {
                // First-time match
                handleConfirmMatch(selectedLogForSearch, orderId, orderAmount);
            }
            setIsSearchModalOpen(false);
            setSelectedLogForSearch(null);
            setAddModeForLog(null);
        }
    };

    // Open search modal in "add more" mode
    const openAddOrderModal = (log: AuditLog) => {
        setSelectedLogForSearch(log);
        setAddModeForLog(log);
        setIsSearchModalOpen(true);
    };

    // Add additional order to an already-matched statement
    const handleAddOrder = async (log: AuditLog, orderId: string, orderAmount: number) => {
        try {
            const res = await apiFetch('Statement_DB/reconcile_add.php', {
                method: 'POST',
                body: JSON.stringify({
                    company_id: currentUser.companyId || (currentUser as any).company_id,
                    user_id: currentUser.id,
                    bank_account_id: parseInt(selectedBankId),
                    statement_id: log.id,
                    order_id: orderId,
                    confirmed_amount: orderAmount,
                    start_date: startDate,
                    end_date: endDate,
                })
            });

            if (res.ok) {
                // Optimistic update: add order to matched_orders
                setLogs(prev => prev.map(l => {
                    if (l.id !== log.id) return l;
                    const newMatch = { reconcile_id: res.reconcile_log_id, order_id: orderId, confirmed_amount: orderAmount, confirmed_at: null, payment_method: null };
                    const updatedMatched = [...(l.matched_orders || []), newMatch];
                    const totalConfirmed = updatedMatched.reduce((sum, m) => sum + m.confirmed_amount, 0);
                    const diff = l.statement_amount - totalConfirmed;
                    return {
                        ...l,
                        matched_orders: updatedMatched,
                        order_id: updatedMatched.map(m => m.order_id).join(','),
                        order_display: updatedMatched.map(m => m.order_id).join(', '),
                        order_amount: totalConfirmed,
                        reconcile_id: updatedMatched[0]?.reconcile_id || l.reconcile_id,
                        status: (Math.abs(diff) < 0.01 ? 'Exact' : diff > 0 ? 'Over' : 'Short') as any,
                        diff,
                    };
                }));
            } else {
                alert('เพิ่มออเดอร์ไม่สำเร็จ: ' + (res.error || 'Server error'));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
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
            case 'Suspense': return 'text-orange-600 bg-orange-100 px-2 py-1 rounded-full text-xs font-bold';
            case 'Deposit': return 'text-purple-600 bg-purple-100 px-2 py-1 rounded-full text-xs font-bold';
            default: return 'text-gray-500 bg-gray-100 px-2 py-1 rounded-full text-xs';
        }
    };

    const handleActionChange = async (log: AuditLog, action: string) => {
        if (!action) return;

        const label = action === 'Suspense' ? 'พักรับ (Suspense)' : 'มัดจำรับ (Deposit)';

        // If it's a "Confirm Match" action (custom value likely just the orderId, but here action is select value)
        // Wait, action here comes from the dropdown. For suggestions we might use a button.

        // Prompt for note
        const note = window.prompt(`ระบุหมายเหตุสำหรับการ${label}:`);
        if (note === null) return; // Cancelled

        try {
            const res = await apiFetch('Statement_DB/reconcile_save.php', {
                method: 'POST',
                body: JSON.stringify({
                    company_id: currentUser.companyId || (currentUser as any).company_id,
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
                // Optimistic update: update the specific log locally
                setLogs(prev => prev.map(l => l.id === log.id ? {
                    ...l,
                    status: action as any,
                    reconcile_id: res.reconcile_log_ids?.[log.id] || l.reconcile_id || -1,
                    order_id: null,
                    order_amount: null,
                    note: note || l.note,
                } : l));
            } else {
                alert('บันทึกไม่สำเร็จ: ' + (res.error || 'Server error'));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleConfirmMatch = async (log: AuditLog, suggestedOrderId: string, knownOrderAmount?: number) => {
        if (!window.confirm(`ยืนยันการจับคู่กับออเดอร์ ${suggestedOrderId}?`)) {
            return;
        }

        // Use known order amount if provided, otherwise fall back to suggestion/statement
        const orderAmt = knownOrderAmount || (log as any).suggested_order_amount || log.order_amount || log.statement_amount;

        try {
            const res = await apiFetch('Statement_DB/reconcile_save.php', {
                method: 'POST',
                body: JSON.stringify({
                    company_id: currentUser.companyId || (currentUser as any).company_id,
                    user_id: currentUser.id,
                    bank_account_id: parseInt(selectedBankId),
                    start_date: startDate,
                    end_date: endDate,
                    items: [{
                        statement_id: log.id,
                        order_id: suggestedOrderId,
                        confirmed_amount: orderAmt
                    }]
                })
            });

            if (res.ok) {
                // Optimistic update: mark as matched with order
                const diff = log.statement_amount - orderAmt;
                const newStatus = (Math.abs(diff) < 0.01 ? 'Exact' : diff > 0 ? 'Over' : 'Short');
                const reconcileId = res.reconcile_log_ids?.[log.id] || log.reconcile_id || -1;
                setLogs(prev => prev.map(l => l.id === log.id ? {
                    ...l,
                    order_id: suggestedOrderId,
                    order_display: suggestedOrderId,
                    order_amount: orderAmt,
                    payment_method: (l as any).suggested_payment_method || l.payment_method,
                    status: newStatus as any,
                    diff: diff,
                    reconcile_id: reconcileId,
                    // Set matched_orders so handleAddOrder can read it later
                    matched_orders: [{ reconcile_id: reconcileId, order_id: suggestedOrderId, confirmed_amount: orderAmt, confirmed_at: null, payment_method: (l as any).suggested_payment_method || l.payment_method || null }],
                    // Clear suggestion fields
                    suggested_order_id: undefined,
                    suggested_order_amount: undefined,
                    suggested_order_info: undefined,
                    suggested_payment_method: undefined,
                } : l));
            } else {
                alert('บันทึกไม่สำเร็จ: ' + (res.error || 'Server error'));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    const handleUnpause = async (log: AuditLog, reconcileId?: number) => {
        const targetReconcileId = reconcileId || log.reconcile_id;
        if (!targetReconcileId) return;
        // Prevent unmatch if linked to COD document
        if (log.is_cod_document || log.cod_document_id) {
            alert('ไม่สามารถยกเลิกการจับคู่ได้ เนื่องจากผูกกับเอกสาร COD');
            return;
        }
        const isSuspenseOrDeposit = log.status === 'Suspense' || log.status === 'Deposit';
        const confirmMsg = isSuspenseOrDeposit
            ? 'ยืนยันยกเลิกการพักรับ? รายการจะกลับไปสถานะ Unmatched'
            : 'ยืนยันยกเลิกการจับคู่ออเดอร์นี้?';
        if (!window.confirm(confirmMsg)) {
            return;
        }

        try {
            const res = await apiFetch('Statement_DB/reconcile_cancel.php', {
                method: 'POST',
                body: JSON.stringify({
                    id: targetReconcileId,
                    company_id: currentUser.companyId || (currentUser as any).company_id
                })
            });

            if (res.ok) {
                // Optimistic update: remove specific order from matched_orders
                setLogs(prev => prev.map(l => {
                    if (l.id !== log.id) return l;
                    const remaining = (l.matched_orders || []).filter(m => m.reconcile_id !== targetReconcileId);
                    if (remaining.length === 0) {
                        // Last order removed → reset to Unmatched
                        return {
                            ...l,
                            order_id: null,
                            order_display: null,
                            order_amount: null,
                            payment_method: null,
                            status: 'Unmatched' as any,
                            diff: 0,
                            reconcile_id: null,
                            confirmed_at: null,
                            confirmed_action: null,
                            note: null,
                            matched_orders: [],
                        };
                    } else {
                        // Still has other orders
                        const totalConfirmed = remaining.reduce((sum, m) => sum + m.confirmed_amount, 0);
                        const diff = l.statement_amount - totalConfirmed;
                        return {
                            ...l,
                            matched_orders: remaining,
                            order_id: remaining.map(m => m.order_id).join(','),
                            order_display: remaining.map(m => m.order_id).join(', '),
                            order_amount: totalConfirmed,
                            reconcile_id: remaining[0]?.reconcile_id || null,
                            status: (Math.abs(diff) < 0.01 ? 'Exact' : diff > 0 ? 'Over' : 'Short') as any,
                            diff,
                        };
                    }
                }));
                // Background refresh to get new auto-match suggestions
                fetchAuditLogs(true);
            } else {
                alert('ยกเลิกไม่สำเร็จ: ' + (res.error || 'Server error'));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    // Unmatch COD document from statement
    const handleCodUnmatch = async (log: AuditLog) => {
        if (!log.cod_document_id) return;
        if (!window.confirm('ยืนยันยกเลิกการผูกเอกสาร COD กับ statement นี้?')) return;

        try {
            const res = await apiFetch('Statement_DB/cod_unmatch.php', {
                method: 'POST',
                body: JSON.stringify({
                    statement_log_id: log.id,
                    cod_document_id: log.cod_document_id,
                    company_id: currentUser.companyId || (currentUser as any).company_id,
                })
            });

            if (res.ok) {
                // Optimistic update: reset to Unmatched
                setLogs(prev => prev.map(l => l.id === log.id ? {
                    ...l,
                    order_id: null,
                    order_display: null,
                    order_amount: null,
                    payment_method: null,
                    status: 'Unmatched' as any,
                    diff: 0,
                    reconcile_id: null,
                    confirmed_at: null,
                    confirmed_action: null,
                    note: null,
                    cod_document_id: null,
                    cod_document_number: null,
                    cod_total_amount: null,
                    cod_status: null,
                    is_cod_document: false,
                    matched_orders: [],
                    reconcile_items: [],
                } : l));
                fetchAuditLogs(true);
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
            // Confirm all matched orders for this statement (not just the first one)
            const reconcileIds = log.matched_orders && log.matched_orders.length > 0
                ? log.matched_orders.map(m => m.reconcile_id)
                : [log.reconcile_id];

            await Promise.all(reconcileIds.map(rid =>
                apiFetch('Statement_DB/confirm_reconcile.php', {
                    method: 'POST',
                    body: JSON.stringify({
                        id: rid,
                        order_amount: log.order_amount,
                        payment_method: log.payment_method
                    })
                }).then(res => {
                    if (!res.ok) throw new Error(res.error || 'Server error');
                })
            ));

            // Optimistic update: mark as confirmed
            setLogs(prev => prev.map(l => l.id === log.id ? {
                ...l,
                confirmed_at: new Date().toISOString(),
                confirmed_action: 'Confirmed',
            } : l));
            // Remove from selection
            setSelectedIds(prev => prev.filter(id => id !== log.id));
        } catch (e: any) {
            alert('ยืนยันไม่สำเร็จ: ' + (e?.message || 'Server error'));
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
            // Separate COD documents from regular orders
            const codDocumentIds = new Set<number>();
            const regularLogs: AuditLog[] = [];

            selectedIds.forEach(id => {
                const log = logs.find(l => l.id === id);
                if (!log) return;

                if (log.is_cod_document && log.cod_document_id) {
                    // COD document - collect unique document IDs
                    codDocumentIds.add(log.cod_document_id);
                } else if (log.order_id && log.reconcile_id) {
                    // Regular order
                    regularLogs.push(log);
                }
            });

            // Process COD documents with dedicated API
            const codPromises = Array.from(codDocumentIds).map(async (codDocId) => {
                const res = await apiFetch('Statement_DB/confirm_cod_document.php', {
                    method: 'POST',
                    body: JSON.stringify({
                        cod_document_id: codDocId,
                        company_id: currentUser.companyId || (currentUser as any).company_id,
                        user_id: currentUser.id
                    })
                });
                if (!res.ok) {
                    throw new Error(res.error || `Failed to confirm COD document ${codDocId}`);
                }
                return res;
            });

            // Process regular orders — confirm each reconcile log individually
            const regularPromises = regularLogs.flatMap((log) => {
                const reconcileIds = log.matched_orders && log.matched_orders.length > 0
                    ? log.matched_orders.map(m => m.reconcile_id)
                    : [log.reconcile_id];

                return reconcileIds.map(rid =>
                    apiFetch('Statement_DB/confirm_reconcile.php', {
                        method: 'POST',
                        body: JSON.stringify({
                            id: rid,
                            order_amount: log.order_amount,
                            payment_method: log.payment_method
                        })
                    }).then(res => {
                        if (!res.ok) throw new Error(res.error || `Failed to confirm reconcile ${rid}`);
                        return res;
                    })
                );
            });

            // Wait for all confirmations
            await Promise.all([...codPromises, ...regularPromises]);

            // Optimistic update: mark all selected as confirmed
            const confirmedAt = new Date().toISOString();
            setLogs(prev => prev.map(l => selectedIds.includes(l.id) ? {
                ...l,
                confirmed_at: confirmedAt,
                confirmed_action: 'Confirmed',
            } : l));
            setSelectedIds([]);
        } catch (error: any) {
            console.error(error);
            alert("เกิดข้อผิดพลาดในการบันทึก: " + (error?.message || "Unknown error"));
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
                                    onClick={() => fetchAuditLogs()}
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
                                                    ) : log.is_cod_document && log.cod_document_number ? (
                                                        // COD Document - show document number and open detail modal
                                                        <div className="flex items-center gap-1">
                                                            <span
                                                                className="font-medium text-emerald-600 hover:underline cursor-pointer inline-flex items-center gap-1 max-w-[11rem] truncate align-middle"
                                                                onClick={() => openCodDetailModal(log)}
                                                                title={`COD Document: ${log.cod_document_number} (${log.reconcile_items?.length || 0} orders)`}
                                                            >
                                                                <i className="fa-solid fa-box-open text-xs"></i>
                                                                {log.cod_document_number}
                                                            </span>
                                                            {!(log.confirmed_action || '').includes('Confirmed') && (
                                                                <button
                                                                    onClick={() => handleCodUnmatch(log)}
                                                                    className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-1 py-0.5 rounded transition-colors"
                                                                    title="ยกเลิกการผูก COD"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : log.order_id ? (
                                                        <div className="flex flex-col items-start gap-1">
                                                            {/* Multi-order display */}
                                                            {(log.matched_orders && log.matched_orders.length > 1) ? (
                                                                // Multiple orders matched
                                                                log.matched_orders.map((mo, moIdx) => (
                                                                    <div key={mo.reconcile_id || moIdx} className="flex items-center gap-1">
                                                                        <span className="font-medium text-indigo-600 hover:underline cursor-pointer text-sm" onClick={() => openOrderModal(mo.order_id, log)}>
                                                                            {mo.order_id}
                                                                        </span>
                                                                        <span className="text-xs text-gray-400">(฿{mo.confirmed_amount?.toLocaleString()})</span>
                                                                        {!mo.confirmed_at && !log.is_cod_document && !log.cod_document_id && (
                                                                            <button
                                                                                onClick={() => handleUnpause(log, mo.reconcile_id)}
                                                                                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-1 py-0.5 rounded transition-colors"
                                                                                title="ยกเลิกการจับคู่ออเดอร์นี้"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                // Single order matched (original display)
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-medium text-indigo-600 hover:underline cursor-pointer inline-block max-w-[11rem] truncate align-middle" onClick={() => openOrderModal(log.order_id!, log)}>
                                                                        {log.order_display || log.order_id}
                                                                    </span>
                                                                    {!log.confirmed_at && log.reconcile_id && !log.is_cod_document && !log.cod_document_id && (
                                                                        <button
                                                                            onClick={() => handleUnpause(log)}
                                                                            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-1 py-0.5 rounded transition-colors"
                                                                            title="ยกเลิกการจับคู่"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {/* Add more orders button */}
                                                            {!log.confirmed_at && !log.is_cod_document && !log.cod_document_id && (
                                                                <button
                                                                    onClick={() => openAddOrderModal(log)}
                                                                    className="text-xs flex items-center gap-1 text-emerald-600 hover:text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors mt-0.5"
                                                                    title="ผูกออเดอร์เพิ่ม"
                                                                >
                                                                    <span className="text-sm leading-none">+</span>
                                                                    ผูกเพิ่ม
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-start gap-1">
                                                            {(log as any).suggested_order_id ? (
                                                                <>
                                                                    <span className="text-gray-400 italic">Unmatched</span>
                                                                    <span
                                                                        className="text-xs text-green-600 font-medium cursor-pointer hover:underline mt-0.5"
                                                                        onClick={() => openOrderModal((log as any).suggested_order_id, log)}
                                                                        title={(log as any).suggested_order_info}
                                                                    >
                                                                        แนะนำ: {(log as any).suggested_order_id}
                                                                    </span>
                                                                </>
                                                            ) : recalculating ? (
                                                                <span className="text-blue-500 italic flex items-center gap-1">
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                    กำลังค้นหา...
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 italic">Unmatched</span>
                                                            )}

                                                            {/* Search Button for Unmatched or Unconfirmed items */}
                                                            {!log.confirmed_at && (
                                                                <button
                                                                    onClick={() => openSearchModal(log)}
                                                                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 hover:bg-blue-100 transition-colors"
                                                                    title="ค้นหาและจับคู่คำสั่งซื้อ"
                                                                >
                                                                    <Search className="w-3 h-3" />
                                                                    ค้นหา
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {log.order_amount
                                                        ? formatCurrency(log.order_amount)
                                                        : (log as any).suggested_order_amount
                                                            ? <span className="text-gray-400 italic" title="ยอดที่แนะนำ">{formatCurrency((log as any).suggested_order_amount)}</span>
                                                            : '-'
                                                    }
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {log.payment_method
                                                        ? log.payment_method
                                                        : (log as any).suggested_payment_method
                                                            ? <span className="text-gray-400 italic" title="วิธีชำระที่แนะนำ">{(log as any).suggested_payment_method}</span>
                                                            : '-'
                                                    }
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
                                                            <div className="flex flex-col gap-1 items-center">
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
                                                            </div>
                                                        )}
                                                        {(log.status === 'Suspense' || log.status === 'Deposit') && !log.is_cod_document && !log.cod_document_id && (
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
                                                        log.order_id ? (
                                                            <div className="flex justify-center">
                                                                <input
                                                                    type="checkbox"
                                                                    className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer"
                                                                    checked={selectedIds.includes(log.id)}
                                                                    onChange={() => handleToggleSelect(log.id)}
                                                                />
                                                            </div>
                                                        ) : (log as any).suggested_order_id ? (
                                                            <button
                                                                onClick={() => handleConfirmMatch(log, (log as any).suggested_order_id, (log as any).suggested_order_amount)}
                                                                className="text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-1 rounded-md hover:bg-green-100 transition-colors shadow-sm whitespace-nowrap"
                                                            >
                                                                ยืนยันจับคู่
                                                            </button>
                                                        ) : null
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
                            setCurrentStatementContext(null);
                        }}
                        orderId={selectedOrderId}
                        statementContext={currentStatementContext}
                        companyId={currentUser.companyId || (currentUser as any).company_id}
                        onSlipUpdated={() => fetchAuditLogs(true)}
                    />
                )
            }

            {/* Order Search Modal */}
            {isSearchModalOpen && selectedLogForSearch && (
                <SlipOrderSearchModal
                    isOpen={isSearchModalOpen}
                    onClose={() => {
                        setIsSearchModalOpen(false);
                        setSelectedLogForSearch(null);
                    }}
                    onSelectOrder={handleOrderSelected}
                    initialParams={{
                        date: selectedLogForSearch.transfer_at,
                        amount: selectedLogForSearch.statement_amount,
                        companyId: currentUser.companyId || (currentUser as any).company_id,
                        channel: selectedLogForSearch.channel
                    }}
                />
            )}

            {/* COD Document Detail Modal */}
            {isCodDetailModalOpen && selectedCodLog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={() => setIsCodDetailModalOpen(false)}>
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="px-6 py-4 bg-emerald-600 text-white flex justify-between items-center">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <i className="fa-solid fa-box-open"></i>
                                รายละเอียด COD Document
                            </h3>
                            <button
                                onClick={() => setIsCodDetailModalOpen(false)}
                                className="text-white hover:text-gray-200 text-xl font-bold"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[60vh]">
                            <div className="mb-4 space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">เลขที่เอกสาร:</span>
                                    <span className="font-semibold text-emerald-700">{selectedCodLog.cod_document_number}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">ยอด Statement:</span>
                                    <span className="font-semibold">{formatCurrency(selectedCodLog.statement_amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">ยอด COD Document:</span>
                                    <span className="font-semibold text-blue-600">{formatCurrency(selectedCodLog.cod_total_amount || selectedCodLog.order_amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">วิธีชำระเงิน:</span>
                                    <span className="font-semibold">{selectedCodLog.payment_method || 'COD'}</span>
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="font-semibold text-gray-700 mb-3">รายการทั้งหมดในเอกสาร COD:</h4>
                                {(selectedCodLog as any).cod_records && (selectedCodLog as any).cod_records.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-100 text-gray-600">
                                                <tr>
                                                    <th className="px-3 py-2 text-left">#</th>
                                                    <th className="px-3 py-2 text-left">Tracking</th>
                                                    <th className="px-3 py-2 text-left">Order</th>
                                                    <th className="px-3 py-2 text-right">ยอด COD</th>
                                                    <th className="px-3 py-2 text-center">สถานะ</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {(selectedCodLog as any).cod_records.map((rec: any, idx: number) => (
                                                    <tr key={rec.id || idx} className="hover:bg-gray-50">
                                                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                                                        <td className="px-3 py-2 font-mono text-xs">{rec.tracking_number || '-'}</td>
                                                        <td className="px-3 py-2">
                                                            {rec.order_id ? (
                                                                <span
                                                                    className="text-indigo-600 font-medium cursor-pointer hover:underline"
                                                                    onClick={() => {
                                                                        setIsCodDetailModalOpen(false);
                                                                        openOrderModal(rec.order_id);
                                                                    }}
                                                                >
                                                                    {rec.order_id}
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-400 italic">ไม่มี Order</span>
                                                            )}
                                                        </td>
                                                        <td className="px-3 py-2 text-right">{formatCurrency(parseFloat(rec.cod_amount || '0'))}</td>
                                                        <td className="px-3 py-2 text-center">
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${rec.status === 'matched' ? 'bg-green-100 text-green-700' :
                                                                rec.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                {rec.status === 'matched' ? 'จับคู่แล้ว' : rec.status === 'pending' ? 'รอจับคู่' : rec.status || '-'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : selectedCodLog.reconcile_items && selectedCodLog.reconcile_items.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedCodLog.reconcile_items.map((item: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="flex justify-between items-center bg-gray-50 px-4 py-2 rounded border hover:bg-gray-100 transition-colors"
                                            >
                                                <span
                                                    className="text-indigo-600 font-medium cursor-pointer hover:underline"
                                                    onClick={() => {
                                                        setIsCodDetailModalOpen(false);
                                                        if (item.order_id) {
                                                            openOrderModal(item.order_id);
                                                        }
                                                    }}
                                                >
                                                    {item.order_id}
                                                </span>
                                                <span className="text-gray-700">{formatCurrency(item.confirmed_amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-400 italic">ไม่พบรายการ</p>
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
                            <button
                                onClick={() => setIsCodDetailModalOpen(false)}
                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BankAccountAuditPage;
