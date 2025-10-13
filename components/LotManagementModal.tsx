import React, { useState, useEffect } from 'react';
import { Warehouse, Product } from '../types';
import { X, Plus, Trash2, Package, Calendar, DollarSign, FileText } from 'lucide-react';
import { listProductLots, createProductLot, updateProductLot, deleteProductLot } from '@/services/api';

interface Lot {
  id?: number;
  lot_number: string;
  product_id: number;
  warehouse_id: number;
  quantity_received: number;
  quantity_remaining: number;
  purchase_date: string;
  expiry_date?: string;
  unit_cost: number;
  status: 'Active' | 'Depleted' | 'Expired';
  notes?: string;
}

interface LotManagementModalProps {
  product: Product;
  warehouses: Warehouse[];
  onClose: () => void;
  onSave: () => void;
}

const LotManagementModal: React.FC<LotManagementModalProps> = ({ 
  product, 
  warehouses, 
  onClose, 
  onSave 
}) => {
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // โหลดข้อมูล Lot ของสินค้า
  useEffect(() => {
    const loadLots = async () => {
      setLoading(true);
      setError(null);
      try {
        const productLots = await listProductLots({ productId: product.id });
        setLots(productLots);
      } catch (err) {
        console.error('Error loading lots:', err);
        setError('ไม่สามารถโหลดข้อมูล Lot ได้');
      } finally {
        setLoading(false);
      }
    };

    if (product.id) {
      loadLots();
    }
  }, [product.id]);

  // เพิ่ม Lot ใหม่
  const addNewLot = () => {
    const newLot: Lot = {
      lot_number: '',
      product_id: product.id,
      warehouse_id: warehouses.length > 0 ? warehouses[0].id : 1,
      quantity_received: 0,
      quantity_remaining: 0,
      purchase_date: new Date().toISOString().split('T')[0],
      expiry_date: '',
      unit_cost: product.cost || 0,
      status: 'Active',
      notes: ''
    };
    setLots([...lots, newLot]);
  };

  // อัปเดตข้อมูล Lot
  const updateLot = (index: number, field: keyof Lot, value: any) => {
    const updatedLots = [...lots];
    updatedLots[index] = { ...updatedLots[index], [field]: value };
    
    // ถ้าเปลี่ยนจำนวนรับเข้า ให้อัปเดตจำนวนคงเหลือด้วย (ถ้ายังไม่เคยมีการใช้)
    if (field === 'quantity_received' && !updatedLots[index].id) {
      updatedLots[index].quantity_remaining = value;
    }
    
    setLots(updatedLots);
  };

  // ลบ Lot
  const removeLot = (index: number) => {
    setLots(lots.filter((_, i) => i !== index));
  };

  // บันทึกข้อมูล Lot ทั้งหมด
  const handleSave = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // ตรวจสอบข้อมูลก่อนบันทึก
      for (const lot of lots) {
        if (!lot.lot_number || !lot.warehouse_id || lot.quantity_received <= 0) {
          setError('กรุณากรอกข้อมูล Lot ให้ครบถ้วน (Lot Number, คลังสินค้า, จำนวน)');
          setLoading(false);
          return;
        }
      }

      // บันทึก Lot ทั้งหมด
      for (const lot of lots) {
        if (lot.id) {
          // อัปเดต Lot ที่มีอยู่แล้ว
          await updateProductLot(lot.id, lot);
        } else {
          // สร้าง Lot ใหม่
          await createProductLot(lot);
        }
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Error saving lots:', err);
      setError('ไม่สามารถบันทึกข้อมูล Lot ได้');
    } finally {
      setLoading(false);
    }
  };

  // ลบ Lot
  const handleDeleteLot = async (lotId: number) => {
    if (!confirm('คุณต้องการลบ Lot นี้ใช่หรือไม่?')) {
      return;
    }

    try {
      await deleteProductLot(lotId);
      setLots(lots.filter(lot => lot.id !== lotId));
    } catch (err) {
      console.error('Error deleting lot:', err);
      setError('ไม่สามารถลบ Lot ได้');
    }
  };

  // หาชื่อคลังสินค้า
  const getWarehouseName = (warehouseId: number) => {
    const warehouse = warehouses.find(w => w.id === warehouseId);
    return warehouse ? warehouse.name : `คลัง ${warehouseId}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-full max-h-[95vh] flex flex-col">
        <header className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800 flex items-center">
            <Package className="mr-3 text-gray-600"/>
            จัดการ Lot สินค้า: {product.sku} - {product.name}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-medium text-gray-900">รายการ Lot</h3>
            <button
              onClick={addNewLot}
              className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center hover:bg-green-700"
            >
              <Plus size={16} className="mr-2"/>
              เพิ่ม Lot ใหม่
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <p className="mt-2 text-gray-600">กำลังโหลดข้อมูล...</p>
            </div>
          ) : lots.length === 0 ? (
            <div className="text-center py-10 text-gray-500 border-2 border-dashed rounded-lg">
              <Package size={48} className="mx-auto mb-4 text-gray-300"/>
              <p>ยังไม่มีข้อมูล Lot</p>
              <p className="text-sm mt-2">คลิก "เพิ่ม Lot ใหม่" เพื่อเพิ่มข้อมูล Lot ของสินค้า</p>
            </div>
          ) : (
            <div className="space-y-4">
              {lots.map((lot, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-medium text-gray-800">
                      {lot.id ? `Lot: ${lot.lot_number}` : `Lot ใหม่ #${index + 1}`}
                    </h4>
                    <div className="flex space-x-2">
                      {lot.id && (
                        <button
                          onClick={() => handleDeleteLot(lot.id!)}
                          className="text-red-600 hover:text-red-800"
                          title="ลบ Lot"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => removeLot(index)}
                        className="text-gray-600 hover:text-gray-800"
                        title="ลบจากฟอร์ม"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <Package size={16} className="mr-1 text-gray-400"/>
                        Lot Number
                      </label>
                      <input
                        type="text"
                        value={lot.lot_number}
                        onChange={(e) => updateLot(index, 'lot_number', e.target.value)}
                        className="w-full p-2 border rounded-md"
                        placeholder="เช่น LOT-2024-001"
                        disabled={!!lot.id}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">คลังสินค้า</label>
                      <select
                        value={lot.warehouse_id}
                        onChange={(e) => updateLot(index, 'warehouse_id', parseInt(e.target.value))}
                        className="w-full p-2 border rounded-md"
                        disabled={!!lot.id}
                      >
                        {warehouses.map(warehouse => (
                          <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนรับเข้า</label>
                      <input
                        type="number"
                        value={lot.quantity_received}
                        onChange={(e) => updateLot(index, 'quantity_received', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border rounded-md"
                        min="0"
                        disabled={!!lot.id}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <Calendar size={16} className="mr-1 text-gray-400"/>
                        วันที่รับเข้า
                      </label>
                      <input
                        type="date"
                        value={lot.purchase_date}
                        onChange={(e) => updateLot(index, 'purchase_date', e.target.value)}
                        className="w-full p-2 border rounded-md"
                        disabled={!!lot.id}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">วันหมดอายุ</label>
                      <input
                        type="date"
                        value={lot.expiry_date || ''}
                        onChange={(e) => updateLot(index, 'expiry_date', e.target.value)}
                        className="w-full p-2 border rounded-md"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <DollarSign size={16} className="mr-1 text-gray-400"/>
                        ต้นทุนต่อหน่วย
                      </label>
                      <input
                        type="number"
                        value={lot.unit_cost}
                        onChange={(e) => updateLot(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                        className="w-full p-2 border rounded-md"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                      <select
                        value={lot.status}
                        onChange={(e) => updateLot(index, 'status', e.target.value as 'Active' | 'Depleted' | 'Expired')}
                        className="w-full p-2 border rounded-md"
                      >
                        <option value="Active">ใช้งาน</option>
                        <option value="Depleted">หมด</option>
                        <option value="Expired">หมดอายุ</option>
                      </select>
                    </div>
                    
                    <div className="md:col-span-2 lg:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                        <FileText size={16} className="mr-1 text-gray-400"/>
                        หมายเหตุ
                      </label>
                      <textarea
                        value={lot.notes || ''}
                        onChange={(e) => updateLot(index, 'notes', e.target.value)}
                        className="w-full p-2 border rounded-md"
                        rows={2}
                        placeholder="หมายเหตุเพิ่มเติม..."
                      />
                    </div>
                  </div>
                  
                  {lot.id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">จำนวนคงเหลือ:</span>
                        <span className="font-medium">{lot.quantity_remaining}</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-500">คลังสินค้า:</span>
                        <span className="font-medium">{getWarehouseName(lot.warehouse_id)}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="p-4 border-t flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="bg-gray-200 text-gray-700 font-semibold text-sm rounded-md py-2 px-4 hover:bg-gray-300"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-green-600 text-white font-semibold text-sm rounded-md py-2 px-4 hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default LotManagementModal;