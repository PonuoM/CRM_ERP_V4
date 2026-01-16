import React, { useState } from 'react';
import Modal from './Modal';
import { X, DollarSign, FileText, AlertCircle } from 'lucide-react';
import { createDebtCollection, DebtCollectionRecord } from '../services/api';
import { User, Order } from '../types';

interface DebtCollectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order;
    currentUser: User;
    onSuccess: () => void;
}

const DebtCollectionModal: React.FC<DebtCollectionModalProps> = ({
    isOpen,
    onClose,
    order,
    currentUser,
    onSuccess,
}) => {
    const [resultStatus, setResultStatus] = useState<1 | 2 | 3>(1);
    const [amountCollected, setAmountCollected] = useState<string>('0');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculate remaining debt
    const totalAmount = order.totalAmount || 0;
    const paidAmount = order.amountPaid || order.codAmount || 0;
    const remainingDebt = Math.max(0, totalAmount - paidAmount);

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
                is_complete: 0, // This is a tracking record, not closing the case
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
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="บันทึกการติดตามหนี้">
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
                                <div className="text-xs text-gray-500">จ่ายครบแล้ว</div>
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
        </Modal>
    );
};

export default DebtCollectionModal;
