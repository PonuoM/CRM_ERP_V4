import React, { useEffect, useState } from 'react';
import Modal from '../Modal';
import { Customer } from '../../types';
import { Loader2, User, Clock, Tag as TagIcon, XCircle, CheckCircle2 } from 'lucide-react';
import { apiFetch } from '../../services/api';

interface CustomerTagHistoryModalProps {
    customer: Customer;
    onClose: () => void;
}

interface TagHistoryEntry {
    id: number;
    tag_name: string;
    color: string;
    created_at: string;
    created_first: string | null;
    created_last: string | null;
    deleted_at: string | null;
    deleted_first: string | null;
    deleted_last: string | null;
}

const CustomerTagHistoryModal: React.FC<CustomerTagHistoryModalProps> = ({
    customer,
    onClose
}) => {
    const [history, setHistory] = useState<TagHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        const fetchHistory = async () => {
            setLoading(true);
            try {
                const res = await apiFetch(`customer_tags?history=1&customerId=${customer.id}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.message || 'Failed to fetch history');
                if (mounted) {
                    setHistory(data);
                }
            } catch (err: any) {
                if (mounted) {
                    setError(err.message || 'Error fetching history');
                }
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchHistory();
        return () => { mounted = false; };
    }, [customer.id]);

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('th-TH');
    };

    const formatUser = (first: string | null, last: string | null) => {
        if (!first && !last) return 'System / Unknown';
        return `${first || ''} ${last || ''}`.trim();
    };

    return (
        <Modal 
            isOpen={true} 
            onClose={onClose} 
            title={`ประวัติการจัดการ Tag - ${customer.customer_name || 'ไม่ระบุชื่อ'}`}
        >
            <div className="p-4 bg-white max-h-[70vh] overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                        <p className="text-gray-500 font-medium">กำลังโหลดประวัติ...</p>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-red-50 text-red-600 rounded-lg">
                        <p className="font-medium">เกิดข้อผิดพลาด</p>
                        <p className="text-sm">{error}</p>
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <TagIcon className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                        <p>ไม่มีประวัติการใส่ Tag สำหรับลูกค้าคนนี้</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {history.map((entry) => {
                            const tagColor = entry.color || '#9333EA';
                            const bgColor = tagColor.startsWith('#') ? tagColor : `#${tagColor}`;
                            
                            return (
                                <div key={entry.id} className="border border-gray-200 rounded-lg p-4 shadow-sm relative overflow-hidden">
                                    {/* Left color border indicator */}
                                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: bgColor }} />
                                    
                                    <div className="flex flex-col md:flex-row md:items-center justify-between ml-2 gap-4">
                                        <div className="w-full">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span 
                                                    className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium text-white shadow-sm"
                                                    style={{ backgroundColor: bgColor }}
                                                >
                                                    <TagIcon className="w-3 h-3 mr-1" />
                                                    {entry.tag_name}
                                                </span>
                                                {entry.deleted_at ? (
                                                    <span className="inline-flex items-center text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                                                        <XCircle className="w-3 h-3 mr-1" /> ถอด Tag แล้ว
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
                                                        <CheckCircle2 className="w-3 h-3 mr-1" /> ใช้งานอยู่
                                                    </span>
                                                )}
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-sm mt-3">
                                                {/* Creation Info */}
                                                <div>
                                                    <p className="text-xs text-gray-500 font-medium mb-1">เวลาที่ใส่ Tag</p>
                                                    <div className="flex items-center gap-2 text-gray-700">
                                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                        <span>{formatDate(entry.created_at)}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-gray-700 mt-1">
                                                        <User className="w-3.5 h-3.5 text-gray-400" />
                                                        <span>{formatUser(entry.created_first, entry.created_last)}</span>
                                                    </div>
                                                </div>

                                                {/* Deletion Info */}
                                                {entry.deleted_at && (
                                                    <div>
                                                        <p className="text-xs text-gray-500 font-medium mb-1">เวลาที่ถอด Tag</p>
                                                        <div className="flex items-center gap-2 text-gray-700">
                                                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                                                            <span>{formatDate(entry.deleted_at)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-gray-700 mt-1">
                                                            <User className="w-3.5 h-3.5 text-gray-400" />
                                                            <span>{formatUser(entry.deleted_first, entry.deleted_last)}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
            
            <div className="p-4 border-t border-gray-200 flex justify-end bg-gray-50 rounded-b-lg">
                <button
                    onClick={onClose}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium border border-gray-300"
                >
                    ปิดหน้าต่าง
                </button>
            </div>
        </Modal>
    );
};

export default CustomerTagHistoryModal;
