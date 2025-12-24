import React, { useEffect, useState } from 'react';
import { ClipboardList, Plus, Trash2, Save, Calendar, FileText, AlertTriangle } from 'lucide-react';
import { User, Warehouse, Product } from '@/types';
import { listWarehouses, listProducts, listProductLots, createStockTransaction } from '@/services/api';

interface StockAdjustmentPageProps {
    currentUser?: User;
    companyId?: number;
}

interface AdjustmentItem {
    id: number;
    productId: number | '';
    productName: string;
    warehouseId: number | '';
    lotId: number | '';
    lotNumber: string;
    quantity: number;
    type: 'add' | 'reduce';
    currentQty: number; // To show available
    remarks: string;
    availableLots: any[];
}

const StockAdjustmentPage: React.FC<StockAdjustmentPageProps> = ({ currentUser, companyId }) => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Document Header
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
    const [docNotes, setDocNotes] = useState('');

    // Items
    const [items, setItems] = useState<AdjustmentItem[]>([]);
    const [saving, setSaving] = useState(false);

    const effectiveCompanyId = companyId ?? currentUser?.companyId ?? 1;

    useEffect(() => {
        Promise.all([
            listWarehouses(effectiveCompanyId),
            listProducts()
        ]).then(([whs, prods]) => {
            setWarehouses(whs as any);
            setProducts(prods);
        });
    }, [effectiveCompanyId]);

    const addItem = () => {
        setItems([...items, {
            id: Date.now(),
            productId: '',
            productName: '',
            warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
            lotId: '',
            lotNumber: '',
            quantity: 1,
            type: 'reduce',
            currentQty: 0,
            remarks: '',
            availableLots: []
        }]);
    };

    const removeItem = (id: number) => {
        setItems(items.filter(i => i.id !== id));
    };

    const updateItem = async (id: number, field: keyof AdjustmentItem, value: any) => {
        // We need to manage async updates carefully inside map
        const newItems = items.map(async (item) => {
            if (item.id !== id) return item;

            const updated = { ...item, [field]: value };

            // Logic for cascading updates
            if (field === 'productId' || field === 'warehouseId') {
                // Reset lot if product or warehouse changes
                updated.lotId = '';
                updated.lotNumber = '';
                updated.currentQty = 0;
                updated.availableLots = [];

                const pid = field === 'productId' ? value : updated.productId;
                const wid = field === 'warehouseId' ? value : updated.warehouseId;

                if (pid && wid) {
                    try {
                        // Fetch lots for this product and warehouse
                        // The API listProductLots usually filters by productId. 
                        // We need to filter client side or API side by warehouse too?
                        // listProductLots({ productId: pid }) and then filter
                        const lots = await listProductLots({ productId: pid });
                        updated.availableLots = lots.filter((l: any) => l.warehouse_id == wid && l.status === 'Active');
                    } catch (e) {
                        console.error("Error fetching lots", e);
                    }
                }

                if (field === 'productId') {
                    const p = products.find(prod => prod.id === Number(value));
                    if (p) updated.productName = p.name;
                }
            }

            if (field === 'lotId') {
                const selectedLot = updated.availableLots.find(l => l.id == value);
                if (selectedLot) {
                    updated.lotNumber = selectedLot.lot_number;
                    updated.currentQty = selectedLot.quantity_remaining;
                }
            }

            return updated;
        });

        // Resolve all promises
        const resolvedItems = await Promise.all(newItems);
        setItems(resolvedItems);
    };

    // Wrapper for synchronous OnChange handling to call async update
    const handleItemChange = (id: number, field: keyof AdjustmentItem, value: any) => {
        updateItem(id, field, value);
    };

    const handleSave = async () => {
        if (items.length === 0) {
            alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
            return;
        }

        // Validate
        for (const item of items) {
            if (!item.productId || !item.warehouseId || !item.quantity || !item.lotId) {
                alert('กรุณากรอกข้อมูลสินค้า คลังสินค้า Lot และจำนวนให้ครบถ้วน');
                return;
            }
            if (item.type === 'reduce' && item.quantity > item.currentQty) {
                alert(`สินค้า ${item.productName} Lot ${item.lotNumber} มีจำนวนไม่พอตัดสต็อก (มีเหลือ ${item.currentQty})`);
                return;
            }
        }

        setSaving(true);
        try {
            const payload = {
                type: 'adjustment' as const,
                transaction_date: docDate,
                notes: docNotes,
                user_id: currentUser?.id,
                items: items.map(item => ({
                    product_id: Number(item.productId),
                    warehouse_id: Number(item.warehouseId),
                    quantity: item.quantity,
                    adjustment_type: item.type,
                    lot_id: Number(item.lotId),
                    remarks: item.remarks
                }))
            };

            const res = await createStockTransaction(payload);
            if (res.success) {
                alert(`บันทึกปรับปรุงสต็อกสำเร็จ เลขที่เอกสาร: ${res.document_number}`);
                setItems([]);
                setDocNotes('');
            } else {
                alert('เกิดข้อผิดพลาด: ' + (res.error || 'Unknown error'));
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 bg-[#F5F5F5] min-h-full">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <ClipboardList className="h-6 w-6 text-orange-600" />
                    ปรับปรุงยอดสต็อก (Stock Adjustment)
                </h2>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded shadow hover:bg-orange-700 disabled:bg-gray-400"
                >
                    <Save className="h-4 w-4" />
                    {saving ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
                </button>
            </div>

            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4 border-b pb-2">ข้อมูลเอกสาร</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รายการ</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="date"
                                className="w-full border rounded pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                value={docDate}
                                onChange={e => setDocDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">สาเหตุ/หมายเหตุ</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                className="w-full border rounded pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="ระบุสาเหตุการปรับปรุง..."
                                value={docNotes}
                                onChange={e => setDocNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold">รายการปรับปรุง</h3>
                    <button
                        onClick={addItem}
                        className="flex items-center gap-1 text-orange-600 hover:text-orange-800 font-medium"
                    >
                        <Plus className="h-4 w-4" /> เพิ่มรายการ
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full min-w-[1000px] border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-y">
                                <th className="py-3 px-4 text-left w-12">#</th>
                                <th className="py-3 px-4 text-left w-64">สินค้า</th>
                                <th className="py-3 px-4 text-left w-40">คลังสินค้า</th>
                                <th className="py-3 px-4 text-left w-48">Lot Number</th>
                                <th className="py-3 px-4 text-left w-32">ประเภท</th>
                                <th className="py-3 px-4 text-right w-24">จำนวน</th>
                                <th className="py-3 px-4 text-left w-48">หมายเหตุ</th>
                                <th className="py-3 px-4 text-center w-12">ลบ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-8 text-center text-gray-400">
                                        ยังไม่มีรายการปรับปรุง กรุณากดปุ่ม "เพิ่มรายการ"
                                    </td>
                                </tr>
                            ) : (
                                items.map((item, index) => (
                                    <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                                        <td className="py-2 px-4">{index + 1}</td>
                                        <td className="py-2 px-4">
                                            <select
                                                className="w-full border rounded px-2 py-1 text-sm"
                                                value={item.productId}
                                                onChange={e => handleItemChange(item.id, 'productId', e.target.value)}
                                            >
                                                <option value="">เลือกสินค้า</option>
                                                {products.map(p => (
                                                    <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2 px-4">
                                            <select
                                                className="w-full border rounded px-2 py-1 text-sm"
                                                value={item.warehouseId}
                                                onChange={e => handleItemChange(item.id, 'warehouseId', e.target.value)}
                                            >
                                                <option value="">เลือกคลัง</option>
                                                {warehouses.map(w => (
                                                    <option key={w.id} value={w.id}>{w.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="py-2 px-4">
                                            <select
                                                className="w-full border rounded px-2 py-1 text-sm"
                                                value={item.lotId}
                                                onChange={e => handleItemChange(item.id, 'lotId', e.target.value)}
                                                disabled={!item.productId || !item.warehouseId}
                                            >
                                                <option value="">เลือก Lot</option>
                                                {item.availableLots.map(l => (
                                                    <option key={l.id} value={l.id}>
                                                        {l.lot_number} (เหลือ {l.quantity_remaining})
                                                    </option>
                                                ))}
                                            </select>
                                            {!item.lotId && item.productId && item.warehouseId && (
                                                <p className="text-xs text-orange-500 mt-1 flex items-center">
                                                    <AlertTriangle className="h-3 w-3 mr-1" /> เลือก Lot ก่อน
                                                </p>
                                            )}
                                        </td>
                                        <td className="py-2 px-4">
                                            <select
                                                className={`w-full border rounded px-2 py-1 text-sm font-medium ${item.type === 'add' ? 'text-green-600' : 'text-red-600'}`}
                                                value={item.type}
                                                onChange={e => handleItemChange(item.id, 'type', e.target.value)}
                                            >
                                                <option value="reduce">ลดยอด (-)</option>
                                                <option value="add">เพิ่มยอด (+)</option>
                                            </select>
                                        </td>
                                        <td className="py-2 px-4">
                                            <input
                                                type="number"
                                                className="w-full border rounded px-2 py-1 text-sm text-right"
                                                value={item.quantity}
                                                onChange={e => handleItemChange(item.id, 'quantity', Number(e.target.value))}
                                                min="1"
                                            />
                                        </td>
                                        <td className="py-2 px-4">
                                            <input
                                                type="text"
                                                className="w-full border rounded px-2 py-1 text-sm"
                                                placeholder="ระบุเหตุผล"
                                                value={item.remarks}
                                                onChange={e => handleItemChange(item.id, 'remarks', e.target.value)}
                                            />
                                        </td>
                                        <td className="py-2 px-4 text-center">
                                            <button
                                                onClick={() => removeItem(item.id)}
                                                className="text-red-500 hover:text-red-700"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default StockAdjustmentPage;
