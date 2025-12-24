import React, { useEffect, useState } from 'react';
import { PackagePlus, Plus, Trash2, Save, Calendar, X, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { User, Warehouse, Product } from '@/types';
import { listWarehouses, listProducts, createStockTransaction, getProductStockLocations, getStockTransaction, updateStockTransaction } from '@/services/api';

interface StockItem {
    id: number;
    productId: number | '';
    productName: string;
    warehouseId: number | '';
    warehouseName: string;
    lotSelection: 'new' | 'existing';
    lotNumber: string;
    existingLotId?: number;
    quantity: number;
    unitCost: number;
    mfgDate: string;
    expDate: string;
    remarks: string;
    availableLots: any[];
    rawStockData?: any[];
}

interface ReceiveStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    currentUser?: User;
    companyId?: number;
    editTransactionId?: number | null;
    readonly?: boolean;
}

const ReceiveStockModal: React.FC<ReceiveStockModalProps> = ({
    isOpen, onClose, onSuccess, currentUser, companyId, editTransactionId, readonly = false
}) => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [products, setProducts] = useState<Product[]>([]);

    // Document Header
    const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
    const [docNumber, setDocNumber] = useState('');
    const [docNotes, setDocNotes] = useState('');

    // Images
    const [images, setImages] = useState<string[]>([]);
    const [existingImages, setExistingImages] = useState<any[]>([]); // For display

    // Items
    const [items, setItems] = useState<StockItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [loadingData, setLoadingData] = useState(false);

    const effectiveCompanyId = companyId ?? currentUser?.companyId ?? 1;

    useEffect(() => {
        if (isOpen) {
            setItems([]);
            setImages([]);
            setExistingImages([]);
            setDocDate(new Date().toISOString().split('T')[0]);
            setDocNumber('');
            setDocNotes('');

            Promise.all([
                listWarehouses(effectiveCompanyId),
                listProducts()
            ]).then(([whs, prods]) => {
                setWarehouses(whs as any);
                setProducts(prods);

                if (editTransactionId) {
                    loadTransactionData(editTransactionId, whs as any, prods);
                } else {
                    if (!readonly) {
                        addItem();
                        addItem();
                    }
                }
            });
        }
    }, [isOpen, effectiveCompanyId, editTransactionId, readonly]);

    const loadTransactionData = async (id: number, whs: Warehouse[], prods: Product[]) => {
        setLoadingData(true);
        try {
            const res = await getStockTransaction(id);
            if (res.success && res.data) {
                const head = res.data.header;
                setDocNumber(head.document_number);
                setDocDate(head.transaction_date.split('T')[0]);
                setDocNotes(head.notes || '');

                setExistingImages(res.data.images || []);

                const loadedItems: StockItem[] = await Promise.all(res.data.items.map(async (i: any) => {
                    const prod = prods.find(p => p.id === i.product_id);
                    const wh = whs.find(w => w.id === i.warehouse_id);

                    // If readonly, we don't strictly need available lots for logic, but helpful for display consistency?
                    // Actually for readonly we just display the text.

                    let availableLots: any[] = [];
                    let rawStockData: any[] = [];

                    if (!readonly) {
                        try {
                            const stockRes = await getProductStockLocations(i.product_id);
                            if (stockRes.success) {
                                rawStockData = stockRes.data;
                                const whData = rawStockData.find((w: any) => w.id == i.warehouse_id);
                                if (whData) availableLots = whData.lots;
                            }
                        } catch (e) { console.error(e); }
                    }

                    return {
                        id: Math.random(),
                        productId: i.product_id,
                        productName: prod ? `${prod.sku} - ${prod.name}` : 'Unknown Product',
                        warehouseId: i.warehouse_id,
                        warehouseName: wh ? wh.name : 'Unknown Warehouse',
                        lotSelection: i.lot_id ? 'existing' : 'new',
                        lotNumber: i.lot_number || '',
                        existingLotId: i.lot_id || undefined,
                        quantity: Number(i.quantity),
                        unitCost: Number(i.cost_price || 0),
                        mfgDate: i.mfg_date || '',
                        expDate: i.exp_date || '',
                        remarks: i.remarks || '',
                        availableLots,
                        rawStockData
                    };
                }));

                setItems(loadedItems);

            }
        } catch (error) {
            console.error(error);
            alert("Failed to load transaction data");
            onClose();
        } finally {
            setLoadingData(false);
        }
    }

    const addItem = () => {
        setItems(prev => [...prev, {
            id: Date.now() + Math.random(),
            productId: '',
            productName: '',
            warehouseId: warehouses.length > 0 ? warehouses[0].id : '',
            warehouseName: warehouses.length > 0 ? warehouses[0].name : '',
            lotSelection: 'new',
            lotNumber: '',
            quantity: 0,
            unitCost: 0,
            mfgDate: '',
            expDate: '',
            remarks: '',
            availableLots: []
        }]);
    };

    const removeItem = (id: number) => {
        setItems(items.filter(i => i.id !== id));
    };

    const handleKeyDown = (
        e: React.KeyboardEvent<HTMLInputElement>,
        id: number,
        field: 'productName' | 'warehouseName',
        value: string
    ) => {
        if (readonly) return;
        if (e.key === 'Tab') {
            const lowerVal = value.toLowerCase();
            if (!lowerVal) return;

            if (field === 'productName') {
                const matches = products.filter(p => `${p.sku} - ${p.name}`.toLowerCase().includes(lowerVal));
                if (matches.length === 1) {
                    const match = matches[0];
                    const fullName = `${match.sku} - ${match.name}`;
                    if (value !== fullName) {
                        updateItemFields(id, { productName: fullName });
                    }
                }
            } else if (field === 'warehouseName') {
                const matches = warehouses.filter(w => w.name.toLowerCase().includes(lowerVal));
                if (matches.length === 1) {
                    const match = matches[0];
                    if (value !== match.name) {
                        updateItemFields(id, { warehouseName: match.name });
                    }
                }
            }
        }
    };

    const updateItemFields = async (id: number, updates: Partial<StockItem>) => {
        if (readonly) return;

        setItems(prev => prev.map(item => {
            if (item.id === id) return { ...item, ...updates };
            return item;
        }));

        let updated = { ...items.find(i => i.id === id)!, ...updates };

        if ('productName' in updates) {
            const value = updates.productName;
            const match = products.find(p => `${p.sku} - ${p.name}` === value);

            if (match) {
                updated.productId = match.id;
                updated.unitCost = match.cost || 0;
                updated.lotSelection = 'new';
                updated.lotNumber = '';
                updated.availableLots = [];

                getProductStockLocations(match.id).then(res => {
                    if (res.success) {
                        setItems(currentItems => currentItems.map(i => {
                            if (i.id === id) {
                                const newData = res.data;
                                let newLots = [];
                                if (i.warehouseId) {
                                    const wh = newData.find((w: any) => w.id == i.warehouseId);
                                    newLots = wh ? wh.lots : [];
                                }
                                return { ...i, ['rawStockData']: newData, availableLots: newLots };
                            }
                            return i;
                        }));
                    }
                }).catch(console.error);

            } else {
                updated.productId = '';
                updated.availableLots = [];
                updated['rawStockData'] = [];
            }
        }

        if ('warehouseName' in updates) {
            const value = updates.warehouseName;
            const match = warehouses.find(w => w.name === value);
            if (match) {
                updated.warehouseId = match.id;
            } else {
                updated.warehouseId = '';
            }
        }

        if (updated.rawStockData && updated.warehouseId) {
            const wh = updated.rawStockData.find((w: any) => w.id == updated.warehouseId);
            updated.availableLots = wh ? wh.lots : [];
        } else if (!updated.rawStockData || !updated.warehouseId) {
            if (!('productName' in updates)) {
                updated.availableLots = [];
            }
        }

        if ('existingLotId' in updates) {
            const value = updates.existingLotId;
            if (value) {
                const lot = updated.availableLots.find(l => l.id == value);
                if (lot) {
                    updated.lotNumber = lot.lot_number;
                }
            }
        }

        setItems(prev => prev.map(item => item.id === id ? updated : item));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (readonly) return;
        if (e.target.files) {
            Array.from(e.target.files).forEach((file: File) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const handleSave = async () => {
        if (readonly) return;
        const validItems = items.filter(i => i.productId && i.quantity > 0);
        if (validItems.length === 0) return alert("กรุณาระบุรายการสินค้าอย่างน้อย 1 รายการ");

        setSaving(true);
        try {
            const payload = {
                type: 'receive' as const,
                transaction_date: docDate,
                notes: docNotes,
                document_number_manual: docNumber,
                user_id: currentUser?.id,
                images: images,
                items: validItems.map(item => ({
                    product_id: Number(item.productId),
                    warehouse_id: Number(item.warehouseId),
                    quantity: item.quantity,
                    adjustment_type: 'receive' as const,
                    new_lot_number: item.lotSelection === 'new' ? item.lotNumber : undefined,
                    lot_id: item.lotSelection === 'existing' ? item.existingLotId : undefined,
                    cost_price: item.unitCost,
                    mfg_date: item.mfgDate || undefined,
                    exp_date: item.expDate || undefined,
                    remarks: item.remarks
                }))
            };

            let res;
            if (editTransactionId) {
                res = await updateStockTransaction({ ...payload, id: editTransactionId });
            } else {
                res = await createStockTransaction(payload);
            }

            if (res.success) {
                alert(`${editTransactionId ? 'แก้ไข' : 'บันทึก'}สำเร็จ`);
                onSuccess();
                onClose();
            } else {
                alert('Error: ' + (res.error || 'Unknown'));
            }
        } catch (err: any) {
            alert('Error: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4 transition-opacity">
            <div className="bg-[#F8F9FC] rounded-xl shadow-2xl w-full max-w-[95%] h-[90vh] flex flex-col overflow-hidden font-sans">

                {/* Header */}
                <div className="bg-white px-6 py-4 border-b flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <PackagePlus className="h-6 w-6 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {readonly ? 'รายละเอียดการรับสินค้า' : (editTransactionId ? `แก้ไขรายการรับสินค้า` : `รับสินค้าเข้า (Receive Stock)`)}
                        </h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {loadingData ? (
                    <div className="flex-1 flex items-center justify-center flex-col text-gray-500 gap-3">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span>กำลังโหลดข้อมูล...</span>
                    </div>
                ) : (
                    <>
                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">

                            {/* Top Section: Split Info & Upload */}
                            <div className="grid grid-cols-12 gap-6">
                                {/* Left: Document Info (Card) */}
                                <div className="col-span-12 lg:col-span-8 bg-white p-5 rounded-xl border shadow-sm">
                                    <div className="flex items-center gap-2 mb-4 text-blue-800 bg-blue-50 w-fit px-3 py-1 rounded-full">
                                        <FileText className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">ข้อมูลเอกสาร</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-5 mb-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">เลขที่เอกสาร</label>
                                            <input
                                                type="text"
                                                className={`w-full bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all ${editTransactionId || readonly ? 'cursor-not-allowed text-gray-400' : ''}`}
                                                placeholder="Auto Generate"
                                                value={docNumber}
                                                onChange={e => setDocNumber(e.target.value)}
                                                disabled={!!editTransactionId || readonly}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">วันที่</label>
                                            <div className="relative">
                                                <input
                                                    type="date"
                                                    className={`w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none transition-all font-medium ${readonly ? 'bg-gray-50 text-gray-500' : 'focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}`}
                                                    value={docDate}
                                                    onChange={e => setDocDate(e.target.value)}
                                                    disabled={readonly}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase">หมายเหตุ (Document Remarks)</label>
                                        <input
                                            type="text"
                                            className={`w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm outline-none transition-all ${readonly ? 'bg-gray-50 text-gray-500' : 'focus:ring-2 focus:ring-blue-100 focus:border-blue-400'}`}
                                            placeholder="ระบุหมายเหตุเพิ่มเติมของเอกสาร..."
                                            value={docNotes}
                                            onChange={e => setDocNotes(e.target.value)}
                                            disabled={readonly}
                                        />
                                    </div>
                                </div>

                                {/* Right: Attachments (Card) */}
                                <div className="col-span-12 lg:col-span-4 bg-white p-5 rounded-xl border shadow-sm flex flex-col">
                                    <div className="flex items-center gap-2 mb-4 text-blue-800 bg-blue-50 w-fit px-3 py-1 rounded-full">
                                        <Upload className="h-4 w-4" />
                                        <span className="text-xs font-bold uppercase tracking-wider">เอกสารแนบ</span>
                                    </div>

                                    <div className={`flex-1 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 group relative overflow-hidden ${!readonly ? 'hover:bg-white hover:border-blue-300 transition-all' : ''}`}>
                                        {!readonly && (
                                            <input type="file" multiple accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                                        )}

                                        {images.length === 0 && existingImages.length === 0 ? (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                                <div className={`bg-white p-3 rounded-full shadow-sm mb-3 ${!readonly ? 'group-hover:scale-110 transition-transform' : ''}`}>
                                                    <ImageIcon className="h-6 w-6 text-blue-400" />
                                                </div>
                                                <span className="text-xs font-medium">{readonly ? 'No Attachments' : 'Click to upload image'}</span>
                                            </div>
                                        ) : (
                                            <div className="p-2 grid grid-cols-3 gap-2 overflow-y-auto max-h-[160px]">
                                                {/* Existing Images */}
                                                {existingImages.map((img, idx) => (
                                                    <div key={`exist-${idx}`} className="relative aspect-square rounded overflow-hidden border cursor-pointer hover:opacity-80" onClick={() => window.open(img.image_path.startsWith('http') || img.image_path.includes('base64') ? img.image_path : `../../${img.image_path}`, '_blank')}>
                                                        <img src={img.image_path.startsWith('http') || img.image_path.includes('base64') ? img.image_path : `../../${img.image_path}`} className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                                {/* New Images */}
                                                {images.map((img, idx) => (
                                                    <div key={`new-${idx}`} className="relative aspect-square rounded overflow-hidden border cursor-pointer hover:opacity-80" onClick={() => window.open(img, '_blank')}>
                                                        <img src={img} className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                                {!readonly && (
                                                    <div className="flex items-center justify-center bg-gray-100 rounded text-gray-400">
                                                        <Plus className="h-6 w-6" />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Middle Section: Items Table */}
                            <div className="bg-white rounded-xl border shadow-sm flex flex-col min-h-[400px]">

                                {/* Table Header Controls */}
                                <div className="px-6 py-4 border-b flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-gray-800">รายการสินค้า (Items)</h3>
                                        <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full font-medium">{items.length} รายการ</span>
                                    </div>
                                    {!readonly && (
                                        <button
                                            onClick={addItem}
                                            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                                        >
                                            <Plus className="h-4 w-4" /> เพิ่มแถว
                                        </button>
                                    )}
                                </div>

                                {/* Table */}
                                <div className="flex-1 overflow-x-auto">
                                    <table className="w-full min-w-[1200px] text-sm text-left border-collapse table-fixed">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-500 text-xs font-bold uppercase tracking-wide border-b border-gray-200">
                                                <th className="w-10 px-0 py-2 text-center border border-gray-200">#</th>
                                                <th className="w-[30%] px-3 py-2 text-left border border-gray-200">สินค้า (Item)</th>
                                                <th className="w-[18%] px-3 py-2 text-left border border-gray-200">คลัง (Warehouse)</th>
                                                <th className="w-[18%] px-3 py-2 text-left border border-gray-200">Lot Number</th>
                                                <th className="w-[10%] px-3 py-2 text-right border border-gray-200">จำนวน (Qty)</th>
                                                <th className="px-3 py-2 text-left border border-gray-200">หมายเหตุ (Remarks)</th>
                                                {!readonly && <th className="w-10 px-0 py-2 text-center border border-gray-200"></th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {items.map((item, idx) => (
                                                <tr key={item.id} className="group hover:bg-gray-50/50 transition-colors">
                                                    <td className="w-10 text-center text-xs text-gray-500 bg-gray-50/30 border border-gray-200">{idx + 1}</td>

                                                    {/* Product Input (Datalist) */}
                                                    <td className="p-0 h-10 border border-gray-200">
                                                        <div className="relative w-full h-full">
                                                            <input
                                                                list="products-list-receive"
                                                                value={item.productName}
                                                                onChange={e => updateItemFields(item.id, { productName: e.target.value })}
                                                                className={`w-full h-full px-3 py-2 bg-transparent text-sm border-none outline-none ${readonly ? 'text-gray-600' : 'focus:ring-2 focus:ring-blue-500 focus:bg-white focus:z-10 placeholder-gray-400'}`}
                                                                placeholder="ค้นหาสินค้า..."
                                                                onKeyDown={(e) => handleKeyDown(e, item.id, 'productName', item.productName)}
                                                                disabled={readonly}
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* Warehouse Input (Datalist) */}
                                                    <td className="p-0 h-10 border border-gray-200">
                                                        <div className="relative w-full h-full">
                                                            <input
                                                                list="warehouses-list-global"
                                                                value={item.warehouseName}
                                                                onChange={e => updateItemFields(item.id, { warehouseName: e.target.value })}
                                                                className={`w-full h-full px-3 py-2 bg-transparent text-sm border-none outline-none ${readonly ? 'text-gray-600' : 'focus:ring-2 focus:ring-blue-500 focus:bg-white focus:z-10 placeholder-gray-400'}`}
                                                                placeholder="เลือกคลัง..."
                                                                onKeyDown={(e) => handleKeyDown(e, item.id, 'warehouseName', item.warehouseName)}
                                                                disabled={readonly}
                                                            />
                                                        </div>
                                                    </td>

                                                    {/* Smart Lot Input (Datalist) */}
                                                    <td className="p-0 h-10 border border-gray-200">
                                                        <input
                                                            list={`lots-${item.id}`}
                                                            type="text"
                                                            className={`w-full h-full px-3 py-2 bg-transparent text-sm border-none outline-none ${readonly ? 'text-gray-600' : 'focus:ring-2 focus:ring-blue-500 focus:bg-white focus:z-10 placeholder-gray-400'}`}
                                                            placeholder="ระบุ Lot"
                                                            value={item.lotSelection === 'existing' ? (item.availableLots.find(l => l.id === item.existingLotId)?.lot_number || item.lotNumber) : item.lotNumber}
                                                            onChange={e => {
                                                                const val = e.target.value;
                                                                const match = item.availableLots.find(l => l.lot_number === val);

                                                                if (match) {
                                                                    updateItemFields(item.id, {
                                                                        existingLotId: match.id,
                                                                        lotSelection: 'existing',
                                                                        lotNumber: val
                                                                    });
                                                                } else {
                                                                    updateItemFields(item.id, {
                                                                        lotNumber: val,
                                                                        lotSelection: 'new',
                                                                        existingLotId: undefined
                                                                    });
                                                                }
                                                            }}
                                                            disabled={readonly}
                                                        />
                                                        {!readonly && (
                                                            <datalist id={`lots-${item.id}`}>
                                                                {item.availableLots.map(l => (
                                                                    <option key={l.id} value={l.lot_number}>{`Exp: ${l.exp_date}`}</option>
                                                                ))}
                                                            </datalist>
                                                        )}
                                                    </td>

                                                    {/* Qty Input */}
                                                    <td className="p-0 h-10 border border-gray-200">
                                                        <input
                                                            type="number"
                                                            className={`w-full h-full px-3 py-2 text-right bg-transparent text-sm border-none outline-none font-medium ${readonly ? 'text-gray-800' : 'focus:ring-2 focus:ring-blue-500 focus:bg-white focus:z-10'}`}
                                                            placeholder="0"
                                                            min="0"
                                                            value={item.quantity || ''}
                                                            onChange={e => updateItemFields(item.id, { quantity: Number(e.target.value) })}
                                                            onFocus={e => !readonly && e.target.select()}
                                                            disabled={readonly}
                                                        />
                                                    </td>

                                                    {/* Remarks Input */}
                                                    <td className="p-0 h-10 border border-gray-200">
                                                        <input
                                                            type="text"
                                                            className={`w-full h-full px-3 py-2 bg-transparent text-sm border-none outline-none ${readonly ? 'text-gray-600' : 'focus:ring-2 focus:ring-blue-500 focus:bg-white focus:z-10 placeholder-gray-400'}`}
                                                            placeholder="ระบุหมายเหตุ"
                                                            value={item.remarks}
                                                            onChange={e => updateItemFields(item.id, { remarks: e.target.value })}
                                                            disabled={readonly}
                                                        />
                                                    </td>

                                                    {!readonly && (
                                                        <td className="p-0 border border-gray-200 text-center align-middle">
                                                            <button
                                                                onClick={() => removeItem(item.id)}
                                                                className="w-full h-full flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    )}
                                                </tr>
                                            ))}
                                            {/* Empty Row Placeholder */}
                                            {[...Array(Math.max(0, 5 - items.length))].map((_, i) => (
                                                <tr key={`empty-${i}`}>
                                                    <td className="py-3 px-4 text-center text-gray-200 text-xs border border-gray-200 border-dashed">{items.length + i + 1}</td>
                                                    <td className="py-3 px-4 text-gray-300 italic text-xs border border-gray-200 border-dashed">-</td>
                                                    <td className="py-3 px-4 text-gray-300 italic text-xs border border-gray-200 border-dashed">-</td>
                                                    <td className="py-3 px-4 border border-gray-200 border-dashed"></td>
                                                    <td className="py-3 px-4 border border-gray-200 border-dashed"></td>
                                                    <td className="py-3 px-4 border border-gray-200 border-dashed"></td>
                                                    {!readonly && <td className="py-3 px-4 border border-gray-200 border-dashed"></td>}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Bottom Add Button */}
                                {!readonly && (
                                    <div className="p-4 border-t bg-gray-50 flex justify-center">
                                        <button
                                            onClick={addItem}
                                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                                        >
                                            <Plus className="h-4 w-4 rounded-full border border-blue-600 p-0.5" />
                                            เพิ่มรายการสินค้าใหม่
                                        </button>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Footer Actions */}
                        <div className="bg-white border-t px-6 py-4 flex justify-end gap-3 shrink-0">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                            >
                                {readonly ? 'ปิด' : 'ยกเลิก'}
                            </button>
                            {!readonly && (
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-md flex items-center gap-2 transition-all disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    {saving ? (editTransactionId ? 'กำลังแก้ไข...' : 'บันทึก...') : (editTransactionId ? 'บันทึกการแก้ไข' : 'บันทึกรับสินค้า')}
                                </button>
                            )}
                        </div>

                        {/* Global Datalists */}
                        <datalist id="products-list-receive">
                            {products.map(p => <option key={p.id} value={`${p.sku} - ${p.name}`} />)}
                        </datalist>
                        <datalist id="warehouses-list-global">
                            {warehouses.map(w => <option key={w.id} value={w.name} />)}
                        </datalist>

                    </>
                )}

            </div>
        </div>
    );
};

export default ReceiveStockModal;
