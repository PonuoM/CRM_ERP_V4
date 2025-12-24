import React, { useEffect, useState } from 'react';
import { FileText, PackagePlus, ClipboardList, Search, Filter, History, Calendar, Edit, Trash2, Eye } from 'lucide-react';
import { User } from '@/types';
import { listStockTransactions, deleteStockTransaction } from '@/services/api';
import ReceiveStockModal from '@/components/Inventory/ReceiveStockModal';
import StockAdjustmentModal from '@/components/Inventory/StockAdjustmentModal';

interface StockDocumentsPageProps {
    currentUser?: User;
    companyId?: number;
}

const StockDocumentsPage: React.FC<StockDocumentsPageProps> = ({ currentUser, companyId }) => {
    const [activeTab, setActiveTab] = useState<'all' | 'receive' | 'adjustment'>('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });

    // Date Filters
    const currentYear = new Date().getFullYear();
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(currentYear);

    // Modals
    const [showReceiveModal, setShowReceiveModal] = useState(false);
    const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
    const [editingTransactionId, setEditingTransactionId] = useState<number | null>(null);
    const [isReadonly, setIsReadonly] = useState(false);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const res = await listStockTransactions({
                page: pagination.page,
                type: activeTab === 'all' ? '' : activeTab,
                search: searchTerm,
                month: selectedMonth,
                year: selectedYear
            });
            if (res.success) {
                setTransactions(res.data);
                setPagination(prev => ({ ...prev, ...res.pagination }));
            }
        } catch (error) {
            console.error("Failed to load transactions", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTransactions();
    }, [activeTab, pagination.page, searchTerm, selectedMonth, selectedYear]);

    const handleEdit = (t: any) => {
        setEditingTransactionId(t.id);
        setIsReadonly(false);
        if (t.type === 'receive') {
            setShowReceiveModal(true);
        } else {
            setShowAdjustmentModal(true);
        }
    };

    const handleView = (t: any) => {
        setEditingTransactionId(t.id);
        setIsReadonly(true);
        if (t.type === 'receive') {
            setShowReceiveModal(true);
        } else {
            setShowAdjustmentModal(true);
        }
    };

    const handleDelete = async (t: any) => {
        if (!window.confirm(`คุณต้องการลบเอกสาร ${t.document_number} ใช่หรือไม่?\nการลบจะย้อนกลับการเคลื่อนไหวสต็อกทั้งหมด`)) return;

        try {
            const res = await deleteStockTransaction(t.id);
            if (res.success) {
                alert('ลบเอกสารสำเร็จ');
                fetchTransactions();
            } else {
                alert('Error: ' + res.error);
            }
        } catch (err: any) {
            alert('Failed to delete: ' + err.message);
        }
    };

    const closeModal = () => {
        setShowReceiveModal(false);
        setShowAdjustmentModal(false);
        setEditingTransactionId(null);
        setIsReadonly(false);
    };

    return (
        <div className="p-6 bg-[#F5F5F5] min-h-full">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <History className="h-6 w-6 text-gray-600" />
                        เอกสารสต็อก (Stock Documents)
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">ประวัติการรับสินค้าและปรับปรุงยอดสินค้า</p>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setEditingTransactionId(null); setIsReadonly(false); setShowReceiveModal(true); }}
                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors"
                    >
                        <PackagePlus className="h-5 w-5" />
                        รับสินค้าเข้า
                    </button>
                    <button
                        onClick={() => { setEditingTransactionId(null); setIsReadonly(false); setShowAdjustmentModal(true); }}
                        className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg shadow hover:bg-orange-700 transition-colors"
                    >
                        <ClipboardList className="h-5 w-5" />
                        ปรับปรุงยอด
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    {/* Tabs (Left) */}
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            ทั้งหมด
                        </button>
                        <button
                            onClick={() => setActiveTab('receive')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'receive' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            รับสินค้าเข้า
                        </button>
                        <button
                            onClick={() => setActiveTab('adjustment')}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'adjustment' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            ปรับปรุงยอด
                        </button>
                    </div>

                    {/* Right Side: Filters & Search */}
                    <div className="flex flex-col md:flex-row items-center gap-3">
                        <div className="flex gap-2 items-center">
                            {/* Month Filter */}
                            <select
                                value={selectedMonth}
                                onChange={e => setSelectedMonth(Number(e.target.value))}
                                className="bg-white border rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                    <option key={m} value={m}>เดือน {m}</option>
                                ))}
                            </select>
                            {/* Year Filter */}
                            <select
                                value={selectedYear}
                                onChange={e => setSelectedYear(Number(e.target.value))}
                                className="bg-white border rounded-lg text-sm px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                                {Array.from({ length: 5 }, (_, i) => currentYear - i).map(y => (
                                    <option key={y} value={y}>{y}</option>
                                ))}
                            </select>
                        </div>

                        {/* Search */}
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500"
                                placeholder="ค้นหาเลขเอกสาร..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 text-sm border-b">
                            <th className="py-3 px-4 w-32">วันที่เอกสาร</th>
                            <th className="py-3 px-4 w-40">เลขที่เอกสาร</th>
                            <th className="py-3 px-4 w-28">ประเภท</th>
                            <th className="py-3 px-4 w-40 text-right">ผู้บันทึก</th>
                            <th className="py-3 px-4 w-24 text-center">รายการ</th>
                            <th className="py-3 px-4 w-32 text-right">จำนวน</th>
                            <th className="py-3 px-4 flex-1">หมายเหตุ</th>
                            <th className="py-3 px-4 w-32 text-center text-xs font-bold uppercase tracking-wide">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-gray-500">
                                    กำลังโหลดข้อมูล...
                                </td>
                            </tr>
                        ) : transactions.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="py-8 text-center text-gray-400">
                                    ไม่พบข้อมูลเอกสาร
                                </td>
                            </tr>
                        ) : (
                            transactions.map((t: any) => (
                                <tr key={t.id} onClick={() => handleView(t)} className="hover:bg-gray-50 transition-colors group cursor-pointer">
                                    <td className="py-3 px-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-3.5 w-3.5 text-gray-400" />
                                            {new Date(t.transaction_date).toLocaleDateString('th-TH')}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm font-medium text-blue-600 group-hover:text-blue-800 group-hover:underline">
                                        {t.document_number}
                                    </td>
                                    <td className="py-3 px-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${t.type === 'receive'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-orange-100 text-orange-700'
                                            }`}>
                                            {t.type === 'receive' ? 'รับเข้า' : 'ปรับยอด'}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-right text-gray-600">
                                        {t.created_by_name || 'Admin'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-center text-gray-600">
                                        {t.item_count}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-right text-gray-600">
                                        {Number(t.total_quantity).toLocaleString()}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-500 truncate max-w-xs">
                                        {t.notes || '-'}
                                    </td>
                                    <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-2">
                                            <button
                                                onClick={() => handleEdit(t)}
                                                className="p-1.5 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
                                                title="แก้ไข"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(t)}
                                                className="p-1.5 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100 transition-colors"
                                                title="ลบ"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                    <span className="text-xs text-gray-500">
                        แสดง {transactions.length} รายการ (จากทั้งหมด {pagination.total})
                    </span>
                    <div className="flex gap-1">
                        <button
                            disabled={pagination.page <= 1}
                            onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                            className="px-3 py-1 text-xs border rounded hover:bg-white disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            ก่อนหน้า
                        </button>
                        <button
                            disabled={pagination.page >= pagination.totalPages}
                            onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                            className="px-3 py-1 text-xs border rounded hover:bg-white disabled:bg-gray-100 disabled:text-gray-400"
                        >
                            ถัดไป
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ReceiveStockModal
                isOpen={showReceiveModal}
                onClose={closeModal}
                onSuccess={() => {
                    fetchTransactions();
                    closeModal(); // Ensure close
                }}
                currentUser={currentUser}
                companyId={companyId}
                editTransactionId={editingTransactionId}
                readonly={isReadonly}
            />

            <StockAdjustmentModal
                isOpen={showAdjustmentModal}
                onClose={closeModal}
                onSuccess={() => {
                    fetchTransactions();
                    closeModal();
                }}
                currentUser={currentUser}
                companyId={companyId}
                editTransactionId={editingTransactionId}
                readonly={isReadonly}
            />
        </div>
    );
};

export default StockDocumentsPage;
