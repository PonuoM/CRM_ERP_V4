import React, { useEffect, useState } from 'react';
import { PackagePlus, Plus, Trash2, Save, Calendar, FileText, Search, Image as ImageIcon } from 'lucide-react';
import { User, Warehouse, Product } from '@/types';
import { listWarehouses, listProducts, listProductLots, createStockTransaction } from '@/services/api';

interface ReceiveStockPageProps {
  currentUser?: User;
  companyId?: number;
}

interface StockItem {
  id: number;
  productId: number | '';
  productName: string;
  warehouseId: number | '';
  lotSelection: 'new' | 'existing';
  lotNumber: string; // New or Existing ID
  existingLotId?: number;
  quantity: number;
  unitCost: number;
  mfgDate: string;
  expDate: string;
  remarks: string;
  lotsList?: any[]; // Cached lots for the product
}

const ReceiveStockPage: React.FC<ReceiveStockPageProps> = ({ currentUser, companyId }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Document Header
  const [docDate, setDocDate] = useState(new Date().toISOString().split('T')[0]);
  const [docNumber, setDocNumber] = useState(''); // Optional manual override
  const [docNotes, setDocNotes] = useState('');

  // Items
  const [items, setItems] = useState<StockItem[]>([]);
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
      lotSelection: 'new',
      lotNumber: '',
      quantity: 1,
      unitCost: 0,
      mfgDate: '',
      expDate: '',
      remarks: ''
    }]);
  };

  const removeItem = (id: number) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id: number, field: keyof StockItem, value: any) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };

        // If product changes, populate cost and name
        if (field === 'productId') {
          const p = products.find(prod => prod.id === Number(value));
          if (p) {
            updated.productName = p.name;
            updated.unitCost = p.cost || 0;
            // Ideally load lots here if 'existing' selected
          }
        }
        return updated;
      }
      return item;
    }));
  };

  const handleSave = async () => {
    if (items.length === 0) {
      alert('กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ');
      return;
    }

    // Validate
    for (const item of items) {
      if (!item.productId || !item.warehouseId || !item.quantity) {
        alert('กรุณากรอกข้อมูลสินค้า คลังสินค้า และจำนวนให้ครบถ้วน');
        return;
      }
      if (item.lotSelection === 'new' && !item.lotNumber) {
        alert('กรุณาระบุเลข Lot สำหรับสินค้าใหม่');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        type: 'receive' as const,
        transaction_date: docDate,
        notes: docNotes,
        document_number_manual: docNumber,
        user_id: currentUser?.id,
        items: items.map(item => ({
          product_id: Number(item.productId),
          warehouse_id: Number(item.warehouseId),
          quantity: item.quantity,
          adjustment_type: 'receive' as const,
          new_lot_number: item.lotSelection === 'new' ? item.lotNumber : undefined,
          lot_id: item.lotSelection === 'existing' ? Number(item.existingLotId) : undefined,
          cost_price: item.unitCost,
          mfg_date: item.mfgDate || undefined,
          exp_date: item.expDate || undefined,
          remarks: item.remarks
        }))
      };

      const res = await createStockTransaction(payload);
      if (res.success) {
        alert(`บันทึกรับสินค้าสำเร็จ เลขที่เอกสาร: ${res.document_number}`);
        setItems([]);
        setDocNotes('');
        setDocNumber('');
        // Maybe redirect?
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
          <PackagePlus className="h-6 w-6 text-blue-600" />
          รับสินค้าเข้าคลัง (Receive Stock)
        </h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 disabled:bg-gray-400"
        >
          <Save className="h-4 w-4" />
          {saving ? 'กำลังบันทึก...' : 'บันทึกเอกสาร'}
        </button>
      </div>

      {/* Header Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 border-b pb-2">ข้อมูลเอกสาร</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">เลขที่เอกสาร (ถ้ามี)</label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Auto Generate"
              value={docNumber}
              onChange={e => setDocNumber(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">เว้นว่างไว้เพื่อรันเลขเอกสารอัตโนมัติ</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับสินค้า</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุเอกสาร</label>
            <div className="relative">
              <FileText className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                className="w-full border rounded pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="ระบุหมายเหตุ..."
                value={docNotes}
                onChange={e => setDocNotes(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">รายการสินค้า</h3>
          <button
            onClick={addItem}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
          >
            <Plus className="h-4 w-4" /> เพิ่มรายสินค้า
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
                <th className="py-3 px-4 text-right w-24">จำนวน</th>
                <th className="py-3 px-4 text-right w-24">ต้นทุน</th>
                <th className="py-3 px-4 text-left w-32">วันหมดอายุ</th>
                <th className="py-3 px-4 text-center w-12">ลบ</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    ยังไม่มีรายการสินค้า กรุณากดปุ่ม "เพิ่มรายสินค้า"
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
                        onChange={e => updateItem(item.id, 'productId', e.target.value)}
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
                        onChange={e => updateItem(item.id, 'warehouseId', e.target.value)}
                      >
                        <option value="">เลือกคลัง</option>
                        {warehouses.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex flex-col gap-1">
                        <select
                          className="border rounded px-2 py-1 text-xs mb-1"
                          value={item.lotSelection}
                          onChange={e => updateItem(item.id, 'lotSelection', e.target.value)}
                        >
                          <option value="new">สร้าง Lot ใหม่</option>
                          {/* Future: Add option for Existing Lot if supported */}
                        </select>
                        {item.lotSelection === 'new' && (
                          <input
                            type="text"
                            className="border rounded px-2 py-1 text-sm"
                            placeholder="ระบุเลข Lot"
                            value={item.lotNumber}
                            onChange={e => updateItem(item.id, 'lotNumber', e.target.value)}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        className="w-full border rounded px-2 py-1 text-sm text-right"
                        value={item.quantity}
                        onChange={e => updateItem(item.id, 'quantity', Number(e.target.value))}
                        min="1"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        className="w-full border rounded px-2 py-1 text-sm text-right"
                        value={item.unitCost}
                        onChange={e => updateItem(item.id, 'unitCost', Number(e.target.value))}
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="date"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={item.expDate}
                        onChange={e => updateItem(item.id, 'expDate', e.target.value)}
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

export default ReceiveStockPage;
