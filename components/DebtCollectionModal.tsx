import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { X, DollarSign, FileText, AlertCircle, Clock, CheckCircle2, XCircle, AlertTriangle, AlertOctagon } from 'lucide-react';
import { createDebtCollection, getDebtCollectionHistory, updateDebtCollection, DebtCollectionRecord } from '../services/api';
import { User, Order } from '../types';

interface DebtCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order;
    currentUser: User;
    onSuccess: () => void;
    isCompletedView?: boolean;
}

const DebtCollectionModal: React.FC<DebtCollectionModalProps> = ({
    isOpen,
    onClose,
    order,
    currentUser,
    onSuccess,
    isCompletedView = false,
}) => {
    const [resultStatus, setResultStatus] = useState<1 | 2 | 3>(1);
    const [amountCollected, setAmountCollected] = useState<string>('0');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // History State
    const [history, setHistory] = useState<DebtCollectionRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [closingRecord, setClosingRecord] = useState<DebtCollectionRecord | null>(null);

    // Close Case State
    const [closeCase, setCloseCase] = useState(false);

    // Calculate remaining debt
    const totalAmount = order.totalAmount || 0;
    const paidAmount = order.amountPaid || order.codAmount || 0;
    const remainingDebt = Math.max(0, totalAmount - paidAmount);

    useEffect(() => {
        if (isOpen && order) {
            fetchHistory();
        }
    }, [isOpen, order]);

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const response = await getDebtCollectionHistory({ order_id: order.id });
            if (response.ok) {
                const data = response.data || [];
                setHistory(data);

                // Find the record that closed the case (is_complete = 1)
                // Assuming the latest one or unique one
                const closed = data.find(r => r.is_complete === 1);
                setClosingRecord(closed || null);
            }
        } catch (err) {
            console.error("Failed to fetch history:", err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleCancelCompletion = async () => {
        if (!closingRecord || !closingRecord.id) {
            setError('ไม่พบประวัติการจบเคส');
            return;
        }

        if (!confirm('ยืนยันที่จะยกเลิกสถานะ "จบเคส" และเปิดรายการติดตามหนี้นี้อีกครั้ง?')) {
            return;
        }

        setLoading(true);
        try {
            const response = await updateDebtCollection(closingRecord.id, {
                is_complete: 0
            });

            if (response.ok) {
                onSuccess();
                handleClose();
            } else {
                setError(response.error || 'เกิดข้อผิดพลาดในการยกเลิกจบเคส');
            }
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการยกเลิกจบเคส');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const amount = parseFloat(amountCollected);

        // Validation
        if (resultStatus === 1 && amount > 0) {
            setError('ยอดเก็บได้ต้องเป็น 0 เมื่อเลือก "เก็บไม่ได้"');
            return;
        }

        if ((resultStatus === 2 || resultStatus === 3) && amount <= 0) {
            setError('กรุณาระบุยอดเงินที่เก็บได้');
            return;
        }

        if (resultStatus === 3 && amount < remainingDebt) {
            setError(`ยอดเก็บได้ต้องเท่ากับยอดหนี้คงเหลือ (${remainingDebt.toLocaleString()} บาท) เมื่อเลือก "เก็บได้ทั้งหมด"`);
            return;
        }

        if (resultStatus === 2 && amount >= remainingDebt) {
            setError('ยอดเก็บได้ต้องน้อยกว่ายอดหนี้คงเหลือ เมื่อเลือก "เก็บได้บางส่วน"');
            return;
        }

        setLoading(true);

        try {
            const response = await createDebtCollection({
                order_id: order.id,
                user_id: currentUser.id,
                amount_collected: amount,
                result_status: resultStatus,
                is_complete: closeCase ? 1 : 0, // Use checkbox state
                note: note.trim() || undefined,
            });

            if (response.ok) {
                onSuccess();
                handleClose();
            } else {
                setError(response.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
            }
        } catch (err: any) {
            setError(err.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setResultStatus(1);
        setAmountCollected('0');
        setNote('');
        setError(null);
        setHistory([]);
        setCloseCase(false);
        onClose();
    };

    const getStatusBadge = (status: number) => {
        switch (status) {
            case 1:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                        <XCircle size={12} /> เก็บไม่ได้
                    </span>
                );
            case 2:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                        <AlertTriangle size={12} /> เก็บได้บางส่วน
                    </span>
                );
            case 3:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle2 size={12} /> เก็บได้ทั้งหมด
                    </span>
                );
            default:
                return <span className="text-gray-500">-</span>;
        }
    };

    return (
        <Modal onClose={handleClose} title={isCompletedView ? "ประวัติการติดตามหนี้ (จบเคสแล้ว)" : "บันทึกการติดตามหนี้"} size={isCompletedView ? "md" : "xl"}>
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left Side: Form (Hidden if isCompletedView) */}
                {!isCompletedView && (
                    <div className="flex-1 space-y-4">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Order Info */}
                            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-600">Order ID:</span>
                                        <span className="ml-2 font-medium">{order.id}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">ยอดหนี้คงเหลือ:</span>
                                        <span className="ml-2 font-bold text-red-600">
                                            ฿{remainingDebt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Result Status */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    ผลการติดตาม <span className="text-red-500">*</span>
                                </label>
                                <div className="space-y-2">
                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="radio"
                                            name="resultStatus"
                                            value="1"
                                            checked={resultStatus === 1}
                                            onChange={() => {
                                                setResultStatus(1);
                                                setAmountCollected('0');
                                            }}
                                            className="mr-3"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">เก็บไม่ได้</div>
                                            <div className="text-xs text-gray-500">ติดต่อไม่ได้ / ปฏิเสธจ่าย</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="radio"
                                            name="resultStatus"
                                            value="2"
                                            checked={resultStatus === 2}
                                            onChange={() => setResultStatus(2)}
                                            className="mr-3"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">เก็บได้บางส่วน</div>
                                            <div className="text-xs text-gray-500">จ่ายไม่ครบ</div>
                                        </div>
                                    </label>

                                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                        <input
                                            type="radio"
                                            name="resultStatus"
                                            value="3"
                                            checked={resultStatus === 3}
                                            onChange={() => {
                                                setResultStatus(3);
                                                setAmountCollected(remainingDebt.toString());
                                            }}
                                            className="mr-3"
                                        />
                                        <div>
                                            <div className="font-medium text-gray-900">เก็บได้ทั้งหมด</div>
                                            <div className="text-xs text-gray-500">จ่ายครบแล้ว (จบเคสอัตโนมัติ)</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Amount Collected */}
                            {(resultStatus === 2 || resultStatus === 3) && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <DollarSign size={16} className="inline mr-1" />
                                        ยอดเงินที่เก็บได้ <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        max={remainingDebt}
                                        value={amountCollected}
                                        onChange={(e) => setAmountCollected(e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        placeholder="0.00"
                                        required
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        สูงสุด: ฿{remainingDebt.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                                    </p>
                                </div>
                            )}

                            {/* Note */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    <FileText size={16} className="inline mr-1" />
                                    บันทึกเพิ่มเติม
                                </label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    rows={4}
                                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="เช่น วันที่นัดจ่าย, เหตุผลที่จ่ายไม่ได้, ช่องทางติดต่อ..."
                                />
                            </div>

                            {/* Close Case Checkbox */}
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                                <label className="flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={closeCase}
                                        onChange={(e) => setCloseCase(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-2 font-medium text-gray-900 flex items-center gap-2">
                                        <CheckCircle2 size={16} className="text-green-600" />
                                        ต้องการจบเคสนี้ทันที
                                    </span>
                                </label>
                                <p className="ml-6 mt-1 text-xs text-gray-500">
                                    เมื่อจบเคส รายการนี้จะถูกย้ายออกจากรายการติดตามหนี้ปัจจุบัน
                                </p>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={loading}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            กำลังบันทึก...
                                        </>
                                    ) : (
                                        'บันทึก'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Right Side: History */}
                <div className={`${isCompletedView ? 'w-full' : 'md:w-80 border-l pl-0 md:pl-6 pt-6 md:pt-0 border-t md:border-t-0'}`}>
                    <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                        <Clock size={18} className="text-gray-500" />
                        ประวัติการติดตาม
                    </h3>

                    {historyLoading ? (
                        <div className="text-center py-8 text-gray-400 text-sm">กำลังโหลด...</div>
                    ) : history.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg border border-dashed">
                            ยังไม่มีประวัติการติดตาม
                        </div>
                    ) : (
                        <div className={`space-y-4 overflow-y-auto pr-2 ${isCompletedView ? 'max-h-[60vh]' : 'max-h-[500px]'}`}>
                            {history.map((record) => (
                                <div key={record.id} className="relative pl-4 border-l-2 border-gray-200 pb-1 last:pb-0">
                                    <div className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-gray-300"></div>
                                    <div className="text-xs text-gray-500 mb-1">
                                        {record.created_at ? new Date(record.created_at).toLocaleString('th-TH', {
                                            day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit'
                                        }) : '-'}
                                    </div>
                                    <div className="mb-1 flex items-center gap-2">
                                        {getStatusBadge(record.result_status)}
                                        {record.is_complete === 1 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-600 text-white">
                                                <CheckCircle2 size={12} /> จบเคส
                                            </span>
                                        )}
                                    </div>
                                    {record.amount_collected > 0 && (
                                        <div className="text-sm font-bold text-green-600 mb-1">
                                            +฿{record.amount_collected.toLocaleString()}
                                        </div>
                                    )}
                                    {record.note && (
                                        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded border break-words">
                                            {record.note}
                                        </div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-1">
                                        โดย: {record.first_name}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Actions for Completed View: Re-open case */}
                    {isCompletedView && (
                        <div className="mt-6 pt-4 border-t flex justify-between items-center bg-gray-50 p-4 rounded-b-lg -mx-4 -mb-4">
                            <div className="text-sm text-gray-500">
                                {closingRecord ? `จบเคสเมื่อ: ${new Date(closingRecord.created_at!).toLocaleDateString('th-TH')}` : ''}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleClose}
                                    disabled={loading}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                                >
                                    ยกเลิก
                                </button>
                                {closingRecord && (
                                    <button
                                        onClick={handleCancelCompletion}
                                        disabled={loading}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {loading ? (
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <AlertOctagon size={16} />
                                        )}
                                        ยกเลิกการจบเคส
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    {isCompletedView && error && (
                        <div className="mt-2 text-red-600 text-sm">
                            {error}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default DebtCollectionModal;
