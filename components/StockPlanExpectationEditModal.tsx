import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Pencil, Trash2 } from 'lucide-react';
import { User } from '@/types';
import { updateStockPlanExpectation, deleteStockPlanExpectation } from '@/services/api';
import { StockPlanExpectation, thaiDate } from '@/components/StockArrivalPlanning/types';

interface StockPlanExpectationEditModalProps {
  expectation: StockPlanExpectation;
  currentUser?: User;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * แก้ไข "คาดว่าจะเข้า" ของสินค้ารายการเดียว โดยไม่ต้องแตะทั้งแพลน
 * ใช้เลื่อนวัน / แก้จำนวน / แก้เลข SO — หรือยกเลิกวันที่กำหนดไว้ให้กลับไปรอกำหนดใหม่
 *
 * เปิดได้เฉพาะแถวที่ยังเป็น "คาดว่าจะเข้า" (เซิร์ฟเวอร์บังคับซ้ำใน update/delete_stock_plan_expectation.php)
 */
const StockPlanExpectationEditModal: React.FC<StockPlanExpectationEditModalProps> = ({ expectation, currentUser, onClose, onSaved }) => {
  const [expectedDate, setExpectedDate] = useState(expectation.expected_date.slice(0, 10));
  const [expectedQty, setExpectedQty] = useState<number | ''>(expectation.expected_qty);
  const [soNumber, setSoNumber] = useState(expectation.so_number ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const originalDate = expectation.expected_date.slice(0, 10);
  const isMoved = expectedDate !== originalDate;

  const handleSave = async () => {
    setError(null);
    if (!expectedDate) {
      setError('กรุณาระบุวันที่คาดว่าจะเข้า');
      return;
    }
    if (!expectedQty || expectedQty <= 0) {
      setError('จำนวนต้องมากกว่า 0');
      return;
    }

    setSaving(true);
    try {
      await updateStockPlanExpectation({
        id: expectation.id,
        expected_qty: Number(expectedQty),
        expected_date: expectedDate,
        so_number: soNumber || undefined,
        user_id: currentUser?.id,
      });
      onSaved();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`ยกเลิกวันที่คาดว่าจะเข้าของ "${expectation.item.product_name ?? expectation.item.sku}" (${expectation.expected_qty} หน่วย)?\n\nจำนวนจะกลับไปรอกำหนดวันใหม่ ยอดแพลนไม่หาย`)) return;
    setError(null);
    setSaving(true);
    try {
      await deleteStockPlanExpectation(expectation.id, currentUser?.id);
      onSaved();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || 'ยกเลิกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col">
        <header className="flex justify-between items-center p-4 border-b bg-gray-50">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Pencil className="text-blue-600" size={18} />
            แก้ไขรายการสินค้า
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-200">
            <X size={20} />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <div className="font-medium text-gray-800">{expectation.item.sku} {expectation.item.product_name}</div>
            <div className="text-gray-500">
              แพลน #{expectation.plan.id} · วันที่แพลน {thaiDate(expectation.plan.planned_date)} · ยอดแพลนรวม {expectation.item.planned_qty}
            </div>
          </div>

          {error && <div className="bg-red-50 border-l-4 border-red-400 p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">เลข SO (ถ้ามี)</label>
            <input
              type="text"
              value={soNumber}
              onChange={e => setSoNumber(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="เลข SO ที่เปิดไว้"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">วันที่คาดว่าจะเข้า</label>
              <input
                type="date"
                value={expectedDate}
                onChange={e => setExpectedDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">จำนวน</label>
              <input
                type="text"
                inputMode="numeric"
                value={expectedQty}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '');
                  setExpectedQty(digits === '' ? '' : parseInt(digits, 10));
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          {isMoved && (
            <p className="text-xs text-orange-600 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              เลื่อนจาก {thaiDate(originalDate)} ไป {thaiDate(expectedDate)} — รายการจะย้ายไปแสดงที่วันใหม่วันเดียว ไม่ค้างไว้วันเดิม
            </p>
          )}
        </div>

        <footer className="p-4 border-t bg-gray-50 flex justify-between gap-3">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 font-medium text-sm rounded-lg py-2.5 px-4 flex items-center gap-1.5 disabled:opacity-50"
          >
            <Trash2 size={15} /> ยกเลิกวันที่
          </button>
          <div className="flex gap-3">
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
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};

export default StockPlanExpectationEditModal;
