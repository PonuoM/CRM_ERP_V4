import React, { useEffect, useMemo, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import { User, Warehouse, Product } from '@/types';
import { listWarehouses, listProducts, listWarehouseStocks } from '@/services/api';

interface ReceiveStockPageProps {
  currentUser?: User;
  companyId?: number;
}

const ReceiveStockPage: React.FC<ReceiveStockPageProps> = ({ currentUser, companyId }) => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | ''>('');
  const [selectedProduct, setSelectedProduct] = useState<number | ''>('');
  const [lotNumber, setLotNumber] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveCompanyId = companyId ?? currentUser?.companyId ?? 1;

  const loadWarehouses = async () => {
    const [whs, prods] = await Promise.all([
      listWarehouses(effectiveCompanyId),
      listProducts(),
    ]);
    setWarehouses(whs as any);
    setProducts(prods);
  };

  useEffect(() => { loadWarehouses(); }, [effectiveCompanyId]);

  const onReceive = async () => {
    if (!selectedWarehouse || !selectedProduct || !lotNumber || !quantity) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setSaving(true);
    try {
      // In a real implementation, you would:
      // 1. Create a product lot record
      // 2. Update warehouse_stocks with the new lot
      // 3. Create a stock movement record
      
      // For now, we'll just log the data
      console.log('Receiving stock:', {
        warehouseId: selectedWarehouse,
        productId: selectedProduct,
        lotNumber,
        quantity: parseInt(quantity),
        purchaseDate,
        expiryDate,
        unitCost: parseFloat(unitCost),
        notes
      });
      
      alert('รับสินค้าเข้าคลังสำเร็จ');
      
      // Reset form
      setSelectedWarehouse('');
      setSelectedProduct('');
      setLotNumber('');
      setQuantity('');
      setExpiryDate('');
      setUnitCost('');
      setNotes('');
    } catch (e: any) {
      alert(e?.message || 'รับสินค้าไม่สำเร็จ');
    } finally { 
      setSaving(false); 
    }
  };

  return (
    <div className="p-6 bg-[#F5F5F5] min-h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-800 flex items-center">
          <PackagePlus className="h-5 w-5 mr-2"/>
          รับสินค้าเข้าคลัง
        </h2>
      </div>

      <div className="bg-white rounded-md shadow p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">คลังสินค้า</label>
            <select 
              className="w-full border rounded px-3 py-2" 
              value={selectedWarehouse} 
              onChange={e => setSelectedWarehouse(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- เลือกคลังสินค้า --</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">สินค้า</label>
            <select 
              className="w-full border rounded px-3 py-2" 
              value={selectedProduct} 
              onChange={e => setSelectedProduct(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">-- เลือกสินค้า --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lot Number</label>
            <input 
              type="text" 
              className="w-full border rounded px-3 py-2" 
              placeholder="เช่น LOT-2024-001"
              value={lotNumber}
              onChange={e => setLotNumber(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">จำนวน</label>
            <input 
              type="number" 
              className="w-full border rounded px-3 py-2" 
              placeholder="0"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              min="0"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่รับเข้า</label>
            <input 
              type="date" 
              className="w-full border rounded px-3 py-2" 
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุ</label>
            <input 
              type="date" 
              className="w-full border rounded px-3 py-2" 
              value={expiryDate}
              onChange={e => setExpiryDate(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ต้นทุนต่อหน่วย</label>
            <input 
              type="number" 
              className="w-full border rounded px-3 py-2" 
              placeholder="0.00"
              value={unitCost}
              onChange={e => setUnitCost(e.target.value)}
              min="0"
              step="0.01"
            />
          </div>
          
          <div className="md:col-span-2 lg:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
            <textarea 
              className="w-full border rounded px-3 py-2" 
              rows={3}
              placeholder="หมายเหตุเพิ่มเติม..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
            ></textarea>
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 mt-4">
          <button 
            className="px-3 py-2 rounded border" 
            onClick={() => {
              setSelectedWarehouse('');
              setSelectedProduct('');
              setLotNumber('');
              setQuantity('');
              setExpiryDate('');
              setUnitCost('');
              setNotes('');
            }} 
            disabled={saving}
          >
            ยกเลิก
          </button>
          <button 
            className="px-3 py-2 rounded bg-[#2E7D32] text-white" 
            onClick={onReceive} 
            disabled={saving}
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึกการรับเข้า'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReceiveStockPage;

