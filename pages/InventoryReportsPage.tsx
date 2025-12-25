import React, { useState, useEffect } from 'react';
import { FileText, Download, Calendar, Filter, Search, X, ChevronRight, BarChart2, ClipboardList } from 'lucide-react';
import { User } from '@/types';
import { listWarehouses, listProducts, apiFetch } from '@/services/api';

interface InventoryReportsPageProps {
    currentUser?: User;
    companyId?: number;
}

type ReportType = 'movement' | 'balance' | null;

const InventoryReportsPage: React.FC<InventoryReportsPageProps> = ({ currentUser, companyId }) => {
    const [selectedReport, setSelectedReport] = useState<ReportType>(null);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);

    // Filter States
    const [selectedWarehouse, setSelectedWarehouse] = useState<string>('');
    const [selectedProduct, setSelectedProduct] = useState<string>('');

    // Movement Specific
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [movementType, setMovementType] = useState<string>('');

    // Balance Specific
    const [balanceDate, setBalanceDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        if (companyId) {
            listWarehouses(companyId).then(res => {
                if (Array.isArray(res)) setWarehouses(res);
            });
            listProducts().then(res => {
                if (Array.isArray(res)) setProducts(res);
            });
        }
    }, [companyId]);

    const handleClose = () => {
        setSelectedReport(null);
        // Optional: Reset filters? Keep them for convenience.
    }

    const handleExport = () => {
        let url = '';
        const query = new URLSearchParams({
            warehouseId: selectedWarehouse,
            productId: products.find(p => `${p.sku} - ${p.name}` === selectedProduct)?.id || selectedProduct,
            companyId: String(companyId || '')
        });

        if (selectedReport === 'movement') {
            query.set('startDate', startDate);
            query.set('endDate', endDate);
            query.set('type', movementType);
            url = `${import.meta.env.VITE_API_URL || 'http://localhost/CRM_ERP_V4/api'}/inventory/export_movement_report.php?${query.toString()}`;
        } else if (selectedReport === 'balance') {
            query.set('date', balanceDate);
            url = `${import.meta.env.VITE_API_URL || 'http://localhost/CRM_ERP_V4/api'}/inventory/export_balance_report.php?${query.toString()}`;
        }

        if (url) window.open(url, '_blank');
        // handleClose(); // Optional: Close after export? User might want to adjust and download again.
    };

    return (
        <div className="p-8 bg-[#F5F5F5] min-h-screen">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Inventory Reports</h1>
                    <p className="text-gray-600">เลือกประเภทรายงานที่ต้องการดาวน์โหลด</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Report Card: Movement */}
                    <div
                        onClick={() => setSelectedReport('movement')}
                        className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100 p-6 flex items-start gap-4 group"
                    >
                        <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                            <ClipboardList className="h-8 w-8 text-blue-600" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-lg font-semibold text-gray-900">รายงานความเคลื่อนไหว</h3>
                                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
                            </div>
                            <h4 className="text-sm font-medium text-blue-900 mb-2">Stock Movement Report</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                ประวัติการรับเข้า, จ่ายออก, ปรับปรุงยอดสินค้า และการกระทำต่างๆ ที่ส่งผลต่อสต็อกสินค้าตามช่วงเวลา
                            </p>
                        </div>
                    </div>

                    {/* Report Card: Balance */}
                    <div
                        onClick={() => setSelectedReport('balance')}
                        className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border border-gray-100 p-6 flex items-start gap-4 group"
                    >
                        <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                            <BarChart2 className="h-8 w-8 text-green-600" />
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <h3 className="text-lg font-semibold text-gray-900">รายงานยอดคงเหลือ</h3>
                                <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-green-500" />
                            </div>
                            <h4 className="text-sm font-medium text-green-900 mb-2">Stock Balance Report</h4>
                            <p className="text-sm text-gray-500 leading-relaxed">
                                ยอดคงเหลือสินค้า ณ ปัจจุบัน หรือย้อนดู ณ วันที่ที่ต้องการ (Snapshot) พร้อมสถานะ Inbound/Reserved/Sold
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Config Modal */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-all" onClick={handleClose}>
                    <div
                        className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    {selectedReport === 'movement' ? 'กำหนดเงื่อนไขรายงานความเคลื่อนไหว' : 'กำหนดเงื่อนไขรายงานยอดคงเหลือ'}
                                </h3>
                                <p className="text-sm text-gray-500 mt-0.5">Please specify report criteria</p>
                            </div>
                            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Common Filters */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">คลังสินค้า (Warehouse)</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all bg-white"
                                        value={selectedWarehouse}
                                        onChange={e => setSelectedWarehouse(e.target.value)}
                                    >
                                        <option value="">ทุกคลังสินค้า (All Warehouses)</option>
                                        {warehouses.map(w => (
                                            <option key={w.id} value={w.id}>{w.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ค้นหาสินค้า (Product)</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <input
                                            type="text"
                                            list="productOptions"
                                            className="w-full pl-9 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                            placeholder="รหัสสินค้า หรือ ชื่อสินค้า... (พิมพ์เพื่อค้นหา)"
                                            value={selectedProduct}
                                            onChange={e => setSelectedProduct(e.target.value)}
                                        />
                                        <datalist id="productOptions">
                                            {products.map(p => (
                                                <option key={p.id} value={`${p.sku} - ${p.name}`} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                            </div>

                            <hr className="border-gray-100" />

                            {/* Specific Filters */}
                            {selectedReport === 'movement' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ตั้งแต่วันที่</label>
                                            <input
                                                type="date"
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                value={startDate}
                                                onChange={e => setStartDate(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ถึงวันที่</label>
                                            <input
                                                type="date"
                                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                value={endDate}
                                                onChange={e => setEndDate(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทรายการ (Movement Type)</label>
                                        <select
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            value={movementType}
                                            onChange={e => setMovementType(e.target.value)}
                                        >
                                            <option value="">ทั้งหมด (All Types)</option>
                                            <option value="IN">รับเข้า (IN)</option>
                                            <option value="OUT">จ่ายออก/ขาย (OUT)</option>
                                            <option value="ADJUSTMENT">ปรับปรุงยอด (ADJUSTMENT)</option>
                                            <option value="Edit Document">แก้ไขเอกสาร (Edit)</option>
                                            <option value="Delete Document">ลบเอกสาร (Void/Delete)</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {selectedReport === 'balance' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ยอดคงเหลือ ณ วันที่ (Snapshot Date)</label>
                                    <input
                                        type="date"
                                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                        value={balanceDate}
                                        onChange={e => setBalanceDate(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">เลือกวันที่อดีตเพื่อดูยอดย้อนหลัง (ระบบจะคำนวณถอยหลังจากยอดปัจจุบัน)</p>
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-all transform active:scale-95"
                            >
                                <Download className="h-4 w-4" />
                                ดาวน์โหลด CSV
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryReportsPage;
