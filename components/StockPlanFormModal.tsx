import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, CalendarDays, Loader2 } from 'lucide-react';
import { Product, User, UserRole } from '@/types';
import { createStockPlan, getStockPlan, updateStockPlan } from '@/services/api';
import ProductSearchSelect from '@/components/ProductSearchSelect';

interface ItemDraft {
  id?: number; // present only when editing an existing item
  product_id: number | '';
  planned_qty: number | '';
  // Scheduled but not yet received — still just a plan, so the row stays editable; changing the
  // product or removing the row throws that schedule away, which the UI warns about first.
  openScheduledQty?: number;
  // Confirmed / closed-short — goods that really moved. Floor for planned_qty, and the product
  // can't be swapped out from under them unless a Super Admin forces it.
  lockedQty?: number;
  lockedCount?: number;
}

interface StockPlanFormModalProps {
  plannedDate?: string | null; // preset date when opened from a calendar day click (create mode)
  editPlanId?: number; // when set, loads and edits this plan instead of creating a new one
  products: Product[];
  companyId?: number;
  currentUser?: User;
  onClose: () => void;
  onSaved: () => void;
}

const StockPlanFormModal: React.FC<StockPlanFormModalProps> = ({ plannedDate, editPlanId, products, companyId, currentUser, onClose, onSaved }) => {
  const isEdit = !!editPlanId;
  const isSuperAdmin = currentUser?.role === UserRole.SuperAdmin;
  const [planDate, setPlanDate] = useState(plannedDate ?? new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([{ product_id: '', planned_qty: '' }]);
  // สำเนาตอนโหลด — ใช้เทียบว่าผู้ใช้ "แตะ" รายการที่รับเข้าจริงไปแล้วจริงหรือเปล่า
  const [originalItems, setOriginalItems] = useState<ItemDraft[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editPlanId) return;
    let mounted = true;
    setLoading(true);
    getStockPlan(editPlanId)
      .then((res: any) => {
        if (!mounted || !res?.success) return;
        setPlanDate(res.plan.planned_date);
        setNotes(res.plan.notes || '');
        const loaded: ItemDraft[] = (res.items || []).map((it: any) => ({
          id: it.id,
          product_id: it.product_id,
          planned_qty: it.planned_qty,
          openScheduledQty: it.open_scheduled_qty || 0,
          lockedQty: it.locked_qty || 0,
          lockedCount: it.locked_count || 0,
        }));
        setItems(loaded);
        setOriginalItems(loaded);
      })
      .catch((err: any) => {
        if (mounted) setError(err?.data?.error || err?.message || 'โหลดข้อมูลแพลนไม่สำเร็จ');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [editPlanId]);

  const addItemRow = () => setItems(prev => [...prev, { product_id: '', planned_qty: '' }]);

  const removeItemRow = (index: number) => {
    const row = items[index];
    if (row?.openScheduledQty) {
      const name = products.find(p => p.id === row.product_id)?.name ?? `สินค้า #${row.product_id}`;
      if (!confirm(`"${name}" กำหนดวันที่คาดว่าจะเข้าไว้แล้ว ${row.openScheduledQty} หน่วย\n\nลบรายการนี้ = ยกเลิกวันที่ที่กำหนดไว้ทั้งหมดด้วย ยืนยันหรือไม่?`)) return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItemField = (index: number, field: 'product_id' | 'planned_qty', value: any) => {
    setItems(prev => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  // แตะรายการที่ยืนยันรับเข้าจริงไปแล้วหรือเปล่า (เปลี่ยนสินค้า / ลบทิ้ง / ลดจำนวนต่ำกว่าที่รับจริง)
  // = แก้ประวัติของที่เข้าคลังจริง ต้องส่ง force และเซิร์ฟเวอร์ยอมเฉพาะ Super Admin
  // แค่ "มี" รายการที่รับเข้าแล้วอยู่ในแพลนไม่นับ — ไม่งั้น Super Admin จะไม่เหลือด่านกันพลาดเลย
  const touchesReceivedHistory = useMemo(() => {
    const current = new Map(items.filter(row => row.id).map(row => [row.id!, row]));
    return originalItems.some(orig => {
      if (!orig.id || !(orig.lockedCount ?? 0)) return false;
      const row = current.get(orig.id);
      if (!row) return true; // ลบทิ้ง
      if (Number(row.product_id) !== Number(orig.product_id)) return true; // เปลี่ยนสินค้า
      return Number(row.planned_qty || 0) < (orig.lockedQty ?? 0); // ลดต่ำกว่ายอดที่รับจริง
    });
  }, [items, originalItems]);

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
    const belowReceived = items.find(row => row.lockedQty && Number(row.planned_qty) < row.lockedQty);
    if (belowReceived && !isSuperAdmin) {
      setError(`จำนวนต้องไม่ต่ำกว่ายอดที่ยืนยันรับเข้าจริงไปแล้ว (${belowReceived.lockedQty})`);
      return;
    }
    if (touchesReceivedHistory && !confirm('แพลนนี้มีสินค้าที่ยืนยันรับเข้าจริงไปแล้ว และการแก้ครั้งนี้จะทับประวัติของที่เข้าคลังจริง\n\nยืนยันหรือไม่?')) {
      return;
    }

    setSaving(true);
    try {
      const itemPayload = items.map(row => ({
        ...(row.id ? { id: row.id } : {}),
        product_id: Number(row.product_id),
        planned_qty: Number(row.planned_qty),
      }));

      if (isEdit && editPlanId) {
        await updateStockPlan({
          id: editPlanId,
          planned_date: planDate,
          notes,
          user_id: currentUser?.id,
          force: touchesReceivedHistory,
          items: itemPayload,
        });
      } else {
        await createStockPlan({
          company_id: companyId,
          planned_date: planDate,
          notes,
          user_id: currentUser?.id,
          items: itemPayload,
        });
      }
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
            {isEdit ? 'แก้ไขแพลนรับสินค้า' : `เพิ่มแพลนรับสินค้า · ${planDate}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200">
            <X size={20} />
          </button>
        </header>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-3 mx-4 mt-4 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-10 text-gray-400">
            <Loader2 className="animate-spin mr-2" size={18} /> กำลังโหลดข้อมูลแพลน...
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ overflowX: 'hidden' }}>
            {isEdit && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">วันที่แพลน</label>
                <input
                  type="date"
                  value={planDate}
                  onChange={e => setPlanDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            )}

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
                {items.map((row, index) => {
                  const product = products.find(p => p.id === row.product_id);
                  const received = row.lockedCount ?? 0;
                  // รายการที่รับเข้าจริงแล้วล็อกไว้ ยกเว้น Super Admin ที่แก้ทับได้ (ส่ง force ไปให้เซิร์ฟเวอร์)
                  const locked = received > 0 && !isSuperAdmin;
                  return (
                    <div key={row.id ?? `new-${index}`} className="border rounded-lg p-2 bg-white" style={{ width: '100%', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
                        <div style={{ flex: '1 1 0%', minWidth: 0 }}>
                          {locked ? (
                            <div className="px-2 py-1.5 text-sm text-gray-600 bg-gray-50 rounded-lg border border-dashed" title="ยืนยันรับเข้าจริงไปแล้ว เปลี่ยนสินค้าไม่ได้">
                              {product?.name || `สินค้า #${row.product_id}`}
                            </div>
                          ) : (
                            <ProductSearchSelect
                              products={products}
                              value={row.product_id}
                              onChange={pid => updateItemField(index, 'product_id', pid)}
                            />
                          )}
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
                        {items.length > 1 && !locked && (
                          <button onClick={() => removeItemRow(index)} className="text-gray-400 hover:text-red-600 p-1" style={{ flex: '0 0 auto' }}>
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                      {received > 0 && (
                        <p className={`text-[11px] mt-1 ${isSuperAdmin ? 'text-red-600' : 'text-gray-500'}`}>
                          {isSuperAdmin
                            ? `ยืนยันรับเข้าจริงไปแล้ว ${row.lockedQty} หน่วย — แก้ได้เพราะเป็น Super Admin แต่จะทับประวัติของที่รับเข้าจริง`
                            : `ยืนยันรับเข้าจริงไปแล้ว ${row.lockedQty} หน่วย — เปลี่ยนสินค้า/ลบทิ้งไม่ได้ และจำนวนต้องไม่ต่ำกว่านี้`}
                        </p>
                      )}
                      {row.openScheduledQty ? (
                        <p className="text-[11px] text-amber-600 mt-1">
                          กำหนดวันที่คาดว่าจะเข้าไว้แล้ว {row.openScheduledQty} หน่วย — เปลี่ยนสินค้าแล้ววันที่เดิมจะย้ายตามไปเป็นของสินค้าใหม่ / ลบรายการนี้จะยกเลิกวันที่ที่กำหนดไว้ด้วย
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <footer className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="bg-white border border-gray-300 text-gray-700 font-medium text-sm rounded-lg py-2.5 px-5 hover:bg-gray-50">
            ยกเลิก
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
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
