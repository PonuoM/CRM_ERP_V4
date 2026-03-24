import React, { useState, useEffect } from 'react';
import { getOrder, apiFetch } from '../services/api';
import resolveApiBasePath from '../utils/apiBasePath';
import { X, User, MapPin, Box, Image as ImageIcon, Pencil, Save, Loader2, ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';

export interface StatementContext {
    statementAmount: number;
    transferAt: string;
    channel?: string;
}

interface OrderDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string | null;
    statementContext?: StatementContext | null;
    onSlipUpdated?: () => void;
    companyId?: number | null;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ isOpen, onClose, orderId, statementContext, onSlipUpdated, companyId }) => {
    const [order, setOrder] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    // Slip editing state (only used when statementContext is provided)
    const [editingSlipId, setEditingSlipId] = useState<number | null>(null);
    const [slipEdits, setSlipEdits] = useState<{ amount: string; transfer_date: string }>({ amount: '', transfer_date: '' });
    const [savingSlip, setSavingSlip] = useState(false);
    const [expandedPromotions, setExpandedPromotions] = useState<Set<number | string>>(new Set());

    const statusThai: Record<string, string> = {
        'Pending': 'รอดำเนินการ', 'Confirmed': 'ยืนยันแล้ว', 'Preparing': 'กำลังจัดเตรียม',
        'Picking': 'กำลังหยิบสินค้า', 'Shipping': 'กำลังจัดส่ง', 'Delivered': 'จัดส่งแล้ว',
        'Cancelled': 'ยกเลิก', 'Returned': 'ตีกลับ', 'BadDebt': 'หนี้สูญ',
        'PreApproved': 'รอตรวจสอบ', 'AwaitingVerification': 'รอยืนยัน',
    };
    const paymentStatusThai: Record<string, string> = {
        'Pending': 'รอชำระ', 'Paid': 'ชำระแล้ว', 'PartiallyPaid': 'ชำระบางส่วน',
        'Unpaid': 'ยังไม่ชำระ', 'Refunded': 'คืนเงินแล้ว', 'CODCollected': 'COD เก็บแล้ว',
    };
    const paymentMethodThai: Record<string, string> = {
        'COD': 'เก็บเงินปลายทาง', 'Transfer': 'โอนเงิน', 'CreditCard': 'บัตรเครดิต',
        'PayAfter': 'ชำระทีหลัง', 'QR': 'QR Code',
    };

    useEffect(() => {
        if (isOpen && orderId) {
            fetchOrder();
        } else {
            setOrder(null);
        }
    }, [isOpen, orderId]);

    const fetchOrder = async () => {
        setLoading(true);
        try {
            const data = await getOrder(orderId!);
            // Normalize: PHP may return items/slips as object with non-sequential keys for sub-orders
            if (data && data.items && !Array.isArray(data.items)) {
                data.items = Object.values(data.items);
            }
            if (data && data.slips && !Array.isArray(data.slips)) {
                data.slips = Object.values(data.slips);
            }
            setOrder(data);
        } catch (err) {
            console.error("Failed to load order", err);
        } finally {
            setLoading(false);
        }
    };

    // Dynamically compute match details after order loads
    // Key: compare against the BEST MATCHING SLIP, not order.total_amount
    // Because one order can have many slips (e.g., 22 partial payments)
    const computeMatchInfo = () => {
        if (!statementContext || !order) return null;

        const formatTHB = (v: number) => new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(v);
        const stmtAmount = statementContext.statementAmount;
        const stmtTime = new Date(statementContext.transferAt).getTime();

        // --- Find the best matching slip ---
        let bestSlip: any = null;
        let bestAmountDiff = Infinity;
        let bestTimeDiff = Infinity;

        if (order.slips?.length > 0) {
            for (const slip of order.slips) {
                const slipAmount = parseFloat(slip.amount) || 0;
                const aDiff = Math.abs(slipAmount - stmtAmount);

                // Calculate time diff for this slip
                let tDiff = Infinity;
                if (slip.transfer_date) {
                    const slipTime = new Date(slip.transfer_date).getTime();
                    if (!isNaN(slipTime) && !isNaN(stmtTime)) {
                        tDiff = Math.abs(stmtTime - slipTime);
                    }
                }

                // Prefer: 1) closest amount, 2) closest time as tiebreaker
                if (aDiff < bestAmountDiff || (aDiff === bestAmountDiff && tDiff < bestTimeDiff)) {
                    bestSlip = slip;
                    bestAmountDiff = aDiff;
                    bestTimeDiff = tDiff;
                }
            }
        }

        // Use best matching slip's data, fallback to order-level data
        const compareAmount = bestSlip ? (parseFloat(bestSlip.amount) || 0) : (parseFloat(order.total_amount) || 0);
        const amountDiff = Math.abs(stmtAmount - compareAmount);
        const amountMatch = amountDiff < 0.01;
        const compareLabel = bestSlip ? 'สลิป' : 'Order';

        // Time: use best slip's transfer_date, fallback to order transfer_date
        let orderTransferDate: string | null = bestSlip?.transfer_date || null;
        if (!orderTransferDate && order.transfer_date) {
            orderTransferDate = order.transfer_date;
        }

        let timeDiffMinutes: number | null = null;
        if (orderTransferDate) {
            const orderTime = new Date(orderTransferDate).getTime();
            if (!isNaN(stmtTime) && !isNaN(orderTime)) {
                timeDiffMinutes = Math.round(Math.abs(stmtTime - orderTime) / 60000);
            }
        }
        const timeMatch = timeDiffMinutes !== null && timeDiffMinutes < 1;
        const isFullMatch = amountMatch && timeMatch;

        return { amountMatch, amountDiff, orderAmount: compareAmount, stmtAmount, timeDiffMinutes, timeMatch, isFullMatch, orderTransferDate, formatTHB, compareLabel, slipCount: order.slips?.length || 0, bestSlipId: bestSlip?.id || null, bestSlipUrl: bestSlip?.url || null };
    };

    // Slip editing handlers
    const startEditSlip = (slip: any) => {
        setEditingSlipId(slip.id);
        setSlipEdits({
            amount: slip.amount != null ? String(parseFloat(slip.amount)) : '',
            transfer_date: slip.transfer_date ? slip.transfer_date.slice(0, 16) : '',
        });
    };

    const cancelEditSlip = () => {
        setEditingSlipId(null);
        setSlipEdits({ amount: '', transfer_date: '' });
    };

    const handleSlipSave = async () => {
        if (!editingSlipId || !companyId) return;
        setSavingSlip(true);
        try {
            const payload: any = { id: editingSlipId, company_id: companyId };
            if (slipEdits.amount !== '') payload.amount = parseFloat(slipEdits.amount);
            if (slipEdits.transfer_date !== '') payload.transfer_date = slipEdits.transfer_date;

            const res = await apiFetch('Slip_DB/update_order_slip.php', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            if (res.success) {
                // Update local order data
                if (order?.slips) {
                    const updated = order.slips.map((s: any) =>
                        s.id === editingSlipId ? { ...s, amount: payload.amount ?? s.amount, transfer_date: payload.transfer_date ?? s.transfer_date } : s
                    );
                    setOrder({ ...order, slips: updated });
                }
                setEditingSlipId(null);
                onSlipUpdated?.();
            } else {
                alert('บันทึกไม่สำเร็จ: ' + (res.message || 'Unknown error'));
            }
        } catch (e: any) {
            alert('Error: ' + e.message);
        } finally {
            setSavingSlip(false);
        }
    };

    if (!isOpen) return null;

    const matchInfo = computeMatchInfo();

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800">รายละเอียดออเดอร์ #{orderId}</h3>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {/* Statement Context Banner — dynamically computed */}
                    {statementContext && matchInfo && (
                        <div className={`mb-4 rounded-lg border p-3 ${matchInfo.isFullMatch
                            ? 'bg-green-50 border-green-200'
                            : matchInfo.amountMatch
                                ? 'bg-yellow-50 border-yellow-200'
                                : 'bg-orange-50 border-orange-200'
                            }`}>
                            {/* Match badges */}
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                {matchInfo.isFullMatch ? (
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                                        ✅ ตรงกัน 100%
                                    </span>
                                ) : (
                                    <>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${matchInfo.amountMatch
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-orange-100 text-orange-800'
                                            }`}>
                                            {matchInfo.amountMatch
                                                ? '💰 ยอดตรงกัน'
                                                : `💰 ยอดต่าง ${matchInfo.formatTHB(matchInfo.amountDiff)}`}
                                        </span>
                                        {matchInfo.timeDiffMinutes !== null ? (
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${matchInfo.timeMatch
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {matchInfo.timeMatch
                                                    ? '🕐 เวลาตรงกัน'
                                                    : `🕐 เวลาต่าง ${matchInfo.timeDiffMinutes} นาที`}
                                            </span>
                                        ) : (
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                🕐 ไม่มีข้อมูลเวลาสลิป
                                            </span>
                                        )}
                                        {matchInfo.slipCount > 1 && (
                                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                                📎 {matchInfo.slipCount} สลิป
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                            {/* Two-column split: Statement vs Slip */}
                            <div className="grid grid-cols-2 gap-0 text-sm">
                                {/* Left: Statement */}
                                <div className="pr-3 border-r border-gray-300 space-y-1">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">📄 Statement</div>
                                    <div>
                                        <span className="text-gray-500">ยอด: </span>
                                        <span className="font-bold text-gray-900">
                                            {matchInfo.formatTHB(matchInfo.stmtAmount)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">เวลา: </span>
                                        <span className="font-medium text-gray-800">
                                            {new Date(statementContext.transferAt).toLocaleString('th-TH')}
                                        </span>
                                    </div>
                                    {statementContext.channel && (
                                        <div>
                                            <span className="text-gray-500">ช่องทาง: </span>
                                            <span className="font-medium text-gray-800">{statementContext.channel}</span>
                                        </div>
                                    )}
                                </div>
                                {/* Right: Matched Slip */}
                                <div className="pl-3 space-y-1">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">🧾 {matchInfo.compareLabel}ที่ตรงกัน</div>
                                    <div>
                                        <span className="text-gray-500">ยอด: </span>
                                        <span className="font-bold text-gray-900">
                                            {matchInfo.formatTHB(matchInfo.orderAmount)}
                                        </span>
                                    </div>
                                    {matchInfo.orderTransferDate && (
                                        <div>
                                            <span className="text-gray-500">เวลา: </span>
                                            <span className="font-medium text-gray-800">
                                                {new Date(matchInfo.orderTransferDate).toLocaleString('th-TH')}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* Show banner with just statement info while loading */}
                    {statementContext && !matchInfo && !loading && (
                        <div className="mb-4 rounded-lg border p-3 bg-blue-50 border-blue-200">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                <div>
                                    <span className="text-gray-500">ยอด Statement: </span>
                                    <span className="font-semibold text-gray-900">
                                        {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(statementContext.statementAmount)}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-gray-500">เวลา Statement: </span>
                                    <span className="font-medium text-gray-800">
                                        {new Date(statementContext.transferAt).toLocaleString('th-TH')}
                                    </span>
                                </div>
                                {statementContext.channel && (
                                    <div>
                                        <span className="text-gray-500">ช่องทาง: </span>
                                        <span className="font-medium text-gray-800">{statementContext.channel}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                        </div>
                    ) : order ? (
                        <div className="space-y-6">
                            {/* Customer Info */}
                            <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
                                <User className="text-blue-600 mt-1" size={18} />
                                <div>
                                    <div className="font-semibold text-blue-900">ลูกค้า: {order.customer_first_name} {order.customer_last_name}</div>
                                    <div className="text-sm text-blue-700 mt-1">
                                        <span className="font-medium">ผู้รับ:</span> {order.recipient_first_name} {order.recipient_last_name}<br />
                                        <span className="font-medium">เบอร์โทร:</span> {order.recipient_phone || order.phone || order.customer_phone || '-'}
                                    </div>
                                </div>
                            </div>

                            {/* Address */}
                            <div className="flex items-start gap-3 px-2">
                                <MapPin className="text-gray-400 mt-1" size={18} />
                                <div className="text-sm text-gray-600">
                                    {[
                                        order.recipient_address, // Fallback if exists
                                        order.street,
                                        order.subdistrict,
                                        order.district,
                                        order.province,
                                        order.postal_code
                                    ].filter(Boolean).join(' ')}
                                </div>
                            </div>

                            {/* Items */}
                            <div>
                                <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                    <Box size={16} /> รายการสินค้า
                                </h4>
                                <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-600 border-b sticky top-0 z-10" style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.06)' }}>
                                            <tr>
                                                <th className="px-3 py-2 text-left">สินค้า</th>
                                                <th className="px-3 py-2 text-center w-20">จำนวน</th>
                                                <th className="px-3 py-2 text-right w-24">ราคา/หน่วย</th>
                                                <th className="px-3 py-2 text-right w-20">ส่วนลด</th>
                                                <th className="px-3 py-2 text-right w-24">ราคารวม</th>
                                                <th className="px-3 py-2 text-left w-24">หมายเหตุ</th>
                                                <th className="px-3 py-2 text-left w-24">ผู้ขาย</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {(() => {
                                                // Sort items: parent promotions followed by their children
                                                const items = order.items || [];
                                                const sorted: any[] = [];
                                                const childMap = new Map<number, any[]>();
                                                const standalone: any[] = [];

                                                // Group children by parent_item_id
                                                for (const item of items) {
                                                    if (item.parent_item_id) {
                                                        const pid = Number(item.parent_item_id);
                                                        if (!childMap.has(pid)) childMap.set(pid, []);
                                                        childMap.get(pid)!.push(item);
                                                    }
                                                }

                                                // Build sorted list: parent → children, then standalone items
                                                for (const item of items) {
                                                    if (item.parent_item_id) continue; // skip children in first pass
                                                    const isParent = item.is_promotion_parent === 1 || item.is_promotion_parent === true;
                                                    sorted.push(item);
                                                    if (isParent && childMap.has(Number(item.id))) {
                                                        sorted.push(...childMap.get(Number(item.id))!);
                                                    }
                                                }

                                                return sorted.map((item: any, idx: number) => {
                                                const isParent = item.is_promotion_parent === 1 || item.is_promotion_parent === true;
                                                const isChild = !!item.parent_item_id;
                                                const parentId = item.parent_item_id;
                                                const isExpanded = parentId ? expandedPromotions.has(parentId) : true;

                                                // Skip collapsed children
                                                if (isChild && !isExpanded) return null;

                                                return (
                                                    <tr key={idx} className={isChild ? 'bg-gray-50/60' : ''}>
                                                        <td className={`px-3 py-2 ${isChild ? 'pl-8' : ''}`}>
                                                            <div className="flex items-center gap-1.5">
                                                                {isParent && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setExpandedPromotions(prev => {
                                                                                const next = new Set(prev);
                                                                                if (next.has(item.id)) { next.delete(item.id); } else { next.add(item.id); }
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        className="text-gray-400 hover:text-gray-600 flex-shrink-0 p-0.5 -ml-1"
                                                                    >
                                                                        {expandedPromotions.has(item.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                                                    </button>
                                                                )}
                                                                {isChild && (
                                                                    <CornerDownRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                                                                )}
                                                                <div>
                                                                    <div className={isParent ? 'font-semibold text-blue-700 text-sm' : isChild ? 'text-gray-700 text-xs' : 'font-medium text-gray-900 text-sm'}>
                                                                        {item.product_name}
                                                                        {isParent && (
                                                                            <span className="ml-1.5 text-[10px] font-normal bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">เซ็ต</span>
                                                                        )}
                                                                    </div>
                                                                    {item.sku && <div className={`text-gray-500 ${isChild ? 'text-[10px]' : 'text-xs'}`}>SKU: {item.sku}</div>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className={`px-3 py-2 text-center ${isChild ? 'text-xs text-gray-500' : 'text-sm'}`}>{item.quantity}</td>
                                                        <td className={`px-3 py-2 text-right ${isChild ? 'text-xs text-gray-500' : 'text-sm'}`}>{new Intl.NumberFormat('th-TH').format(item.price_per_unit || item.price || 0)}</td>
                                                        <td className={`px-3 py-2 text-right ${isChild ? 'text-xs' : 'text-sm'} text-red-500`}>{item.discount > 0 ? `-${new Intl.NumberFormat('th-TH').format(item.discount)}` : '-'}</td>
                                                        <td className={`px-3 py-2 text-right font-medium ${isChild ? 'text-xs text-gray-500' : 'text-sm'}`}>{new Intl.NumberFormat('th-TH').format(item.net_total || 0)}</td>
                                                        <td className={`px-3 py-2 text-gray-500 ${isChild ? 'text-[11px]' : 'text-sm'}`}>
                                                            {(item.is_freebie === 1 || item.is_freebie === true) ? (
                                                                <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded border border-green-200">ของแถม</span>
                                                            ) : (
                                                                item.notes || '-'
                                                            )}
                                                        </td>
                                                        <td className={`px-3 py-2 text-purple-600 font-medium ${isChild ? 'text-[11px]' : 'text-sm'}`}>
                                                            {`${item.creator_first_name || ''} ${item.creator_last_name || ''}`.trim() || '-'}
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                            })()}
                                        </tbody>
                                        <tfoot className="bg-gray-50 font-semibold border-t">
                                            <tr>
                                                <td className="px-3 py-2 text-right" colSpan={5}>รวมทั้งหมด</td>
                                                <td className="px-3 py-2 text-right text-blue-600">{new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(Number(order.total_amount))}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                            {/* Statuses */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-3 bg-gray-50 rounded border">
                                    <div className="text-xs text-gray-500 mb-1">สถานะการชำระเงิน</div>
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${order.payment_status === 'Paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {paymentMethodThai[order.payment_method] || order.payment_method} ({paymentStatusThai[order.payment_status] || order.payment_status})
                                    </span>
                                </div>
                                <div className="p-3 bg-gray-50 rounded border">
                                    <div className="text-xs text-gray-500 mb-1">สถานะออเดอร์</div>
                                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${order.order_status === 'Delivered' ? 'bg-green-100 text-green-800' :
                                        order.order_status === 'Cancelled' ? 'bg-red-100 text-red-800' :
                                            order.order_status === 'Returned' ? 'bg-orange-100 text-orange-800' :
                                                order.order_status === 'BadDebt' ? 'bg-gray-800 text-white' :
                                                    'bg-blue-100 text-blue-800'
                                        }`}>
                                        {statusThai[order.order_status] || order.order_status}
                                    </span>
                                </div>
                            </div>

                            {/* Proof of Payment Images */}
                            {(() => {
                                // Calculate base path for images
                                const apiBase = resolveApiBasePath().replace(/\/api$/, '');
                                const getFullUrl = (path: string) => {
                                    if (!path) return '';
                                    if (path.startsWith('http')) return path;
                                    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
                                    return `${apiBase}/${cleanPath}`;
                                };

                                // Build slip entries with metadata for highlighting
                                const slipEntries = (order.slips || []).map((s: any) => ({
                                    url: getFullUrl(s.url),
                                    id: s.id,
                                    amount: parseFloat(s.amount) || 0,
                                    isMatch: matchInfo?.bestSlipId && s.id === matchInfo.bestSlipId,
                                }));
                                // Add legacy slipUrl if present
                                if (order.slipUrl) {
                                    slipEntries.push({ url: getFullUrl(order.slipUrl), id: null, amount: 0, isMatch: false });
                                }
                                const validEntries = slipEntries.filter((e: any) => e.url);

                                if (validEntries.length === 0) return null;

                                // If there's a matched slip, sort it to the front
                                const matchedIdx = validEntries.findIndex((e: any) => e.isMatch);
                                const sortedEntries = matchedIdx > 0
                                    ? [validEntries[matchedIdx], ...validEntries.filter((_: any, i: number) => i !== matchedIdx)]
                                    : validEntries;

                                return (
                                    <div className="border-t pt-4">
                                        <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                            <ImageIcon size={16} /> หลักฐานการโอนเงิน
                                            {validEntries.length > 1 && (
                                                <span className="text-xs font-normal text-gray-400">({validEntries.length} รายการ)</span>
                                            )}
                                        </h4>
                                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                            {sortedEntries.map((entry: any, idx: number) => (
                                                <div
                                                    key={entry.id || idx}
                                                    className={`aspect-square rounded-lg overflow-hidden cursor-zoom-in relative group ${entry.isMatch
                                                        ? 'ring-3 ring-blue-500 ring-offset-1 border-2 border-blue-400'
                                                        : 'border border-gray-200'
                                                        }`}
                                                    onClick={() => setViewingImage(entry.url)}
                                                >
                                                    <img
                                                        src={entry.url}
                                                        alt="Slip"
                                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = 'https://placehold.co/400?text=No+Image';
                                                        }}
                                                    />
                                                    {/* Matched slip badge */}
                                                    {entry.isMatch && (
                                                        <div className="absolute top-0 left-0 right-0 bg-blue-600/90 text-white text-[10px] text-center font-semibold py-0.5">
                                                            ✓ สลิปที่ตรงกัน
                                                        </div>
                                                    )}
                                                    {/* Amount label */}
                                                    {entry.amount > 0 && (
                                                        <div className={`absolute bottom-0 left-0 right-0 text-[10px] text-center font-semibold py-0.5 ${entry.isMatch
                                                            ? 'bg-blue-600/80 text-white'
                                                            : 'bg-black/50 text-white'
                                                            }`}>
                                                            ฿{entry.amount.toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Slip Edit Section - only shown from BankAccountAuditPage */}
                                        {statementContext && (order.slips || []).length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                <div className="text-xs font-medium text-gray-500 mb-1">แก้ไขรายละเอียดสลิป</div>
                                                {(order.slips || []).map((slip: any, idx: number) => (
                                                    <div key={slip.id || idx} className="border rounded-lg p-2 bg-white">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-600">
                                                                สลิป #{idx + 1} {slip.id ? `(ID: ${slip.id})` : ''}
                                                            </span>
                                                            {editingSlipId === slip.id ? (
                                                                <div className="flex items-center gap-1">
                                                                    <button onClick={handleSlipSave} disabled={savingSlip} className="text-xs text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50" title="บันทึก">
                                                                        {savingSlip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                                                                    </button>
                                                                    <button onClick={cancelEditSlip} className="text-xs text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100" title="ยกเลิก">
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button onClick={() => startEditSlip(slip)} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-0.5 p-1 rounded hover:bg-blue-50" title="แก้ไข">
                                                                    <Pencil className="w-3 h-3" />
                                                                    <span>แก้ไข</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                        {editingSlipId === slip.id ? (
                                                            <div className="mt-2 grid grid-cols-2 gap-2">
                                                                <div>
                                                                    <label className="text-[10px] text-gray-500">ยอดเงิน</label>
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={slipEdits.amount}
                                                                        onChange={e => setSlipEdits(prev => ({ ...prev, amount: e.target.value }))}
                                                                        className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                                                                        placeholder="ยอดเงิน"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="text-[10px] text-gray-500">วันที่โอน</label>
                                                                    <input
                                                                        type="datetime-local"
                                                                        value={slipEdits.transfer_date}
                                                                        onChange={e => setSlipEdits(prev => ({ ...prev, transfer_date: e.target.value }))}
                                                                        className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-1 flex gap-4 text-xs text-gray-500">
                                                                <span>ยอด: <strong className="text-gray-700">฿{(parseFloat(slip.amount) || 0).toLocaleString()}</strong></span>
                                                                <span>โอน: <strong className="text-gray-700">{slip.transfer_date ? new Date(slip.transfer_date).toLocaleString('th-TH') : '-'}</strong></span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="text-center text-gray-500">ไม่พบข้อมูล</div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium shadow-sm">
                        ปิดหน้าต่าง
                    </button>
                </div>
            </div>

            {/* Lightbox */}
            {viewingImage && (
                <div
                    className="fixed inset-0 z-[10000] bg-black/90 flex items-center justify-center p-4"
                    onClick={() => setViewingImage(null)}
                >
                    <button
                        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors bg-white/10 rounded-full p-2"
                        onClick={() => setViewingImage(null)}
                    >
                        <X size={24} />
                    </button>
                    <img
                        src={viewingImage}
                        alt="Full size"
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
};

export default OrderDetailModal;
