import React, { useState, useEffect } from 'react';
import { apiFetch } from '../../services/api';
import { BankAccount, User, Customer, Activity, LineItem, Order } from '../../types';
import { Search, Loader2, ExternalLink, Filter, CheckSquare } from 'lucide-react';
import OrderManagementModal from '../../components/OrderManagementModal';

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
        const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return firstOfLastMonth.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [orderCustomers, setOrderCustomers] = useState<Customer[]>([]);
    const [orderActivities, setOrderActivities] = useState<Activity[]>([]);

    // For viewing order detail
    const [selectedOrderForEdit, setSelectedOrderForEdit] = useState<any | null>(null);
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

    const normalizeOrder = (apiOrder: any): Order => {
        const order: any = { ...apiOrder };
        order.id = apiOrder.id;
        order.customerId = apiOrder.customerId ?? apiOrder.customer_id ?? apiOrder.customerID ?? apiOrder.customerid;
        order.companyId = apiOrder.companyId ?? apiOrder.company_id ?? 0;
        order.creatorId = apiOrder.creatorId ?? apiOrder.creator_id ?? apiOrder.user_id ?? 0;
        order.orderDate = apiOrder.orderDate ?? apiOrder.order_date ?? apiOrder.created_at ?? '';
        order.deliveryDate = apiOrder.deliveryDate ?? apiOrder.delivery_date ?? '';
        order.shippingCost = Number(apiOrder.shippingCost ?? apiOrder.shipping_cost ?? 0);
        order.billDiscount = Number(apiOrder.billDiscount ?? apiOrder.bill_discount ?? 0);
        order.totalAmount = Number(apiOrder.totalAmount ?? apiOrder.total_amount ?? 0);
        order.paymentMethod = apiOrder.paymentMethod ?? apiOrder.payment_method ?? '';
        order.paymentStatus = apiOrder.paymentStatus ?? apiOrder.payment_status ?? '';
        order.orderStatus = apiOrder.orderStatus ?? apiOrder.order_status ?? '';
        order.salesChannel = apiOrder.salesChannel ?? apiOrder.sales_channel ?? '';
        order.salesChannelPageId = apiOrder.salesChannelPageId ?? apiOrder.sales_channel_page_id ?? apiOrder.page_id ?? undefined;
        order.bankAccountId = apiOrder.bankAccountId ?? apiOrder.bank_account_id ?? undefined;
        order.transferDate = apiOrder.transferDate ?? apiOrder.transfer_date ?? undefined;
        order.trackingNumbers = apiOrder.trackingNumbers ?? apiOrder.tracking_numbers ?? [];
        order.trackingEntries = apiOrder.trackingEntries ?? apiOrder.tracking_entries ?? [];
        order.trackingDetails = apiOrder.trackingDetails ?? apiOrder.tracking_details ?? [];
        order.notes = apiOrder.notes ?? apiOrder.remarks ?? '';
        order.warehouseId = apiOrder.warehouseId ?? apiOrder.warehouse_id ?? undefined;

        order.shippingAddress =
            apiOrder.shippingAddress ??
            {
                street: apiOrder.street ?? apiOrder.address ?? '',
                subdistrict: apiOrder.subdistrict ?? '',
                district: apiOrder.district ?? '',
                province: apiOrder.province ?? '',
                postalCode: apiOrder.postal_code ?? '',
                recipientFirstName: apiOrder.recipient_first_name ?? apiOrder.recipientFirstName ?? '',
                recipientLastName: apiOrder.recipient_last_name ?? apiOrder.recipientLastName ?? '',
            };

        const items: any[] = apiOrder.items ?? apiOrder.order_items ?? [];
        order.items = items.map((i, idx): LineItem => ({
            id: Number(i.id ?? idx + 1),
            productName: i.productName ?? i.product_name ?? '',
            quantity: Number(i.quantity ?? 0),
            pricePerUnit: Number(i.pricePerUnit ?? i.price_per_unit ?? 0),
            discount: Number(i.discount ?? 0),
            isFreebie: Boolean(i.isFreebie ?? i.is_freebie ?? false),
            boxNumber: Number(i.boxNumber ?? i.box_number ?? 1),
            productId: i.productId ?? i.product_id,
            promotionId: i.promotionId ?? i.promotion_id,
            parentItemId: i.parentItemId ?? i.parent_item_id,
            isPromotionParent: Boolean(i.isPromotionParent ?? i.is_promotion_parent ?? false),
            creatorId: i.creatorId ?? i.creator_id,
        }));

        order.slips = apiOrder.slips ?? apiOrder.order_slips ?? [];
        order.boxes = apiOrder.boxes ?? apiOrder.order_boxes ?? [];

        return order;
    };

    const openOrderModal = async (orderId: string) => {
        try {
            // Fetch full order details
            const res = await apiFetch(`/orders/${orderId}`);
            if (res) {
                const normalized = normalizeOrder(res);
                const derivedCustomer: Customer = {
                    id: String(normalized.customerId ?? ''),
                    customerId: String(normalized.customerId ?? ''),
                    customerRefId: undefined,
                    pk: typeof res.customer_id === 'number' ? res.customer_id : undefined,
                    firstName: res.recipient_first_name ?? res.first_name ?? '',
                    lastName: res.recipient_last_name ?? res.last_name ?? '',
                    phone: res.phone ?? res.recipient_phone ?? res.customer_phone ?? '',
                    backupPhone: res.backup_phone ?? '',
                    email: res.email ?? '',
                    address: normalized.shippingAddress,
                    province: normalized.shippingAddress?.province ?? '',
                    companyId: normalized.companyId ?? 0,
                    assignedTo: null,
                    dateAssigned: '',
                    ownershipExpires: '',
                    lifecycleStatus: 'new' as any,
                    behavioralStatus: 'unknown' as any,
                };
                setOrderCustomers(derivedCustomer.id ? [derivedCustomer] : []);
                setOrderActivities([]);
                setSelectedOrderForEdit(normalized);
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
                                                {log.order_id ? (
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
                                                <span className={getStatusColor(log.status)}>
                                                    {log.status === 'Unmatched' ? 'ยังไม่จับคู่' :
                                                        log.status === 'Exact' ? 'พอดี' :
                                                            log.status === 'Over' ? `เกิน (+${log.diff.toLocaleString()})` :
                                                                `ขาด (${log.diff.toLocaleString()})`
                                                    }
                                                </span>
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

            {isOrderModalOpen && selectedOrderForEdit && (
                <OrderManagementModal
                    isOpen={isOrderModalOpen}
                    onClose={() => {
                        setIsOrderModalOpen(false);
                        setSelectedOrderForEdit(null);
                    }}
                    order={selectedOrderForEdit}
                    customers={orderCustomers}
                    activities={orderActivities}
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
