import React from 'react';
import Modal from './Modal';
import { User, Clock, Building2, DollarSign, Calendar, Image as ImageIcon } from 'lucide-react';
import resolveApiBasePath from '../utils/apiBasePath';

export interface SlipDetail {
    image_url: string;
    amount?: number | string | null;
    transfer_date?: string | null;
    slip_created_at?: string | null;
    bank_account_id?: number | null;
    bank_name?: string | null;
    bank_number?: string | null;
    uploader_name?: string | null;
}

interface SlipDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    slip: SlipDetail | null;
}

const SlipDetailModal: React.FC<SlipDetailModalProps> = ({ isOpen, onClose, slip }) => {
    if (!isOpen || !slip) return null;

    const basePath = resolveApiBasePath().replace(/\/api$/, '');
    const imgUrl = `${basePath}/${slip.image_url}`;

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('th-TH', {
            day: 'numeric',
            month: 'short',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatAmount = (amount?: number | string | null) => {
        if (amount === null || amount === undefined) return '-';
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        if (isNaN(num)) return '-';
        return `฿${num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <Modal title="รายละเอียดสลิป" onClose={onClose} size="md">
            {/* Image */}
            <div className="bg-gray-900 flex items-center justify-center rounded-lg overflow-hidden -mt-2 mb-4" style={{ maxHeight: '350px' }}>
                <img
                    src={imgUrl}
                    alt="slip"
                    className="max-w-full max-h-[350px] object-contain"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=No+Image';
                    }}
                />
            </div>

            {/* Details */}
            <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                    {/* Amount */}
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                        <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium mb-1">
                            <DollarSign size={13} />
                            จำนวนที่โอน
                        </div>
                        <div className="text-lg font-bold text-green-700">
                            {formatAmount(slip.amount)}
                        </div>
                    </div>

                    {/* Bank */}
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                        <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium mb-1">
                            <Building2 size={13} />
                            ธนาคาร
                        </div>
                        <div className="text-sm font-semibold text-blue-700">
                            {slip.bank_name || '-'}
                        </div>
                        {slip.bank_number && (
                            <div className="text-xs text-blue-500 mt-0.5 font-mono">
                                {slip.bank_number}
                            </div>
                        )}
                    </div>

                    {/* Transfer Date */}
                    <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                        <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium mb-1">
                            <Calendar size={13} />
                            เวลาที่โอน
                        </div>
                        <div className="text-sm font-semibold text-purple-700">
                            {formatDate(slip.transfer_date)}
                        </div>
                    </div>

                    {/* Upload Date */}
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
                            <Clock size={13} />
                            เวลาที่อัปโหลด
                        </div>
                        <div className="text-sm font-semibold text-gray-700">
                            {formatDate(slip.slip_created_at)}
                        </div>
                    </div>
                </div>

                {/* Uploader */}
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mb-1">
                        <User size={13} />
                        ผู้อัปโหลด
                    </div>
                    <div className="text-sm font-semibold text-amber-700">
                        {slip.uploader_name || '-'}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t flex justify-end gap-2">
                <a
                    href={imgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 text-sm text-blue-600 bg-white border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                    เปิดรูปเต็ม
                </a>
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    ปิด
                </button>
            </div>
        </Modal>
    );
};

export default SlipDetailModal;
