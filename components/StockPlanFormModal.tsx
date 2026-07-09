import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, CalendarDays } from 'lucide-react';
import { Product, User } from '@/types';
import { createStockPlan } from '@/services/api';
import ProductSearchSelect from '@/components/ProductSearchSelect';

interface ItemDraft {
  product_id: number | '';
  planned_qty: number | '';
}

interface StockPlanFormModalProps {
  plannedDate?: string | null; // preset date when opened from a calendar day click
  products: Product[];
  companyId?: number;
  currentUser?: User;
  onClose: () => void;
  onSaved: () => void;
}

const StockPlanFormModal: React.FC<StockPlanFormModalProps> = ({ plannedDate, products, companyId, currentUser, onClose, onSaved }) => {
  const initialDate = plannedDate ?? new Date().toISOString().slice(0, 10);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([{ product_id: '', planned_qty: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addItemRow = () => setItems(prev => [...prev, { product_id: '', planned_qty: '' }]);
  const removeItemRow = (index: number) => setItems(prev => prev.filter((_, i) => i !== index));
  const updateItemField = (index: number, field: keyof ItemDraft, value: any) => {
    setItems(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const handleSave = async () => {
    setError(null);

    if (items.length === 0) {
      setError('ต้องมีสินค้าอย่างน้อย 1 รายการ');
      return;
    }
    if (items.some(row => !row.product_id || !row.planned_qty || row.planned_qty <= 0)) {
      setError('กรุณาระบุสินค้าและจำนวนแพลนให้ครบทุกแถว (มากกว่า 0)');
      return;
    }

    setSaving(true);
    try {
      await createStockPlan({
        company_id: companyId,
        planned_date: initialDate,
        notes,
        user_id: currentUser?.id,
        items: items.map(row => ({
          product_id: Number(row.product_id),
          planned_qty: Number(row.planned_qty),
        })),
      });
      onSaved();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" style={{ overflowX: 'hidden' }}>
        <header className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <CalendarDays className="text-blue-600" size={20} />
            เพิ่มแพลนรับสินค้า · {initialDate}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200">
            <X size={20} />
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-4 mt-4 text-sm text-red-700">{error}</div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ overflowX: 'hidden' }}>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">หมายเหตุ</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-700">รายการสินค้า</h3>
              <button onClick={addItemRow} className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Plus size={15} /> เพิ่มรายการสินค้า
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-2">ระบุแค่สินค้าและจำนวนแพลนรวม — เลข SO และวันที่คาดว่าจะเข้าจริงจะไปกำหนดทีหลังโดยผู้ดูแลคลังตอนเปิด SO จริง</p>

            <div className="space-y-2">
              {items.map((row, index) => (
                <div key={index} className="border rounded-lg p-2 bg-white" style={{ width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                    <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                      <ProductSearchSelect
                        products={products}
                        value={row.product_id}
                        onChange={pid => updateItemField(index, 'product_id', pid)}
                      />
                    </div>
                    <div style={{ flex: '0 0 110px' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={row.planned_qty}
                        onChange={e => {
                          const digits = e.target.value.replace(/\D/g, '');
                          updateItemField(index, 'planned_qty', digits === '' ? '' : parseInt(digits, 10));
                        }}
                        className="border rounded-lg px-2 py-1.5 text-sm"
                        style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
                        placeholder="จำนวน"
                      />
                    </div>
                    {items.length > 1 && (
                      <button onClick={() => removeItemRow(index)} className="text-gray-400 hover:text-red-600 p-1" style={{ flex: '0 0 auto' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="bg-white border border-gray-300 text-gray-700 font-medium text-sm rounded-lg py-2.5 px-5 hover:bg-gray-50">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white font-medium text-sm rounded-lg py-2.5 px-6 hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'กำลังบันทึก...' : 'บันทึก'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default StockPlanFormModal;
