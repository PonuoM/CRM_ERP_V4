import React, { useState, useEffect, useMemo } from 'react';
import { Warehouse, Product } from '../types';
import { X, Plus, Trash2, Package, Calendar, DollarSign, FileText, Search, Filter } from 'lucide-react';
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

  // Filter State
  const [filterWarehouseId, setFilterWarehouseId] = useState<number | ''>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

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

  // Apply Filters
  const filteredLots = useMemo(() => {
    return lots.filter(lot => {
      // 1. Filter by Warehouse
      if (filterWarehouseId !== '' && lot.warehouse_id !== filterWarehouseId) {
        return false;
      }
      // 2. Filter by Status
      if (filterStatus !== '' && lot.status !== filterStatus) {
        return false;
      }
      // 3. Filter by Search Term (Lot Number)
      if (searchTerm && !lot.lot_number.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [lots, filterWarehouseId, filterStatus, searchTerm]);

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

    // Reset filters to show the new lot if hidden?
    // Or just let it be added to the list. If it doesn't match filter, it might disappear from view (which can be confusing).
    // Let's clear filters when adding new lot to ensure it's seen.
    if (filterWarehouseId !== '' || filterStatus !== '' || searchTerm !== '') {
      // Optional: decide if we want to clear filters or pre-fill the new lot with filter values.
      // Pre-fill might be better UX.
      if (typeof filterWarehouseId === 'number') {
        newLot.warehouse_id = filterWarehouseId;
      }
    }
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

      // บันทึก Lot ทั้งหมด (เฉพาะที่ถูกแก้ไขหรือสร้างใหม่ จริงๆควรเช็ค diff แต่ API น่าจะรับได้)
      // Note: listProductLots return all lots. Re-saving all might be inefficient if list is huge, 
      // but for now it ensures consistency.
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
        <header className="flex justify-between items-center p-4 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <Package className="mr-3 text-blue-600" />
              จัดการ Lot สินค้า: {product.sku}
            </h2>
            <p className="text-sm text-gray-500 ml-9">{product.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-white rounded-full p-1 hover:bg-gray-200 transition-colors">
            <X size={24} />
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 m-4 mb-0">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="p-4 bg-white border-b space-y-3">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1">ค้นหา Lot Number</label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาเลข Lot..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
            <div className="w-[200px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1">คลังสินค้า</label>
              <select
                value={filterWarehouseId}
                onChange={(e) => setFilterWarehouseId(e.target.value ? Number(e.target.value) : '')}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">ทั้งหมด</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-semibold text-gray-500 mb-1">สถานะ</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">ทั้งหมด</option>
                <option value="Active">ใช้งาน (Active)</option>
                <option value="Depleted">หมด (Depleted)</option>
                <option value="Expired">หมดอายุ (Expired)</option>
              </select>
            </div>
            <button
              onClick={addNewLot}
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-green-700 font-medium shadow-sm h-[38px]"
            >
              <Plus size={18} className="mr-1.5" />
              เพิ่ม Lot ใหม่
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-700">รายการ Lot ({filteredLots.length})</h3>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-3 text-gray-500 text-sm">กำลังโหลดข้อมูล...</p>
            </div>
          ) : filteredLots.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-xl bg-white">
              <Package size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">ไม่พบข้อมูล Lot ตามเงื่อนไข</p>
              <p className="text-sm mt-1 text-gray-400">ลองปรับตัวกรอง หรือคลิก "เพิ่ม Lot ใหม่"</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredLots.map((lot, index) => {
                // Find functionality index in original array if needed, but managing state locally via ID or mapped index
                // Here we map over filteredLots. Updating filtered items needs to update original 'lots'.
                // We need to know the index in the original 'lots' array to update correctly.
                const originalIndex = lots.findIndex(l => l === lot); // Simple object reference check works if not mutated deeply elsewhere

                return (
                  <div key={index} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-800 flex items-center gap-2">
                        <span className="bg-gray-100 px-2 py-0.5 rounded text-sm border font-mono">
                          {lot.id ? lot.lot_number : `New Draft`}
                        </span>
                        {lot.status === 'Active' && <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full border border-green-200">ใช้งาน</span>}
                        {lot.status === 'Depleted' && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full border border-gray-200">หมด</span>}
                        {lot.status === 'Expired' && <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full border border-red-200">หมดอายุ</span>}
                      </h4>
                      <div className="flex space-x-2">
                        {lot.id && (
                          <button
                            onClick={() => handleDeleteLot(lot.id!)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="ลบ Lot"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                        <button
                          onClick={() => removeLot(originalIndex)}
                          className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                          title="ปิด/ยกเลิกการแก้ไข"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center">
                          <Package size={14} className="mr-1" />
                          Lot Number
                        </label>
                        <input
                          type="text"
                          value={lot.lot_number}
                          onChange={(e) => updateLot(originalIndex, 'lot_number', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                          placeholder="เช่น LOT-2024-001"
                          disabled={!!lot.id}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">คลังสินค้า</label>
                        <select
                          value={lot.warehouse_id}
                          onChange={(e) => updateLot(originalIndex, 'warehouse_id', parseInt(e.target.value))}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
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
                        <label className="block text-xs font-semibold text-gray-500 mb-1">จำนวนรับเข้า</label>
                        <input
                          type="number"
                          value={lot.quantity_received}
                          onChange={(e) => updateLot(originalIndex, 'quantity_received', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                          min="0"
                          disabled={!!lot.id}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center">
                          <Calendar size={14} className="mr-1" />
                          วันที่รับเข้า
                        </label>
                        <input
                          type="date"
                          value={lot.purchase_date}
                          onChange={(e) => updateLot(originalIndex, 'purchase_date', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                          disabled={!!lot.id}
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">วันหมดอายุ</label>
                        <input
                          type="date"
                          value={lot.expiry_date || ''}
                          onChange={(e) => updateLot(originalIndex, 'expiry_date', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center">
                          <DollarSign size={14} className="mr-1" />
                          ต้นทุนต่อหน่วย
                        </label>
                        <input
                          type="number"
                          value={lot.unit_cost}
                          onChange={(e) => updateLot(originalIndex, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                          min="0"
                          step="0.01"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">สถานะ</label>
                        <select
                          value={lot.status}
                          onChange={(e) => updateLot(originalIndex, 'status', e.target.value as 'Active' | 'Depleted' | 'Expired')}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                        >
                          <option value="Active">ใช้งาน</option>
                          <option value="Depleted">หมด</option>
                          <option value="Expired">หมดอายุ</option>
                        </select>
                      </div>

                      <div className="md:col-span-2 lg:col-span-3">
                        <label className="block text-xs font-semibold text-gray-500 mb-1 flex items-center">
                          <FileText size={14} className="mr-1" />
                          หมายเหตุ
                        </label>
                        <textarea
                          value={lot.notes || ''}
                          onChange={(e) => updateLot(originalIndex, 'notes', e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors"
                          rows={2}
                          placeholder="หมายเหตุเพิ่มเติม..."
                        />
                      </div>
                    </div>

                    {lot.id && (
                      <div className="mt-4 pt-3 border-t border-gray-100 bg-blue-50/50 -mx-5 -mb-5 p-3 rounded-b-xl flex items-center justify-between">
                        <div className="flex gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 text-xs">คงเหลือ:</span>
                            <span className="font-bold ml-2 text-blue-700 text-lg">{lot.quantity_remaining}</span>
                          </div>
                          <div className="border-l border-gray-300 pl-4">
                            <span className="text-gray-500 text-xs">คลัง:</span>
                            <span className="font-medium ml-2 text-gray-700">{getWarehouseName(lot.warehouse_id)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <footer className="p-4 border-t bg-gray-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="bg-white border border-gray-300 text-gray-700 font-medium text-sm rounded-lg py-2.5 px-5 hover:bg-gray-50 shadow-sm transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-blue-600 text-white font-medium text-sm rounded-lg py-2.5 px-6 hover:bg-blue-700 disabled:opacity-50 shadow-sm transition-colors"
          >
            {loading ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
          </button>
        </footer>
      </div>
    </div>
  );
};

export default LotManagementModal;